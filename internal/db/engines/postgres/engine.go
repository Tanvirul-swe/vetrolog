package postgres

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"vetrolog/internal/db/types"
)

// Engine implements db.DatabaseEngine for PostgreSQL
type Engine struct {
	pool       *pgxpool.Pool
	config     types.ConnectionConfig
	versionStr string
}

// NewEngine creates an uninitialized PostgreSQL engine
func NewEngine() *Engine {
	return &Engine{}
}

func (e *Engine) Type() types.EngineType {
	return types.EnginePostgres
}

func (e *Engine) Connect(ctx context.Context, cfg types.ConnectionConfig) error {
	e.config = cfg

	sslMode := cfg.SSLMode
	if sslMode == "" {
		sslMode = "disable"
	}

	host := cfg.Host
	port := cfg.Port
	if port <= 0 {
		port = 5432
	}

	database := cfg.Database
	if database == "" {
		database = "postgres"
	}

	connStr := fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s?sslmode=%s",
		url.QueryEscape(cfg.User),
		url.QueryEscape(cfg.Password),
		host,
		port,
		database,
		sslMode,
	)

	poolConfig, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		return fmt.Errorf("invalid postgres connection config: %w", err)
	}

	poolConfig.MaxConns = 10
	poolConfig.MinConns = 1
	poolConfig.MaxConnLifetime = 30 * time.Minute
	poolConfig.MaxConnIdleTime = 5 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return fmt.Errorf("postgres connection failed: %w", err)
	}

	e.pool = pool

	// Test connection and obtain server version
	var v string
	err = e.pool.QueryRow(ctx, "SHOW server_version;").Scan(&v)
	if err == nil {
		e.versionStr = "PostgreSQL " + v
	}

	return nil
}

func (e *Engine) Close() error {
	if e.pool != nil {
		e.pool.Close()
		e.pool = nil
	}
	return nil
}

func (e *Engine) Ping(ctx context.Context) (time.Duration, error) {
	if e.pool == nil {
		return 0, fmt.Errorf("engine not connected")
	}
	start := time.Now()
	err := e.pool.Ping(ctx)
	return time.Since(start), err
}

func (e *Engine) ServerVersion(ctx context.Context) string {
	if e.versionStr != "" {
		return e.versionStr
	}
	if e.pool != nil {
		var v string
		if err := e.pool.QueryRow(ctx, "SHOW server_version;").Scan(&v); err == nil {
			e.versionStr = "PostgreSQL " + v
		}
	}
	return e.versionStr
}

func (e *Engine) ListDatabases(ctx context.Context) ([]string, error) {
	if e.pool == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	rows, err := e.pool.Query(ctx, "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname;")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var dbs []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err == nil {
			dbs = append(dbs, name)
		}
	}
	return dbs, nil
}

func (e *Engine) ListSchemas(ctx context.Context, _ string) ([]string, error) {
	if e.pool == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	query := `SELECT schema_name FROM information_schema.schemata 
			  WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
			    AND schema_name NOT LIKE 'pg_temp%'
			  ORDER BY schema_name;`

	rows, err := e.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var schemas []string
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err == nil {
			schemas = append(schemas, s)
		}
	}
	if len(schemas) == 0 {
		schemas = []string{"public"}
	}
	return schemas, nil
}

func (e *Engine) ListTables(ctx context.Context, _ string, schema string) ([]types.TableSummary, error) {
	if e.pool == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	if schema == "" {
		schema = "public"
	}

	query := `
		SELECT 
			t.table_name,
			t.table_type,
			COALESCE(c.reltuples::bigint, 0) AS estimated_rows,
			COALESCE(pg_total_relation_size(quote_ident(t.table_schema) || '.' || quote_ident(t.table_name)), 0) AS size_bytes
		FROM information_schema.tables t
		LEFT JOIN pg_class c ON c.relname = t.table_name
		LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.table_schema
		WHERE t.table_schema = $1
		ORDER BY t.table_name;
	`

	rows, err := e.pool.Query(ctx, query, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var summaries []types.TableSummary
	for rows.Next() {
		var name, tableType string
		var rowCount, sizeBytes int64
		if err := rows.Scan(&name, &tableType, &rowCount, &sizeBytes); err == nil {
			normalizedType := "table"
			if strings.Contains(strings.ToLower(tableType), "view") {
				normalizedType = "view"
			}
			summaries = append(summaries, types.TableSummary{
				Name:      name,
				Schema:    schema,
				Type:      normalizedType,
				RowCount:  rowCount,
				SizeBytes: sizeBytes,
			})
		}
	}
	return summaries, nil
}

func (e *Engine) GetTableSchema(ctx context.Context, _ string, schema string, table string) (*types.ExtendedTableSchema, error) {
	if e.pool == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	if schema == "" {
		schema = "public"
	}

	// 1. Fetch Columns
	colQuery := `
		SELECT 
			column_name,
			data_type,
			is_nullable,
			COALESCE(column_default, '')
		FROM information_schema.columns
		WHERE table_schema = $1 AND table_name = $2
		ORDER BY ordinal_position;
	`
	colRows, err := e.pool.Query(ctx, colQuery, schema, table)
	if err != nil {
		return nil, err
	}
	defer colRows.Close()

	var columns []types.ColumnInfo
	for colRows.Next() {
		var name, dtype, isNullable, defVal string
		if err := colRows.Scan(&name, &dtype, &isNullable, &defVal); err == nil {
			columns = append(columns, types.ColumnInfo{
				Name:         name,
				Type:         dtype,
				IsNullable:   strings.ToUpper(isNullable) == "YES",
				DefaultValue: defVal,
			})
		}
	}

	// 2. Fetch Primary Keys
	pkQuery := `
		SELECT kcu.column_name
		FROM information_schema.table_constraints tc
		JOIN information_schema.key_column_usage kcu 
			ON tc.constraint_name = kcu.constraint_name 
			AND tc.table_schema = kcu.table_schema
		WHERE tc.constraint_type = 'PRIMARY KEY'
		  AND tc.table_schema = $1 AND tc.table_name = $2;
	`
	pkRows, err := e.pool.Query(ctx, pkQuery, schema, table)
	var pks []string
	if err == nil {
		defer pkRows.Close()
		for pkRows.Next() {
			var pkCol string
			if err := pkRows.Scan(&pkCol); err == nil {
				pks = append(pks, pkCol)
				for i := range columns {
					if columns[i].Name == pkCol {
						columns[i].IsPrimaryKey = true
					}
				}
			}
		}
	}

	// 3. Fetch Indexes
	idxQuery := `
		SELECT 
			indexname, 
			indexdef
		FROM pg_indexes 
		WHERE schemaname = $1 AND tablename = $2;
	`
	idxRows, err := e.pool.Query(ctx, idxQuery, schema, table)
	var indexes []types.IndexInfo
	if err == nil {
		defer idxRows.Close()
		for idxRows.Next() {
			var idxName, idxDef string
			if err := idxRows.Scan(&idxName, &idxDef); err == nil {
				isUnique := strings.Contains(strings.ToUpper(idxDef), "UNIQUE")
				var cols []string
				if openIdx := strings.LastIndex(idxDef, "("); openIdx != -1 {
					if closeIdx := strings.LastIndex(idxDef, ")"); closeIdx > openIdx {
						rawCols := idxDef[openIdx+1 : closeIdx]
						for _, c := range strings.Split(rawCols, ",") {
							trimmed := strings.Trim(strings.TrimSpace(c), "\"")
							if trimmed != "" {
								cols = append(cols, trimmed)
							}
						}
					}
				}
				indexes = append(indexes, types.IndexInfo{
					Name:     idxName,
					Columns:  cols,
					IsUnique: isUnique,
					Type:     "BTREE",
				})
			}
		}
	}

	// 4. Fetch Foreign Keys
	var foreignKeys []types.ForeignKeyInfo
	fkQuery := `
		SELECT
			tc.constraint_name,
			kcu.column_name,
			ccu.table_name AS foreign_table_name,
			ccu.column_name AS foreign_column_name,
			COALESCE(rc.update_rule, 'NO ACTION'),
			COALESCE(rc.delete_rule, 'NO ACTION')
		FROM information_schema.table_constraints AS tc
		JOIN information_schema.key_column_usage AS kcu
			ON tc.constraint_name = kcu.constraint_name
			AND tc.table_schema = kcu.table_schema
		JOIN information_schema.constraint_column_usage AS ccu
			ON ccu.constraint_name = tc.constraint_name
			AND ccu.table_schema = tc.table_schema
		LEFT JOIN information_schema.referential_constraints AS rc
			ON rc.constraint_name = tc.constraint_name
		WHERE tc.constraint_type = 'FOREIGN KEY'
			AND tc.table_schema = $1
			AND tc.table_name = $2;
	`
	fkRows, err := e.pool.Query(ctx, fkQuery, schema, table)
	if err == nil {
		defer fkRows.Close()
		for fkRows.Next() {
			var cName, col, refTbl, refCol, onUpd, onDel string
			if err := fkRows.Scan(&cName, &col, &refTbl, &refCol, &onUpd, &onDel); err == nil {
				foreignKeys = append(foreignKeys, types.ForeignKeyInfo{
					ConstraintName: cName,
					Column:         col,
					RefTable:       refTbl,
					RefColumn:      refCol,
					OnUpdate:       onUpd,
					OnDelete:       onDel,
				})
			}
		}
	}

	// 5. Exact Row Count
	var exactCount int64
	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM "%s"."%s"`, schema, table)
	_ = e.pool.QueryRow(ctx, countQuery).Scan(&exactCount)

	return &types.ExtendedTableSchema{
		TableName:   table,
		Name:        table,
		Schema:      schema,
		Type:        "TABLE",
		Columns:     columns,
		PrimaryKeys: pks,
		Indexes:     indexes,
		ForeignKeys: foreignKeys,
		RowCount:    exactCount,
	}, nil
}

func (e *Engine) GetTableData(ctx context.Context, req types.TableDataRequest) (*types.TableDataResult, error) {
	if e.pool == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	schema := req.Schema
	if schema == "" {
		schema = "public"
	}

	start := time.Now()

	// 1. Columns and Schema metadata
	schemaInfo, err := e.GetTableSchema(ctx, "", schema, req.Table)
	if err != nil {
		return nil, err
	}

	limit := req.PageSize
	if limit <= 0 {
		limit = 50
	}
	offset := (req.Page - 1) * limit
	if offset < 0 {
		offset = 0
	}

	// Build query
	var query strings.Builder
	query.WriteString(fmt.Sprintf(`SELECT * FROM "%s"."%s"`, schema, req.Table))

	if req.Filter != "" {
		// Generic ILIKE search across text columns
		var filters []string
		for _, col := range schemaInfo.Columns {
			filters = append(filters, fmt.Sprintf(`CAST("%s" AS text) ILIKE '%%%s%%'`, col.Name, escapeSql(req.Filter)))
		}
		if len(filters) > 0 {
			query.WriteString(" WHERE " + strings.Join(filters, " OR "))
		}
	}

	if req.SortColumn != "" {
		sortDir := "ASC"
		if strings.ToUpper(req.SortDirection) == "DESC" {
			sortDir = "DESC"
		}
		query.WriteString(fmt.Sprintf(` ORDER BY "%s" %s`, req.SortColumn, sortDir))
	} else if len(schemaInfo.PrimaryKeys) > 0 {
		query.WriteString(fmt.Sprintf(` ORDER BY "%s" ASC`, schemaInfo.PrimaryKeys[0]))
	}

	query.WriteString(fmt.Sprintf(` LIMIT %d OFFSET %d;`, limit, offset))

	rows, err := e.pool.Query(ctx, query.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	fieldDescriptions := rows.FieldDescriptions()
	columns := make([]types.ColumnInfo, len(fieldDescriptions))
	for i, fd := range fieldDescriptions {
		colName := string(fd.Name)
		isPk := false
		for _, pk := range schemaInfo.PrimaryKeys {
			if pk == colName {
				isPk = true
				break
			}
		}
		columns[i] = types.ColumnInfo{
			Name:         colName,
			Type:         "text", // Postgres returns OID; formatted in scanner
			IsPrimaryKey: isPk,
		}
	}

	var dataRows []map[string]interface{}
	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			continue
		}
		rowMap := make(map[string]interface{})
		for i, fd := range fieldDescriptions {
			rowMap[string(fd.Name)] = values[i]
		}
		dataRows = append(dataRows, rowMap)
	}

	return &types.TableDataResult{
		TableName:  req.Table,
		Schema:     schema,
		Columns:    columns,
		Rows:       dataRows,
		TotalRows:  schemaInfo.RowCount,
		Page:       req.Page,
		PageSize:   limit,
		DurationMs: float64(time.Since(start).Microseconds()) / 1000.0,
	}, nil
}

func (e *Engine) ExecuteQuery(ctx context.Context, query string, maxRows int) (*types.QueryResult, error) {
	if e.pool == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	if maxRows <= 0 {
		maxRows = 1000
	}

	start := time.Now()
	trimmed := strings.TrimSpace(query)

	// Check if this is a SELECT or EXPLAIN statement
	isSelect := strings.HasPrefix(strings.ToUpper(trimmed), "SELECT") ||
		strings.HasPrefix(strings.ToUpper(trimmed), "WITH") ||
		strings.HasPrefix(strings.ToUpper(trimmed), "SHOW") ||
		strings.HasPrefix(strings.ToUpper(trimmed), "EXPLAIN")

	if !isSelect {
		tag, err := e.pool.Exec(ctx, query)
		duration := float64(time.Since(start).Microseconds()) / 1000.0
		if err != nil {
			return &types.QueryResult{
				Query:      query,
				Success:    false,
				Error:      err.Error(),
				DurationMs: duration,
			}, nil
		}
		return &types.QueryResult{
			Query:      query,
			Success:    true,
			Affected:   tag.RowsAffected(),
			DurationMs: duration,
		}, nil
	}

	rows, err := e.pool.Query(ctx, query)
	duration := float64(time.Since(start).Microseconds()) / 1000.0
	if err != nil {
		return &types.QueryResult{
			Query:      query,
			Success:    false,
			Error:      err.Error(),
			DurationMs: duration,
		}, nil
	}
	defer rows.Close()

	fieldDescriptions := rows.FieldDescriptions()
	columns := make([]types.ColumnInfo, len(fieldDescriptions))
	for i, fd := range fieldDescriptions {
		columns[i] = types.ColumnInfo{
			Name: string(fd.Name),
			Type: "text",
		}
	}

	var dataRows []map[string]interface{}
	for rows.Next() && len(dataRows) < maxRows {
		values, err := rows.Values()
		if err != nil {
			continue
		}
		rowMap := make(map[string]interface{})
		for i, fd := range fieldDescriptions {
			rowMap[string(fd.Name)] = values[i]
		}
		dataRows = append(dataRows, rowMap)
	}

	return &types.QueryResult{
		Query:      query,
		Columns:    columns,
		Rows:       dataRows,
		Affected:   int64(len(dataRows)),
		DurationMs: float64(time.Since(start).Microseconds()) / 1000.0,
		Success:    true,
	}, nil
}

func (e *Engine) ApplyPendingChanges(ctx context.Context, changes types.PendingChanges) (*types.ChangeResult, error) {
	if e.pool == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	if len(changes.Changes) == 0 {
		return &types.ChangeResult{Success: true, AffectedRows: 0}, nil
	}

	start := time.Now()

	tx, err := e.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	var generatedSQL strings.Builder
	var totalAffected int64

	for _, ch := range changes.Changes {
		schema := ch.Schema
		if schema == "" {
			schema = "public"
		}

		switch ch.Type {
		case types.ChangeUpdate:
			var setClauses []string
			var args []interface{}
			argIdx := 1

			for col, val := range ch.NewValues {
				setClauses = append(setClauses, fmt.Sprintf(`"%s" = $%d`, col, argIdx))
				args = append(args, val)
				argIdx++
			}

			var whereClauses []string
			for pkCol, pkVal := range ch.PrimaryKey {
				whereClauses = append(whereClauses, fmt.Sprintf(`"%s" = $%d`, pkCol, argIdx))
				args = append(args, pkVal)
				argIdx++
			}

			sql := fmt.Sprintf(`UPDATE "%s"."%s" SET %s WHERE %s;`, schema, ch.Table, strings.Join(setClauses, ", "), strings.Join(whereClauses, " AND "))
			generatedSQL.WriteString(sql + "\n")

			tag, err := tx.Exec(ctx, sql, args...)
			if err != nil {
				return &types.ChangeResult{
					Success:      false,
					GeneratedSQL: generatedSQL.String(),
					Error:        fmt.Sprintf("update error on %s: %v", ch.Table, err),
					DurationMs:   float64(time.Since(start).Microseconds()) / 1000.0,
				}, nil
			}
			totalAffected += tag.RowsAffected()

		case types.ChangeInsert:
			var cols []string
			var placeholders []string
			var args []interface{}
			argIdx := 1

			for col, val := range ch.NewValues {
				cols = append(cols, fmt.Sprintf(`"%s"`, col))
				placeholders = append(placeholders, fmt.Sprintf(`$%d`, argIdx))
				args = append(args, val)
				argIdx++
			}

			sql := fmt.Sprintf(`INSERT INTO "%s"."%s" (%s) VALUES (%s);`, schema, ch.Table, strings.Join(cols, ", "), strings.Join(placeholders, ", "))
			generatedSQL.WriteString(sql + "\n")

			tag, err := tx.Exec(ctx, sql, args...)
			if err != nil {
				return &types.ChangeResult{
					Success:      false,
					GeneratedSQL: generatedSQL.String(),
					Error:        fmt.Sprintf("insert error on %s: %v", ch.Table, err),
					DurationMs:   float64(time.Since(start).Microseconds()) / 1000.0,
				}, nil
			}
			totalAffected += tag.RowsAffected()

		case types.ChangeDelete:
			var whereClauses []string
			var args []interface{}
			argIdx := 1

			for pkCol, pkVal := range ch.PrimaryKey {
				whereClauses = append(whereClauses, fmt.Sprintf(`"%s" = $%d`, pkCol, argIdx))
				args = append(args, pkVal)
				argIdx++
			}

			sql := fmt.Sprintf(`DELETE FROM "%s"."%s" WHERE %s;`, schema, ch.Table, strings.Join(whereClauses, " AND "))
			generatedSQL.WriteString(sql + "\n")

			tag, err := tx.Exec(ctx, sql, args...)
			if err != nil {
				return &types.ChangeResult{
					Success:      false,
					GeneratedSQL: generatedSQL.String(),
					Error:        fmt.Sprintf("delete error on %s: %v", ch.Table, err),
					DurationMs:   float64(time.Since(start).Microseconds()) / 1000.0,
				}, nil
			}
			totalAffected += tag.RowsAffected()
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit failed: %w", err)
	}

	return &types.ChangeResult{
		Success:      true,
		AffectedRows: totalAffected,
		GeneratedSQL: generatedSQL.String(),
		DurationMs:   float64(time.Since(start).Microseconds()) / 1000.0,
	}, nil
}

func (e *Engine) ExplainQuery(ctx context.Context, query string) (*types.QueryPlanResult, error) {
	if e.pool == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	start := time.Now()
	explainSQL := fmt.Sprintf("EXPLAIN (COSTS, BUFFERS, VERBOSE, FORMAT TEXT) %s", query)

	rows, err := e.pool.Query(ctx, explainSQL)
	if err != nil {
		return &types.QueryPlanResult{
			Success:    false,
			Error:      err.Error(),
			DurationMs: float64(time.Since(start).Microseconds()) / 1000.0,
		}, nil
	}
	defer rows.Close()

	var lines []string
	for rows.Next() {
		var line string
		if err := rows.Scan(&line); err == nil {
			lines = append(lines, line)
		}
	}

	return &types.QueryPlanResult{
		RawPlan:    strings.Join(lines, "\n"),
		Success:    true,
		DurationMs: float64(time.Since(start).Microseconds()) / 1000.0,
	}, nil
}

func escapeSql(s string) string {
	return strings.ReplaceAll(s, "'", "''")
}

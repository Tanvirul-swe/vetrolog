package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"vetrolog/internal/db/types"
)

// Engine implements db.DatabaseEngine for MySQL and MariaDB
type Engine struct {
	dbInstance *sql.DB
	config     types.ConnectionConfig
	versionStr string
}

// NewEngine creates an uninitialized MySQL engine
func NewEngine() *Engine {
	return &Engine{}
}

func (e *Engine) Type() types.EngineType {
	return types.EngineMySQL
}

func (e *Engine) Connect(ctx context.Context, cfg types.ConnectionConfig) error {
	e.config = cfg

	host := cfg.Host
	port := cfg.Port
	if port <= 0 {
		port = 3306
	}

	database := cfg.Database

	tlsParam := "false"
	if cfg.SSLMode != "" && cfg.SSLMode != "disable" {
		tlsParam = "true"
	}

	// Format DSN: user:password@tcp(host:port)/dbname?charset=utf8mb4&parseTime=true&tls=false
	dsn := fmt.Sprintf(
		"%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local&tls=%s",
		cfg.User,
		cfg.Password,
		host,
		port,
		database,
		tlsParam,
	)

	conn, err := sql.Open("mysql", dsn)
	if err != nil {
		return fmt.Errorf("invalid mysql connection string: %w", err)
	}

	conn.SetMaxOpenConns(10)
	conn.SetMaxIdleConns(2)
	conn.SetConnMaxLifetime(30 * time.Minute)
	conn.SetConnMaxIdleTime(5 * time.Minute)

	if err := conn.PingContext(ctx); err != nil {
		_ = conn.Close()
		return fmt.Errorf("mysql connection failed: %w", err)
	}

	e.dbInstance = conn

	// Cache version
	var v string
	if err := e.dbInstance.QueryRowContext(ctx, "SELECT VERSION();").Scan(&v); err == nil {
		e.versionStr = "MySQL " + v
	}

	return nil
}

func (e *Engine) Close() error {
	if e.dbInstance != nil {
		err := e.dbInstance.Close()
		e.dbInstance = nil
		return err
	}
	return nil
}

func (e *Engine) Ping(ctx context.Context) (time.Duration, error) {
	if e.dbInstance == nil {
		return 0, fmt.Errorf("engine not connected")
	}
	start := time.Now()
	err := e.dbInstance.PingContext(ctx)
	return time.Since(start), err
}

func (e *Engine) ServerVersion(ctx context.Context) string {
	if e.versionStr != "" {
		return e.versionStr
	}
	if e.dbInstance != nil {
		var v string
		if err := e.dbInstance.QueryRowContext(ctx, "SELECT VERSION();").Scan(&v); err == nil {
			e.versionStr = "MySQL " + v
		}
	}
	return e.versionStr
}

func (e *Engine) ListDatabases(ctx context.Context) ([]string, error) {
	if e.dbInstance == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	rows, err := e.dbInstance.QueryContext(ctx, "SHOW DATABASES;")
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

func (e *Engine) ListSchemas(ctx context.Context, dbName string) ([]string, error) {
	// In MySQL, Schema is synonymous with Database
	if dbName != "" {
		return []string{dbName}, nil
	}
	return e.ListDatabases(ctx)
}

func (e *Engine) ListTables(ctx context.Context, dbName string, _ string) ([]types.TableSummary, error) {
	if e.dbInstance == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	if dbName == "" {
		dbName = e.config.Database
	}

	query := `
		SELECT 
			TABLE_NAME, 
			TABLE_TYPE, 
			COALESCE(TABLE_ROWS, 0), 
			COALESCE(DATA_LENGTH + INDEX_LENGTH, 0)
		FROM information_schema.TABLES
		WHERE TABLE_SCHEMA = ?
		ORDER BY TABLE_NAME;
	`

	rows, err := e.dbInstance.QueryContext(ctx, query, dbName)
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
				Schema:    dbName,
				Type:      normalizedType,
				RowCount:  rowCount,
				SizeBytes: sizeBytes,
			})
		}
	}
	return summaries, nil
}

func (e *Engine) GetTableSchema(ctx context.Context, dbName string, _ string, table string) (*types.ExtendedTableSchema, error) {
	if e.dbInstance == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	if dbName == "" {
		dbName = e.config.Database
	}

	// 1. Columns
	colQuery := `
		SELECT 
			COLUMN_NAME, 
			COLUMN_TYPE, 
			IS_NULLABLE, 
			COLUMN_KEY, 
			COALESCE(COLUMN_DEFAULT, ''), 
			EXTRA
		FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
		ORDER BY ORDINAL_POSITION;
	`

	colRows, err := e.dbInstance.QueryContext(ctx, colQuery, dbName, table)
	if err != nil {
		return nil, err
	}
	defer colRows.Close()

	var columns []types.ColumnInfo
	var pks []string

	for colRows.Next() {
		var name, colType, isNullable, colKey, defVal, extra string
		if err := colRows.Scan(&name, &colType, &isNullable, &colKey, &defVal, &extra); err == nil {
			isPk := colKey == "PRI"
			if isPk {
				pks = append(pks, name)
			}
			columns = append(columns, types.ColumnInfo{
				Name:         name,
				Type:         colType,
				IsPrimaryKey: isPk,
				IsNullable:   strings.ToUpper(isNullable) == "YES",
				DefaultValue: defVal,
				Extra:        extra,
			})
		}
	}

	// 2. Indexes
	idxQuery := fmt.Sprintf("SHOW INDEX FROM `%s`.`%s`;", dbName, table)
	idxRows, err := e.dbInstance.QueryContext(ctx, idxQuery)
	var indexes []types.IndexInfo
	if err == nil {
		defer idxRows.Close()
		indexMap := make(map[string]*types.IndexInfo)

		for idxRows.Next() {
			var table, nonUnique, keyName, seqInIndex, columnName, collation, cardinality, subPart, packed, null, indexType, comment, indexComment string
			// Scan flexible columns
			var vals = make([]interface{}, 13)
			for i := range vals {
				vals[i] = new(sql.RawBytes)
			}
			_ = idxRows.Scan(&table, &nonUnique, &keyName, &seqInIndex, &columnName, &collation, &cardinality, &subPart, &packed, &null, &indexType, &comment, &indexComment)

			if idx, ok := indexMap[keyName]; ok {
				idx.Columns = append(idx.Columns, columnName)
			} else {
				idx := &types.IndexInfo{
					Name:      keyName,
					Columns:   []string{columnName},
					IsUnique:  nonUnique == "0",
					IsPrimary: keyName == "PRIMARY",
					Type:      indexType,
				}
				indexMap[keyName] = idx
				indexes = append(indexes, *idx)
			}
		}
	}

	// 3. Foreign Keys
	var foreignKeys []types.ForeignKeyInfo
	fkQuery := `
		SELECT 
			constraint_name, 
			column_name, 
			referenced_table_name, 
			referenced_column_name 
		FROM information_schema.key_column_usage 
		WHERE table_schema = ? AND table_name = ? AND referenced_table_name IS NOT NULL;
	`
	fkRows, err := e.dbInstance.QueryContext(ctx, fkQuery, dbName, table)
	if err == nil {
		defer fkRows.Close()
		for fkRows.Next() {
			var cName, col, refTbl, refCol string
			if err := fkRows.Scan(&cName, &col, &refTbl, &refCol); err == nil {
				foreignKeys = append(foreignKeys, types.ForeignKeyInfo{
					ConstraintName: cName,
					Column:         col,
					RefTable:       refTbl,
					RefColumn:      refCol,
					OnUpdate:       "NO ACTION",
					OnDelete:       "NO ACTION",
				})
			}
		}
	}

	// 4. Exact Row Count
	var exactCount int64
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM `%s`.`%s`;", dbName, table)
	_ = e.dbInstance.QueryRowContext(ctx, countQuery).Scan(&exactCount)

	return &types.ExtendedTableSchema{
		TableName:   table,
		Name:        table,
		Schema:      dbName,
		Type:        "TABLE",
		Columns:     columns,
		PrimaryKeys: pks,
		Indexes:     indexes,
		ForeignKeys: foreignKeys,
		RowCount:    exactCount,
	}, nil
}

func (e *Engine) GetTableData(ctx context.Context, req types.TableDataRequest) (*types.TableDataResult, error) {
	if e.dbInstance == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	dbName := req.Schema
	if dbName == "" {
		dbName = e.config.Database
	}

	start := time.Now()

	schemaInfo, err := e.GetTableSchema(ctx, dbName, "", req.Table)
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

	var query strings.Builder
	query.WriteString(fmt.Sprintf("SELECT * FROM `%s`.`%s`", dbName, req.Table))

	if req.Filter != "" {
		var filters []string
		for _, col := range schemaInfo.Columns {
			filters = append(filters, fmt.Sprintf("`%s` LIKE '%%%s%%'", col.Name, escapeMySql(req.Filter)))
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
		query.WriteString(fmt.Sprintf(" ORDER BY `%s` %s", req.SortColumn, sortDir))
	} else if len(schemaInfo.PrimaryKeys) > 0 {
		query.WriteString(fmt.Sprintf(" ORDER BY `%s` ASC", schemaInfo.PrimaryKeys[0]))
	}

	query.WriteString(fmt.Sprintf(" LIMIT %d OFFSET %d;", limit, offset))

	rows, err := e.dbInstance.QueryContext(ctx, query.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	colTypes, err := rows.ColumnTypes()
	if err != nil {
		return nil, err
	}

	columns := make([]types.ColumnInfo, len(colTypes))
	for i, ct := range colTypes {
		colName := ct.Name()
		isPk := false
		for _, pk := range schemaInfo.PrimaryKeys {
			if pk == colName {
				isPk = true
				break
			}
		}
		columns[i] = types.ColumnInfo{
			Name:         colName,
			Type:         ct.DatabaseTypeName(),
			IsPrimaryKey: isPk,
		}
	}

	dataRows, err := scanRows(rows, colTypes)
	if err != nil {
		return nil, err
	}

	return &types.TableDataResult{
		TableName:  req.Table,
		Schema:     dbName,
		Columns:    columns,
		Rows:       dataRows,
		TotalRows:  schemaInfo.RowCount,
		Page:       req.Page,
		PageSize:   limit,
		DurationMs: float64(time.Since(start).Microseconds()) / 1000.0,
	}, nil
}

func (e *Engine) ExecuteQuery(ctx context.Context, query string, maxRows int) (*types.QueryResult, error) {
	if e.dbInstance == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	if maxRows <= 0 {
		maxRows = 1000
	}

	start := time.Now()
	trimmed := strings.TrimSpace(query)

	isSelect := strings.HasPrefix(strings.ToUpper(trimmed), "SELECT") ||
		strings.HasPrefix(strings.ToUpper(trimmed), "SHOW") ||
		strings.HasPrefix(strings.ToUpper(trimmed), "DESCRIBE") ||
		strings.HasPrefix(strings.ToUpper(trimmed), "EXPLAIN")

	if !isSelect {
		res, err := e.dbInstance.ExecContext(ctx, query)
		duration := float64(time.Since(start).Microseconds()) / 1000.0
		if err != nil {
			return &types.QueryResult{
				Query:      query,
				Success:    false,
				Error:      err.Error(),
				DurationMs: duration,
			}, nil
		}
		affected, _ := res.RowsAffected()
		return &types.QueryResult{
			Query:      query,
			Success:    true,
			Affected:   affected,
			DurationMs: duration,
		}, nil
	}

	rows, err := e.dbInstance.QueryContext(ctx, query)
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

	colTypes, err := rows.ColumnTypes()
	if err != nil {
		return nil, err
	}

	columns := make([]types.ColumnInfo, len(colTypes))
	for i, ct := range colTypes {
		columns[i] = types.ColumnInfo{
			Name: ct.Name(),
			Type: ct.DatabaseTypeName(),
		}
	}

	dataRows, err := scanRows(rows, colTypes)
	if err != nil {
		return nil, err
	}

	if len(dataRows) > maxRows {
		dataRows = dataRows[:maxRows]
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
	if e.dbInstance == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	if len(changes.Changes) == 0 {
		return &types.ChangeResult{Success: true, AffectedRows: 0}, nil
	}

	start := time.Now()

	tx, err := e.dbInstance.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	var generatedSQL strings.Builder
	var totalAffected int64

	for _, ch := range changes.Changes {
		dbName := ch.Schema
		if dbName == "" {
			dbName = e.config.Database
		}

		switch ch.Type {
		case types.ChangeUpdate:
			var setClauses []string
			var args []interface{}

			for col, val := range ch.NewValues {
				setClauses = append(setClauses, fmt.Sprintf("`%s` = ?", col))
				args = append(args, val)
			}

			var whereClauses []string
			for pkCol, pkVal := range ch.PrimaryKey {
				whereClauses = append(whereClauses, fmt.Sprintf("`%s` = ?", pkCol))
				args = append(args, pkVal)
			}

			sqlStr := fmt.Sprintf("UPDATE `%s`.`%s` SET %s WHERE %s;", dbName, ch.Table, strings.Join(setClauses, ", "), strings.Join(whereClauses, " AND "))
			generatedSQL.WriteString(sqlStr + "\n")

			res, err := tx.ExecContext(ctx, sqlStr, args...)
			if err != nil {
				return &types.ChangeResult{
					Success:      false,
					GeneratedSQL: generatedSQL.String(),
					Error:        fmt.Sprintf("update error on %s: %v", ch.Table, err),
					DurationMs:   float64(time.Since(start).Microseconds()) / 1000.0,
				}, nil
			}
			aff, _ := res.RowsAffected()
			totalAffected += aff

		case types.ChangeInsert:
			var cols []string
			var placeholders []string
			var args []interface{}

			for col, val := range ch.NewValues {
				cols = append(cols, fmt.Sprintf("`%s`", col))
				placeholders = append(placeholders, "?")
				args = append(args, val)
			}

			sqlStr := fmt.Sprintf("INSERT INTO `%s`.`%s` (%s) VALUES (%s);", dbName, ch.Table, strings.Join(cols, ", "), strings.Join(placeholders, ", "))
			generatedSQL.WriteString(sqlStr + "\n")

			res, err := tx.ExecContext(ctx, sqlStr, args...)
			if err != nil {
				return &types.ChangeResult{
					Success:      false,
					GeneratedSQL: generatedSQL.String(),
					Error:        fmt.Sprintf("insert error on %s: %v", ch.Table, err),
					DurationMs:   float64(time.Since(start).Microseconds()) / 1000.0,
				}, nil
			}
			aff, _ := res.RowsAffected()
			totalAffected += aff

		case types.ChangeDelete:
			var whereClauses []string
			var args []interface{}

			for pkCol, pkVal := range ch.PrimaryKey {
				whereClauses = append(whereClauses, fmt.Sprintf("`%s` = ?", pkCol))
				args = append(args, pkVal)
			}

			sqlStr := fmt.Sprintf("DELETE FROM `%s`.`%s` WHERE %s;", dbName, ch.Table, strings.Join(whereClauses, " AND "))
			generatedSQL.WriteString(sqlStr + "\n")

			res, err := tx.ExecContext(ctx, sqlStr, args...)
			if err != nil {
				return &types.ChangeResult{
					Success:      false,
					GeneratedSQL: generatedSQL.String(),
					Error:        fmt.Sprintf("delete error on %s: %v", ch.Table, err),
					DurationMs:   float64(time.Since(start).Microseconds()) / 1000.0,
				}, nil
			}
			aff, _ := res.RowsAffected()
			totalAffected += aff
		}
	}

	if err := tx.Commit(); err != nil {
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
	if e.dbInstance == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	start := time.Now()
	explainSQL := fmt.Sprintf("EXPLAIN %s", query)

	rows, err := e.dbInstance.QueryContext(ctx, explainSQL)
	if err != nil {
		return &types.QueryPlanResult{
			Success:    false,
			Error:      err.Error(),
			DurationMs: float64(time.Since(start).Microseconds()) / 1000.0,
		}, nil
	}
	defer rows.Close()

	colTypes, _ := rows.ColumnTypes()
	dataRows, err := scanRows(rows, colTypes)
	if err != nil {
		return nil, err
	}

	var sb strings.Builder
	for _, row := range dataRows {
		for k, v := range row {
			sb.WriteString(fmt.Sprintf("%s: %v  ", k, v))
		}
		sb.WriteString("\n")
	}

	return &types.QueryPlanResult{
		RawPlan:    sb.String(),
		Nodes:      dataRows,
		Success:    true,
		DurationMs: float64(time.Since(start).Microseconds()) / 1000.0,
	}, nil
}

func scanRows(rows *sql.Rows, colTypes []*sql.ColumnType) ([]map[string]interface{}, error) {
	var results []map[string]interface{}
	colNames := make([]string, len(colTypes))
	for i, ct := range colTypes {
		colNames[i] = ct.Name()
	}

	for rows.Next() {
		columns := make([]interface{}, len(colNames))
		columnPointers := make([]interface{}, len(colNames))
		for i := range columns {
			columnPointers[i] = &columns[i]
		}

		if err := rows.Scan(columnPointers...); err != nil {
			return nil, err
		}

		rowMap := make(map[string]interface{})
		for i, colName := range colNames {
			val := columns[i]
			if b, ok := val.([]byte); ok {
				rowMap[colName] = string(b)
			} else {
				rowMap[colName] = val
			}
		}
		results = append(results, rowMap)
	}
	return results, nil
}

func escapeMySql(s string) string {
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, "'", "\\'")
	return s
}

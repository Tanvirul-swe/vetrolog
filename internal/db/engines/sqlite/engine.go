package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	_ "modernc.org/sqlite"
	"vetrolog/internal/db/types"
)

var limitRegex = regexp.MustCompile(`(?i)\bLIMIT\s+\d+`)

// Engine implements types.DatabaseEngine for local SQLite files
type Engine struct {
	dbInstance *sql.DB
	config     types.ConnectionConfig
	versionStr string
}

// NewEngine creates an uninitialized SQLite file engine
func NewEngine() *Engine {
	return &Engine{}
}

func (e *Engine) Type() types.EngineType {
	return types.EngineSQLite
}

func (e *Engine) Connect(ctx context.Context, cfg types.ConnectionConfig) error {
	e.config = cfg

	filePath := cfg.FilePath
	if filePath == "" {
		filePath = cfg.Database
	}

	if _, err := os.Stat(filePath); err != nil {
		return fmt.Errorf("sqlite file not found: %s", filePath)
	}

	conn, err := sql.Open("sqlite", filePath)
	if err != nil {
		return fmt.Errorf("failed to open sqlite database: %w", err)
	}

	conn.SetMaxOpenConns(4)
	conn.SetMaxIdleConns(4)

	pragmas := []string{
		"PRAGMA journal_mode = WAL;",
		"PRAGMA synchronous = NORMAL;",
		"PRAGMA foreign_keys = ON;",
		"PRAGMA busy_timeout = 5000;",
	}
	for _, p := range pragmas {
		_, _ = conn.ExecContext(ctx, p)
	}

	if err := conn.PingContext(ctx); err != nil {
		_ = conn.Close()
		return fmt.Errorf("failed to ping sqlite database: %w", err)
	}

	e.dbInstance = conn

	var v string
	if err := e.dbInstance.QueryRowContext(ctx, "SELECT sqlite_version();").Scan(&v); err == nil {
		e.versionStr = "SQLite " + v
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
		if err := e.dbInstance.QueryRowContext(ctx, "SELECT sqlite_version();").Scan(&v); err == nil {
			e.versionStr = "SQLite " + v
		}
	}
	return e.versionStr
}

func (e *Engine) ListDatabases(_ context.Context) ([]string, error) {
	name := filepath.Base(e.config.FilePath)
	if name == "" {
		name = "main"
	}
	return []string{name}, nil
}

func (e *Engine) ListSchemas(_ context.Context, _ string) ([]string, error) {
	return []string{"main"}, nil
}

func (e *Engine) ListTables(ctx context.Context, _ string, _ string) ([]types.TableSummary, error) {
	if e.dbInstance == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	query := `
		SELECT name, type 
		FROM sqlite_master 
		WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
		ORDER BY name;
	`

	rows, err := e.dbInstance.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var summaries []types.TableSummary
	for rows.Next() {
		var name, tableType string
		if err := rows.Scan(&name, &tableType); err == nil {
			var rowCount int64
			_ = e.dbInstance.QueryRowContext(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM "%s"`, name)).Scan(&rowCount)

			// Populate columns via PRAGMA table_info
			var cols []types.ColumnInfo
			if colRows, colErr := e.dbInstance.QueryContext(ctx, fmt.Sprintf(`PRAGMA table_info("%s");`, name)); colErr == nil {
				for colRows.Next() {
					var cid, notnull, pk int
					var cName, colType string
					var dfltValue sql.NullString
					if err := colRows.Scan(&cid, &cName, &colType, &notnull, &dfltValue, &pk); err == nil {
						cols = append(cols, types.ColumnInfo{
							Name:         cName,
							Type:         colType,
							IsPrimaryKey: pk > 0,
							IsNullable:   notnull == 0,
							DefaultValue: dfltValue.String,
						})
					}
				}
				colRows.Close()
			}

			summaries = append(summaries, types.TableSummary{
				Name:     name,
				Schema:   "main",
				Type:     tableType,
				RowCount: rowCount,
				Columns:  cols,
			})
		}
	}
	return summaries, nil
}

func (e *Engine) GetTableSchema(ctx context.Context, _ string, _ string, table string) (*types.ExtendedTableSchema, error) {
	if e.dbInstance == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	// 1. Column info via PRAGMA table_info
	rows, err := e.dbInstance.QueryContext(ctx, fmt.Sprintf(`PRAGMA table_info("%s");`, table))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var columns []types.ColumnInfo
	var pks []string

	for rows.Next() {
		var cid, notnull, pk int
		var name, colType string
		var dfltValue sql.NullString
		if err := rows.Scan(&cid, &name, &colType, &notnull, &dfltValue, &pk); err == nil {
			isPk := pk > 0
			if isPk {
				pks = append(pks, name)
			}
			columns = append(columns, types.ColumnInfo{
				Name:         name,
				Type:         colType,
				IsPrimaryKey: isPk,
				IsNullable:   notnull == 0,
				DefaultValue: dfltValue.String,
			})
		}
	}

	// 2. Indexes via PRAGMA index_list
	var indexes []types.IndexInfo
	idxRows, err := e.dbInstance.QueryContext(ctx, fmt.Sprintf(`PRAGMA index_list("%s");`, table))
	if err == nil {
		defer idxRows.Close()
		for idxRows.Next() {
			var seq, unique int
			var idxName, origin, partial string
			if err := idxRows.Scan(&seq, &idxName, &unique, &origin, &partial); err == nil {
				// Get indexed columns
				var cols []string
				infoRows, err := e.dbInstance.QueryContext(ctx, fmt.Sprintf(`PRAGMA index_info("%s");`, idxName))
				if err == nil {
					for infoRows.Next() {
						var seqno, cid int
						var colName string
						if err := infoRows.Scan(&seqno, &cid, &colName); err == nil {
							cols = append(cols, colName)
						}
					}
					infoRows.Close()
				}

				indexes = append(indexes, types.IndexInfo{
					Name:      idxName,
					Columns:   cols,
					IsUnique:  unique == 1,
					IsPrimary: origin == "pk",
					Type:      "BTREE",
				})
			}
		}
	}

	// 3. Foreign Keys via PRAGMA foreign_key_list
	var foreignKeys []types.ForeignKeyInfo
	fkRows, err := e.dbInstance.QueryContext(ctx, fmt.Sprintf(`PRAGMA foreign_key_list("%s");`, table))
	if err == nil {
		defer fkRows.Close()
		for fkRows.Next() {
			var id, seq int
			var refTable, fromCol, toCol, onUpdate, onDelete, match string
			if err := fkRows.Scan(&id, &seq, &refTable, &fromCol, &toCol, &onUpdate, &onDelete, &match); err == nil {
				foreignKeys = append(foreignKeys, types.ForeignKeyInfo{
					ConstraintName: fmt.Sprintf("fk_%s_%d", table, id),
					Column:         fromCol,
					RefTable:       refTable,
					RefColumn:      toCol,
					OnUpdate:       onUpdate,
					OnDelete:       onDelete,
				})
			}
		}
	}

	var exactCount int64
	_ = e.dbInstance.QueryRowContext(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM "%s"`, table)).Scan(&exactCount)

	return &types.ExtendedTableSchema{
		TableName:   table,
		Name:        table,
		Schema:      "main",
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

	start := time.Now()

	schemaInfo, err := e.GetTableSchema(ctx, "", "", req.Table)
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
	query.WriteString(fmt.Sprintf(`SELECT * FROM "%s"`, req.Table))

	if req.Filter != "" {
		var filters []string
		for _, col := range schemaInfo.Columns {
			filters = append(filters, fmt.Sprintf(`CAST("%s" AS TEXT) LIKE '%%%s%%'`, col.Name, escapeSql(req.Filter)))
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
		Schema:     "main",
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
		strings.HasPrefix(strings.ToUpper(trimmed), "PRAGMA") ||
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

	queryToRun := query
	defaultLimitApplied := false

	// Apply safe default limit of 100 rows for SELECT queries lacking an explicit LIMIT
	if strings.HasPrefix(strings.ToUpper(trimmed), "SELECT") && !limitRegex.MatchString(trimmed) {
		cleanSQL := strings.TrimRight(trimmed, ";")
		queryToRun = fmt.Sprintf("SELECT * FROM (%s) LIMIT 100", cleanSQL)
		defaultLimitApplied = true
		maxRows = 100
	}

	rows, err := e.dbInstance.QueryContext(ctx, queryToRun)
	if err != nil && defaultLimitApplied {
		// Fallback to raw query if wrapped subquery has syntax limitations
		queryToRun = query
		rows, err = e.dbInstance.QueryContext(ctx, queryToRun)
	}
	duration := float64(time.Since(start).Microseconds()) / 1000.0
	if err != nil {
		return &types.QueryResult{
			Query:               query,
			Success:             false,
			Error:               err.Error(),
			DurationMs:          duration,
			DefaultLimitApplied: defaultLimitApplied,
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

	if defaultLimitApplied && len(dataRows) > 100 {
		dataRows = dataRows[:100]
	} else if len(dataRows) > maxRows {
		dataRows = dataRows[:maxRows]
	}

	return &types.QueryResult{
		Query:               query,
		Columns:             columns,
		Rows:                dataRows,
		Affected:            int64(len(dataRows)),
		DurationMs:          float64(time.Since(start).Microseconds()) / 1000.0,
		Success:             true,
		DefaultLimitApplied: defaultLimitApplied,
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
		switch ch.Type {
		case types.ChangeUpdate:
			var setClauses []string
			var args []interface{}

			for col, val := range ch.NewValues {
				setClauses = append(setClauses, fmt.Sprintf(`"%s" = ?`, col))
				args = append(args, val)
			}

			var whereClauses []string
			for pkCol, pkVal := range ch.PrimaryKey {
				whereClauses = append(whereClauses, fmt.Sprintf(`"%s" = ?`, pkCol))
				args = append(args, pkVal)
			}

			sqlStr := fmt.Sprintf(`UPDATE "%s" SET %s WHERE %s;`, ch.Table, strings.Join(setClauses, ", "), strings.Join(whereClauses, " AND "))
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
				cols = append(cols, fmt.Sprintf(`"%s"`, col))
				placeholders = append(placeholders, "?")
				args = append(args, val)
			}

			sqlStr := fmt.Sprintf(`INSERT INTO "%s" (%s) VALUES (%s);`, ch.Table, strings.Join(cols, ", "), strings.Join(placeholders, ", "))
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
				whereClauses = append(whereClauses, fmt.Sprintf(`"%s" = ?`, pkCol))
				args = append(args, pkVal)
			}

			sqlStr := fmt.Sprintf(`DELETE FROM "%s" WHERE %s;`, ch.Table, strings.Join(whereClauses, " AND "))
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
	explainSQL := fmt.Sprintf("EXPLAIN QUERY PLAN %s", query)

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
		sb.WriteString(fmt.Sprintf("%v: %v\n", row["selectid"], row["detail"]))
	}

	return &types.QueryPlanResult{
		RawPlan:    sb.String(),
		Nodes:      dataRows,
		Success:    true,
		DurationMs: float64(time.Since(start).Microseconds()) / 1000.0,
	}, nil
}

func (e *Engine) SimulateQuery(ctx context.Context, query string) (*types.SimulationResult, error) {
	if e.dbInstance == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	start := time.Now()
	trimmed := strings.TrimSpace(query)
	upper := strings.ToUpper(trimmed)

	isMutation := strings.HasPrefix(upper, "UPDATE") ||
		strings.HasPrefix(upper, "DELETE") ||
		strings.HasPrefix(upper, "INSERT") ||
		strings.HasPrefix(upper, "DROP") ||
		strings.HasPrefix(upper, "ALTER")

	if !isMutation {
		// Read-only query simulation
		rows, err := e.dbInstance.QueryContext(ctx, query)
		elapsed := float64(time.Since(start).Microseconds()) / 1000.0
		if err != nil {
			return &types.SimulationResult{
				Query:      query,
				IsMutation: false,
				DurationMs: elapsed,
				Success:    false,
				Error:      err.Error(),
			}, nil
		}
		defer rows.Close()

		var count int64
		for rows.Next() {
			count++
			if count >= 100 {
				break
			}
		}
		return &types.SimulationResult{
			Query:        query,
			IsMutation:   false,
			AffectedRows: count,
			DurationMs:   elapsed,
			Success:      true,
		}, nil
	}

	// For UPDATE or DELETE, attempt to capture preview of affected rows before executing
	var previewRows []map[string]interface{}
	if strings.HasPrefix(upper, "UPDATE") || strings.HasPrefix(upper, "DELETE") {
		tableName := types.ExtractTableNameFromMutation(trimmed)
		whereClause := types.ExtractWhereClause(trimmed)
		if tableName != "" {
			previewSQL := fmt.Sprintf(`SELECT * FROM "%s"`, tableName)
			if whereClause != "" {
				previewSQL += " " + whereClause
			}
			previewSQL += " LIMIT 20"

			pRows, err := e.dbInstance.QueryContext(ctx, previewSQL)
			if err == nil {
				defer pRows.Close()
				colTypes, _ := pRows.ColumnTypes()
				previewRows, _ = scanRows(pRows, colTypes)
			}
		}
	}

	// Execute inside isolated transaction and ALWAYS rollback
	tx, err := e.dbInstance.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to open sandbox transaction: %w", err)
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(ctx, query)
	elapsed := float64(time.Since(start).Microseconds()) / 1000.0
	if err != nil {
		return &types.SimulationResult{
			Query:      query,
			IsMutation: true,
			DurationMs: elapsed,
			Success:    false,
			Error:      err.Error(),
		}, nil
	}

	affected, _ := res.RowsAffected()
	return &types.SimulationResult{
		Query:        query,
		IsMutation:   true,
		AffectedRows: affected,
		PreviewRows:  previewRows,
		DurationMs:   elapsed,
		Success:      true,
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

func escapeSql(s string) string {
	return strings.ReplaceAll(s, "'", "''")
}

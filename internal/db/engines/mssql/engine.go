package mssql

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"time"

	_ "github.com/microsoft/go-mssqldb"
	"vetrolog/internal/db/types"
)

var limitRegex = regexp.MustCompile(`(?i)(\bTOP\s+\d+|\bFETCH\s+NEXT\s+\d+)`)

// Engine implements types.DatabaseEngine for Microsoft SQL Server (MSSQL / Azure SQL)
type Engine struct {
	dbInstance *sql.DB
	config     types.ConnectionConfig
	versionStr string
}

// NewEngine creates an uninitialized MSSQL engine
func NewEngine() *Engine {
	return &Engine{}
}

func (e *Engine) Type() types.EngineType {
	return types.EngineMSSQL
}

func (e *Engine) Connect(ctx context.Context, cfg types.ConnectionConfig) error {
	e.config = cfg

	host := cfg.Host
	port := cfg.Port
	if port <= 0 {
		port = 1433
	}

	database := cfg.Database
	if database == "" {
		database = "master"
	}

	query := url.Values{}
	query.Add("database", database)

	if cfg.SSLMode == "disable" || cfg.SSLMode == "" {
		query.Add("encrypt", "disable")
		query.Add("trustServerCertificate", "true")
	} else {
		query.Add("encrypt", "true")
		query.Add("trustServerCertificate", "true")
	}

	// Format DSN: sqlserver://user:password@host:port?database=db&encrypt=disable&trustServerCertificate=true
	u := &url.URL{
		Scheme:   "sqlserver",
		User:     url.UserPassword(cfg.User, cfg.Password),
		Host:     fmt.Sprintf("%s:%d", host, port),
		RawQuery: query.Encode(),
	}

	conn, err := sql.Open("sqlserver", u.String())
	if err != nil {
		return fmt.Errorf("invalid mssql connection string: %w", err)
	}

	conn.SetMaxOpenConns(10)
	conn.SetMaxIdleConns(2)
	conn.SetConnMaxLifetime(30 * time.Minute)
	conn.SetConnMaxIdleTime(5 * time.Minute)

	if err := conn.PingContext(ctx); err != nil {
		_ = conn.Close()
		return fmt.Errorf("mssql connection failed: %w", err)
	}

	e.dbInstance = conn

	// Cache server version
	var v string
	if err := e.dbInstance.QueryRowContext(ctx, "SELECT @@VERSION;").Scan(&v); err == nil {
		lines := strings.Split(v, "\n")
		if len(lines) > 0 {
			e.versionStr = strings.TrimSpace(lines[0])
		} else {
			e.versionStr = "Microsoft SQL Server"
		}
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
		if err := e.dbInstance.QueryRowContext(ctx, "SELECT @@VERSION;").Scan(&v); err == nil {
			lines := strings.Split(v, "\n")
			if len(lines) > 0 {
				e.versionStr = strings.TrimSpace(lines[0])
			}
		}
	}
	return e.versionStr
}

func (e *Engine) ListDatabases(ctx context.Context) ([]string, error) {
	if e.dbInstance == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	query := `
		SELECT name FROM sys.databases 
		WHERE state = 0 
		  AND name NOT IN ('master', 'tempdb', 'model', 'msdb')
		ORDER BY name;
	`
	rows, err := e.dbInstance.QueryContext(ctx, query)
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
	if len(dbs) == 0 && e.config.Database != "" {
		dbs = []string{e.config.Database}
	}
	return dbs, nil
}

func (e *Engine) ListSchemas(ctx context.Context, _ string) ([]string, error) {
	if e.dbInstance == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	query := `
		SELECT schema_name FROM information_schema.schemata
		WHERE schema_name NOT IN ('guest', 'INFORMATION_SCHEMA', 'sys', 'db_owner', 'db_accessadmin', 'db_securityadmin', 'db_ddladmin', 'db_backupoperator', 'db_datareader', 'db_datawriter', 'db_denydatareader', 'db_denydatawriter')
		ORDER BY schema_name;
	`
	rows, err := e.dbInstance.QueryContext(ctx, query)
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
		schemas = []string{"dbo"}
	}
	return schemas, nil
}

func (e *Engine) ListTables(ctx context.Context, _ string, schema string) ([]types.TableSummary, error) {
	if e.dbInstance == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	if schema == "" {
		schema = "dbo"
	}

	// 1. Fetch tables and statistical row counts in one indexed query
	query := `
		SELECT 
			t.TABLE_NAME, 
			t.TABLE_TYPE, 
			COALESCE(p.rows, 0) AS estimated_rows
		FROM information_schema.TABLES t
		LEFT JOIN (
			SELECT 
				s.name AS schema_name,
				o.name AS table_name,
				SUM(p.rows) AS rows
			FROM sys.partitions p
			JOIN sys.objects o ON o.object_id = p.object_id
			JOIN sys.schemas s ON s.schema_id = o.schema_id
			WHERE p.index_id IN (0, 1) AND o.type = 'U'
			GROUP BY s.name, o.name
		) p ON p.schema_name = t.TABLE_SCHEMA AND p.table_name = t.TABLE_NAME
		WHERE t.TABLE_SCHEMA = @p1
		ORDER BY t.TABLE_NAME;
	`

	rows, err := e.dbInstance.QueryContext(ctx, query, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var summaries []types.TableSummary
	for rows.Next() {
		var name, tableType string
		var rowCount int64
		if err := rows.Scan(&name, &tableType, &rowCount); err == nil {
			normalizedType := "table"
			if strings.Contains(strings.ToLower(tableType), "view") {
				normalizedType = "view"
			}
			summaries = append(summaries, types.TableSummary{
				Name:                name,
				Schema:              schema,
				Type:                normalizedType,
				RowCount:            rowCount,
				IsRowCountEstimated: true,
			})
		}
	}

	// 2. Preload columns for autocomplete & AI
	colQuery := `
		SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COALESCE(COLUMN_DEFAULT, '')
		FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = @p1
		ORDER BY TABLE_NAME, ORDINAL_POSITION;
	`
	if colRows, err := e.dbInstance.QueryContext(ctx, colQuery, schema); err == nil {
		defer colRows.Close()
		colsByTable := make(map[string][]types.ColumnInfo)
		for colRows.Next() {
			var tbl, col, dtype, isNull, defVal string
			if err := colRows.Scan(&tbl, &col, &dtype, &isNull, &defVal); err == nil {
				colsByTable[tbl] = append(colsByTable[tbl], types.ColumnInfo{
					Name:         col,
					Type:         dtype,
					IsNullable:   strings.ToUpper(isNull) == "YES",
					DefaultValue: defVal,
				})
			}
		}
		for i := range summaries {
			if cols, ok := colsByTable[summaries[i].Name]; ok {
				summaries[i].Columns = cols
			}
		}
	}

	return summaries, nil
}

func (e *Engine) GetTableSchema(ctx context.Context, _ string, schema string, table string) (*types.ExtendedTableSchema, error) {
	if e.dbInstance == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	if schema == "" {
		schema = "dbo"
	}

	// 1. Columns
	colQuery := `
		SELECT 
			COLUMN_NAME, 
			DATA_TYPE, 
			IS_NULLABLE, 
			COALESCE(COLUMN_DEFAULT, '')
		FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = @p1 AND TABLE_NAME = @p2
		ORDER BY ORDINAL_POSITION;
	`
	colRows, err := e.dbInstance.QueryContext(ctx, colQuery, schema, table)
	if err != nil {
		return nil, err
	}
	defer colRows.Close()

	var columns []types.ColumnInfo
	for colRows.Next() {
		var name, dtype, isNull, defVal string
		if err := colRows.Scan(&name, &dtype, &isNull, &defVal); err == nil {
			columns = append(columns, types.ColumnInfo{
				Name:         name,
				Type:         dtype,
				IsNullable:   strings.ToUpper(isNull) == "YES",
				DefaultValue: defVal,
			})
		}
	}

	// 2. Primary Keys
	pkQuery := `
		SELECT k.COLUMN_NAME
		FROM information_schema.TABLE_CONSTRAINTS tc
		JOIN information_schema.KEY_COLUMN_USAGE k
		  ON tc.CONSTRAINT_NAME = k.CONSTRAINT_NAME 
		 AND tc.TABLE_SCHEMA = k.TABLE_SCHEMA
		WHERE tc.TABLE_SCHEMA = @p1 
		  AND tc.TABLE_NAME = @p2 
		  AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
		ORDER BY k.ORDINAL_POSITION;
	`
	var pks []string
	if pkRows, err := e.dbInstance.QueryContext(ctx, pkQuery, schema, table); err == nil {
		defer pkRows.Close()
		for pkRows.Next() {
			var pk string
			if err := pkRows.Scan(&pk); err == nil {
				pks = append(pks, pk)
			}
		}
	}

	for i := range columns {
		for _, pk := range pks {
			if columns[i].Name == pk {
				columns[i].IsPrimaryKey = true
				break
			}
		}
	}

	// 3. Indexes
	idxQuery := `
		SELECT 
			i.name AS index_name,
			i.is_unique,
			i.is_primary_key,
			i.type_desc,
			c.name AS column_name
		FROM sys.indexes i
		JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
		JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
		JOIN sys.objects o ON o.object_id = i.object_id
		JOIN sys.schemas s ON s.schema_id = o.schema_id
		WHERE s.name = @p1 AND o.name = @p2 AND i.name IS NOT NULL
		ORDER BY i.name, ic.key_ordinal;
	`
	var indexes []types.IndexInfo
	if idxRows, err := e.dbInstance.QueryContext(ctx, idxQuery, schema, table); err == nil {
		defer idxRows.Close()
		idxMap := make(map[string]*types.IndexInfo)
		for idxRows.Next() {
			var idxName, typeDesc, colName string
			var isUnique, isPk bool
			if err := idxRows.Scan(&idxName, &isUnique, &isPk, &typeDesc, &colName); err == nil {
				if info, exists := idxMap[idxName]; exists {
					info.Columns = append(info.Columns, colName)
				} else {
					idxMap[idxName] = &types.IndexInfo{
						Name:      idxName,
						Columns:   []string{colName},
						IsUnique:  isUnique,
						IsPrimary: isPk,
						Type:      typeDesc,
					}
				}
			}
		}
		for _, idx := range idxMap {
			indexes = append(indexes, *idx)
		}
	}

	// 4. Foreign Keys
	fkQuery := `
		SELECT 
			fk.name AS constraint_name,
			col.name AS from_column,
			ref_tab.name AS to_table,
			ref_col.name AS to_column,
			fk.update_referential_action_desc,
			fk.delete_referential_action_desc
		FROM sys.foreign_keys fk
		JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
		JOIN sys.tables tab ON tab.object_id = fk.parent_object_id
		JOIN sys.schemas s ON s.schema_id = tab.schema_id
		JOIN sys.columns col ON col.object_id = fkc.parent_object_id AND col.column_id = fkc.parent_column_id
		JOIN sys.tables ref_tab ON ref_tab.object_id = fk.referenced_object_id
		JOIN sys.columns ref_col ON ref_col.object_id = fkc.referenced_object_id AND ref_col.column_id = fkc.referenced_column_id
		WHERE s.name = @p1 AND tab.name = @p2;
	`
	var foreignKeys []types.ForeignKeyInfo
	if fkRows, err := e.dbInstance.QueryContext(ctx, fkQuery, schema, table); err == nil {
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

	// 5. Row Count (Optimized with Enterprise Safeguard)
	var rowCount int64
	var isEstimated bool

	// Step A: Fetch instant O(1) estimate from sys.partitions
	var estimatedCount int64 = -1
	estQuery := `
		SELECT COALESCE(SUM(p.rows), -1)
		FROM sys.partitions p
		JOIN sys.objects o ON o.object_id = p.object_id
		JOIN sys.schemas s ON s.schema_id = o.schema_id
		WHERE s.name = @p1 AND o.name = @p2 AND p.index_id IN (0, 1) AND o.type = 'U';
	`
	_ = e.dbInstance.QueryRowContext(ctx, estQuery, schema, table).Scan(&estimatedCount)

	if estimatedCount > 50000 {
		// Large table: use instant partition stats to eliminate slow table scans
		rowCount = estimatedCount
		isEstimated = true
	} else {
		// Small table: compute exact count with 500ms safety timeout guard
		countCtx, countCancel := context.WithTimeout(ctx, 500*time.Millisecond)
		defer countCancel()

		countQuery := fmt.Sprintf("SELECT COUNT(*) FROM [%s].[%s];", escapeBracket(schema), escapeBracket(table))
		if err := e.dbInstance.QueryRowContext(countCtx, countQuery).Scan(&rowCount); err != nil {
			if estimatedCount >= 0 {
				rowCount = estimatedCount
				isEstimated = true
			}
		}
	}

	return &types.ExtendedTableSchema{
		TableName:           table,
		Name:                table,
		Schema:              schema,
		Type:                "TABLE",
		Columns:             columns,
		PrimaryKeys:         pks,
		Indexes:             indexes,
		ForeignKeys:         foreignKeys,
		RowCount:            rowCount,
		IsRowCountEstimated: isEstimated,
	}, nil
}

func (e *Engine) GetTableData(ctx context.Context, req types.TableDataRequest) (*types.TableDataResult, error) {
	if e.dbInstance == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	schema := req.Schema
	if schema == "" {
		schema = "dbo"
	}

	start := time.Now()

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
	query.WriteString(fmt.Sprintf("SELECT * FROM [%s].[%s]", escapeBracket(schema), escapeBracket(req.Table)))

	if req.Filter != "" {
		var filters []string
		for _, col := range schemaInfo.Columns {
			filters = append(filters, fmt.Sprintf("CAST([%s] AS NVARCHAR(MAX)) LIKE '%%%s%%'", escapeBracket(col.Name), escapeMssql(req.Filter)))
		}
		if len(filters) > 0 {
			query.WriteString(" WHERE " + strings.Join(filters, " OR "))
		}
	}

	// T-SQL modern pagination requires an ORDER BY clause
	orderCol := ""
	sortDir := "ASC"
	if strings.ToUpper(req.SortDirection) == "DESC" {
		sortDir = "DESC"
	}

	if req.SortColumn != "" {
		orderCol = fmt.Sprintf("[%s] %s", escapeBracket(req.SortColumn), sortDir)
	} else if len(schemaInfo.PrimaryKeys) > 0 {
		orderCol = fmt.Sprintf("[%s] ASC", escapeBracket(schemaInfo.PrimaryKeys[0]))
	} else if len(schemaInfo.Columns) > 0 {
		orderCol = fmt.Sprintf("[%s] ASC", escapeBracket(schemaInfo.Columns[0].Name))
	} else {
		orderCol = "(SELECT NULL)"
	}

	query.WriteString(fmt.Sprintf(" ORDER BY %s OFFSET %d ROWS FETCH NEXT %d ROWS ONLY;", orderCol, offset, limit))

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
		TableName:           req.Table,
		Schema:              schema,
		Columns:             columns,
		Rows:                dataRows,
		TotalRows:           schemaInfo.RowCount,
		IsRowCountEstimated: schemaInfo.IsRowCountEstimated,
		Page:                req.Page,
		PageSize:            limit,
		DurationMs:          float64(time.Since(start).Microseconds()) / 1000.0,
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
		strings.HasPrefix(strings.ToUpper(trimmed), "WITH") ||
		strings.HasPrefix(strings.ToUpper(trimmed), "EXEC")

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

	// Apply safe default TOP 100 limit for ad-hoc SELECT queries lacking explicit TOP/FETCH
	if strings.HasPrefix(strings.ToUpper(trimmed), "SELECT") && !limitRegex.MatchString(trimmed) {
		cleanSQL := strings.TrimRight(trimmed, ";")
		queryToRun = fmt.Sprintf("SELECT TOP 100 * FROM (%s) AS _sub", cleanSQL)
		defaultLimitApplied = true
		maxRows = 100
	}

	rows, err := e.dbInstance.QueryContext(ctx, queryToRun)
	if err != nil && defaultLimitApplied {
		// Fallback to raw query if wrapped subquery fails
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

	if len(dataRows) > maxRows {
		dataRows = dataRows[:maxRows]
	}

	return &types.QueryResult{
		Query:               query,
		Success:             true,
		Columns:             columns,
		Rows:                dataRows,
		Affected:            int64(len(dataRows)),
		DurationMs:          duration,
		DefaultLimitApplied: defaultLimitApplied,
	}, nil
}

func (e *Engine) ApplyPendingChanges(ctx context.Context, changes types.PendingChanges) (*types.ChangeResult, error) {
	if e.dbInstance == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	start := time.Now()
	tx, err := e.dbInstance.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var totalAffected int64
	var generatedSQL strings.Builder

	for _, ch := range changes.Changes {
		schema := ch.Schema
		if schema == "" {
			schema = "dbo"
		}

		switch ch.Type {
		case types.ChangeUpdate:
			var setClauses []string
			var args []interface{}

			for col, val := range ch.NewValues {
				setClauses = append(setClauses, fmt.Sprintf("[%s] = ?", escapeBracket(col)))
				args = append(args, val)
			}

			var whereClauses []string
			for pkCol, pkVal := range ch.PrimaryKey {
				whereClauses = append(whereClauses, fmt.Sprintf("[%s] = ?", escapeBracket(pkCol)))
				args = append(args, pkVal)
			}

			sqlStr := fmt.Sprintf("UPDATE [%s].[%s] SET %s WHERE %s;", escapeBracket(schema), escapeBracket(ch.Table), strings.Join(setClauses, ", "), strings.Join(whereClauses, " AND "))
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
				cols = append(cols, fmt.Sprintf("[%s]", escapeBracket(col)))
				placeholders = append(placeholders, "?")
				args = append(args, val)
			}

			sqlStr := fmt.Sprintf("INSERT INTO [%s].[%s] (%s) VALUES (%s);", escapeBracket(schema), escapeBracket(ch.Table), strings.Join(cols, ", "), strings.Join(placeholders, ", "))
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
				whereClauses = append(whereClauses, fmt.Sprintf("[%s] = ?", escapeBracket(pkCol)))
				args = append(args, pkVal)
			}

			sqlStr := fmt.Sprintf("DELETE FROM [%s].[%s] WHERE %s;", escapeBracket(schema), escapeBracket(ch.Table), strings.Join(whereClauses, " AND "))
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
		return nil, fmt.Errorf("transaction commit failed: %w", err)
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
	// Enable SHOWPLAN_ALL for execution plan inspection
	_, _ = e.dbInstance.ExecContext(ctx, "SET SHOWPLAN_ALL ON;")
	defer func() {
		_, _ = e.dbInstance.ExecContext(ctx, "SET SHOWPLAN_ALL OFF;")
	}()

	rows, err := e.dbInstance.QueryContext(ctx, query)
	elapsed := float64(time.Since(start).Microseconds()) / 1000.0
	if err != nil {
		return &types.QueryPlanResult{
			Success:    false,
			Error:      err.Error(),
			DurationMs: elapsed,
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
		DurationMs: elapsed,
	}, nil
}

func (e *Engine) SimulateQuery(ctx context.Context, query string) (*types.SimulationResult, error) {
	if e.dbInstance == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	start := time.Now()
	trimmed := strings.TrimSpace(query)
	isMutation := !strings.HasPrefix(strings.ToUpper(trimmed), "SELECT")

	if !isMutation {
		return &types.SimulationResult{
			Query:        query,
			IsMutation:   false,
			AffectedRows: 0,
			DurationMs:   float64(time.Since(start).Microseconds()) / 1000.0,
			Success:      true,
		}, nil
	}

	// Wrap in a transaction that always rolls back
	tx, err := e.dbInstance.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
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

func escapeBracket(s string) string {
	return strings.ReplaceAll(s, "]", "]]")
}

func escapeMssql(s string) string {
	return strings.ReplaceAll(s, "'", "''")
}

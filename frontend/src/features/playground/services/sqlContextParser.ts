import { TableSchema, ExtendedTableSchema, ColumnInfo } from '@/types/database';

export interface DotContextResult {
  isDotContext: boolean;
  rawQualifier: string;
  tableName: string;
  table: TableSchema | ExtendedTableSchema;
  columnPrefix: string;
  replaceLength: number;
}

const NON_ALIAS_KEYWORDS = new Set([
  'WHERE',
  'ON',
  'JOIN',
  'INNER',
  'LEFT',
  'RIGHT',
  'CROSS',
  'NATURAL',
  'GROUP',
  'ORDER',
  'LIMIT',
  'OFFSET',
  'SET',
  'VALUES',
  'HAVING',
  'UNION',
  'ALL',
  'EXCEPT',
  'INTERSECT',
  'AS',
  'USING',
  'SELECT',
  'FROM',
]);

/**
 * Extracts table aliases defined in a SQL query.
 * Matches:
 *  - FROM users u
 *  - FROM "users" AS u
 *  - JOIN orders o
 *  - JOIN "customer_orders" AS co
 */
export function extractTableAliases(sql: string): Map<string, string> {
  const aliasMap = new Map<string, string>();
  if (!sql) return aliasMap;

  // Regex to match FROM/JOIN <table> [[AS] <alias>]
  const regex = /\b(?:FROM|JOIN)\s+(["`[a-zA-Z0-9_\]`"]+)(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(sql)) !== null) {
    const rawTable = match[1];
    const rawAlias = match[2];

    const cleanTable = rawTable.replace(/["`[\]]/g, '');
    if (!cleanTable) continue;

    // Map table to itself (case-insensitive)
    aliasMap.set(cleanTable.toLowerCase(), cleanTable);

    if (rawAlias) {
      const cleanAlias = rawAlias.replace(/["`[\]]/g, '');
      const upperAlias = cleanAlias.toUpperCase();

      // Ensure the alias is not a reserved SQL keyword like WHERE or ON
      if (!NON_ALIAS_KEYWORDS.has(upperAlias)) {
        aliasMap.set(cleanAlias.toLowerCase(), cleanTable);
      }
    }
  }

  // Also match comma-separated FROM table1 [alias1], table2 [alias2]
  const fromClauseMatch = sql.match(/\bFROM\s+([^;]+?)(?:\s+(?:WHERE|JOIN|GROUP|ORDER|LIMIT|HAVING|UNION)|$)/i);
  if (fromClauseMatch) {
    const tableListStr = fromClauseMatch[1];
    const parts = tableListStr.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      const partMatch = trimmed.match(/^(["`[a-zA-Z0-9_\]`"]+)(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?$/i);
      if (partMatch) {
        const cleanT = partMatch[1].replace(/["`[\]]/g, '');
        const rawA = partMatch[2];
        if (cleanT) {
          aliasMap.set(cleanT.toLowerCase(), cleanT);
          if (rawA) {
            const cleanA = rawA.replace(/["`[\]]/g, '');
            if (!NON_ALIAS_KEYWORDS.has(cleanA.toUpperCase())) {
              aliasMap.set(cleanA.toLowerCase(), cleanT);
            }
          }
        }
      }
    }
  }

  return aliasMap;
}

/**
 * Parses the context immediately preceding the cursor in the SQL editor.
 * Determines if the user is typing after a dot (e.g. `table.` or `alias.col_prefix`).
 */
export function parseDotContext(
  textBeforeCursor: string,
  fullSql: string,
  availableTables: (TableSchema | ExtendedTableSchema)[]
): DotContextResult | null {
  if (!textBeforeCursor) return null;

  // Match: <qualifier>.<columnPrefix> at end of textBeforeCursor
  // e.g. "general_info_table." or "g._i" or '"farmer_image".' or 't."col'
  const dotMatch = textBeforeCursor.match(/(?:(["`[a-zA-Z0-9_\]`"]+)\.)(["`[a-zA-Z0-9_\]`"]*)$/);
  if (!dotMatch) return null;

  const rawQualifier = dotMatch[1];
  const rawColumnPrefix = dotMatch[2] || '';
  const columnPrefix = rawColumnPrefix.replace(/["`[\]]/g, '');

  // Clean qualifier of quotes/brackets
  const cleanQualifier = rawQualifier.replace(/["`[\]]/g, '');

  // Ignore numeric literals like 3.14
  if (!cleanQualifier || /^\d+$/.test(cleanQualifier)) return null;

  // Extract all aliases defined in the query
  const aliases = extractTableAliases(fullSql);

  // Resolve to actual table name
  const resolvedTableName = aliases.get(cleanQualifier.toLowerCase()) || cleanQualifier;

  // Find table schema in availableTables
  const matchedTable = availableTables.find(
    (t) => t.name.toLowerCase() === resolvedTableName.toLowerCase()
  );

  if (!matchedTable) return null;

  return {
    isDotContext: true,
    rawQualifier,
    tableName: matchedTable.name,
    table: matchedTable,
    columnPrefix,
    replaceLength: rawColumnPrefix.length,
  };
}

/**
 * Filters and ranks columns for a resolved table based on columnPrefix.
 * Primary keys are ranked first, followed by prefix matches, then substring matches.
 */
export function filterTableColumns(
  columns: ColumnInfo[],
  prefix: string
): ColumnInfo[] {
  const cleanPrefix = (prefix || '').toLowerCase();

  const filtered = columns.filter((col) => {
    if (!cleanPrefix) return true;
    return col.name.toLowerCase().includes(cleanPrefix);
  });

  return filtered.sort((a, b) => {
    const aLow = a.name.toLowerCase();
    const bLow = b.name.toLowerCase();

    // Exact match comes first
    if (aLow === cleanPrefix) return -1;
    if (bLow === cleanPrefix) return 1;

    // Primary keys take precedence
    if (a.isPrimaryKey && !b.isPrimaryKey) return -1;
    if (!a.isPrimaryKey && b.isPrimaryKey) return 1;

    // Starts with prefix comes next
    const aStarts = aLow.startsWith(cleanPrefix);
    const bStarts = bLow.startsWith(cleanPrefix);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;

    // Alphabetical
    return aLow.localeCompare(bLow);
  });
}

/**
 * Extracts all table names referenced in FROM, JOIN, UPDATE, or INTO clauses.
 * Handles aliases, quotes, commas, multiline queries, and SELECT* without spaces.
 */
export function extractReferencedTables(sql: string): string[] {
  if (!sql) return [];
  const tableNames = new Set<string>();

  // 1. Match FROM/JOIN/UPDATE/INTO <table> [[AS] <alias>]
  const regex = /\b(?:FROM|JOIN|UPDATE|INTO)\s+(["`[a-zA-Z0-9_\]`"]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sql)) !== null) {
    const rawTable = match[1];
    const cleanTable = rawTable.replace(/["`[\]]/g, '').trim();
    if (cleanTable && !NON_ALIAS_KEYWORDS.has(cleanTable.toUpperCase())) {
      tableNames.add(cleanTable.toLowerCase());
    }
  }

  // 2. Also match comma-separated FROM table1, table2
  const fromMatch = sql.match(/\bFROM\s+([^;]+?)(?:\s+(?:WHERE|JOIN|GROUP|ORDER|LIMIT|HAVING|UNION)|$)/i);
  if (fromMatch) {
    const parts = fromMatch[1].split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      const firstTokenMatch = trimmed.match(/^(["`[a-zA-Z0-9_\]`"]+)/);
      if (firstTokenMatch) {
        const cleanT = firstTokenMatch[1].replace(/["`[\]]/g, '').trim();
        if (cleanT && !NON_ALIAS_KEYWORDS.has(cleanT.toUpperCase())) {
          tableNames.add(cleanT.toLowerCase());
        }
      }
    }
  }

  return Array.from(tableNames);
}

export type ClauseType =
  | 'WHERE'
  | 'SELECT'
  | 'FROM'
  | 'JOIN'
  | 'ORDER_BY'
  | 'GROUP_BY'
  | 'HAVING'
  | 'SET'
  | 'ON'
  | 'NONE';

export interface SqlClauseContext {
  isFromOrJoin: boolean;
  isColumnClause: boolean;
  clauseType: ClauseType;
  currentWord: string;
}

/**
 * Detects the active SQL clause at cursor position.
 * Distinguishes whether the user is typing table names (FROM/JOIN) or column names (WHERE/SELECT/ORDER BY/etc.).
 */
export function detectSqlClauseContext(textBeforeCursor: string): SqlClauseContext {
  if (!textBeforeCursor) {
    return { isFromOrJoin: false, isColumnClause: false, clauseType: 'NONE', currentWord: '' };
  }

  const lastWordMatch = textBeforeCursor.match(/([a-zA-Z0-9_]+)$/);
  const currentWord = lastWordMatch ? lastWordMatch[1].toLowerCase() : '';

  // 1. Check FROM / JOIN context (e.g. "FROM ", "FROM users", "JOIN ", "JOIN orders")
  const isFromOrJoin = /(?:FROM|JOIN|INTO|UPDATE)\s+([a-zA-Z0-9_]*)$/i.test(textBeforeCursor);
  if (isFromOrJoin) {
    const isJoin = /JOIN\s+([a-zA-Z0-9_]*)$/i.test(textBeforeCursor);
    return {
      isFromOrJoin: true,
      isColumnClause: false,
      clauseType: isJoin ? 'JOIN' : 'FROM',
      currentWord,
    };
  }

  // 2. Column-heavy clauses:
  // WHERE, HAVING, AND, OR
  if (/(?:WHERE|HAVING)\s+([^;]*)$/i.test(textBeforeCursor)) {
    return { isFromOrJoin: false, isColumnClause: true, clauseType: 'WHERE', currentWord };
  }
  if (/\b(?:AND|OR)\s+([a-zA-Z0-9_]*)$/i.test(textBeforeCursor)) {
    return { isFromOrJoin: false, isColumnClause: true, clauseType: 'WHERE', currentWord };
  }
  if (/\bON\s+([a-zA-Z0-9_.]*)$/i.test(textBeforeCursor)) {
    return { isFromOrJoin: false, isColumnClause: true, clauseType: 'ON', currentWord };
  }
  if (/\bSET\s+([^;]*)$/i.test(textBeforeCursor)) {
    return { isFromOrJoin: false, isColumnClause: true, clauseType: 'SET', currentWord };
  }
  if (/ORDER\s+BY\s+([^;]*)$/i.test(textBeforeCursor)) {
    return { isFromOrJoin: false, isColumnClause: true, clauseType: 'ORDER_BY', currentWord };
  }
  if (/GROUP\s+BY\s+([^;]*)$/i.test(textBeforeCursor)) {
    return { isFromOrJoin: false, isColumnClause: true, clauseType: 'GROUP_BY', currentWord };
  }

  // SELECT list (between SELECT and FROM, e.g. "SELECT ", "SELECT id, ")
  const lastSelectIdx = textBeforeCursor.toUpperCase().lastIndexOf('SELECT');
  if (lastSelectIdx !== -1) {
    const textAfterSelect = textBeforeCursor.slice(lastSelectIdx);
    if (!/\bFROM\b/i.test(textAfterSelect)) {
      return { isFromOrJoin: false, isColumnClause: true, clauseType: 'SELECT', currentWord };
    }
  }

  return { isFromOrJoin: false, isColumnClause: false, clauseType: 'NONE', currentWord };
}

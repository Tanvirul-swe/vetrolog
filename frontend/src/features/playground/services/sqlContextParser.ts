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

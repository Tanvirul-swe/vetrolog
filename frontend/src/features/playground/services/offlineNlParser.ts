import { ExtendedTableSchema } from '@/types/database';

export interface NLParseResult {
  sql: string;
  explanation: string;
  confidence: number;
}

/**
 * Pure client-side, zero-dependency offline Natural Language to SQLite parser.
 * Handles common developer intents using schema tokenization and pattern matching.
 */
export function parseNaturalLanguageToSql(
  prompt: string,
  tables: ExtendedTableSchema[]
): NLParseResult {
  const clean = prompt.trim();
  const lower = clean.toLowerCase();

  const tableNames = tables.map((t) => t.name);

  // Helper to find mentioned table
  const findMentionedTable = (): string | undefined => {
    // Exact match
    for (const t of tableNames) {
      const reg = new RegExp(`\\b${t}\\b`, 'i');
      if (reg.test(clean)) return t;
    }
    // Plural / singular loose match
    for (const t of tableNames) {
      const singular = t.endsWith('s') ? t.slice(0, -1) : t;
      if (lower.includes(singular)) return t;
    }
    return tableNames[0]; // fallback to first table
  };

  const targetTable = findMentionedTable();
  const tableCols = tables.find((t) => t.name === targetTable)?.columns || [];
  const colNames = tableCols.map((c) => c.name);

  // 1. "count" / "how many"
  if (lower.startsWith('count') || lower.includes('how many') || lower.startsWith('total')) {
    // Check for "grouped by" or "by"
    const byMatch = lower.match(/(?:by|grouped by|per)\s+([a-zA-Z0-9_]+)/);
    if (byMatch && targetTable) {
      const groupByCol = colNames.find((c) => c.toLowerCase() === byMatch[1].toLowerCase()) || byMatch[1];
      return {
        sql: `SELECT "${groupByCol}", COUNT(*) AS count FROM "${targetTable}" GROUP BY "${groupByCol}" ORDER BY count DESC;`,
        explanation: `Count grouped by "${groupByCol}" in table "${targetTable}"`,
        confidence: 0.9,
      };
    }
    if (targetTable) {
      return {
        sql: `SELECT COUNT(*) AS total_count FROM "${targetTable}";`,
        explanation: `Total row count in table "${targetTable}"`,
        confidence: 0.95,
      };
    }
  }

  // 2. "top N" / "first N" / "limit N" / "recent N"
  const limitMatch = lower.match(/(?:top|first|recent|last|limit)\s+(\d+)/);
  const limit = limitMatch ? parseInt(limitMatch[1], 10) : 10;

  // 3. "recent" or "ordered by created"
  const isRecent = lower.includes('recent') || lower.includes('latest') || lower.includes('last');
  const dateCol = colNames.find((c) => /created|date|timestamp|time/i.test(c));
  const idCol = colNames.find((c) => /id/i.test(c)) || 'id';

  // 4. "created this week" / "today"
  if (lower.includes('today') && targetTable && dateCol) {
    return {
      sql: `SELECT * FROM "${targetTable}" WHERE date("${dateCol}") = date('now') ORDER BY "${idCol}" DESC LIMIT ${limit};`,
      explanation: `Show rows from "${targetTable}" created today`,
      confidence: 0.85,
    };
  }

  if ((lower.includes('this week') || lower.includes('last 7 days')) && targetTable && dateCol) {
    return {
      sql: `SELECT * FROM "${targetTable}" WHERE "${dateCol}" >= date('now', '-7 days') ORDER BY "${idCol}" DESC LIMIT ${limit};`,
      explanation: `Show rows from "${targetTable}" created in the last 7 days`,
      confidence: 0.85,
    };
  }

  // 5. "find [table] where [column] contains/is [value]"
  const whereMatch = lower.match(/where\s+([a-zA-Z0-9_]+)\s*(?:=|is|contains|like)\s*['"]?([^'"]+)['"]?/);
  if (whereMatch && targetTable) {
    const rawCol = whereMatch[1];
    const rawVal = whereMatch[2].trim();
    const matchedCol = colNames.find((c) => c.toLowerCase() === rawCol.toLowerCase()) || rawCol;

    if (lower.includes('contains') || lower.includes('like')) {
      return {
        sql: `SELECT * FROM "${targetTable}" WHERE "${matchedCol}" LIKE '%${rawVal}%' LIMIT ${limit};`,
        explanation: `Search "${targetTable}" where "${matchedCol}" contains "${rawVal}"`,
        confidence: 0.9,
      };
    }

    return {
      sql: `SELECT * FROM "${targetTable}" WHERE "${matchedCol}" = '${rawVal}' LIMIT ${limit};`,
      explanation: `Filter "${targetTable}" by "${matchedCol}" = '${rawVal}'`,
      confidence: 0.9,
    };
  }

  // 6. "delete where"
  if (lower.startsWith('delete') && targetTable) {
    const delWhere = lower.indexOf('where');
    if (delWhere !== -1) {
      const rest = clean.slice(delWhere);
      return {
        sql: `DELETE FROM "${targetTable}" ${rest};`,
        explanation: `Delete from "${targetTable}" with filter condition`,
        confidence: 0.8,
      };
    }
  }

  // 7. General Select with ordering and limit
  if (targetTable) {
    let orderClause = '';
    if (isRecent) {
      orderClause = dateCol ? ` ORDER BY "${dateCol}" DESC` : ` ORDER BY "${idCol}" DESC`;
    }

    return {
      sql: `SELECT * FROM "${targetTable}"${orderClause} LIMIT ${limit};`,
      explanation: `Retrieve ${limit} rows from "${targetTable}"${isRecent ? ' ordered by recent' : ''}`,
      confidence: 0.75,
    };
  }

  // Fallback generic query
  return {
    sql: `SELECT * FROM sqlite_master WHERE type='table';`,
    explanation: 'List all tables in the database',
    confidence: 0.5,
  };
}

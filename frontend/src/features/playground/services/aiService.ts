import { AIConfig, ExtendedTableSchema } from '@/types/database';

export interface AIQueryResponse {
  sql: string;
  explanation?: string;
  error?: string;
}

/**
 * Intelligently prunes and ranks table schemas for LLM prompts when the database
 * has many tables (e.g. 50 to 600+ tables).
 *
 * Scoring criteria:
 * 1. Currently selected/active table (+1000 points)
 * 2. Foreign-key linked tables (parent/child) (+500 points)
 * 3. Exact table name match in prompt (+300 points)
 * 4. Partial table name match in prompt (+150 points)
 * 5. Matching column name in prompt (+60 points)
 * 6. Tiebreaker: row count / prominence
 */
export function pruneTablesForPrompt(
  tables: ExtendedTableSchema[],
  userPrompt: string,
  activeTableName?: string,
  maxTables: number = 30
): { prunedTables: ExtendedTableSchema[]; totalAvailable: number; wasPruned: boolean } {
  if (!tables || tables.length <= maxTables) {
    return { prunedTables: tables || [], totalAvailable: tables?.length || 0, wasPruned: false };
  }

  // Tokenize user prompt into alphanumeric words (lowercase, length >= 3)
  const rawTerms = userPrompt.toLowerCase().match(/[a-z0-9_]{3,}/g) || [];
  const terms = new Set<string>();
  for (const t of rawTerms) {
    terms.add(t);
    // Add singular form if ends with 's' or 'es'
    if (t.endsWith('ies') && t.length > 4) {
      terms.add(t.slice(0, -3) + 'y');
    } else if (t.endsWith('es') && t.length > 3) {
      terms.add(t.slice(0, -2));
    } else if (t.endsWith('s') && t.length > 3) {
      terms.add(t.slice(0, -1));
    }
  }

  const activeNorm = activeTableName?.toLowerCase() || '';

  // Identify foreign key relations for active table
  const relatedTableNames = new Set<string>();
  if (activeNorm) {
    for (const t of tables) {
      const isCurrent = t.name.toLowerCase() === activeNorm;
      for (const fk of t.foreignKeys || []) {
        const toTbl = (fk.toTable || fk.refTable || '').toLowerCase();
        if (isCurrent && toTbl) {
          relatedTableNames.add(toTbl);
        } else if (toTbl === activeNorm) {
          relatedTableNames.add(t.name.toLowerCase());
        }
      }
    }
  }

  const scored = tables.map((table) => {
    let score = 0;
    const tName = table.name.toLowerCase();

    // 1. Active table
    if (activeNorm && tName === activeNorm) {
      score += 1000;
    }

    // 2. FK relation with active table
    if (relatedTableNames.has(tName)) {
      score += 500;
    }

    // 3. User prompt term matches
    for (const term of terms) {
      if (tName === term) {
        score += 300;
      } else if (tName.includes(term) || term.includes(tName)) {
        score += 150;
      }

      // Check column names
      for (const col of table.columns || []) {
        const cName = col.name.toLowerCase();
        if (cName === term) {
          score += 60;
        } else if (cName.includes(term) || term.includes(cName)) {
          score += 25;
        }
      }
    }

    // Tiebreaker: table row count / activity
    if (table.rowCount > 0) {
      score += Math.min(10, Math.log10(table.rowCount + 1));
    }

    return { table, score };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  const selectedTables = scored.slice(0, maxTables).map((s) => s.table);

  return {
    prunedTables: selectedTables,
    totalAvailable: tables.length,
    wasPruned: true,
  };
}

/**
 * Builds schema prompt context for LLM code generation.
 */
function buildSchemaPrompt(
  tables: ExtendedTableSchema[],
  wasPruned: boolean = false,
  totalAvailable: number = 0
): string {
  if (!tables || tables.length === 0) {
    return 'Database Schema: No schema information available.\n';
  }
  const header = wasPruned
    ? `Database Schema (Focusing on ${tables.length} most relevant tables out of ${totalAvailable} total tables in database catalog):\n`
    : 'Database Schema:\n';

  const schemaLines = tables.map((t) => {
    const colDefs = (t.columns || [])
      .map((c) => `${c.name} ${c.type || 'TEXT'}${c.isPrimaryKey ? ' PRIMARY KEY' : ''}`)
      .join(', ');
    const fkDefs = (t.foreignKeys || [])
      .map((fk) => {
        const fromCol = fk.fromCol || fk.column;
        const toTable = fk.toTable || fk.refTable;
        const toCol = fk.toCol || fk.refColumn;
        return fromCol && toTable && toCol
          ? `FOREIGN KEY (${fromCol}) REFERENCES ${toTable}(${toCol})`
          : '';
      })
      .filter(Boolean)
      .join(', ');
    const all = [colDefs, fkDefs].filter(Boolean).join(', ');
    return `CREATE TABLE ${t.name} (${all || 'id'});`;
  });

  return `${header}${schemaLines.join('\n')}\n`;
}

/**
 * Returns canonical dialect name for database engine.
 */
export function getDialectName(engine?: string): string {
  switch (engine?.toLowerCase()) {
    case 'postgres':
    case 'postgresql':
      return 'PostgreSQL';
    case 'mysql':
      return 'MySQL';
    case 'mariadb':
      return 'MariaDB';
    case 'sqlite':
    default:
      return 'SQLite';
  }
}

/**
 * Fetches the list of models that support generateContent for the given Gemini API key.
 */
export async function fetchAvailableGeminiModels(apiKey: string, signal?: AbortSignal): Promise<string[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to fetch models: HTTP ${res.status}`);
  }
  const data = await res.json();
  const rawList: Array<{ name: string; supportedGenerationMethods?: string[] }> = data.models || [];

  return rawList
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''));
}

/**
 * Invokes the configured AI provider to translate natural language into dialect-aware SQL.
 */
export async function generateSqlWithAI(
  prompt: string,
  tables: ExtendedTableSchema[],
  config: AIConfig,
  engine: string = 'sqlite',
  onModelAutoMigrated?: (newModel: string) => void,
  signal?: AbortSignal,
  activeTableName?: string
): Promise<AIQueryResponse> {
  const dialect = getDialectName(engine);
  const { prunedTables, totalAvailable, wasPruned } = pruneTablesForPrompt(
    tables,
    prompt,
    activeTableName,
    30
  );
  const schemaContext = buildSchemaPrompt(prunedTables, wasPruned, totalAvailable);
  const systemInstruction = `You are an expert ${dialect} database engineer.
Given the database schema below:
${schemaContext}
Translate the user's natural language request into a valid, optimized ${dialect} query.
Rules:
1. Output ONLY the raw SQL query. Do not wrap in markdown quotes (\`\`\`), do not provide introductory chit-chat.
2. Use standard ${dialect} syntax and dialect-specific functions (e.g. for PostgreSQL use NOW() - INTERVAL '15 days', for MySQL use NOW() - INTERVAL 15 DAY, for SQLite use datetime('now', '-15 days')).
3. Only reference table names and column names that exist in the provided schema.
4. Keep queries performant and safe.`;

  try {
    // 1. Google Gemini API
    if (config.provider === 'gemini') {
      if (!config.geminiApiKey) {
        return { sql: '', error: 'Gemini API Key is missing. Please configure it in Settings.' };
      }

      // Automatically upgrade legacy deprecated model gemini-1.5-flash to gemini-2.5-flash
      let targetModel = config.modelName?.trim() || 'gemini-2.5-flash';
      if (targetModel === 'gemini-1.5-flash') {
        targetModel = 'gemini-2.5-flash';
      }

      const executeGemini = async (model: string) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.geminiApiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: `${systemInstruction}\n\nUser Request: ${prompt}` }],
              },
            ],
          }),
          signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const errMsg = err.error?.message || `Gemini API returned status ${res.status}`;
          const isNotFound =
            res.status === 404 ||
            errMsg.toLowerCase().includes('not found') ||
            errMsg.toLowerCase().includes('not supported for generatecontent');
          return { ok: false, status: res.status, error: errMsg, isNotFound };
        }

        const data = await res.json();
        let rawSql = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        rawSql = sanitizeSqlOutput(rawSql);
        return { ok: true, sql: rawSql };
      };

      let result = await executeGemini(targetModel);

      // If the target model was not found, auto-discover supported models from the user's project/key
      if (!result.ok && result.isNotFound) {
        try {
          const availableModels = await fetchAvailableGeminiModels(config.geminiApiKey, signal);
          const priority = [
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-2.0-flash-001',
            'gemini-1.5-flash-latest',
            'gemini-1.5-flash-8b',
            'gemini-2.5-pro',
            'gemini-1.5-pro-latest',
          ];

          const fallback =
            priority.find((p) => availableModels.includes(p)) ||
            availableModels.find((m) => m.includes('flash')) ||
            availableModels[0];

          if (fallback && fallback !== targetModel) {
            result = await executeGemini(fallback);
            if (result.ok && result.sql) {
              if (onModelAutoMigrated) {
                onModelAutoMigrated(fallback);
              }
              return { sql: result.sql, explanation: `Auto-switched to active model ${fallback}` };
            }
          }
        } catch {
          // If model listing fails, fall through to reporting original error
        }
      }

      if (!result.ok) {
        throw new Error(result.error);
      }

      return { sql: result.sql || '' };
    }

    // 2. OpenAI API
    if (config.provider === 'openai') {
      if (!config.openaiApiKey) {
        return { sql: '', error: 'OpenAI API Key is missing. Please configure it in Settings.' };
      }
      const model = config.modelName || 'gpt-4o-mini';
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.openaiApiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
        }),
        signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `OpenAI returned status ${res.status}`);
      }

      const data = await res.json();
      let rawSql = data.choices?.[0]?.message?.content || '';
      rawSql = sanitizeSqlOutput(rawSql);
      return { sql: rawSql };
    }

    // 3. Local Ollama (Self-hosted & 100% Offline)
    if (config.provider === 'ollama') {
      const baseUrl = config.ollamaBaseUrl || 'http://localhost:11434';
      const model = config.modelName || 'codellama';
      const res = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: `${systemInstruction}\n\nUser Request: ${prompt}\n\nSQL:`,
          stream: false,
        }),
        signal,
      });

      if (!res.ok) {
        throw new Error(`Ollama returned status ${res.status}. Verify Ollama is running at ${baseUrl}`);
      }

      const data = await res.json();
      let rawSql = data.response || '';
      rawSql = sanitizeSqlOutput(rawSql);
      return { sql: rawSql };
    }

    return { sql: '', error: 'Unsupported AI provider selected.' };
  } catch (err: any) {
    if (err.name === 'AbortError' || signal?.aborted) {
      return { sql: '', error: 'Generation stopped by user.' };
    }
    return { sql: '', error: err.message || 'Failed to generate query with AI' };
  }
}

function sanitizeSqlOutput(text: string): string {
  let cleaned = text.trim();
  // Strip markdown code fences if model enclosed them
  if (cleaned.startsWith('```sql')) {
    cleaned = cleaned.replace(/^```sql\s*/i, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

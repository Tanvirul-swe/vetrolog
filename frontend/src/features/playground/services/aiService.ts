import { AIConfig, ExtendedTableSchema } from '@/types/database';

export interface AIQueryResponse {
  sql: string;
  explanation?: string;
  error?: string;
}

/**
 * Builds schema prompt context for LLM code generation.
 */
function buildSchemaPrompt(tables: ExtendedTableSchema[]): string {
  const schemaLines = tables.map((t) => {
    const colDefs = t.columns
      .map((c) => `${c.name} ${c.type}${c.isPrimaryKey ? ' PRIMARY KEY' : ''}`)
      .join(', ');
    const fkDefs = (t.foreignKeys || [])
      .map((fk) => `FOREIGN KEY (${fk.fromCol}) REFERENCES ${fk.toTable}(${fk.toCol})`)
      .join(', ');
    const all = [colDefs, fkDefs].filter(Boolean).join(', ');
    return `CREATE TABLE ${t.name} (${all});`;
  });

  return `Database Schema:\n${schemaLines.join('\n')}\n`;
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
 * Invokes the configured AI provider to translate natural language into SQLite.
 */
export async function generateSqlWithAI(
  prompt: string,
  tables: ExtendedTableSchema[],
  config: AIConfig,
  onModelAutoMigrated?: (newModel: string) => void,
  signal?: AbortSignal
): Promise<AIQueryResponse> {
  const schemaContext = buildSchemaPrompt(tables);
  const systemInstruction = `You are an expert SQLite database engineer for mobile applications.
Given the schema below:
${schemaContext}
Translate the user's natural language request into a valid, optimized SQLite query.
Rules:
1. Output ONLY the raw SQL query. Do not wrap in markdown quotes (\`\`\`), do not provide introductory chit-chat.
2. Use standard SQLite dialect.
3. Keep queries performant and safe.`;

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

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
 * Invokes the configured AI provider to translate natural language into SQLite.
 */
export async function generateSqlWithAI(
  prompt: string,
  tables: ExtendedTableSchema[],
  config: AIConfig
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
      const model = config.modelName || 'gemini-1.5-flash';
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
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Gemini API returned status ${res.status}`);
      }

      const data = await res.json();
      let rawSql = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      rawSql = sanitizeSqlOutput(rawSql);
      return { sql: rawSql };
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

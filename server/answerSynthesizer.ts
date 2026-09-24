import { GoogleGenAI } from '@google/genai';

export interface AnswerInsight {
  headline: string;
  summary: string;
  keyMetrics: { label: string; value: string }[];
  suggestedFollowUps: string[];
}

export async function synthesizeNaturalLanguageAnswer(
  userQuery: string,
  sqlQuery: string,
  rows: any[],
  executionTimeMs: number,
  clarificationUsed?: string
): Promise<AnswerInsight> {
  const rowCount = rows.length;

  if (rowCount === 0) {
    return {
      headline: 'No records found matching criteria',
      summary: 'The query executed successfully in ' + executionTimeMs + 'ms against PostgreSQL, but returned 0 rows for this filter combination.',
      keyMetrics: [{ label: 'Result Rows', value: '0' }, { label: 'Execution Time', value: `${executionTimeMs}ms` }],
      suggestedFollowUps: [
        'Broaden the date range or remove status filters',
        'Check if there are pending or unfulfilled records',
        'Show all customers regardless of order history'
      ]
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const sampleRows = rows.slice(0, 5);

      const prompt = `You are an AI Data Analyst presenting SQL query results to a business user in simple, conversational language.
User's Question: "${userQuery}"
${clarificationUsed ? `Clarification Applied: ${clarificationUsed}` : ''}
SQL Query Executed:
${sqlQuery}
Query Returned: ${rowCount} rows in ${executionTimeMs}ms.
First few rows of data (JSON):
${JSON.stringify(sampleRows, null, 2)}

Provide your response in JSON format with:
1. headline: A punchy 1-sentence answer to the user's question with the primary finding.
2. summary: A 2-3 sentence conversational narrative explaining the key takeaways and highlights.
3. keyMetrics: An array of 2-4 objects with 'label' and 'value' (e.g. {"label": "Top Spender", "value": "Acro Corp ($19,099)"}).
4. suggestedFollowUps: An array of 3 natural follow-up questions the user might ask next.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      if (parsed.headline && parsed.summary) {
        return {
          headline: parsed.headline,
          summary: parsed.summary,
          keyMetrics: Array.isArray(parsed.keyMetrics) ? parsed.keyMetrics : [],
          suggestedFollowUps: Array.isArray(parsed.suggestedFollowUps) ? parsed.suggestedFollowUps : []
        };
      }
    } catch (err) {
      console.warn('Gemini answer synthesis error, using heuristic synthesizer:', err);
    }
  }

  // Heuristic rule-based synthesis for instant responses
  const firstRow = rows[0];
  const keys = Object.keys(firstRow);
  const nameKey = keys.find(k => /name|title|category/i.test(k)) || keys[0];
  const valueKey = keys.find(k => /spend|amount|total|revenue|price|count|quantity/i.test(k));

  let topItemName = String(firstRow[nameKey] ?? 'Top Record');
  let topValue = valueKey ? String(firstRow[valueKey]) : '';

  if (valueKey && typeof firstRow[valueKey] === 'number') {
    topValue = /spend|amount|revenue|price|cost|balance/i.test(valueKey)
      ? `$${firstRow[valueKey].toLocaleString()}`
      : firstRow[valueKey].toLocaleString();
  }

  const keyMetrics = [
    { label: 'Total Records', value: rowCount.toString() },
    { label: 'Query Latency', value: `${executionTimeMs}ms` }
  ];

  if (valueKey) {
    keyMetrics.unshift({
      label: `Top (${nameKey})`,
      value: `${topItemName}${topValue ? ` • ${topValue}` : ''}`
    });
  }

  return {
    headline: `Found ${rowCount} matching record${rowCount === 1 ? '' : 's'} in PostgreSQL.`,
    summary: `Your query was processed and validated against the relational database in ${executionTimeMs}ms. The leading entry is ${topItemName}${topValue ? ` with ${topValue}` : ''}. Review the full breakdown in the table below or inspect the generated SQL panel.`,
    keyMetrics,
    suggestedFollowUps: [
      'Filter results by customer segment (e.g. Enterprise only)',
      'Break this down by country or geographic region',
      'Compare performance against the previous calendar quarter'
    ]
  };
}

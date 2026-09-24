import { GoogleGenAI, Type } from '@google/genai';
import { getSchemaMetadata } from './db.js';

export interface ClarificationOption {
  id: string;
  label: string;
  description: string;
  sqlHint?: string;
}

export interface AmbiguityAnalysis {
  isAmbiguous: boolean;
  ambiguityScore: number; // 0.0 (crystal clear) to 1.0 (highly ambiguous)
  ambiguityType: 'metric_definition' | 'time_window' | 'threshold' | 'aggregation_scope' | 'entity_resolution' | 'none';
  detectedAmbiguousTokens: string[];
  explanation: string;
  clarifyingQuestion?: string;
  options?: ClarificationOption[];
  resolvedIntent?: string;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  selectedOptionId?: string;
  generatedSql?: string;
}

// Fallback heuristic rules for immediate, zero-latency detection of classic SQL ambiguities
const HEURISTIC_PATTERNS = [
  {
    regex: /\b(best|top|valuable|biggest|vip)\s+(customers?|clients?|users?|buyers?)\b/i,
    ambiguityType: 'metric_definition' as const,
    tokens: ['best customers'],
    explanation: "'Best customers' is subjective and could refer to lifetime revenue, transaction frequency, or average order value.",
    question: "How would you like to define our 'best customers'?",
    options: [
      {
        id: 'total_spend',
        label: 'Lifetime Spend (Revenue)',
        description: 'Rank by total completed order amount (SUM of total_amount)',
        sqlHint: 'SUM(orders.total_amount) DESC'
      },
      {
        id: 'order_count',
        label: 'Order Frequency (Loyalty)',
        description: 'Rank by number of completed orders (COUNT of orders)',
        sqlHint: 'COUNT(orders.id) DESC'
      },
      {
        id: 'aov',
        label: 'Average Order Value (AOV)',
        description: 'Rank by average transaction size (AVG of total_amount)',
        sqlHint: 'AVG(orders.total_amount) DESC'
      },
      {
        id: 'recent_high_spend',
        label: 'Active High Spenders (2024)',
        description: 'Customers with highest spend in the current year',
        sqlHint: "order_date >= '2024-01-01' ORDER BY SUM(total_amount) DESC"
      }
    ]
  },
  {
    regex: /\b(top|popular|hottest|best-selling|best)\s+products?\b/i,
    ambiguityType: 'metric_definition' as const,
    tokens: ['top products'],
    explanation: "'Top products' could mean highest sales volume (units sold), highest gross revenue, or highest profit margin.",
    question: "How should we rank 'top products'?",
    options: [
      {
        id: 'product_revenue',
        label: 'Total Revenue Generated',
        description: 'Rank by total dollars generated (quantity * unit_price)',
        sqlHint: 'SUM(order_items.quantity * order_items.unit_price) DESC'
      },
      {
        id: 'units_sold',
        label: 'Units Sold (Volume)',
        description: 'Rank by total quantity of items sold',
        sqlHint: 'SUM(order_items.quantity) DESC'
      },
      {
        id: 'profit_margin',
        label: 'Gross Profit Margin',
        description: 'Rank by profit margin ((price - cost) * quantity sold)',
        sqlHint: 'SUM((order_items.unit_price - products.cost) * order_items.quantity) DESC'
      }
    ]
  },
  {
    regex: /\b(low\s*stock|out\s*of\s*stock|reorder)\b/i,
    ambiguityType: 'threshold' as const,
    tokens: ['low stock'],
    explanation: "Low stock threshold can be defined against each product's specific reorder level or an absolute inventory quantity.",
    question: "How should we define low stock?",
    options: [
      {
        id: 'below_reorder_level',
        label: 'Below Catalog Reorder Level',
        description: 'Products where stock_quantity <= reorder_level',
        sqlHint: 'products.stock_quantity <= products.reorder_level'
      },
      {
        id: 'critically_low_10',
        label: 'Critical Threshold (< 10 units)',
        description: 'Products with strictly fewer than 10 units in stock',
        sqlHint: 'products.stock_quantity < 10'
      },
      {
        id: 'low_and_high_demand',
        label: 'Low Stock with Active Orders',
        description: 'Stock <= reorder_level and ordered at least twice',
        sqlHint: 'stock_quantity <= reorder_level AND order_count > 1'
      }
    ]
  },
  {
    regex: /\b(inactive|dormant|churned|idle)\s+(customers?|users?)\b/i,
    ambiguityType: 'time_window' as const,
    tokens: ['inactive customers'],
    explanation: "Inactivity depends on the evaluation window: based on the customer status flag or order recency.",
    question: "How should we identify inactive customers?",
    options: [
      {
        id: 'status_flag',
        label: 'Marked Dormant or Churned',
        description: "Customers with status IN ('dormant', 'churned')",
        sqlHint: "customers.status IN ('dormant', 'churned')"
      },
      {
        id: 'no_orders_2024',
        label: 'No Orders in 2024',
        description: 'Customers who have placed zero orders since January 1, 2024',
        sqlHint: "customer_id NOT IN (SELECT customer_id FROM orders WHERE order_date >= '2024-01-01')"
      },
      {
        id: 'balance_no_activity',
        label: 'Positive Balance but No Recent Order',
        description: 'account_balance > 0 and no orders in the last 60 days',
        sqlHint: 'account_balance > 0'
      }
    ]
  }
];

export async function analyzeIntentAndAmbiguity(
  userQuery: string,
  conversationHistory: ConversationTurn[] = [],
  selectedClarification?: { optionId: string; optionLabel?: string; customNote?: string }
): Promise<AmbiguityAnalysis> {
  const cleanQuery = userQuery.trim();

  // If user just provided an answer to a clarification question or clicked an option
  if (selectedClarification) {
    return {
      isAmbiguous: false,
      ambiguityScore: 0.05,
      ambiguityType: 'none',
      detectedAmbiguousTokens: [],
      explanation: `Clarification applied: ${selectedClarification.optionLabel || selectedClarification.optionId}. Intent is now fully specified.`,
      resolvedIntent: `Original query '${cleanQuery}' clarified using metric: ${selectedClarification.optionLabel || selectedClarification.optionId} ${selectedClarification.customNote ? `(${selectedClarification.customNote})` : ''}`
    };
  }

  // Check heuristic patterns first for guaranteed fast & robust response
  for (const pattern of HEURISTIC_PATTERNS) {
    if (pattern.regex.test(cleanQuery)) {
      return {
        isAmbiguous: true,
        ambiguityScore: 0.85,
        ambiguityType: pattern.ambiguityType,
        detectedAmbiguousTokens: pattern.tokens,
        explanation: pattern.explanation,
        clarifyingQuestion: pattern.question,
        options: pattern.options
      };
    }
  }

  // Use Gemini 3.8 Flash if API key is present for nuanced ambiguity understanding
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

      const schema = getSchemaMetadata();
      const schemaSummary = schema.map(s => `${s.tableName} (${s.columns.map(c => c.name).join(', ')})`).join('\n');

      const historySummary = conversationHistory.slice(-4).map(t => `${t.role.toUpperCase()}: ${t.content}`).join('\n');

      const systemPrompt = `You are an expert Text-to-SQL Clarification Engine.
Your goal is to inspect user database queries against the PostgreSQL schema and detect SEMANTIC AMBIGUITY.
Relational Schema:
${schemaSummary}

Ambiguity criteria:
- If the user uses subjective adjectives ("best", "worst", "top", "successful", "poor", "active", "recent", "popular", "heavy", "valuable") without clarifying the exact numerical metric, mark isAmbiguous = true.
- If the user query has missing timeframes (e.g., "sales" without a time period or grouping), evaluate if it needs clarification.
- If the query is already specific (e.g. "count of customers in Germany", "total sum of orders in March 2024", "list 10 products with price > 100"), mark isAmbiguous = false.
- When ambiguous, provide a crisp clarifyingQuestion and 3-4 structured options with concrete SQL hints.`;

      const prompt = `Conversation history:
${historySummary || 'None'}

User query: "${cleanQuery}"

Analyze if this query has ambiguity that warrants clarification before generating SQL.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isAmbiguous: { type: Type.BOOLEAN },
              ambiguityScore: { type: Type.NUMBER, description: 'Float between 0 and 1' },
              ambiguityType: {
                type: Type.STRING,
                description: 'metric_definition, time_window, threshold, aggregation_scope, entity_resolution, or none'
              },
              detectedAmbiguousTokens: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              explanation: { type: Type.STRING },
              clarifyingQuestion: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    label: { type: Type.STRING },
                    description: { type: Type.STRING },
                    sqlHint: { type: Type.STRING }
                  },
                  required: ['id', 'label', 'description']
                }
              },
              resolvedIntent: { type: Type.STRING }
            },
            required: ['isAmbiguous', 'ambiguityScore', 'ambiguityType', 'detectedAmbiguousTokens', 'explanation']
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      if (parsed.isAmbiguous !== undefined) {
        return {
          isAmbiguous: Boolean(parsed.isAmbiguous),
          ambiguityScore: typeof parsed.ambiguityScore === 'number' ? parsed.ambiguityScore : 0.5,
          ambiguityType: parsed.ambiguityType || 'none',
          detectedAmbiguousTokens: parsed.detectedAmbiguousTokens || [],
          explanation: parsed.explanation || 'Analyzed query ambiguity.',
          clarifyingQuestion: parsed.clarifyingQuestion,
          options: parsed.options,
          resolvedIntent: parsed.resolvedIntent
        };
      }
    } catch (err) {
      console.warn('Gemini clarification check error, falling back to direct intent:', err);
    }
  }

  // Default: clear intent if not triggered by vague heuristics
  return {
    isAmbiguous: false,
    ambiguityScore: 0.1,
    ambiguityType: 'none',
    detectedAmbiguousTokens: [],
    explanation: 'Query intent is sufficiently specific for direct SQL generation.',
    resolvedIntent: cleanQuery
  };
}

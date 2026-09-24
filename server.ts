import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

import { getDatabase, getSchemaMetadata, executeQuery } from './server/db.js';
import { analyzeIntentAndAmbiguity } from './server/clarificationEngine.js';
import { generateSqlFromIntent } from './server/sqlGenerator.js';
import { validateAndSanitizeSql } from './server/sqlValidator.js';
import { synthesizeNaturalLanguageAnswer } from './server/answerSynthesizer.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  const app = express();
  app.use(express.json());

  // Initialize in-memory PostgreSQL relational database
  getDatabase();

  // API Endpoints

  // 1. Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      database: 'PostgreSQL (pg-mem Relational Dialect)',
      clarificationEngine: 'Active (Ambiguity Detection & Metric Resolver)',
      hasGeminiApiKey: Boolean(process.env.GEMINI_API_KEY)
    });
  });

  // 2. Schema metadata for inspection
  app.get('/api/schema', (req, res) => {
    try {
      const schemas = getSchemaMetadata();
      res.json({ tables: schemas });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Table sample preview
  app.get('/api/schema/preview/:tableName', (req, res) => {
    try {
      const { tableName } = req.params;
      const validTables = ['customers', 'orders', 'order_items', 'products', 'categories', 'support_tickets'];
      if (!validTables.includes(tableName)) {
        return res.status(400).json({ error: `Table '${tableName}' is not in allowed schema.` });
      }

      const result = executeQuery(`SELECT * FROM ${tableName} LIMIT 10`);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Clarification analysis endpoint (standalone ambiguity test)
  app.post('/api/clarify', async (req, res) => {
    try {
      const { query, conversationHistory = [], selectedClarification } = req.body;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Query string is required.' });
      }

      const analysis = await analyzeIntentAndAmbiguity(query, conversationHistory, selectedClarification);
      res.json(analysis);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Full Chat / Text-to-SQL endpoint
  app.post('/api/chat', async (req, res) => {
    try {
      const { query, conversationHistory = [], selectedClarification } = req.body;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Query is required.' });
      }

      // Step 1: Detect ambiguity using Clarification Engine
      const ambiguityAnalysis = await analyzeIntentAndAmbiguity(query, conversationHistory, selectedClarification);

      // If ambiguous and user has not yet provided clarification choice
      if (ambiguityAnalysis.isAmbiguous && !selectedClarification) {
        return res.json({
          type: 'clarification_needed',
          ambiguityAnalysis,
          clarifyingQuestion: ambiguityAnalysis.clarifyingQuestion || 'Could you please clarify your request?',
          options: ambiguityAnalysis.options || [],
          explanation: ambiguityAnalysis.explanation
        });
      }

      // Step 2: Generate SQL using clarified intent + conversation context
      const sqlResult = await generateSqlFromIntent(query, selectedClarification, conversationHistory);

      // Step 3: Check validation result
      if (!sqlResult.validation.isValid) {
        return res.json({
          type: 'validation_error',
          error: sqlResult.validation.error,
          rawSql: sqlResult.rawSql,
          safetyChecks: sqlResult.validation.safetyChecks
        });
      }

      // Step 4: Execute query against PostgreSQL
      let execResult;
      try {
        execResult = executeQuery(sqlResult.sanitizedSql);
      } catch (dbErr: any) {
        return res.status(400).json({
          type: 'execution_error',
          error: `Database execution error: ${dbErr.message}`,
          sql: sqlResult.sanitizedSql,
          formattedSql: sqlResult.formattedSql
        });
      }

      // Step 5: Synthesize conversational natural language answer
      const answerInsight = await synthesizeNaturalLanguageAnswer(
        query,
        sqlResult.sanitizedSql,
        execResult.rows,
        execResult.executionTimeMs,
        selectedClarification ? `${selectedClarification.optionLabel || selectedClarification.optionId}` : undefined
      );

      res.json({
        type: 'sql_result',
        ambiguityAnalysis,
        sql: {
          raw: sqlResult.rawSql,
          sanitized: sqlResult.sanitizedSql,
          formatted: sqlResult.formattedSql,
          explanation: sqlResult.explanation,
          assumptions: sqlResult.assumptions,
          validation: sqlResult.validation
        },
        execution: {
          rows: execResult.rows,
          rowCount: execResult.rowCount,
          executionTimeMs: execResult.executionTimeMs
        },
        answer: answerInsight
      });
    } catch (err: any) {
      console.error('Chat endpoint error:', err);
      res.status(500).json({ error: err.message || 'Internal processing error.' });
    }
  });

  // 6. Direct SQL validation endpoint
  app.post('/api/validate-sql', (req, res) => {
    try {
      const { sql } = req.body;
      if (!sql) {
        return res.status(400).json({ error: 'SQL string is required.' });
      }
      const validation = validateAndSanitizeSql(sql);
      res.json(validation);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. Direct SQL execution endpoint (Playground / Sandbox)
  app.post('/api/execute-sql', (req, res) => {
    try {
      const { sql } = req.body;
      if (!sql) {
        return res.status(400).json({ error: 'SQL query is required.' });
      }

      const validation = validateAndSanitizeSql(sql);
      if (!validation.isValid) {
        return res.status(400).json({
          error: validation.error,
          safetyChecks: validation.safetyChecks
        });
      }

      const result = executeQuery(validation.sanitizedSql);
      res.json({
        ...result,
        validation
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Frontend mounting: Vite middleware in dev, static files in prod
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ClarifySQL full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

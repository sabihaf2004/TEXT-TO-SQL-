import React, { useState } from 'react';
import { Play, ShieldCheck, ShieldAlert, Terminal, CheckCircle2, RotateCcw, Copy, Check } from 'lucide-react';
import { DataTable } from './DataTable';
import { ValidationResult } from '../types';

interface SqlPlaygroundProps {
  initialSql?: string;
}

const PRESET_QUERIES = [
  {
    name: 'Top Spenders by Revenue (Valid)',
    sql: `SELECT 
  c.id, 
  c.name, 
  c.segment, 
  c.country, 
  COUNT(o.id) as orders_count, 
  SUM(o.total_amount) as total_spent
FROM customers c
JOIN orders o ON c.id = o.customer_id
WHERE o.status = 'completed'
GROUP BY c.id, c.name, c.segment, c.country
ORDER BY total_spent DESC
LIMIT 10;`
  },
  {
    name: 'Product Inventory & Stock Status (Valid)',
    sql: `SELECT 
  p.name as product_name, 
  cat.name as category, 
  p.stock_quantity, 
  p.reorder_level, 
  p.price,
  CASE 
    WHEN p.stock_quantity <= p.reorder_level THEN 'Reorder Required'
    ELSE 'Sufficient Stock'
  END as stock_status
FROM products p
JOIN categories cat ON p.category_id = cat.id
ORDER BY p.stock_quantity ASC;`
  },
  {
    name: 'Injection Attempt: Stacked DROP TABLE (Blocked)',
    sql: `SELECT * FROM customers; DROP TABLE orders;`
  },
  {
    name: 'Data Mutation: UPDATE balances (Blocked)',
    sql: `UPDATE customers SET account_balance = 999999 WHERE id = 1;`
  },
  {
    name: 'Data Mutation: DELETE tickets (Blocked)',
    sql: `DELETE FROM support_tickets WHERE priority = 'urgent';`
  }
];

export const SqlPlayground: React.FC<SqlPlaygroundProps> = ({ initialSql }) => {
  const [sqlText, setSqlText] = useState(
    initialSql ||
      `SELECT 
  c.name, 
  c.city, 
  c.country, 
  COUNT(o.id) as completed_orders,
  SUM(o.total_amount) as total_revenue
FROM customers c
JOIN orders o ON c.id = o.customer_id
WHERE o.status = 'completed'
GROUP BY c.id, c.name, c.city, c.country
ORDER BY total_revenue DESC
LIMIT 10;`
  );

  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<Record<string, any>[] | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleValidate = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/validate-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sqlText })
      });
      const data = await res.json();
      setValidation(data);
      if (!data.isValid) {
        setErrorMsg(data.error);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecute = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/execute-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sqlText })
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Execution failed');
        setResults(null);
        if (data.safetyChecks) {
          setValidation({
            isValid: false,
            error: data.error,
            sanitizedSql: sqlText,
            formattedSql: sqlText,
            tablesUsed: [],
            safetyChecks: data.safetyChecks
          });
        }
      } else {
        setResults(data.rows);
        setExecutionTime(data.executionTimeMs);
        setValidation(data.validation);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header Info */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">PostgreSQL Sandbox & Security Validator</h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Directly execute queries against PostgreSQL or test the AST security validator against unauthorized mutations and injections.
            </p>
          </div>
        </div>

        {/* Preset Queries */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap gap-2 items-center">
          <span className="text-xs text-slate-400 font-semibold">Test Presets:</span>
          {PRESET_QUERIES.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setSqlText(preset.sql);
                setErrorMsg(null);
                setResults(null);
                setValidation(null);
              }}
              className={`px-3 py-1 rounded-lg text-xs border transition-all ${
                preset.name.includes('Blocked')
                  ? 'bg-rose-950/40 border-rose-800 text-rose-300 hover:bg-rose-900/50'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Editor & Execution Panel */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
            SQL Query (PostgreSQL Dialect)
          </span>

          <button
            onClick={handleCopy}
            className="flex items-center space-x-1 text-xs text-slate-400 hover:text-slate-200"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        <textarea
          rows={7}
          value={sqlText}
          onChange={e => setSqlText(e.target.value)}
          className="w-full p-4 rounded-xl bg-slate-950 border border-slate-700 text-emerald-300 font-mono text-xs focus:outline-none focus:border-blue-500 leading-relaxed shadow-inner"
        />

        {/* Buttons */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExecute}
              disabled={isLoading || !sqlText.trim()}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-xs flex items-center space-x-1.5 transition-colors shadow"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isLoading ? 'Executing...' : 'Execute Query'}</span>
            </button>

            <button
              onClick={handleValidate}
              disabled={isLoading || !sqlText.trim()}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center space-x-1.5 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Validate Security AST</span>
            </button>
          </div>

          <button
            onClick={() => {
              setSqlText('');
              setResults(null);
              setValidation(null);
              setErrorMsg(null);
            }}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs transition-colors flex items-center space-x-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Security Report Box */}
      {validation && (
        <div
          className={`p-4 rounded-xl border ${
            validation.isValid
              ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-300'
              : 'bg-rose-950/30 border-rose-800 text-rose-300'
          }`}
        >
          <div className="flex items-center space-x-2 font-semibold text-xs mb-2">
            {validation.isValid ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Security Validation Passed: Safe Read-Only Query</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>Security Violation: {validation.error}</span>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {validation.safetyChecks?.map((chk, i) => (
              <div
                key={i}
                className={`p-2 rounded border text-[11px] ${
                  chk.passed
                    ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-800/60 text-rose-300 font-medium'
                }`}
              >
                <div className="flex items-center space-x-1 font-semibold">
                  {chk.passed ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0" />
                  )}
                  <span className="truncate">{chk.name}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{chk.details}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && !validation && (
        <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800 text-xs text-rose-300 flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 flex-shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Results Table */}
      {results && (
        <div>
          <DataTable
            data={results}
            title={`Query Results (${results.length} records in ${executionTime}ms)`}
            pageSize={10}
          />
        </div>
      )}
    </div>
  );
};

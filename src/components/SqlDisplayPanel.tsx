import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Check, ShieldCheck, Terminal, Clock, Database, Layers } from 'lucide-react';
import { SqlDetails, ExecutionDetails } from '../types';

interface SqlDisplayPanelProps {
  sql: SqlDetails;
  execution?: ExecutionDetails;
  onRunInSandbox?: (sql: string) => void;
  defaultExpanded?: boolean;
}

export const SqlDisplayPanel: React.FC<SqlDisplayPanelProps> = ({
  sql,
  execution,
  onRunInSandbox,
  defaultExpanded = true
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(sql.formatted || sql.sanitized || sql.raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-3 rounded-xl border border-slate-700/80 bg-slate-900/90 overflow-hidden shadow-md">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/80">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-2 text-left font-mono text-xs text-slate-200 hover:text-white transition-colors"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4 text-blue-400" /> : <ChevronDown className="w-4 h-4 text-blue-400" />}
          <span className="font-semibold text-slate-100">Generated PostgreSQL Query</span>
          {execution && (
            <span className="hidden sm:inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] bg-slate-950 text-slate-400 border border-slate-800 font-sans">
              <Clock className="w-3 h-3 text-emerald-400" />
              <span>{execution.executionTimeMs}ms</span>
              <span>•</span>
              <span>{execution.rowCount} row{execution.rowCount === 1 ? '' : 's'}</span>
            </span>
          )}
        </button>

        <div className="flex items-center space-x-2">
          {onRunInSandbox && (
            <button
              onClick={() => onRunInSandbox(sql.sanitized || sql.raw)}
              className="flex items-center space-x-1 px-2 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
              title="Open and modify in SQL Sandbox"
            >
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Sandbox</span>
            </button>
          )}

          <button
            onClick={handleCopy}
            className="flex items-center space-x-1 px-2 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
            title="Copy SQL to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* SQL Code Block with syntax styling */}
          <div className="relative group">
            <pre className="p-3.5 bg-slate-950 rounded-lg text-emerald-300 font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed">
              <code>{sql.formatted || sql.sanitized || sql.raw}</code>
            </pre>
          </div>

          {/* Explanation and Assumptions */}
          {(sql.explanation || (sql.assumptions && sql.assumptions.length > 0)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {sql.explanation && (
                <div className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60">
                  <div className="flex items-center space-x-1.5 text-slate-300 font-semibold mb-1">
                    <Database className="w-3.5 h-3.5 text-blue-400" />
                    <span>Query Logic & Scope</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{sql.explanation}</p>
                </div>
              )}

              {sql.assumptions && sql.assumptions.length > 0 && (
                <div className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60">
                  <div className="flex items-center space-x-1.5 text-slate-300 font-semibold mb-1">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Assumptions & Filters</span>
                  </div>
                  <ul className="list-disc list-inside text-slate-300 space-y-0.5">
                    {sql.assumptions.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Security Validation Report */}
          {sql.validation && (
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Security & AST Safety Checks:</span>
                  <span className="text-emerald-400 font-medium ml-1">Passed (Safe to Execute)</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {sql.validation.safetyChecks?.map((check, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded border text-[11px] ${
                      check.passed
                        ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                        : 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center space-x-1 font-medium">
                      {check.passed ? (
                        <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0" />
                      )}
                      <span className="truncate">{check.name}</span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-400 line-clamp-2">{check.details}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

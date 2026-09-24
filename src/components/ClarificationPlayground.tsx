import React, { useState } from 'react';
import { Sparkles, AlertCircle, CheckCircle2, Play, HelpCircle, Layers, ArrowRight } from 'lucide-react';
import { AmbiguityAnalysis } from '../types';

const TEST_PHRASES = [
  { text: 'Who are our best customers?', category: 'Metric Definition' },
  { text: 'Show top selling products', category: 'Metric Definition' },
  { text: 'Find inactive customers', category: 'Time-window Ambiguity' },
  { text: 'List products with low stock', category: 'Threshold Ambiguity' },
  { text: 'Count customers in Germany', category: 'Crystal Clear (No Ambiguity)' },
  { text: 'Total completed orders in March 2024', category: 'Crystal Clear (No Ambiguity)' }
];

export const ClarificationPlayground: React.FC = () => {
  const [testQuery, setTestQuery] = useState('Who are our best customers?');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AmbiguityAnalysis | null>(null);

  const runAnalysis = async (queryToTest: string) => {
    if (!queryToTest.trim()) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryToTest })
      });
      const data = await res.json();
      setAnalysis(data);
    } catch (err) {
      console.error('Clarification analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Intro Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 shadow-md">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-700 flex items-center justify-center text-cyan-300 shadow">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Clarification Engine Deep-Dive & Testbed</h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Test how the Clarification Engine detects subjective vocabulary, assigns ambiguity scores, and formats follow-up questions.
            </p>
          </div>
        </div>

        {/* Preset query chips */}
        <div className="mt-4 pt-3 border-t border-slate-800/80">
          <span className="text-xs text-slate-400 font-semibold block mb-2">
            Click to test common business queries:
          </span>
          <div className="flex flex-wrap gap-2">
            {TEST_PHRASES.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setTestQuery(preset.text);
                  runAnalysis(preset.text);
                }}
                className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-500 transition-all flex items-center space-x-1.5"
              >
                <span>{preset.text}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-cyan-400 border border-slate-800">
                  {preset.category}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Input box */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-3">
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Query to Analyze for Semantic Ambiguity:
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={testQuery}
            onChange={e => setTestQuery(e.target.value)}
            placeholder="Type any phrase with subjective words like 'best', 'top', 'low stock', or specific filters..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={() => runAnalysis(testQuery)}
            disabled={isAnalyzing || !testQuery.trim()}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isAnalyzing ? 'Analyzing...' : 'Analyze Intent'}</span>
          </button>
        </div>
      </div>

      {/* Analysis Results Display */}
      {analysis && (
        <div className="space-y-4">
          {/* Ambiguity Score Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Status card */}
            <div
              className={`p-4 rounded-xl border flex items-center space-x-3 ${
                analysis.isAmbiguous
                  ? 'bg-amber-950/20 border-amber-800/60 text-amber-300'
                  : 'bg-emerald-950/20 border-emerald-800/60 text-emerald-300'
              }`}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-900 flex-shrink-0">
                {analysis.isAmbiguous ? (
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                )}
              </div>
              <div>
                <span className="text-xs uppercase font-semibold text-slate-400 block">
                  Ambiguity Status
                </span>
                <span className="text-sm font-bold">
                  {analysis.isAmbiguous ? 'Clarification Required' : 'Intent is Clear & Ready'}
                </span>
              </div>
            </div>

            {/* Score gauge */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-slate-950 flex items-center justify-center text-cyan-400 font-mono font-bold text-sm">
                {Math.round(analysis.ambiguityScore * 100)}%
              </div>
              <div>
                <span className="text-xs uppercase font-semibold text-slate-400 block">
                  Ambiguity Score
                </span>
                <span className="text-xs text-slate-300">
                  {analysis.ambiguityScore >= 0.7
                    ? 'High Subjectivity'
                    : analysis.ambiguityScore >= 0.3
                    ? 'Moderate'
                    : 'Low / Deterministic'}
                </span>
              </div>
            </div>

            {/* Category */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-slate-950 flex items-center justify-center text-blue-400">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs uppercase font-semibold text-slate-400 block">
                  Ambiguity Type
                </span>
                <span className="text-xs font-mono font-semibold text-slate-200">
                  {analysis.ambiguityType}
                </span>
              </div>
            </div>
          </div>

          {/* Explanation & Tokens */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Linguistic Reasoning:
              </h4>
              <p className="text-sm text-slate-200 leading-relaxed">{analysis.explanation}</p>
            </div>

            {analysis.detectedAmbiguousTokens.length > 0 && (
              <div className="flex items-center space-x-2 pt-2 border-t border-slate-800 text-xs">
                <span className="text-slate-400 font-medium">Flagged Tokens:</span>
                {analysis.detectedAmbiguousTokens.map((token, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-300 font-mono text-xs"
                  >
                    "{token}"
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Clarification Output (if ambiguous) */}
          {analysis.isAmbiguous && analysis.options && (
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center space-x-2 text-sm font-semibold text-cyan-300">
                <HelpCircle className="w-4 h-4" />
                <span>Generated Clarifying Question:</span>
              </div>
              <p className="text-base font-medium text-white px-2">
                "{analysis.clarifyingQuestion}"
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {analysis.options.map(opt => (
                  <div
                    key={opt.id}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-white flex items-center space-x-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{opt.label}</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">id: {opt.id}</span>
                    </div>
                    <p className="text-xs text-slate-400 mb-2">{opt.description}</p>
                    {opt.sqlHint && (
                      <div className="px-2 py-1 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-emerald-300">
                        Formula: {opt.sqlHint}
                      </div>
                    )}
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

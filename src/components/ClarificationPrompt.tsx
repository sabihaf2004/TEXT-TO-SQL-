import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Send, HelpCircle, Sparkles } from 'lucide-react';
import { AmbiguityAnalysis, ClarificationOption } from '../types';

interface ClarificationPromptProps {
  analysis: AmbiguityAnalysis;
  onSelectOption: (option: ClarificationOption, customNote?: string) => void;
  onCustomClarification: (text: string) => void;
  disabled?: boolean;
}

export const ClarificationPrompt: React.FC<ClarificationPromptProps> = ({
  analysis,
  onSelectOption,
  onCustomClarification,
  disabled = false
}) => {
  const [customText, setCustomText] = useState('');
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  const handleOptionClick = (option: ClarificationOption) => {
    if (disabled) return;
    setSelectedOptionId(option.id);
    onSelectOption(option, customText.trim() || undefined);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim() || disabled) return;
    onCustomClarification(customText.trim());
  };

  return (
    <div className="mt-3 p-4 rounded-xl border border-amber-500/40 bg-gradient-to-b from-amber-950/30 via-slate-900 to-slate-900 shadow-lg">
      {/* Ambiguity Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0 text-amber-400">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-sm font-semibold text-amber-300">Ambiguity Detected</h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 border border-amber-700 text-amber-400">
                {Math.round(analysis.ambiguityScore * 100)}% Ambiguity Score
              </span>
              <span className="hidden sm:inline-block text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {analysis.ambiguityType.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">{analysis.explanation}</p>
          </div>
        </div>
      </div>

      {/* Detected Ambiguous Tokens */}
      {analysis.detectedAmbiguousTokens && analysis.detectedAmbiguousTokens.length > 0 && (
        <div className="mb-3 flex items-center space-x-2 text-xs text-slate-400">
          <span>Subjective term(s):</span>
          {analysis.detectedAmbiguousTokens.map((token, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/80 font-mono text-[11px]"
            >
              "{token}"
            </span>
          ))}
        </div>
      )}

      {/* Clarifying Question */}
      <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700 mb-3">
        <div className="flex items-center space-x-2 text-slate-200 font-medium text-xs mb-1">
          <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
          <span>Clarification Required:</span>
        </div>
        <p className="text-sm font-semibold text-white">
          {analysis.clarifyingQuestion || "How would you like to define this metric for SQL calculation?"}
        </p>
      </div>

      {/* Structured Option Cards */}
      {analysis.options && analysis.options.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Select a concrete interpretation:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {analysis.options.map(option => {
              const isSelected = selectedOptionId === option.id;
              return (
                <button
                  key={option.id}
                  disabled={disabled}
                  onClick={() => handleOptionClick(option)}
                  className={`text-left p-3 rounded-xl border transition-all relative ${
                    isSelected
                      ? 'bg-blue-900/40 border-blue-500 shadow-md shadow-blue-500/20 ring-1 ring-blue-500'
                      : 'bg-slate-850 hover:bg-slate-800 border-slate-700/80 hover:border-slate-600'
                  } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="font-semibold text-xs text-slate-100 flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{option.label}</span>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />}
                  </div>

                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">{option.description}</p>

                  {option.sqlHint && (
                    <div className="mt-2 inline-block px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-[10px] text-emerald-300">
                      {option.sqlHint}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom Clarification Input */}
      <form onSubmit={handleCustomSubmit} className="pt-2 border-t border-slate-800">
        <label className="block text-[11px] text-slate-400 mb-1.5">
          Or specify a custom metric definition / filter:
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            disabled={disabled}
            placeholder="e.g. Only completed orders over $5,000 in Q1 2024..."
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={disabled || !customText.trim()}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-xs font-medium text-white flex items-center space-x-1 transition-colors"
          >
            <Send className="w-3 h-3" />
            <span className="hidden sm:inline">Apply</span>
          </button>
        </div>
      </form>
    </div>
  );
};

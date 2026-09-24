import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, RefreshCw, Bot, User, ShieldAlert, ArrowRight, Lightbulb } from 'lucide-react';
import { ChatMessage, ClarificationOption } from '../types';
import { ClarificationPrompt } from './ClarificationPrompt';
import { SqlDisplayPanel } from './SqlDisplayPanel';
import { DataTable } from './DataTable';

interface ChatInterfaceProps {
  onRunInSandbox: (sql: string) => void;
}

const SAMPLE_QUERIES = [
  {
    text: 'Show our best customers',
    badge: 'Ambiguous: Metric Clarification',
    color: 'border-amber-700/60 bg-amber-950/40 text-amber-300'
  },
  {
    text: 'What was our total revenue last month by category?',
    badge: 'Clear: Direct Aggregation',
    color: 'border-emerald-700/60 bg-emerald-950/40 text-emerald-300'
  },
  {
    text: 'Which products have low stock?',
    badge: 'Ambiguous: Threshold Definition',
    color: 'border-amber-700/60 bg-amber-950/40 text-amber-300'
  },
  {
    text: 'List top 5 enterprise customers with highest account balance',
    badge: 'Clear: Filtered & Sorted',
    color: 'border-blue-700/60 bg-blue-950/40 text-blue-300'
  },
  {
    text: 'DROP TABLE customers; SELECT * FROM products;',
    badge: 'Security Test: Injection Blocked',
    color: 'border-rose-700/60 bg-rose-950/40 text-rose-300'
  }
];

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ onRunInSandbox }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hello! I'm your AI Text-to-SQL Assistant with an integrated Clarification Engine. Ask any business question about your customers, orders, inventory, or categories. If your question contains subjective terms (like 'best customers' or 'low stock'), I will first ask for clarification so the generated SQL matches your exact definition.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'text'
    }
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (queryText: string, clarificationContext?: any) => {
    const textToSend = queryText.trim();
    if (!textToSend || isLoading) return;

    // Add user message if not just applying clarification
    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: clarificationContext
        ? `Clarified metric: ${clarificationContext.optionLabel || clarificationContext.optionId}${
            clarificationContext.customNote ? ` (${clarificationContext.customNote})` : ''
          }`
        : textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'text',
      selectedOptionId: clarificationContext?.optionId
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    // Dynamic loading progress steps
    setLoadingStep('Analyzing query intent & detecting ambiguities...');
    const stepTimer1 = setTimeout(() => {
      setLoadingStep('Validating schema relations & table references...');
    }, 600);
    const stepTimer2 = setTimeout(() => {
      setLoadingStep('Synthesizing & executing PostgreSQL query...');
    }, 1200);

    try {
      // Build conversation history for multi-turn context
      const historyPayload = messages
        .filter(m => m.type !== 'clarification_prompt')
        .slice(-6)
        .map(m => ({
          role: m.role,
          content: m.content,
          selectedOptionId: m.selectedOptionId,
          generatedSql: m.sql?.sanitized
        }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: clarificationContext?.originalQuery || textToSend,
          conversationHistory: historyPayload,
          selectedClarification: clarificationContext
        })
      });

      const data = await res.json();
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      const botMsgId = `bot-${Date.now()}`;

      if (data.type === 'clarification_needed') {
        const botClarificationMsg: ChatMessage = {
          id: botMsgId,
          role: 'assistant',
          content: data.clarifyingQuestion || 'I noticed some ambiguity in your request.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'clarification_prompt',
          ambiguityAnalysis: data.ambiguityAnalysis,
          clarifyingQuestion: data.clarifyingQuestion,
          options: data.options
        };
        setMessages(prev => [...prev, botClarificationMsg]);
      } else if (data.type === 'validation_error') {
        const botErrorMsg: ChatMessage = {
          id: botMsgId,
          role: 'assistant',
          content: `Security Block: The generated or requested SQL failed security validation.\n${data.error}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'validation_error',
          error: data.error,
          safetyChecks: data.safetyChecks
        };
        setMessages(prev => [...prev, botErrorMsg]);
      } else if (data.type === 'execution_error') {
        const botExecErrorMsg: ChatMessage = {
          id: botMsgId,
          role: 'assistant',
          content: `PostgreSQL Execution Error: ${data.error}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'execution_error',
          error: data.error
        };
        setMessages(prev => [...prev, botExecErrorMsg]);
      } else if (data.type === 'sql_result') {
        const botResultMsg: ChatMessage = {
          id: botMsgId,
          role: 'assistant',
          content: data.answer?.headline || 'Query executed successfully.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'sql_result',
          sql: data.sql,
          execution: data.execution,
          answer: data.answer,
          ambiguityAnalysis: data.ambiguityAnalysis
        };
        setMessages(prev => [...prev, botResultMsg]);
      } else {
        // Generic fallback
        const botGenericMsg: ChatMessage = {
          id: botMsgId,
          role: 'assistant',
          content: data.error || 'Processed your request.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'text'
        };
        setMessages(prev => [...prev, botGenericMsg]);
      }
    } catch (err: any) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setMessages(prev => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          role: 'assistant',
          content: `Failed to connect to backend: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'text'
        }
      ]);
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  const handleClarificationSelect = (
    originalQuery: string,
    option: ClarificationOption,
    customNote?: string
  ) => {
    handleSend(originalQuery, {
      originalQuery,
      optionId: option.id,
      optionLabel: option.label,
      customNote,
      sqlHint: option.sqlHint
    });
  };

  const handleCustomClarificationSubmit = (originalQuery: string, customText: string) => {
    handleSend(originalQuery, {
      originalQuery,
      optionId: 'custom',
      optionLabel: customText,
      customNote: customText
    });
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        content: 'Conversation context reset. What would you like to query next?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'text'
      }
    ]);
  };

  // Helper to find the original user query that triggered a clarification
  const findOriginalQueryForClarification = (msgIndex: number): string => {
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        return messages[i].content;
      }
    }
    return 'best customers';
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-6xl mx-auto px-2 sm:px-4 py-3">
      {/* Sample Quick Prompt Chips */}
      <div className="mb-3">
        <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1.5 font-medium px-1">
          <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
          <span>Try these example prompts (testing clear vs ambiguous vs security):</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {SAMPLE_QUERIES.map((sample, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(sample.text)}
              disabled={isLoading}
              className={`flex-shrink-0 flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs text-slate-300 hover:text-white hover:border-slate-500 bg-slate-900 transition-all ${
                isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <span className="truncate max-w-[220px] font-medium">{sample.text}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded border font-semibold ${sample.color}`}
              >
                {sample.badge.split(':')[0]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto space-y-4 px-2 sm:px-3 py-2 rounded-2xl bg-slate-900/40 border border-slate-800/80 shadow-inner">
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow ${
                  isUser
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 border border-slate-700 text-cyan-400'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble Container */}
              <div className={`max-w-[92%] sm:max-w-[85%] space-y-2`}>
                <div className={`flex items-center space-x-2 text-[11px] text-slate-500 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <span>{isUser ? 'You' : 'ClarifySQL Engine'}</span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </div>

                {/* Primary Message Bubble */}
                <div
                  className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-slate-850 border border-slate-700/80 text-slate-100 rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>

                {/* Clarification Prompt Card (If ambiguity was detected) */}
                {msg.type === 'clarification_prompt' && msg.ambiguityAnalysis && (
                  <ClarificationPrompt
                    analysis={msg.ambiguityAnalysis}
                    onSelectOption={(opt, note) =>
                      handleClarificationSelect(
                        findOriginalQueryForClarification(index),
                        opt,
                        note
                      )
                    }
                    onCustomClarification={text =>
                      handleCustomClarificationSubmit(
                        findOriginalQueryForClarification(index),
                        text
                      )
                    }
                    disabled={index < messages.length - 1} // only active on latest message
                  />
                )}

                {/* Natural Language Insights (If SQL Result) */}
                {msg.type === 'sql_result' && msg.answer && (
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                    {/* Summary Narrative */}
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                      {msg.answer.summary}
                    </p>

                    {/* Key Metrics Callouts */}
                    {msg.answer.keyMetrics && msg.answer.keyMetrics.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                        {msg.answer.keyMetrics.map((metric, mIdx) => (
                          <div
                            key={mIdx}
                            className="p-2 rounded-lg bg-slate-950/80 border border-slate-800"
                          >
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                              {metric.label}
                            </span>
                            <span className="text-xs sm:text-sm font-bold text-cyan-300 truncate block mt-0.5">
                              {metric.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Suggested Follow-ups */}
                    {msg.answer.suggestedFollowUps && msg.answer.suggestedFollowUps.length > 0 && (
                      <div className="pt-2 border-t border-slate-800/80">
                        <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                          Suggested conversational follow-ups:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.answer.suggestedFollowUps.map((followUp, fIdx) => (
                            <button
                              key={fIdx}
                              onClick={() => handleSend(followUp)}
                              className="text-left text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors flex items-center space-x-1"
                            >
                              <span>{followUp}</span>
                              <ArrowRight className="w-3 h-3 text-blue-400" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Expandable SQL Panel */}
                {msg.type === 'sql_result' && msg.sql && (
                  <SqlDisplayPanel
                    sql={msg.sql}
                    execution={msg.execution}
                    onRunInSandbox={onRunInSandbox}
                  />
                )}

                {/* Tabular Results */}
                {msg.type === 'sql_result' && msg.execution && msg.execution.rows && (
                  <DataTable
                    data={msg.execution.rows}
                    title="Executed PostgreSQL Records"
                    pageSize={5}
                  />
                )}

                {/* Security Error Display */}
                {msg.type === 'validation_error' && (
                  <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800/60 text-xs text-rose-200 space-y-2">
                    <div className="flex items-center space-x-2 text-rose-300 font-semibold">
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                      <span>Security Validation Rule Triggered</span>
                    </div>
                    <p className="text-rose-200 leading-relaxed">{msg.error}</p>
                    {msg.safetyChecks && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                        {msg.safetyChecks.map((check, cIdx) => (
                          <div
                            key={cIdx}
                            className={`p-1.5 rounded text-[10px] border ${
                              check.passed
                                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                                : 'bg-rose-950/50 border-rose-700 text-rose-300 font-medium'
                            }`}
                          >
                            <span>{check.name}: </span>
                            <span className="opacity-80">{check.details}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 animate-pulse">
              <Sparkles className="w-4 h-4 animate-spin" />
            </div>
            <div className="p-3.5 rounded-2xl rounded-tl-none bg-slate-850 border border-slate-700/80 text-xs text-slate-300 flex items-center space-x-2 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              <span className="font-medium text-cyan-200">{loadingStep || 'Processing query...'}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box & Action Bar */}
      <div className="mt-3 pt-2">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSend(inputQuery);
          }}
          className="relative flex items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={inputQuery}
              onChange={e => setInputQuery(e.target.value)}
              disabled={isLoading}
              placeholder="Ask a question (e.g. 'Show our best customers', 'Revenue by category', 'Low stock products')..."
              className="w-full pl-4 pr-10 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-lg transition-all"
            />
            {inputQuery.trim() && (
              <button
                type="submit"
                disabled={isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                title="Send query"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleClearHistory}
            className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors shadow-lg"
            title="Reset conversation context"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </form>

        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5 px-1">
          <span>Clarification Engine active: detects semantic ambiguities before SQL execution</span>
          <span className="font-mono">PostgreSQL 16 Dialect</span>
        </div>
      </div>
    </div>
  );
};

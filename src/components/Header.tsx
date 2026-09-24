import React from 'react';
import { Database, ShieldCheck, Sparkles, Code, Table, Compass, Terminal } from 'lucide-react';

interface HeaderProps {
  activeTab: 'chat' | 'schema' | 'clarification' | 'sandbox' | 'fastapi';
  onTabChange: (tab: 'chat' | 'schema' | 'clarification' | 'sandbox' | 'fastapi') => void;
  tableCount: number;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange, tableCount }) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">ClarifySQL</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-950 text-cyan-300 border border-cyan-800">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Clarification Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Ambiguity-Aware Text-to-SQL • PostgreSQL • Validated Execution
              </p>
            </div>
          </div>

          {/* System Status Badges */}
          <div className="hidden lg:flex items-center space-x-3 text-xs">
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-medium text-slate-200">PostgreSQL</span>
              <span className="text-slate-400">({tableCount} tables)</span>
            </div>

            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>AST Validator:</span>
              <span className="text-emerald-400 font-medium">Enforcing Read-Only</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-1">
            <button
              onClick={() => onTabChange('chat')}
              className={`flex items-center px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'chat'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Compass className="w-4 h-4 mr-1.5" />
              <span>Assistant</span>
            </button>

            <button
              onClick={() => onTabChange('schema')}
              className={`flex items-center px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'schema'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Table className="w-4 h-4 mr-1.5" />
              <span>Schema & Data</span>
            </button>

            <button
              onClick={() => onTabChange('clarification')}
              className={`flex items-center px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'clarification'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              <span>Clarification Engine</span>
            </button>

            <button
              onClick={() => onTabChange('sandbox')}
              className={`flex items-center px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'sandbox'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Terminal className="w-4 h-4 mr-1.5" />
              <span>SQL Sandbox</span>
            </button>

            <button
              onClick={() => onTabChange('fastapi')}
              className={`flex items-center px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'fastapi'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Code className="w-4 h-4 mr-1.5" />
              <span>FastAPI Backend</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};

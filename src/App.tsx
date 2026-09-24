/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ChatInterface } from './components/ChatInterface';
import { SchemaInspector } from './components/SchemaInspector';
import { ClarificationPlayground } from './components/ClarificationPlayground';
import { SqlPlayground } from './components/SqlPlayground';
import { FastApiArchitecture } from './components/FastApiArchitecture';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'schema' | 'clarification' | 'sandbox' | 'fastapi'>('chat');
  const [tableCount, setTableCount] = useState<number>(6);
  const [sandboxSql, setSandboxSql] = useState<string>('');

  useEffect(() => {
    fetch('/api/schema')
      .then(res => res.json())
      .then(data => {
        if (data.tables && Array.isArray(data.tables)) {
          setTableCount(data.tables.length);
        }
      })
      .catch(err => console.warn('Could not fetch schema count:', err));
  }, []);

  const handleRunInSandbox = (sql: string) => {
    setSandboxSql(sql);
    setActiveTab('sandbox');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Header Bar */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tableCount={tableCount}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'chat' && (
          <ChatInterface onRunInSandbox={handleRunInSandbox} />
        )}

        {activeTab === 'schema' && (
          <SchemaInspector />
        )}

        {activeTab === 'clarification' && (
          <ClarificationPlayground />
        )}

        {activeTab === 'sandbox' && (
          <SqlPlayground initialSql={sandboxSql} />
        )}

        {activeTab === 'fastapi' && (
          <FastApiArchitecture />
        )}
      </main>
    </div>
  );
}

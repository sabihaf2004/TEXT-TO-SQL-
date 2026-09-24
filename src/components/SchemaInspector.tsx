import React, { useState, useEffect } from 'react';
import { Table, Key, Link2, Database, Eye, RefreshCw, Layers } from 'lucide-react';
import { TableSchema } from '../types';
import { DataTable } from './DataTable';

export const SchemaInspector: React.FC = () => {
  const [tables, setTables] = useState<TableSchema[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('customers');
  const [sampleData, setSampleData] = useState<Record<string, any>[]>([]);
  const [isLoadingSchema, setIsLoadingSchema] = useState(true);
  const [isLoadingSample, setIsLoadingSample] = useState(false);

  const fetchSchema = async () => {
    setIsLoadingSchema(true);
    try {
      const res = await fetch('/api/schema');
      const data = await res.json();
      if (data.tables) {
        setTables(data.tables);
        if (data.tables.length > 0 && !selectedTable) {
          setSelectedTable(data.tables[0].tableName);
        }
      }
    } catch (err) {
      console.error('Failed to fetch schema:', err);
    } finally {
      setIsLoadingSchema(false);
    }
  };

  const fetchTablePreview = async (tableName: string) => {
    setIsLoadingSample(true);
    try {
      const res = await fetch(`/api/schema/preview/${tableName}`);
      const data = await res.json();
      if (data.rows) {
        setSampleData(data.rows);
      }
    } catch (err) {
      console.error('Failed to preview table:', err);
    } finally {
      setIsLoadingSample(false);
    }
  };

  useEffect(() => {
    fetchSchema();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      fetchTablePreview(selectedTable);
    }
  }, [selectedTable]);

  const activeTableMeta = tables.find(t => t.tableName === selectedTable);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
        <div>
          <div className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-white">PostgreSQL Relational Schema Browser</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time metadata inspection for the 6 seeded e-commerce and enterprise SaaS tables.
          </p>
        </div>

        <button
          onClick={fetchSchema}
          disabled={isLoadingSchema}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSchema ? 'animate-spin' : ''}`} />
          <span>Refresh Metadata</span>
        </button>
      </div>

      {/* Main Layout: Tables Selector + Table Columns & Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Tables List */}
        <div className="lg:col-span-1 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1 mb-2">
            Tables ({tables.length})
          </h3>
          <div className="space-y-1.5">
            {tables.map(table => {
              const isSelected = selectedTable === table.tableName;
              return (
                <button
                  key={table.tableName}
                  onClick={() => setSelectedTable(table.tableName)}
                  className={`w-full text-left px-3.5 py-3 rounded-xl border transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-blue-900/30 border-blue-500 shadow-md ring-1 ring-blue-500 text-white'
                      : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Table className={`w-4 h-4 ${isSelected ? 'text-blue-400' : 'text-slate-500'}`} />
                    <div>
                      <span className="font-mono text-xs font-semibold block">{table.tableName}</span>
                      <span className="text-[11px] text-slate-500 block truncate max-w-[150px]">
                        {table.columns.length} columns
                      </span>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                    {table.rowCount} rows
                  </span>
                </button>
              );
            })}
          </div>

          {/* Relational Graph Summary */}
          <div className="mt-6 p-4 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-slate-400 space-y-2">
            <div className="flex items-center space-x-1.5 text-slate-200 font-semibold">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Foreign Key Relationships</span>
            </div>
            <ul className="space-y-1.5 text-[11px] font-mono">
              <li className="flex items-center space-x-1">
                <span className="text-blue-400">orders</span>
                <span className="text-slate-500">.customer_id →</span>
                <span className="text-emerald-400">customers.id</span>
              </li>
              <li className="flex items-center space-x-1">
                <span className="text-blue-400">order_items</span>
                <span className="text-slate-500">.order_id →</span>
                <span className="text-emerald-400">orders.id</span>
              </li>
              <li className="flex items-center space-x-1">
                <span className="text-blue-400">order_items</span>
                <span className="text-slate-500">.product_id →</span>
                <span className="text-emerald-400">products.id</span>
              </li>
              <li className="flex items-center space-x-1">
                <span className="text-blue-400">products</span>
                <span className="text-slate-500">.category_id →</span>
                <span className="text-emerald-400">categories.id</span>
              </li>
              <li className="flex items-center space-x-1">
                <span className="text-blue-400">support_tickets</span>
                <span className="text-slate-500">.customer_id →</span>
                <span className="text-emerald-400">customers.id</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right Column: Columns Definition + Live Data Preview */}
        <div className="lg:col-span-3 space-y-6">
          {activeTableMeta ? (
            <>
              {/* Table Metadata Details */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold font-mono text-cyan-300">
                      Table: {activeTableMeta.tableName}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">{activeTableMeta.description}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300">
                    Total Records: {activeTableMeta.rowCount}
                  </span>
                </div>

                {/* Column Schema Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/40">
                        <th className="py-2 px-3 font-mono">Column</th>
                        <th className="py-2 px-3 font-mono">Type</th>
                        <th className="py-2 px-3">Keys / Constraints</th>
                        <th className="py-2 px-3">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {activeTableMeta.columns.map(col => (
                        <tr key={col.name} className="hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-200">
                            {col.name}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-cyan-400">{col.type}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center space-x-1">
                              {col.isPrimary && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                                  <Key className="w-2.5 h-2.5 mr-0.5" />
                                  PRIMARY KEY
                                </span>
                              )}
                              {col.isForeign && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800">
                                  <Link2 className="w-2.5 h-2.5 mr-0.5" />
                                  FK ({col.references})
                                </span>
                              )}
                              {!col.isPrimary && !col.isForeign && (
                                <span className="text-slate-600">-</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">{col.description || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sample Data Preview */}
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                    <Eye className="w-3.5 h-3.5 text-blue-400" />
                    <span>Live Sample Records (First 10 Rows)</span>
                  </div>
                </div>

                {isLoadingSample ? (
                  <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-400 text-xs">
                    Loading sample rows...
                  </div>
                ) : (
                  <DataTable
                    data={sampleData}
                    title={`Live Table: ${activeTableMeta.tableName}`}
                    pageSize={10}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400">
              Select a table from the left to view its relational schema and seeded records.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

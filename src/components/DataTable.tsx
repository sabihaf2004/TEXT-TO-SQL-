import React, { useState, useMemo } from 'react';
import { Download, Search, ArrowUpDown, ChevronLeft, ChevronRight, Table as TableIcon } from 'lucide-react';

interface DataTableProps {
  data: Record<string, any>[];
  title?: string;
  pageSize?: number;
}

export const DataTable: React.FC<DataTableProps> = ({
  data,
  title = 'PostgreSQL Query Results',
  pageSize = 5
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  const columns = useMemo(() => {
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]);
  }, [data]);

  // Filter rows by search term
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(row =>
      Object.values(row).some(val =>
        String(val ?? '').toLowerCase().includes(term)
      )
    );
  }, [data, searchTerm]);

  // Sort rows
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA == null) return 1;
      if (valB == null) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [filteredData, sortKey, sortDirection]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const currentRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (col: string) => {
    if (sortKey === col) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col);
      setSortDirection('desc');
    }
  };

  const exportCsv = () => {
    if (!data || data.length === 0) return;
    const headers = columns.join(',');
    const rows = data.map(row =>
      columns.map(col => {
        let cell = String(row[col] ?? '');
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
          cell = `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `query_results_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!data || data.length === 0) {
    return (
      <div className="mt-3 p-6 text-center rounded-xl border border-slate-800 bg-slate-900/50 text-slate-400 text-sm">
        <TableIcon className="w-8 h-8 mx-auto mb-2 text-slate-500 opacity-60" />
        <p>No rows returned from PostgreSQL query.</p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-md">
      {/* Table controls */}
      <div className="p-3 bg-slate-850 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="flex items-center space-x-2 text-xs text-slate-300 font-medium">
          <TableIcon className="w-4 h-4 text-blue-400" />
          <span>{title}</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[11px] font-mono">
            {data.length} row{data.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          {/* Quick search */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter results..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Export CSV button */}
          <button
            onClick={exportCsv}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap"
            title="Download CSV export"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Table View */}
      <div className="overflow-x-auto max-h-96">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 bg-slate-800/95 backdrop-blur z-10 text-slate-300 font-semibold border-b border-slate-700">
            <tr>
              <th className="py-2.5 px-3 w-10 text-slate-500 font-mono text-[10px]">#</th>
              {columns.map(col => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="py-2.5 px-3 cursor-pointer hover:bg-slate-700/50 transition-colors select-none font-mono"
                >
                  <div className="flex items-center space-x-1">
                    <span>{col}</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 text-slate-200">
            {currentRows.map((row, rowIdx) => {
              const globalIdx = (currentPage - 1) * pageSize + rowIdx + 1;
              return (
                <tr key={rowIdx} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2 px-3 text-slate-500 font-mono text-[10px]">{globalIdx}</td>
                  {columns.map(col => {
                    const value = row[col];
                    let displayVal = String(value ?? '-');
                    const isNumeric = typeof value === 'number';
                    const isCurrency =
                      isNumeric && /amount|price|spend|revenue|cost|balance/i.test(col);

                    if (isCurrency) {
                      displayVal = `$${value.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}`;
                    } else if (isNumeric && !col.endsWith('_id')) {
                      displayVal = value.toLocaleString();
                    }

                    return (
                      <td
                        key={col}
                        className={`py-2 px-3 whitespace-nowrap ${
                          isNumeric ? 'font-mono text-cyan-300' : 'text-slate-300'
                        }`}
                      >
                        {displayVal}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="px-4 py-2 bg-slate-850 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} records
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-slate-300 text-xs">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  X, Database, Table, Globe, Eye, Columns, ArrowRight, 
  Server, RefreshCw, FileCode, Check, Copy, Cpu, GitFork, 
  ArrowUpRight, ArrowDownLeft 
} from 'lucide-react';
import { fetchTableColumns } from '../services/api';

export function InspectorDrawer({ selectedItem, onClose, onSelectItem }) {
  if (!selectedItem) return null;

  const isEdge = Boolean(selectedItem.source && selectedItem.target);
  const data = selectedItem.data || {};

  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'sql', 'impact'
  const [columns, setColumns] = useState(data.columns || []);
  const [loadingCols, setLoadingCols] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setActiveTab('overview');
    if (!isEdge && data.name && data.database && data.type !== 'REMOTE SOURCE TABLE' && data.type !== 'PROCEDURE') {
      if (data.columns && data.columns.length > 0) {
        setColumns(data.columns);
      } else {
        setLoadingCols(true);
        fetchTableColumns(data.database, data.schema, data.name)
          .then((cols) => {
            setColumns(cols);
          })
          .catch((err) => {
            console.error('Failed to load columns:', err);
            setColumns([]);
          })
          .finally(() => {
            setLoadingCols(false);
          });
      }
    } else {
      setColumns(data.columns || []);
    }
  }, [selectedItem, isEdge, data.name, data.database, data.schema]);

  const handleCopySql = () => {
    if (data.sqlDefinition) {
      navigator.clipboard.writeText(data.sqlDefinition);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const inflows = data.inflows || [];
  const outflows = data.outflows || [];

  return (
    <div className="fixed right-0 top-16 bottom-0 w-[420px] bg-slate-900/98 backdrop-blur-md border-l border-slate-800 shadow-2xl z-40 flex flex-col text-slate-100 transition-all duration-300">
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-slate-800 border border-slate-700">
            {isEdge ? (
              <GitFork className="w-5 h-5 text-cyan-400" />
            ) : data.type === 'FOREIGN TABLE' ? (
              <Globe className="w-5 h-5 text-cyan-400" />
            ) : data.type && data.type.includes('VIEW') ? (
              <Eye className="w-5 h-5 text-purple-400" />
            ) : data.type === 'PROCEDURE' || data.type === 'FUNCTION' ? (
              <Cpu className="w-5 h-5 text-amber-400" />
            ) : (
              <Table className="w-5 h-5 text-emerald-400" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-white truncate">
              {isEdge ? 'Data Lineage Flow' : data.name}
            </h3>
            <span className="text-[11px] text-slate-400 font-mono truncate block">
              {isEdge ? (data.relationship || 'DATA_FLOW') : `${data.database} / ${data.schema}`}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs Switcher for Nodes */}
      {!isEdge && (
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-3 pt-2 gap-1 text-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-t-lg font-bold border-b-2 transition-all ${
              activeTab === 'overview'
                ? 'border-cyan-400 text-cyan-300 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Overview
          </button>

          {data.sqlDefinition && (
            <button
              onClick={() => setActiveTab('sql')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-t-lg font-bold border-b-2 transition-all ${
                activeTab === 'sql'
                  ? 'border-purple-400 text-purple-300 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>SQL Query</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('impact')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-t-lg font-bold border-b-2 transition-all ${
              activeTab === 'impact'
                ? 'border-amber-400 text-amber-300 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitFork className="w-3.5 h-3.5" />
            <span>Impact Analysis ({inflows.length + outflows.length})</span>
          </button>
        </div>
      )}

      {/* Drawer Body */}
      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {isEdge ? (
          /* Edge Details */
          <div className="space-y-4">
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Relationship Type
              </span>
              <div className="font-mono text-cyan-300 text-sm font-semibold flex items-center gap-1.5">
                <Globe className="w-4 h-4" />
                {data.relationship || 'DATA_FLOW'}
              </div>
            </div>

            {/* Column mapping if column-level edge */}
            {data.sourceColumn && data.targetColumn && (
              <div className="bg-purple-950/30 border border-purple-800/60 rounded-xl p-3 space-y-2">
                <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">
                  Column-Level Mapping (CLL)
                </span>
                <div className="flex items-center justify-between text-xs font-mono bg-slate-950/80 p-2.5 rounded-lg border border-purple-900/60">
                  <span className="text-purple-300 font-bold">{data.sourceColumn}</span>
                  <ArrowRight className="w-4 h-4 text-purple-400" />
                  <span className="text-purple-300 font-bold">{data.targetColumn}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Object Flow
              </span>
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Upstream Source:</span>
                  <span className="font-mono text-emerald-400 font-medium truncate max-w-[200px]" title={selectedItem.source}>
                    {selectedItem.source}
                  </span>
                </div>
                <div className="flex justify-center text-cyan-400">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Downstream Target:</span>
                  <span className="font-mono text-cyan-400 font-medium truncate max-w-[200px]" title={selectedItem.target}>
                    {selectedItem.target}
                  </span>
                </div>
              </div>
            </div>

            {data.server && (
              <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Foreign Server Name
                </span>
                <p className="font-mono text-sm text-cyan-200">{data.server}</p>
              </div>
            )}
          </div>
        ) : activeTab === 'sql' ? (
          /* TAB 2: SQL DEFINITION */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileCode className="w-4 h-4" />
                <span>SQL Definition ({data.type})</span>
              </span>
              <button
                onClick={handleCopySql}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy SQL'}</span>
              </button>
            </div>
            <pre className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-purple-200 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[70vh]">
              {data.sqlDefinition}
            </pre>
          </div>
        ) : activeTab === 'impact' ? (
          /* TAB 3: IMPACT & ROOT-CAUSE ANALYSIS */
          <div className="space-y-4">
            {/* Inflows (Upstream Sources) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                  <ArrowDownLeft className="w-4 h-4" />
                  Upstream Sources (Inflows: {inflows.length})
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Data pada objek ini berasal dari sumber-sumber berikut:
              </p>
              <div className="bg-slate-950/80 rounded-xl border border-slate-800 divide-y divide-slate-800/60">
                {inflows.length > 0 ? (
                  inflows.map((srcId) => (
                    <div
                      key={srcId}
                      className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-900/80"
                    >
                      <span className="font-mono text-cyan-300 truncate max-w-[280px]" title={srcId}>
                        {srcId}
                      </span>
                      <span className="text-[10px] text-slate-500">Source</span>
                    </div>
                  ))
                ) : (
                  <div className="p-3 text-center text-slate-500 text-xs">
                    Tidak ada dependensi hulu (Root Source Table)
                  </div>
                )}
              </div>
            </div>

            {/* Outflows (Downstream Targets) */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <ArrowUpRight className="w-4 h-4" />
                  Downstream Impact (Outflows: {outflows.length})
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Perubahan pada objek ini akan berdampak pada view/tabel berikut:
              </p>
              <div className="bg-slate-950/80 rounded-xl border border-slate-800 divide-y divide-slate-800/60">
                {outflows.length > 0 ? (
                  outflows.map((tgtId) => (
                    <div
                      key={tgtId}
                      className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-900/80"
                    >
                      <span className="font-mono text-amber-300 truncate max-w-[280px]" title={tgtId}>
                        {tgtId}
                      </span>
                      <span className="text-[10px] text-amber-400/80">Impact</span>
                    </div>
                  ))
                ) : (
                  <div className="p-3 text-center text-slate-500 text-xs">
                    Tidak ada turunan hilir (End-node / Reporting Target)
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* TAB 1: OVERVIEW & COLUMNS */
          <div className="space-y-4">
            {/* Metadata card */}
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Database</span>
                <span className="font-semibold text-white">{data.database}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Schema</span>
                <span className="font-mono text-slate-200">{data.schema}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Type</span>
                <span className="font-semibold text-cyan-300">{data.type}</span>
              </div>
              {data.type !== 'PROCEDURE' && data.type !== 'FUNCTION' && (
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Total Columns</span>
                  <span className="font-semibold text-white">{data.columnCount || columns.length || 0}</span>
                </div>
              )}
            </div>

            {/* Routine Arguments & Return Type if Procedure/Function */}
            {(data.type === 'PROCEDURE' || data.type === 'FUNCTION') && (
              <div className="bg-amber-950/20 border border-amber-800/50 rounded-xl p-3 space-y-2 text-xs">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                  Routine Signature
                </span>
                <div className="font-mono text-[11px] space-y-1">
                  {data.arguments && (
                    <div className="text-slate-300">
                      <span className="text-slate-500">Parameters: </span>
                      {data.arguments}
                    </div>
                  )}
                  {data.returnType && (
                    <div className="text-amber-300">
                      <span className="text-slate-500">Return Type: </span>
                      {data.returnType}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Foreign options if foreign table */}
            {data.type === 'FOREIGN TABLE' && (
              <div className="bg-cyan-950/30 border border-cyan-800/50 rounded-xl p-3 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                  <Server className="w-4 h-4" />
                  <span>postgres_fdw Remote Configuration</span>
                </div>
                <div className="space-y-1 font-mono text-[11px] pt-1">
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Server:</span>
                    <span className="text-cyan-300 font-bold">{data.foreignServer}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Remote Schema:</span>
                    <span>{data.remoteSchema}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Remote Table:</span>
                    <span className="text-emerald-400">{data.remoteTable}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Columns list */}
            {data.type !== 'PROCEDURE' && data.type !== 'FUNCTION' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Columns className="w-3.5 h-3.5" />
                    Columns ({data.columnCount || columns.length || 0})
                  </span>
                  {loadingCols && (
                    <span className="text-[10px] text-cyan-400 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Loading...
                    </span>
                  )}
                </div>
                <div className="bg-slate-950/80 rounded-xl border border-slate-800 divide-y divide-slate-800/60 max-h-72 overflow-y-auto">
                  {loadingCols ? (
                    <div className="p-6 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                      <span>Loading column details...</span>
                    </div>
                  ) : columns.length > 0 ? (
                    columns.map((col, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-900/60">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-mono text-[10px] w-4">{col.ordinalPosition || col.ordinal_position}</span>
                          <span className="font-medium text-slate-200">{col.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-cyan-400/90 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
                            {col.dataType || col.data_type}
                          </span>
                          {(col.isNullable === 'NO' || col.is_nullable === 'NO') && (
                            <span className="text-[9px] text-amber-400 font-semibold">NOT NULL</span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-slate-500 text-xs">
                      {data.type === 'REMOTE SOURCE TABLE' ? 'Remote table schema (not yet connected directly)' : 'No columns found'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

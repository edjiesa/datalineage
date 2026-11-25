import React from 'react';
import { X, Database, Table, Globe, Eye, Columns, ArrowRight, ShieldCheck, Server } from 'lucide-react';

export function InspectorDrawer({ selectedItem, onClose }) {
  if (!selectedItem) return null;

  const isEdge = Boolean(selectedItem.source && selectedItem.target);
  const data = selectedItem.data || {};

  return (
    <div className="fixed right-0 top-16 bottom-0 w-96 bg-slate-900/95 backdrop-blur-md border-l border-slate-800 shadow-2xl z-40 flex flex-col text-slate-100 transition-all duration-300">
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center gap-2">
          {isEdge ? (
            <Globe className="w-5 h-5 text-cyan-400" />
          ) : data.type === 'FOREIGN TABLE' ? (
            <Globe className="w-5 h-5 text-cyan-400" />
          ) : data.type && data.type.includes('VIEW') ? (
            <Eye className="w-5 h-5 text-purple-400" />
          ) : (
            <Table className="w-5 h-5 text-emerald-400" />
          )}
          <div>
            <h3 className="font-semibold text-sm">
              {isEdge ? 'Connection Details' : data.name}
            </h3>
            <span className="text-[11px] text-slate-400">
              {isEdge ? 'Cross-Database Dependency' : `${data.database} / ${data.schema}`}
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

      {/* Drawer Body */}
      <div className="p-4 flex-1 overflow-y-auto space-y-5">
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

            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Lineage Flow
              </span>
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Source:</span>
                  <span className="font-mono text-emerald-400 font-medium">{selectedItem.source}</span>
                </div>
                <div className="flex justify-center text-cyan-400">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Target:</span>
                  <span className="font-mono text-cyan-400 font-medium">{selectedItem.target}</span>
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
        ) : (
          /* Table Node Details */
          <div className="space-y-4">
            {/* Metadata card */}
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 space-y-2.5 text-xs">
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
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Total Columns</span>
                <span className="font-semibold text-white">{data.columnCount || (data.columns && data.columns.length) || 0}</span>
              </div>
            </div>

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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Columns className="w-3.5 h-3.5" />
                  Columns ({data.columns ? data.columns.length : 0})
                </span>
              </div>
              <div className="bg-slate-950/80 rounded-xl border border-slate-800 divide-y divide-slate-800/60 max-h-72 overflow-y-auto">
                {data.columns && data.columns.length > 0 ? (
                  data.columns.map((col, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-900/60">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-mono text-[10px] w-4">{col.ordinal_position}</span>
                        <span className="font-medium text-slate-200">{col.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-cyan-400/90 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
                          {col.data_type}
                        </span>
                        {col.is_nullable === 'NO' && (
                          <span className="text-[9px] text-amber-400 font-semibold">NOT NULL</span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-slate-500 text-xs">
                    No column details available
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

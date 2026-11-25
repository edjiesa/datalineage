import React, { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Database, Table, Globe, Eye, Columns, Cpu, ChevronDown, ChevronUp, FileCode } from 'lucide-react';

const dbColors = {
  'postgres-core': {
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-950/20',
    badge: 'bg-emerald-900/60 text-emerald-300 border-emerald-700/50',
    glow: 'group-hover:border-emerald-400/80',
  },
  'postgres-logistics': {
    border: 'border-blue-500/40',
    bg: 'bg-blue-950/20',
    badge: 'bg-blue-900/60 text-blue-300 border-blue-700/50',
    glow: 'group-hover:border-blue-400/80',
  },
  'postgres-analytics': {
    border: 'border-purple-500/40',
    bg: 'bg-purple-950/20',
    badge: 'bg-purple-900/60 text-purple-300 border-purple-700/50',
    glow: 'group-hover:border-purple-400/80',
  },
};

const defaultColor = {
  border: 'border-slate-700',
  bg: 'bg-slate-900/60',
  badge: 'bg-slate-800 text-slate-300 border-slate-700',
  glow: 'group-hover:border-slate-500',
};

// 1. Table / View / Foreign Table Node (Dataedo Style)
export const TableNode = memo(({ data, selected }) => {
  const [expanded, setExpanded] = useState(false);
  const isForeign = data.type === 'FOREIGN TABLE';
  const isView = data.type && data.type.includes('VIEW');
  const isRemote = data.type === 'REMOTE SOURCE TABLE';
  const styling = dbColors[data.database] || defaultColor;

  const showColumns = data.granularity === 'column' || expanded;
  const columns = data.columns || [];

  return (
    <div
      className={`group relative rounded-xl border bg-slate-900/95 backdrop-blur-md shadow-xl transition-all duration-200 w-80 text-xs ${
        selected ? 'ring-2 ring-cyan-400 border-cyan-400 shadow-cyan-500/20' : styling.border
      } ${styling.glow}`}
    >
      {/* Base Object-level Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-cyan-400 !border-2 !border-slate-900 !w-3 !h-3 hover:scale-125 transition-transform"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-cyan-400 !border-2 !border-slate-900 !w-3 !h-3 hover:scale-125 transition-transform"
      />

      {/* Header bar */}
      <div className="p-2.5 border-b border-slate-800/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Database className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${styling.badge} truncate`}>
            {data.database}
          </span>
        </div>
        
        {/* Object Type Badge */}
        {isForeign ? (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-600/60 shrink-0">
            <Globe className="w-3 h-3 text-cyan-400 animate-pulse" />
            FDW FOREIGN
          </span>
        ) : isView ? (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-950/80 text-purple-300 border border-purple-600/60 shrink-0">
            <Eye className="w-3 h-3 text-purple-400" />
            VIEW
          </span>
        ) : isRemote ? (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-600/60 shrink-0">
            <Globe className="w-3 h-3 text-amber-400" />
            REMOTE
          </span>
        ) : (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-700/40 shrink-0">
            <Table className="w-3 h-3 text-emerald-400" />
            TABLE
          </span>
        )}
      </div>

      {/* Table details */}
      <div className="p-3 space-y-2">
        <div className="flex items-baseline gap-1.5 justify-between">
          <div className="flex items-baseline gap-1.5 truncate">
            <span className="text-slate-400 font-mono text-[11px]">{data.schema}.</span>
            <span className="text-white font-bold text-sm tracking-tight truncate">{data.name}</span>
          </div>
          {data.sqlDefinition && (
            <span title="Has SQL Query Definition" className="p-0.5 bg-purple-950/80 text-purple-300 border border-purple-800 rounded text-[9px] font-mono shrink-0">
              SQL
            </span>
          )}
        </div>

        {/* Foreign table origin link banner */}
        {isForeign && (
          <div className="bg-slate-950/80 border border-cyan-900/60 rounded-lg p-2 space-y-1">
            <div className="text-[10px] text-cyan-400 font-medium flex items-center gap-1">
              <span>Source Server:</span>
              <span className="font-mono text-cyan-200 bg-cyan-950 px-1 py-0.2 rounded border border-cyan-800">
                {data.foreignServer}
              </span>
            </div>
            <div className="text-[10px] text-slate-300 font-mono truncate">
              ↳ {data.remoteSchema}.{data.remoteTable}
            </div>
          </div>
        )}

        {/* Column-Level Lineage List (Dataedo CLL) */}
        {showColumns && columns.length > 0 ? (
          <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-1 max-h-48 overflow-y-auto">
            {columns.map((col, idx) => (
              <div
                key={idx}
                className="relative flex items-center justify-between py-1 px-2 rounded bg-slate-950/70 border border-slate-800/60 text-[11px] group/col hover:border-cyan-500/50"
              >
                {/* Dedicated Column Handles */}
                <Handle
                  type="target"
                  position={Position.Left}
                  id={`col-${col.name}`}
                  className="!w-2 !h-2 !-left-2 !bg-purple-400 !border !border-slate-900 hover:scale-150 transition-transform"
                />
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`col-${col.name}`}
                  className="!w-2 !h-2 !-right-2 !bg-purple-400 !border !border-slate-900 hover:scale-150 transition-transform"
                />

                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-slate-500 font-mono text-[9px] w-3">{col.ordinalPosition}</span>
                  <span className="text-slate-200 font-medium truncate">{col.name}</span>
                </div>
                <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/80 px-1 py-0.2 rounded border border-cyan-800/50 shrink-0">
                  {col.dataType}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {/* Footer / Toggle */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/50">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 hover:text-cyan-300 transition-colors"
          >
            <Columns className="w-3 h-3 text-cyan-400" />
            <span>{data.columnCount || columns.length || 0} columns</span>
            {columns.length > 0 && (
              expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
            )}
          </button>
          <span className="text-[10px] text-slate-500 group-hover:text-slate-300">Inspect →</span>
        </div>
      </div>
    </div>
  );
});

// 2. Stored Procedure & Function Node (Dataedo Processor Style)
export const ProcedureNode = memo(({ data, selected }) => {
  return (
    <div
      className={`group relative rounded-xl border bg-slate-900/95 backdrop-blur-md shadow-xl transition-all duration-200 w-72 text-xs ${
        selected
          ? 'ring-2 ring-amber-400 border-amber-400 shadow-amber-500/20'
          : 'border-amber-700/60 bg-amber-950/15 group-hover:border-amber-500'
      }`}
    >
      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-amber-400 !border-2 !border-slate-900 !w-3 !h-3 hover:scale-125 transition-transform"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-amber-400 !border-2 !border-slate-900 !w-3 !h-3 hover:scale-125 transition-transform"
      />

      {/* Header bar */}
      <div className="p-2.5 border-b border-amber-900/50 flex items-center justify-between gap-2 bg-amber-950/30">
        <div className="flex items-center gap-1.5 min-w-0">
          <Cpu className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950 text-amber-300 border border-amber-800/60 truncate">
            {data.database}
          </span>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-900/60 text-amber-200 border border-amber-700/60 shrink-0">
          {data.type || 'PROCEDURE'}
        </span>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2">
        <div className="flex items-baseline gap-1">
          <span className="text-slate-400 font-mono text-[11px]">{data.schema}.</span>
          <span className="text-white font-bold text-sm tracking-tight truncate">{data.name}()</span>
        </div>

        {/* Signature details */}
        <div className="bg-slate-950/80 border border-amber-900/40 rounded-lg p-2 space-y-1 font-mono text-[10px]">
          {data.arguments && (
            <div className="text-slate-300 truncate" title={data.arguments}>
              <span className="text-slate-500">args: </span>
              {data.arguments}
            </div>
          )}
          {data.returnType && (
            <div className="text-amber-300 truncate">
              <span className="text-slate-500">returns: </span>
              {data.returnType}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-amber-400/80 pt-1">
          <span className="flex items-center gap-1">
            <FileCode className="w-3 h-3" />
            <span>SQL Processor</span>
          </span>
          <span className="text-[10px] text-slate-500 group-hover:text-slate-300">View SQL →</span>
        </div>
      </div>
    </div>
  );
});

export const nodeTypes = {
  tableNode: TableNode,
  procedureNode: ProcedureNode,
};

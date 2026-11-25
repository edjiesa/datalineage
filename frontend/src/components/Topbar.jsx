import React, { useState } from 'react';
import {
  Database,
  Globe,
  Eye,
  RefreshCw,
  Search,
  Filter,
  ShieldCheck,
  PlusCircle,
  Table,
  CheckCircle2,
  X
} from 'lucide-react';
import { addDatabase } from '../services/api';

export function Topbar({
  stats,
  databases,
  selectedDb,
  onSelectDb,
  searchTerm,
  onSearchChange,
  onRefresh,
  loading,
  onOpenHbaModal,
}) {
  const [showAddDb, setShowAddDb] = useState(false);
  const [formName, setFormName] = useState('');
  const [formHost, setFormHost] = useState('');
  const [formPort, setFormPort] = useState(5432);
  const [formDbName, setFormDbName] = useState('');
  const [formUser, setFormUser] = useState('postgres');
  const [formPass, setFormPass] = useState('');
  const [adding, setAdding] = useState(false);

  async function handleAddDb(e) {
    e.preventDefault();
    if (!formName || !formHost || !formDbName || !formUser) return;
    setAdding(true);
    try {
      await addDatabase({
        name: formName,
        host: formHost,
        port: Number(formPort),
        dbname: formDbName,
        user: formUser,
        password: formPass,
      });
      setShowAddDb(false);
      onRefresh();
    } catch (err) {
      alert(`Error adding database: ${err.message}`);
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <header className="h-16 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-5 flex items-center justify-between z-30 select-none">
        {/* Left: Brand & Status */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20 text-slate-950 font-black">
              <Globe className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-white flex items-center gap-2">
                <span>PG Data Lineage</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  FDW Engine
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">Cross-Postgres & Topology Visualizer</p>
            </div>
          </div>

          {/* Quick Stats Pill List */}
          {stats && (
            <div className="hidden lg:flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300">
                <Database className="w-3.5 h-3.5 text-blue-400" />
                <span>{stats.totalDatabases || 0} DBs</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300">
                <Table className="w-3.5 h-3.5 text-emerald-400" />
                <span>{stats.totalTables || 0} Tables</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-950/70 border border-cyan-700/50 text-cyan-300 font-semibold">
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                <span>{stats.foreignTables || 0} FDW Tables</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-950/70 border border-purple-700/50 text-purple-300">
                <Eye className="w-3.5 h-3.5 text-purple-400" />
                <span>{stats.views || 0} Views</span>
              </div>
            </div>
          )}
        </div>

        {/* Center: Search & Database filter */}
        <div className="flex items-center gap-3">
          {/* Search table */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search table or column..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-56 pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:w-64 transition-all"
            />
          </div>

          {/* Database filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <select
              value={selectedDb}
              onChange={(e) => onSelectDb(e.target.value)}
              className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Databases</option>
              {databases.map((db) => (
                <option key={db.name} value={db.name}>
                  {db.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* pg_hba.conf Modal Trigger */}
          <button
            onClick={onOpenHbaModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-xs text-slate-200 font-medium transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>pg_hba.conf</span>
          </button>

          {/* Add DB Button */}
          <button
            onClick={() => setShowAddDb(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-xs text-slate-200 font-medium transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Add DB</span>
          </button>

          {/* Rescan Button */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-bold transition-all shadow-md shadow-cyan-600/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Rescan</span>
          </button>
        </div>
      </header>

      {/* Add Database Modal */}
      {showAddDb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-400" />
                Add External PostgreSQL Instance
              </h3>
              <button
                onClick={() => setShowAddDb(false)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddDb} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. postgres-payments"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-slate-400 mb-1">Host / IP</label>
                  <input
                    type="text"
                    placeholder="e.g. 192.168.1.10 or container-name"
                    value={formHost}
                    onChange={(e) => setFormHost(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Port</label>
                  <input
                    type="number"
                    value={formPort}
                    onChange={(e) => setFormPort(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Database Name</label>
                <input
                  type="text"
                  placeholder="e.g. production_db"
                  value={formDbName}
                  onChange={(e) => setFormDbName(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Username</label>
                  <input
                    type="text"
                    value={formUser}
                    onChange={(e) => setFormUser(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={formPass}
                    onChange={(e) => setFormPass(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddDb(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 text-slate-950 font-bold hover:bg-cyan-500 disabled:opacity-50"
                >
                  {adding ? 'Connecting...' : 'Save & Scan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Database, Info, Filter, AlertTriangle, RefreshCw } from 'lucide-react';
import { fetchHbaRules } from '../services/api';

export function HbaTopologyModal({ isOpen, onClose }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDb, setSelectedDb] = useState('ALL');

  useEffect(() => {
    if (isOpen) {
      loadRules();
    }
  }, [isOpen]);

  async function loadRules() {
    setLoading(true);
    try {
      const data = await fetchHbaRules();
      setRules(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const databases = Array.from(new Set(rules.map((r) => r.database)));
  const filteredRules = selectedDb === 'ALL' ? rules : rules.filter((r) => r.database === selectedDb);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl text-slate-100">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>pg_hba.conf Authentication Rules & Topology</span>
              </h2>
              <p className="text-xs text-slate-400">
                Inspecting PostgreSQL host-based authentication rules across instances
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="p-4 bg-cyan-950/20 border-b border-cyan-900/30 flex items-start gap-3 text-xs text-cyan-200">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <p>
            <strong>Catatan Teknis:</strong> Aturan <code className="text-cyan-300">pg_hba.conf</code> menentukan host mana yang diizinkan mengontak database untuk otentikasi. Garis aliran data antar tabel sendiri dihubungkan melalui Foreign Data Wrapper (<code className="text-cyan-300">postgres_fdw</code>) yang telah diatur di atas aturan otentikasi ini.
          </p>
        </div>

        {/* Toolbar & Filter */}
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-950/30">
          <div className="flex items-center gap-2 text-xs">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400 font-medium">Database Filter:</span>
            <select
              value={selectedDb}
              onChange={(e) => setSelectedDb(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value="ALL">All Databases ({rules.length} rules)</option>
              {databases.map((db) => (
                <option key={db} value={db}>
                  {db}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={loadRules}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Rules
          </button>
        </div>

        {/* Rules Table */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-400 mr-2" />
              <span>Scanning pg_hba rules...</span>
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-sm">
              No pg_hba rules found or databases still initializing.
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Instance</th>
                    <th className="py-2.5 px-3 font-semibold">Line</th>
                    <th className="py-2.5 px-3 font-semibold">Type</th>
                    <th className="py-2.5 px-3 font-semibold">Database</th>
                    <th className="py-2.5 px-3 font-semibold">User</th>
                    <th className="py-2.5 px-3 font-semibold">Address / CIDR</th>
                    <th className="py-2.5 px-3 font-semibold">Auth Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredRules.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-sans font-semibold text-white">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px]">
                          {r.database}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">{r.line_number}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/40 text-[10px]">
                          {r.rule_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {r.databases && r.databases.join(', ')}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {r.user_names && r.user_names.join(', ')}
                      </td>
                      <td className="py-2.5 px-3 text-emerald-400">
                        {r.address || '(local socket)'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800/40 text-[10px]">
                          {r.auth_method}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

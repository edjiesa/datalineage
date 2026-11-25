import React, { useState, useEffect } from 'react';
import {
  Database,
  Globe,
  Eye,
  RefreshCw,
  Search,
  ShieldCheck,
  PlusCircle,
  Table,
  Trash2,
  CheckCircle2,
  XCircle,
  X,
  Info,
  Zap,
  Download,
  Maximize,
  Minimize,
  Expand,
  Columns,
  Cpu
} from 'lucide-react';
import { addDatabase, deleteDatabase, testDatabase } from '../services/api';
import { exportLineageToPdf } from '../services/pdfExport';

export function Topbar({
  stats,
  databases,
  selectedDb,
  onSelectDb,
  selectedSchema,
  onSelectSchema,
  selectedView,
  onSelectView,
  viewMode,
  onSelectViewMode,
  granularity,
  onSelectGranularity,
  searchTerm,
  onSearchChange,
  onRefresh,
  loading,
  onOpenHbaModal,
  onFitView,
  onGetNodes,
}) {
  const [showDbModal, setShowDbModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formHost, setFormHost] = useState('');
  const [formPort, setFormPort] = useState(5432);
  const [formDbName, setFormDbName] = useState('postgres');
  const [formUser, setFormUser] = useState('postgres');
  const [formPass, setFormPass] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);

  // PDF Export state
  const [exportingPdf, setExportingPdf] = useState(false);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error('Failed to enter fullscreen:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handleDownloadPdf = async () => {
    setExportingPdf(true);
    try {
      const activeNodes = onGetNodes ? onGetNodes() : [];
      await exportLineageToPdf({
        database: selectedDb,
        mode: viewMode,
        granularity: granularity,
        nodes: activeNodes,
      });
    } catch (err) {
      alert(`Gagal mengekspor PDF: ${err.message}`);
    } finally {
      setExportingPdf(false);
    }
  };

  async function handleTest() {
    if (!formHost || !formDbName || !formUser) {
      alert('Mohon isi Host, Database Name, dan User terlebih dahulu.');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testDatabase({
        name: formName || 'test-db',
        host: formHost,
        port: Number(formPort),
        dbname: formDbName,
        user: formUser,
        password: formPass,
      });
      setTestResult(res);
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTesting(false);
    }
  }

  async function handleAddDb(e) {
    e.preventDefault();
    if (!formName || !formHost || !formDbName || !formUser) return;
    setSaving(true);
    try {
      await addDatabase({
        name: formName,
        host: formHost,
        port: Number(formPort),
        dbname: formDbName,
        user: formUser,
        password: formPass,
      });
      setFormName('');
      setFormHost('');
      setFormPass('');
      setTestResult(null);
      onRefresh();
    } catch (err) {
      alert(`Gagal menyimpan database: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(name) {
    if (!confirm(`Hapus konfigurasi database '${name}'?`)) return;
    try {
      await deleteDatabase(name);
      onRefresh();
    } catch (err) {
      alert(`Gagal menghapus: ${err.message}`);
    }
  }

  return (
    <>
      <header className="h-14 bg-slate-900/98 backdrop-blur-md border-b border-slate-800 px-3 flex items-center justify-between z-30 select-none gap-2">
        {/* Left: Compact Brand & Summary Stats */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-md shadow-cyan-500/20 text-slate-950 font-black">
              <Globe className="w-4 h-4 text-slate-950" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-white tracking-tight whitespace-nowrap">PG Lineage</span>
              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 shrink-0">
                FDW
              </span>
            </div>
          </div>

          {/* Quick Summary Stats (Compact single badge) */}
          {stats && (
            <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-300 font-mono shrink-0 whitespace-nowrap">
              <span className="text-emerald-400 font-semibold">{stats.totalTables || 0} tbls</span>
              <span className="text-slate-600">•</span>
              <span className="text-cyan-400 font-semibold">{stats.foreignTables || 0} fdw</span>
              <span className="text-slate-600">•</span>
              <span className="text-purple-400 font-semibold">{stats.views || 0} views</span>
              {stats.procedures > 0 && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-amber-400 font-semibold">{stats.procedures} proc</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Center: View Modes, Granularity, Search & Filters */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mode Switcher */}
          <div className="flex bg-slate-950/90 p-0.5 rounded-xl border border-slate-800 text-[11px]">
            {/* Mode 1: FDW Only */}
            <button
              onClick={() => onSelectViewMode('fdw')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all ${
                viewMode === 'fdw'
                  ? 'bg-cyan-600 text-slate-950 shadow-sm shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>FDW ({stats?.foreignTables || 0})</span>
            </button>

            {/* Mode 2: Views Lineage */}
            <button
              onClick={() => onSelectViewMode('views')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all ${
                viewMode === 'views'
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Views ({stats?.views || 0})</span>
            </button>

            {/* Mode 3: All / Search Table */}
            <button
              onClick={() => onSelectViewMode('all')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all ${
                viewMode === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Table className="w-3 h-3" />
              <span>Tabel</span>
            </button>
          </div>

          {/* Granularity Switcher: Object vs Column Level (Dataedo CLL) */}
          <div className="flex bg-slate-950/90 p-0.5 rounded-xl border border-slate-800 text-[11px]">
            <button
              onClick={() => onSelectGranularity('object')}
              title="Object-Level Lineage (Tabel & Views Ringkas)"
              className={`flex items-center gap-1 px-2 py-1 rounded-lg font-bold transition-all ${
                granularity === 'object'
                  ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Table className="w-3 h-3" />
              <span>Object</span>
            </button>
            <button
              onClick={() => onSelectGranularity('column')}
              title="Column-Level Lineage (CLL - Relasi Antar Kolom Dataedo)"
              className={`flex items-center gap-1 px-2 py-1 rounded-lg font-bold transition-all ${
                granularity === 'column'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Columns className="w-3 h-3" />
              <span>CLL</span>
            </button>
          </div>

          {/* View Selector Dropdown when in 'views' mode */}
          {viewMode === 'views' && stats?.viewsList && stats.viewsList.length > 0 && (
            <div className="flex items-center gap-1 text-[11px]">
              <select
                value={selectedView}
                onChange={(e) => onSelectView(e.target.value)}
                className="bg-purple-950/80 border border-purple-700/60 rounded-xl px-2 py-1 text-purple-200 text-[11px] font-semibold focus:outline-none focus:border-purple-400 max-w-[145px] truncate"
              >
                <option value="ALL">Semua Views ({stats.viewsList.length})</option>
                {stats.viewsList.map((v) => (
                  <option key={v.id} value={v.name}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Schema Selector when in 'all' mode */}
          {viewMode === 'all' && stats?.schemas && stats.schemas.length > 0 && (
            <div className="flex items-center gap-1 text-[11px]">
              <select
                value={selectedSchema}
                onChange={(e) => onSelectSchema(e.target.value)}
                className="bg-slate-950/80 border border-slate-800 rounded-xl px-2 py-1 text-slate-200 text-[11px] focus:outline-none focus:border-cyan-500 max-w-[115px] truncate"
              >
                <option value="ALL">Semua Skema</option>
                {stats.schemas.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} ({s.count})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search box */}
          <div className="relative">
            <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={viewMode === 'views' ? 'Cari view...' : 'Cari tabel...'}
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-28 pl-7 pr-2.5 py-1 text-[11px] rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:w-40 transition-all"
            />
          </div>

          {/* Database filter */}
          <div className="flex items-center gap-1 text-[11px]">
            <select
              value={selectedDb}
              onChange={(e) => onSelectDb(e.target.value)}
              className="bg-slate-950/80 border border-slate-800 rounded-xl px-2 py-1 text-slate-200 text-[11px] focus:outline-none focus:border-cyan-500 max-w-[95px] truncate"
            >
              <option value="ALL">All DBs</option>
              {databases.map((db) => (
                <option key={db.name} value={db.name}>
                  {db.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Actions (Fit View, Fullscreen, PDF, Manage DB, HBA, Rescan) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Fit View */}
          <button
            onClick={onFitView}
            title="Pusatkan & Sesuaikan 1 Layar Penuh (Fit View)"
            className="flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-[11px] text-slate-300 transition-colors"
          >
            <Expand className="w-3 h-3 text-cyan-400" />
            <span className="hidden 2xl:inline">Fit</span>
          </button>

          {/* Fullscreen Browser Toggle */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Keluar Fullscreen' : 'Layar Penuh Browser (Fullscreen)'}
            className="flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-[11px] text-slate-300 transition-colors"
          >
            {isFullscreen ? (
              <Minimize className="w-3 h-3 text-amber-400" />
            ) : (
              <Maximize className="w-3 h-3 text-amber-400" />
            )}
            <span className="hidden 2xl:inline">{isFullscreen ? 'Exit' : 'Full'}</span>
          </button>

          {/* Download PDF Button */}
          <button
            onClick={handleDownloadPdf}
            disabled={exportingPdf}
            title="Download visualisasi diagram ke file PDF"
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-700 hover:bg-emerald-600 border border-emerald-600 text-[11px] text-white font-bold transition-all shadow-sm shadow-emerald-700/20 disabled:opacity-50"
          >
            {exportingPdf ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Download className="w-3 h-3" />
            )}
            <span>PDF</span>
          </button>

          {/* Databases Manager Button */}
          <button
            onClick={() => setShowDbModal(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-[11px] text-slate-200 font-medium transition-colors"
          >
            <Database className="w-3 h-3 text-blue-400" />
            <span>{databases.length} DB</span>
          </button>

          {/* pg_hba.conf Modal Trigger */}
          <button
            onClick={onOpenHbaModal}
            className="flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-[11px] text-slate-200 font-medium transition-colors"
          >
            <ShieldCheck className="w-3 h-3 text-cyan-400" />
            <span className="hidden xl:inline">pg_hba</span>
          </button>

          {/* Rescan Button */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-[11px] font-bold transition-all shadow-sm shadow-cyan-600/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Rescan</span>
          </button>
        </div>
      </header>

      {/* Database Management Modal */}
      {showDbModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="font-bold text-sm text-white">PostgreSQL Databases Configuration</h3>
                  <p className="text-xs text-slate-400">Hubungkan database server Anda untuk memetakan FDW dan Lineage</p>
                </div>
              </div>
              <button
                onClick={() => setShowDbModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-6">
              {/* Existing Databases List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Configured Databases ({databases.length})
                </h4>

                {databases.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-800 text-center text-slate-500 text-xs">
                    Belum ada database yang ditambahkan. Silakan isi form di bawah untuk menghubungkan PostgreSQL Anda.
                  </div>
                ) : (
                  <div className="grid gap-2.5">
                    {databases.map((db) => (
                      <div
                        key={db.name}
                        className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{db.name}</span>
                            {db.is_online ? (
                              <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/50">
                                <CheckCircle2 className="w-3 h-3" /> Online
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-800/50">
                                <XCircle className="w-3 h-3" /> Unreachable
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-slate-400 text-[11px]">
                            {db.user}@{db.host}:{db.port} / {db.dbname}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(db.name)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                          title="Hapus Database"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Form Add Database */}
              <form onSubmit={handleAddDb} className="space-y-3 pt-3 border-t border-slate-800 text-xs">
                <h4 className="font-bold text-slate-300 text-xs flex items-center gap-1.5">
                  <PlusCircle className="w-4 h-4 text-emerald-400" />
                  Tambah Database Baru
                </h4>

                {/* Host Tip */}
                <div className="p-3 bg-cyan-950/20 border border-cyan-900/40 rounded-xl text-[11px] text-cyan-200 flex items-start gap-2">
                  <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>
                    Jika PostgreSQL berjalan langsung di mesin host yang sama dengan Docker, gunakan host <strong className="text-cyan-300">host.docker.internal</strong> (atau IP LAN / public server Anda).
                  </span>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Display Name (Label)</label>
                  <input
                    type="text"
                    placeholder="misal: db-finance, db-warehouse"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-slate-400 mb-1">Host / IP Address</label>
                    <input
                      type="text"
                      placeholder="e.g. 192.168.1.100 atau host.docker.internal"
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
                    placeholder="postgres"
                    value={formDbName}
                    onChange={(e) => setFormDbName(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-1">User</label>
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

                {/* Test Result Message */}
                {testResult && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      testResult.success
                        ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                        : 'bg-rose-950/60 border border-rose-800 text-rose-300'
                    }`}
                  >
                    {testResult.success ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                        <div>
                          <strong>Koneksi Berhasil!</strong>
                          <p className="text-[10px] text-emerald-400/80">{testResult.version}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 shrink-0 text-rose-400" />
                        <div>
                          <strong>Koneksi Gagal:</strong>
                          <p className="text-[10px] font-mono">{testResult.error}</p>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={testing}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 disabled:opacity-50"
                  >
                    {testing ? 'Testing...' : 'Test Connection'}
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDbModal(false)}
                      className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs"
                    >
                      Tutup
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs shadow-md shadow-cyan-600/20 disabled:opacity-50"
                    >
                      {saving ? 'Menyimpan...' : 'Simpan & Scan'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

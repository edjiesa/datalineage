import React, { useState, useEffect, useCallback } from 'react';
import { fetchLineageGraph, fetchDatabases } from './services/api';
import { Topbar } from './components/Topbar';
import { Canvas } from './components/Canvas';
import { InspectorDrawer } from './components/InspectorDrawer';
import { HbaTopologyModal } from './components/HbaTopologyModal';
import { RefreshCw, AlertCircle, Database } from 'lucide-react';

export default function App() {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [], stats: {} });
  const [databases, setDatabases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & State
  const [selectedDb, setSelectedDb] = useState('ALL');
  const [selectedSchema, setSelectedSchema] = useState('ALL');
  const [selectedView, setSelectedView] = useState('ALL');
  const [viewMode, setViewMode] = useState('fdw'); // Default 'fdw'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [isHbaOpen, setIsHbaOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [graph, dbs] = await Promise.all([
        fetchLineageGraph(viewMode, selectedSchema, searchTerm, selectedView),
        fetchDatabases(),
      ]);
      setGraphData(graph);
      setDatabases(dbs);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to connect to backend server');
    } finally {
      setLoading(false);
    }
  }, [viewMode, selectedSchema, searchTerm, selectedView]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadData]);

  // When switching modes, reset selectedView
  const handleModeChange = (mode) => {
    setViewMode(mode);
    setSelectedView('ALL');
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-950 overflow-hidden font-sans">
      {/* Topbar */}
      <Topbar
        stats={graphData.stats}
        databases={databases}
        selectedDb={selectedDb}
        onSelectDb={setSelectedDb}
        selectedSchema={selectedSchema}
        onSelectSchema={setSelectedSchema}
        selectedView={selectedView}
        onSelectView={setSelectedView}
        viewMode={viewMode}
        onSelectViewMode={handleModeChange}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onRefresh={loadData}
        loading={loading}
        onOpenHbaModal={() => setIsHbaOpen(true)}
      />

      {/* Main Canvas Area */}
      <div className="flex-1 relative overflow-hidden">
        {loading && graphData.nodes.length === 0 ? (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm text-slate-300 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
            <p className="text-sm font-medium">Memindai catalog & menyusun visualisasi...</p>
          </div>
        ) : error && graphData.nodes.length === 0 ? (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950 p-6 text-center space-y-4">
            <div className="p-3 bg-red-950/50 rounded-2xl border border-red-800 text-red-400">
              <AlertCircle className="w-10 h-10" />
            </div>
            <div className="max-w-md space-y-1">
              <h2 className="text-lg font-bold text-white">Connection Error</h2>
              <p className="text-xs text-slate-400">{error}</p>
            </div>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-xl text-xs transition-colors"
            >
              Retry Connection
            </button>
          </div>
        ) : databases.length === 0 ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950 p-6 text-center space-y-4">
            <div className="p-4 bg-cyan-950/40 rounded-2xl border border-cyan-800/60 text-cyan-400">
              <Database className="w-12 h-12" />
            </div>
            <div className="max-w-md space-y-2">
              <h2 className="text-xl font-bold text-white">Belum Ada Database Terhubung</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Aplikasi ini siap memonitor database PostgreSQL milik server Anda. Klik tombol <strong>Manage DBs</strong> di atas untuk menambahkan koneksi host, user, dan password database Anda.
              </p>
            </div>
          </div>
        ) : (
          <Canvas
            initialNodes={graphData.nodes}
            initialEdges={graphData.edges}
            selectedDb={selectedDb}
            searchTerm={searchTerm}
            onSelectItem={setSelectedItem}
          />
        )}

        {/* Inspector Slideover Drawer */}
        <InspectorDrawer
          selectedItem={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      </div>

      {/* pg_hba.conf Rules & Topology Modal */}
      <HbaTopologyModal
        isOpen={isHbaOpen}
        onClose={() => setIsHbaOpen(false)}
      />
    </div>
  );
}

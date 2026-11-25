import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { nodeTypes } from './CustomNodes';

export function Canvas({
  initialNodes,
  initialEdges,
  selectedDb,
  searchTerm,
  onSelectItem,
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync internal state when props change
  React.useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  React.useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Apply filters (Database filter & Search filter)
  const displayNodes = useMemo(() => {
    return nodes.map((node) => {
      const data = node.data || {};
      const matchesDb = selectedDb === 'ALL' || data.database === selectedDb;
      
      let matchesSearch = true;
      if (searchTerm && searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const inName = (data.name || '').toLowerCase().includes(query);
        const inSchema = (data.schema || '').toLowerCase().includes(query);
        const inServer = (data.foreignServer || '').toLowerCase().includes(query);
        const inCols = (data.columns || []).some((c) =>
          (c.name || '').toLowerCase().includes(query)
        );
        matchesSearch = inName || inSchema || inServer || inCols;
      }

      const isVisible = matchesDb && matchesSearch;

      return {
        ...node,
        style: {
          ...node.style,
          opacity: isVisible ? 1 : 0.15,
          pointerEvents: isVisible ? 'all' : 'none',
          transition: 'opacity 0.25s ease',
        },
      };
    });
  }, [nodes, selectedDb, searchTerm]);

  const onNodeClick = useCallback(
    (_, node) => {
      onSelectItem(node);
    },
    [onSelectItem]
  );

  const onEdgeClick = useCallback(
    (_, edge) => {
      onSelectItem(edge);
    },
    [onSelectItem]
  );

  const onPaneClick = useCallback(() => {
    onSelectItem(null);
  }, [onSelectItem]);

  return (
    <div className="w-full h-full bg-slate-950 relative">
      <ReactFlow
        nodes={displayNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.8}
        defaultEdgeOptions={{
          type: 'smoothstep',
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color="#1e293b"
        />
        <Controls className="!bg-slate-900 !border-slate-800 !shadow-xl !rounded-xl !overflow-hidden [&>button]:!bg-slate-900 [&>button]:!border-slate-800 [&>button]:!fill-slate-300 [&>button:hover]:!bg-slate-800" />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          className="!bg-slate-900/90 !border-slate-800 !rounded-xl !shadow-xl overflow-hidden"
          nodeColor={(n) => {
            if (n.data?.type === 'FOREIGN TABLE') return '#06b6d4';
            if (n.data?.type?.includes('VIEW')) return '#8b5cf6';
            if (n.data?.database === 'postgres-core') return '#10b981';
            if (n.data?.database === 'postgres-logistics') return '#3b82f6';
            return '#64748b';
          }}
        />
      </ReactFlow>
    </div>
  );
}

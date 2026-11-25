import React, { useCallback, useMemo, useEffect, useState, useImperativeHandle } from 'react';
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
  canvasRef,
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [rfInstance, setRfInstance] = useState(null);

  // Sync internal state when props change
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Expose fitView to parent via ref
  useImperativeHandle(canvasRef, () => ({
    fitView: () => {
      if (rfInstance) {
        rfInstance.fitView({ padding: 0.25, duration: 400 });
      }
    },
  }));

  // Auto-fit to full screen whenever nodes change
  useEffect(() => {
    if (rfInstance && initialNodes.length > 0) {
      const timer = setTimeout(() => {
        rfInstance.fitView({ padding: 0.25, duration: 400 });
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [initialNodes, rfInstance]);

  // Apply search/db filters
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
        matchesSearch = inName || inSchema || inServer;
      }

      const isVisible = matchesDb && matchesSearch;

      return {
        ...node,
        style: {
          ...node.style,
          opacity: isVisible ? 1 : 0.2,
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
        onInit={setRfInstance}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        onlyRenderVisibleElements={true}
        minZoom={0.1}
        maxZoom={2.0}
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
            if (n.data?.database?.includes('External')) return '#f59e0b';
            return '#10b981';
          }}
        />
      </ReactFlow>
    </div>
  );
}

import React, { useCallback, useMemo, useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { nodeTypes } from './CustomNodes';

export function Canvas({
  initialNodes,
  initialEdges,
  selectedDb,
  searchTerm,
  selectedItem,
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

  // Expose fitView to parent via ref safely
  useEffect(() => {
    if (canvasRef) {
      canvasRef.current = {
        fitView: () => {
          if (rfInstance) {
            rfInstance.fitView({ padding: 0.25, duration: 400 });
          }
        },
      };
    }
  }, [canvasRef, rfInstance]);

  // Auto-fit to full screen whenever nodes change
  useEffect(() => {
    if (rfInstance && initialNodes.length > 0) {
      const timer = setTimeout(() => {
        rfInstance.fitView({ padding: 0.25, duration: 400 });
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [initialNodes, rfInstance]);

  // 1. Dataedo Impact Analysis: Traverse upstream ancestors & downstream descendants
  const { upstreamIds, downstreamIds, highlightedEdgeIds } = useMemo(() => {
    if (!selectedItem) {
      return { upstreamIds: new Set(), downstreamIds: new Set(), highlightedEdgeIds: new Set() };
    }

    const up = new Set();
    const down = new Set();
    const hEdges = new Set();

    // Helper: find all upstream nodes recursively
    const findUpstream = (currId) => {
      edges.forEach((e) => {
        if (e.target === currId && !up.has(e.source)) {
          up.add(e.source);
          hEdges.add(e.id);
          findUpstream(e.source);
        }
      });
    };

    // Helper: find all downstream nodes recursively
    const findDownstream = (currId) => {
      edges.forEach((e) => {
        if (e.source === currId && !down.has(e.target)) {
          down.add(e.target);
          hEdges.add(e.id);
          findDownstream(e.target);
        }
      });
    };

    if (selectedItem.source && selectedItem.target) {
      // Edge selected
      up.add(selectedItem.source);
      down.add(selectedItem.target);
      hEdges.add(selectedItem.id);
      findUpstream(selectedItem.source);
      findDownstream(selectedItem.target);
    } else {
      // Node selected
      findUpstream(selectedItem.id);
      findDownstream(selectedItem.id);
    }

    return { upstreamIds: up, downstreamIds: down, highlightedEdgeIds: hEdges };
  }, [selectedItem, edges]);

  // 2. Compute Nodes with Search/DB Filter and Impact Highlighting
  const displayNodes = useMemo(() => {
    const hasSelection = Boolean(selectedItem);

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

      const isBaseVisible = matchesDb && matchesSearch;

      let opacity = isBaseVisible ? 1 : 0.15;
      let isSelected = false;

      if (hasSelection) {
        if (selectedItem.id === node.id) {
          opacity = 1;
          isSelected = true;
        } else if (upstreamIds.has(node.id) || downstreamIds.has(node.id)) {
          opacity = 1;
        } else {
          opacity = 0.15;
        }
      }

      return {
        ...node,
        selected: isSelected,
        style: {
          ...node.style,
          opacity,
          transition: 'opacity 0.25s ease, transform 0.25s ease',
        },
      };
    });
  }, [nodes, selectedDb, searchTerm, selectedItem, upstreamIds, downstreamIds]);

  // 3. Compute Edges with Arrowheads and Highlight Strokes
  const displayEdges = useMemo(() => {
    const hasSelection = Boolean(selectedItem);

    return edges.map((edge) => {
      const isHighlighted = highlightedEdgeIds.has(edge.id);
      const isUpstream = upstreamIds.has(edge.source);

      let strokeColor = edge.style?.stroke || '#06b6d4';
      let strokeWidth = edge.style?.strokeWidth || 2;
      let opacity = 1;
      let animated = edge.animated;

      if (hasSelection) {
        if (isHighlighted) {
          strokeColor = isUpstream ? '#06b6d4' : '#f59e0b';
          strokeWidth = 3.5;
          opacity = 1;
          animated = true;
        } else {
          opacity = 0.1;
        }
      }

      return {
        ...edge,
        animated,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
          width: 14,
          height: 14,
        },
        style: {
          ...edge.style,
          stroke: strokeColor,
          strokeWidth,
          opacity,
          transition: 'all 0.25s ease',
        },
      };
    });
  }, [edges, selectedItem, highlightedEdgeIds, upstreamIds]);

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
        edges={displayEdges}
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
        minZoom={0.08}
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
            if (n.data?.type === 'PROCEDURE' || n.data?.type === 'FUNCTION') return '#f59e0b';
            if (n.data?.database?.includes('External')) return '#eab308';
            return '#10b981';
          }}
        />
      </ReactFlow>
    </div>
  );
}

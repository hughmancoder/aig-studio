import React, { useMemo, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react';
import type { Node, Edge, NodeTypes, EdgeTypes, ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import type { AigGraphData } from '../lib/aigTypes';
import { PiNode, AndNode, PoNode, ConstNode } from './AigCustomNodes';
import { AigCustomEdge } from './AigCustomEdge';

interface AigGraphCanvasProps {
  data: AigGraphData;
  title?: string;
  badge?: string;
  badgeColor?: 'indigo' | 'emerald' | 'amber' | 'slate';
  theme?: 'dark' | 'light';
}

const nodeTypes: NodeTypes = {
  PI: PiNode as any,
  AND: AndNode as any,
  PO: PoNode as any,
  CONST: ConstNode as any,
};

const edgeTypes: EdgeTypes = {
  aigEdge: AigCustomEdge as any,
};

const NODE_WIDTH = 100;
const NODE_HEIGHT = 48;

function getLayoutedElements(graphData: AigGraphData) {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: 'TB',
    nodesep: 50,
    ranksep: 70,
    align: 'DL',
  });

  graphData.nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  graphData.edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const nodes: Node[] = graphData.nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id) || { x: 0, y: 0 };
    return {
      id: node.id,
      type: node.type,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
      data: {
        label: node.label,
        level: node.level,
        type: node.type,
      },
    };
  });

  const edges: Edge[] = graphData.edges.map((edge) => {
    const isInverted = edge.inverted;
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'aigEdge',
      data: { inverted: isInverted },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 14,
        height: 14,
        color: isInverted ? '#f43f5e' : '#64748b',
      },
    };
  });

  return { nodes, edges };
}

export const AigGraphCanvas: React.FC<AigGraphCanvasProps> = ({
  data,
  title,
  badge,
  badgeColor = 'indigo',
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => getLayoutedElements(data),
    [data]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  useEffect(() => {
    if (rfInstance && layoutedNodes.length > 0) {
      const id = requestAnimationFrame(() => {
        rfInstance.fitView({ padding: 0.25, duration: 150 });
      });
      return () => cancelAnimationFrame(id);
    }
  }, [rfInstance, layoutedNodes]);

  const badgeColorClasses = {
    indigo: isDark
      ? 'bg-indigo-950 text-indigo-300 border-indigo-700/60'
      : 'bg-indigo-50 text-indigo-700 border-indigo-200',
    emerald: isDark
      ? 'bg-emerald-950 text-emerald-300 border-emerald-700/60'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: isDark
      ? 'bg-amber-950 text-amber-300 border-amber-700/60'
      : 'bg-amber-50 text-amber-700 border-amber-200',
    slate: isDark
      ? 'bg-slate-800 text-slate-300 border-slate-600/60'
      : 'bg-slate-100 text-slate-700 border-slate-300',
  }[badgeColor];

  return (
    <div
      className={`relative w-full h-full min-h-[460px] rounded-2xl overflow-hidden border shadow-xl backdrop-blur-sm transition-colors ${
        isDark ? 'border-slate-800/80 bg-slate-950/70' : 'border-slate-200 bg-white/95'
      }`}
    >
      {/* Top Header / Status bar */}
      {(title || badge) && (
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2.5 pointer-events-none">
          {title && (
            <div
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold shadow-md ${
                isDark
                  ? 'bg-slate-900/90 border-slate-800 text-slate-200'
                  : 'bg-white/95 border-slate-200 text-slate-800'
              }`}
            >
              {title}
            </div>
          )}
          {badge && (
            <div
              className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium border shadow-sm ${badgeColorClasses}`}
            >
              {badge}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {nodes.length === 0 ? (
        <div
          className={`flex flex-col items-center justify-center h-full font-mono text-sm ${
            isDark ? 'text-slate-500' : 'text-slate-400'
          }`}
        >
          <span>No AIG nodes in graph</span>
          <span className="text-xs text-slate-400 mt-1">Enter a Boolean equation to synthesize</span>
        </div>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onInit={setRfInstance}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.2}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            color={isDark ? '#334155' : '#cbd5e1'}
            gap={20}
            size={1}
            variant={BackgroundVariant.Dots}
          />
          <Controls
            className={
              isDark
                ? '!bg-slate-900 !border-slate-700 !fill-slate-300 !text-slate-300'
                : '!bg-white !border-slate-300 !fill-slate-700 !text-slate-700 shadow-md'
            }
          />
          <MiniMap
            nodeColor={(node) => {
              if (node.type === 'PI') return '#06b6d4';
              if (node.type === 'AND') return '#8b5cf6';
              if (node.type === 'PO') return '#f59e0b';
              return '#64748b';
            }}
            maskColor={isDark ? 'rgba(11, 15, 25, 0.75)' : 'rgba(241, 245, 249, 0.75)'}
            className={`!border rounded-lg overflow-hidden !bottom-4 !right-4 ${
              isDark ? '!bg-slate-900/90 !border-slate-800' : '!bg-white/95 !border-slate-300 shadow-md'
            }`}
          />
        </ReactFlow>
      )}
    </div>
  );
};

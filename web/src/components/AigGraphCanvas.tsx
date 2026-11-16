import React, { useMemo, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
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

export type GraphTab = 'simplified' | 'initial';

interface AigGraphCanvasProps {
  data: AigGraphData;
  activeTab: GraphTab;
  onTabChange: (tab: GraphTab) => void;
  badge?: string;
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

const NODE_WIDTH = 96;
const NODE_HEIGHT = 40;

function getLayoutedElements(graphData: AigGraphData) {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: 'TB',
    nodesep: 48,
    ranksep: 64,
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
        width: 13,
        height: 13,
        color: isInverted ? '#e11d48' : '#64748b',
      },
    };
  });

  return { nodes, edges };
}

export const AigGraphCanvas: React.FC<AigGraphCanvasProps> = ({
  data,
  activeTab,
  onTabChange,
  badge,
}) => {
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

  const badgeStyle =
    activeTab === 'simplified'
      ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
      : 'text-slate-700 bg-slate-100 border-slate-300';

  return (
    <div className="flex flex-col w-full rounded border border-slate-300 bg-white">
      <div className="flex items-center justify-between px-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onTabChange('simplified')}
            className={`px-3 py-2.5 text-xs border-b-2 cursor-pointer transition-colors ${
              activeTab === 'simplified'
                ? 'border-indigo-600 text-indigo-700 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            Simplified AIG
          </button>
          <button
            type="button"
            onClick={() => onTabChange('initial')}
            className={`px-3 py-2.5 text-xs border-b-2 cursor-pointer transition-colors ${
              activeTab === 'initial'
                ? 'border-indigo-600 text-indigo-700 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            Initial AIG
          </button>
        </div>

        {badge && (
          <span className={`px-2 py-0.5 rounded border text-[11px] font-mono ${badgeStyle}`}>
            {badge}
          </span>
        )}
      </div>

      <div className="relative h-[500px] w-full">
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full font-mono text-sm text-slate-400">
            <span>No AIG nodes in graph</span>
            <span className="text-xs mt-1">Enter a Boolean equation above</span>
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
              color="#e2e8f0"
              gap={20}
              size={1}
              variant={BackgroundVariant.Dots}
            />
            <Controls
              showInteractive={false}
              className="!bg-white !border-slate-300 !fill-slate-700 !text-slate-700 !shadow-none"
            />
          </ReactFlow>
        )}
      </div>
    </div>
  );
};

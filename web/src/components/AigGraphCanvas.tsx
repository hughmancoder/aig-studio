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
  initialGateCount: number;
  simplifiedGateCount: number;
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

const NODE_WIDTH = 48;
const NODE_HEIGHT = 48;

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
        width: 14,
        height: 14,
        color: '#101411',
      },
    };
  });

  return { nodes, edges };
}

export const AigGraphCanvas: React.FC<AigGraphCanvasProps> = ({
  data,
  activeTab,
  onTabChange,
  initialGateCount,
  simplifiedGateCount,
}) => {
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => getLayoutedElements(data),
    [data]
  );

  const graphKey = useMemo(
    () =>
      `${activeTab}-${layoutedNodes
        .map((n) => `${n.id}@${n.position.x},${n.position.y}`)
        .join(';')}`,
    [activeTab, layoutedNodes]
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
      const timer = window.setTimeout(() => {
        rfInstance.fitView({ padding: 0.2, duration: 120 });
      }, 50);
      return () => window.clearTimeout(timer);
    }
  }, [rfInstance, graphKey, layoutedNodes.length]);

  return (
    <div className="flex flex-col w-full bg-white border border-[#B6BFB8] rounded-md overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-2.5 border-b border-[#B6BFB8] bg-[#F2F5F3]">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onTabChange('initial')}
            className={`inline-flex items-center gap-1.5 text-sm cursor-pointer transition-colors ${
              activeTab === 'initial'
                ? 'font-semibold text-[#101411]'
                : 'font-normal text-[#909692] hover:text-[#101411]'
            }`}
          >
            <span>Initial AIG</span>
            <span className="bg-[#E4EBE6] text-[#101411] rounded-full px-2 py-0.5 text-xs font-medium">
              {initialGateCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('simplified')}
            className={`inline-flex items-center gap-1.5 text-sm cursor-pointer transition-colors ${
              activeTab === 'simplified'
                ? 'font-semibold text-[#101411]'
                : 'font-normal text-[#909692] hover:text-[#101411]'
            }`}
          >
            <span>Simplified AIG</span>
            <span className="bg-[#E4EBE6] text-[#101411] rounded-full px-2 py-0.5 text-xs font-medium">
              {simplifiedGateCount}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-[#232925]">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs border border-[#101411] bg-[#8DD6FF]/40 inline-block" /> PI
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border border-[#101411] bg-white inline-block" /> AND (&amp;)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs border border-[#101411] bg-[#BFFFD1]/60 inline-block" /> PO
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#101411] inline-block" /> NOT
          </span>
        </div>
      </div>

      <div className="relative h-[640px] w-full">
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full font-mono text-sm text-[#909692]">
            <span>No AIG nodes in graph</span>
            <span className="text-xs mt-1">Enter a Boolean equation above</span>
          </div>
        ) : (
          <ReactFlow
            key={graphKey}
            nodes={nodes}
            edges={edges}
            onInit={setRfInstance}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            maxZoom={2.5}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              color="#E4EBE6"
              gap={20}
              size={1}
              variant={BackgroundVariant.Dots}
            />
            <Controls
              showInteractive={false}
              className="!bg-[#F2F5F3] !border-[#B6BFB8] !fill-[#232925] !text-[#232925] !shadow-none !rounded-md"
            />
          </ReactFlow>
        )}
      </div>
    </div>
  );
};

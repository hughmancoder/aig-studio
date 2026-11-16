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
  initialGateCount,
  simplifiedGateCount,
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

  return (
    <div className="flex flex-col w-full bg-white border border-[#d0d7de] rounded-md overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-2.5 border-b border-[#d0d7de] bg-[#f6f8fa]">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onTabChange('initial')}
            className={`inline-flex items-center gap-1.5 text-sm cursor-pointer transition-colors ${
              activeTab === 'initial'
                ? 'font-semibold text-[#1f2328]'
                : 'font-normal text-[#656d76] hover:text-[#1f2328]'
            }`}
          >
            <span>Initial AIG</span>
            <span className="bg-[#eaeef2] text-[#1f2328] rounded-full px-2 py-0.5 text-xs font-medium">
              {initialGateCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('simplified')}
            className={`inline-flex items-center gap-1.5 text-sm cursor-pointer transition-colors ${
              activeTab === 'simplified'
                ? 'font-semibold text-[#1f2328]'
                : 'font-normal text-[#656d76] hover:text-[#1f2328]'
            }`}
          >
            <span>Simplified AIG</span>
            <span className="bg-[#eaeef2] text-[#1f2328] rounded-full px-2 py-0.5 text-xs font-medium">
              {simplifiedGateCount}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-[#656d76]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block" /> PI
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" /> AND
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> PO
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-rose-600 inline-block" /> NOT
          </span>
        </div>
      </div>

      <div className="relative h-[500px] w-full">
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full font-mono text-sm text-[#656d76]">
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
              color="#d8dee4"
              gap={20}
              size={1}
              variant={BackgroundVariant.Dots}
            />
            <Controls
              showInteractive={false}
              className="!bg-[#f6f8fa] !border-[#d0d7de] !fill-[#24292f] !text-[#24292f] !shadow-none !rounded-md"
            />
          </ReactFlow>
        )}
      </div>
    </div>
  );
};

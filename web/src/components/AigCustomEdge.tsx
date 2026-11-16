import { memo } from 'react';
import { BaseEdge, getBezierPath, EdgeLabelRenderer } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

export const AigCustomEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps<any>) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isInverted = Boolean(data?.inverted);

  const edgeStyle = isInverted
    ? {
        ...style,
        stroke: '#e11d48',
        strokeWidth: 1.75,
        strokeDasharray: '5 4',
      }
    : {
        ...style,
        stroke: '#64748b',
        strokeWidth: 1.75,
      };

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={edgeStyle} markerEnd={markerEnd} />
      {isInverted && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="w-3.5 h-3.5 rounded-full border-2 border-rose-600 bg-white z-10"
            title="Inverted / Complemented Edge (NOT)"
          />
        </EdgeLabelRenderer>
      )}
    </>
  );
});

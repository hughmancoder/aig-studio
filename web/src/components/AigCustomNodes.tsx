import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface NodeData {
  label: string;
  level?: number;
}

export const PiNode = memo(({ data }: { data: NodeData }) => {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded border font-mono min-w-[72px] justify-center bg-cyan-50 border-cyan-600 text-cyan-950">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-700">
        IN
      </span>
      <span className="font-bold text-sm">{data.label}</span>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !border-0 !bg-cyan-600"
      />
    </div>
  );
});

export const AndNode = memo(({ data }: { data: NodeData }) => {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded border font-mono min-w-[82px] justify-center bg-indigo-50 border-indigo-600 text-indigo-950">
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !border-0 !bg-indigo-600"
      />
      <span className="font-bold text-sm">AND</span>
      {data.level !== undefined && (
        <span className="text-[10px] px-1 rounded bg-indigo-100 text-indigo-700">
          L{data.level}
        </span>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !border-0 !bg-indigo-600"
      />
    </div>
  );
});

export const PoNode = memo(({ data }: { data: NodeData }) => {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded border font-mono min-w-[72px] justify-center bg-amber-50 border-amber-600 text-amber-950">
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !border-0 !bg-amber-600"
      />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
        OUT
      </span>
      <span className="font-bold text-sm">{data.label}</span>
    </div>
  );
});

export const ConstNode = memo(({ data }: { data: NodeData }) => {
  return (
    <div className="flex items-center justify-center px-3 py-1.5 rounded border font-mono min-w-[54px] bg-slate-100 border-slate-500 text-slate-900">
      <span className="font-bold text-xs">{data.label || '0'}</span>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !border-0 !bg-slate-500"
      />
    </div>
  );
});

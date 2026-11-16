import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface NodeData {
  label: string;
}

export const PiNode = memo(({ data }: { data: NodeData }) => {
  return (
    <div className="min-w-11 h-11 px-2 rounded-md border-2 border-[#101411] bg-[#8DD6FF]/25 text-[#101411] flex items-center justify-center font-mono font-bold text-sm">
      <span>{data.label}</span>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-1 !h-1 !opacity-0 !border-0"
      />
    </div>
  );
});

export const AndNode = memo(() => {
  return (
    <div className="w-11 h-11 rounded-full border-2 border-[#101411] bg-white text-[#101411] flex items-center justify-center font-mono font-bold text-base">
      <Handle
        type="target"
        position={Position.Top}
        className="!w-1 !h-1 !opacity-0 !border-0"
      />
      <span>&amp;</span>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-1 !h-1 !opacity-0 !border-0"
      />
    </div>
  );
});

export const PoNode = memo(({ data }: { data: NodeData }) => {
  return (
    <div className="min-w-11 h-11 px-2 rounded-md border-2 border-[#101411] bg-[#BFFFD1]/50 text-[#101411] flex items-center justify-center font-mono font-bold text-sm">
      <Handle
        type="target"
        position={Position.Top}
        className="!w-1 !h-1 !opacity-0 !border-0"
      />
      <span>{data.label}</span>
    </div>
  );
});

export const ConstNode = memo(({ data }: { data: NodeData }) => {
  return (
    <div className="w-10 h-10 rounded-md border-2 border-[#101411] bg-[#F2F5F3] text-[#101411] flex items-center justify-center font-mono font-bold text-sm">
      <span>{data.label || '0'}</span>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-1 !h-1 !opacity-0 !border-0"
      />
    </div>
  );
});

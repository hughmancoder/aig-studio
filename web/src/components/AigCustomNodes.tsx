import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface NodeData {
  label: string;
  level?: number;
}

export const PiNode = memo(({ data }: { data: NodeData }) => {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border font-mono min-w-[72px] justify-center bg-[#8DD6FF]/20 border-[#3094FF] text-[#101411]">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#0040A7]">
        IN
      </span>
      <span className="font-bold text-sm">{data.label}</span>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !border-0 !bg-[#3094FF]"
      />
    </div>
  );
});

export const AndNode = memo(({ data }: { data: NodeData }) => {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border font-mono min-w-[82px] justify-center bg-[#B3C1FD]/25 border-[#4956E5] text-[#101411]">
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !border-0 !bg-[#4956E5]"
      />
      <span className="font-bold text-sm">AND</span>
      {data.level !== undefined && (
        <span className="text-[10px] px-1 rounded bg-[#B3C1FD]/50 text-[#4956E5]">
          L{data.level}
        </span>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !border-0 !bg-[#4956E5]"
      />
    </div>
  );
});

export const PoNode = memo(({ data }: { data: NodeData }) => {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border font-mono min-w-[72px] justify-center bg-[#DA7210]/10 border-[#DA7210] text-[#101411]">
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !border-0 !bg-[#DA7210]"
      />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#B85B06]">
        OUT
      </span>
      <span className="font-bold text-sm">{data.label}</span>
    </div>
  );
});

export const ConstNode = memo(({ data }: { data: NodeData }) => {
  return (
    <div className="flex items-center justify-center px-3 py-1.5 rounded-md border font-mono min-w-[54px] bg-[#F2F5F3] border-[#909692] text-[#232925]">
      <span className="font-bold text-xs">{data.label || '0'}</span>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !border-0 !bg-[#909692]"
      />
    </div>
  );
});

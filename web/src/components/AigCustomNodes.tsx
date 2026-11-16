import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface NodeData {
  label: string;
  level?: number;
  theme?: 'dark' | 'light';
}

export const PiNode = memo(({ data }: { data: NodeData }) => {
  const isDark = data.theme === 'dark';
  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded border font-mono min-w-[72px] justify-center ${
        isDark
          ? 'bg-slate-900 border-cyan-500 text-cyan-100'
          : 'bg-cyan-50 border-cyan-600 text-cyan-950'
      }`}
    >
      <span
        className={`text-[10px] font-semibold uppercase tracking-wider ${
          isDark ? 'text-cyan-400' : 'text-cyan-700'
        }`}
      >
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
  const isDark = data.theme === 'dark';
  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded border font-mono min-w-[82px] justify-center ${
        isDark
          ? 'bg-slate-900 border-indigo-400 text-indigo-100'
          : 'bg-indigo-50 border-indigo-600 text-indigo-950'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !border-0 !bg-indigo-600"
      />
      <span className="font-bold text-sm">AND</span>
      {data.level !== undefined && (
        <span
          className={`text-[10px] px-1 rounded ${
            isDark ? 'bg-indigo-950 text-indigo-300' : 'bg-indigo-100 text-indigo-700'
          }`}
        >
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
  const isDark = data.theme === 'dark';
  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded border font-mono min-w-[72px] justify-center ${
        isDark
          ? 'bg-slate-900 border-amber-500 text-amber-100'
          : 'bg-amber-50 border-amber-600 text-amber-950'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !border-0 !bg-amber-600"
      />
      <span
        className={`text-[10px] font-semibold uppercase tracking-wider ${
          isDark ? 'text-amber-400' : 'text-amber-700'
        }`}
      >
        OUT
      </span>
      <span className="font-bold text-sm">{data.label}</span>
    </div>
  );
});

export const ConstNode = memo(({ data }: { data: NodeData }) => {
  const isDark = data.theme === 'dark';
  return (
    <div
      className={`flex items-center justify-center px-3 py-1.5 rounded border font-mono min-w-[54px] ${
        isDark
          ? 'bg-slate-900 border-slate-500 text-slate-200'
          : 'bg-slate-100 border-slate-500 text-slate-900'
      }`}
    >
      <span className="font-bold text-xs">{data.label || '0'}</span>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !border-0 !bg-slate-500"
      />
    </div>
  );
});

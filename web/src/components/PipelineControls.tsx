import React from 'react';
import { Sliders, Split, Eye } from 'lucide-react';

export type ViewMode = 'optimized' | 'split' | 'initial';

interface PipelineControlsProps {
  selectedPasses: string[];
  onTogglePass: (pass: string) => void;
  onSetRecipe: (passes: string[]) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  theme?: 'dark' | 'light';
}

const AVAILABLE_PASSES = [
  {
    id: 'strash',
    name: 'Strash',
    desc: 'Structural Hashing & On-the-fly local constant/idempotence folding',
  },
  {
    id: 'balance',
    name: 'Balance',
    desc: 'Huffman tree balancing to minimize AIG logic depth',
  },
  {
    id: 'rewrite',
    name: 'Rewrite',
    desc: '4-input cut DAG-aware rewriting using pre-computed truth table catalog',
  },
  {
    id: 'rewrite_z',
    name: 'Rewrite (Zero-Cost)',
    desc: 'Performs zero-cost local replacements to escape local minima',
  },
];

export const PipelineControls: React.FC<PipelineControlsProps> = ({
  selectedPasses,
  onTogglePass,
  onSetRecipe,
  viewMode,
  onViewModeChange,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';

  const containerBg = isDark
    ? 'bg-slate-900/80 border-slate-800'
    : 'bg-white border-slate-200 shadow-md';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const toggleContainerBg = isDark
    ? 'bg-slate-950/80 border-slate-800'
    : 'bg-slate-100 border-slate-200';

  return (
    <div className={`flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border shadow-xl backdrop-blur-md transition-colors ${containerBg}`}>
      {/* Passes selection */}
      <div className="flex flex-wrap items-center gap-2">
        <div className={`flex items-center gap-1.5 text-xs font-medium mr-1 ${textMuted}`}>
          <Sliders className="w-3.5 h-3.5 text-indigo-500" />
          <span>Pass Recipe:</span>
        </div>

        {AVAILABLE_PASSES.map((pass) => {
          const isActive = selectedPasses.includes(pass.id);
          const activeStyle = isDark
            ? 'bg-indigo-600/30 text-indigo-200 border-indigo-500/60 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
            : 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-sm';
          const inactiveStyle = isDark
            ? 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
            : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-800';

          return (
            <button
              key={pass.id}
              type="button"
              onClick={() => onTogglePass(pass.id)}
              title={pass.desc}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium border transition-all cursor-pointer ${
                isActive ? activeStyle : inactiveStyle
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isActive ? (isDark ? 'bg-indigo-400' : 'bg-indigo-600') : 'bg-slate-400'
                  }`}
                />
                {pass.name}
              </span>
            </button>
          );
        })}

        <div className={`h-4 w-px mx-1 hidden sm:block ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

        {/* Quick Recipes */}
        <button
          type="button"
          onClick={() => onSetRecipe(['strash', 'balance', 'rewrite'])}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono hover:text-cyan-500 transition-colors cursor-pointer ${
            isDark ? 'text-slate-400 hover:bg-slate-800/80' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          [Full: S+B+R]
        </button>
        <button
          type="button"
          onClick={() => onSetRecipe(['strash'])}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono hover:text-cyan-500 transition-colors cursor-pointer ${
            isDark ? 'text-slate-400 hover:bg-slate-800/80' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          [Strash Only]
        </button>
      </div>

      {/* View Mode Toggle */}
      <div className={`flex items-center p-1 rounded-xl border ${toggleContainerBg}`}>
        <button
          type="button"
          onClick={() => onViewModeChange('optimized')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            viewMode === 'optimized'
              ? (isDark ? 'bg-slate-800 text-cyan-300 shadow-sm' : 'bg-white text-cyan-700 shadow-sm font-semibold')
              : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800')
          }`}
          title="Single View: Optimized AIG"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Single Tree</span>
        </button>

        <button
          type="button"
          onClick={() => onViewModeChange('split')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            viewMode === 'split'
              ? (isDark ? 'bg-slate-800 text-cyan-300 shadow-sm' : 'bg-white text-cyan-700 shadow-sm font-semibold')
              : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800')
          }`}
          title="Compare Before & After Side-by-Side"
        >
          <Split className="w-3.5 h-3.5" />
          <span>Side-by-Side</span>
        </button>

        <button
          type="button"
          onClick={() => onViewModeChange('initial')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            viewMode === 'initial'
              ? (isDark ? 'bg-slate-800 text-cyan-300 shadow-sm' : 'bg-white text-cyan-700 shadow-sm font-semibold')
              : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800')
          }`}
          title="View Initial Unoptimized AIG"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Initial</span>
        </button>
      </div>
    </div>
  );
};

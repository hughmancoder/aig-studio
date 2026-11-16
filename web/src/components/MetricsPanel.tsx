import React, { useState } from 'react';
import type { AigStats, OutputMapping } from '../lib/aigTypes';

interface MetricsPanelProps {
  stats: AigStats;
  originalExpr: string;
  simplifiedExpr: string;
  outputs?: OutputMapping[];
  equivalent: boolean | null;
  theme?: 'dark' | 'light';
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({
  stats,
  originalExpr,
  simplifiedExpr,
  outputs = [],
  equivalent,
  theme = 'light',
}) => {
  const [copied, setCopied] = useState(false);
  const isDark = theme === 'dark';

  const andReduction =
    stats.initial_and_nodes > 0
      ? Math.round(
          ((stats.initial_and_nodes - stats.final_and_nodes) / stats.initial_and_nodes) * 100
        )
      : 0;

  const levelReduction =
    stats.initial_levels > 0
      ? Math.round(
          ((stats.initial_levels - stats.final_levels) / stats.initial_levels) * 100
        )
      : 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(simplifiedExpr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const borderClass = isDark ? 'border-slate-800' : 'border-slate-300';
  const divideClass = isDark ? 'divide-slate-800' : 'divide-slate-200';
  const mutedText = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <section
      className={`border rounded grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x ${borderClass} ${divideClass} ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'
      }`}
    >
      <div className="lg:col-span-6 p-4 flex items-start justify-between gap-4 min-w-0">
        <div className="min-w-0 flex-1">
          <div className={`text-[11px] font-semibold uppercase tracking-wider mb-1 ${mutedText}`}>
            Simplified Expression
          </div>
          <div
            className={`text-lg md:text-xl font-mono font-semibold truncate ${
              isDark ? 'text-indigo-300' : 'text-indigo-700'
            }`}
            title={simplifiedExpr}
          >
            {simplifiedExpr || '(empty)'}
          </div>
          <div className={`text-xs font-mono truncate mt-1 ${mutedText}`} title={originalExpr}>
            Input: {originalExpr}
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className={`px-3 py-1.5 rounded border text-xs font-medium shrink-0 cursor-pointer transition-colors ${
            isDark
              ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
              : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
          }`}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="lg:col-span-2 p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${mutedText}`}>
            AND Gates
          </span>
          {andReduction > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                isDark
                  ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              -{andReduction}%
            </span>
          )}
        </div>
        <div className="font-mono text-lg font-bold mt-2">
          <span className={mutedText}>{stats.initial_and_nodes}</span>
          <span className={`mx-1.5 ${mutedText}`}>&rarr;</span>
          <span className={isDark ? 'text-indigo-300' : 'text-indigo-700'}>
            {stats.final_and_nodes}
          </span>
        </div>
      </div>

      <div className="lg:col-span-2 p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${mutedText}`}>
            Logic Depth
          </span>
          {levelReduction > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                isDark
                  ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              -{levelReduction}%
            </span>
          )}
        </div>
        <div className="font-mono text-lg font-bold mt-2">
          <span className={mutedText}>{stats.initial_levels}</span>
          <span className={`mx-1.5 ${mutedText}`}>&rarr;</span>
          <span className={isDark ? 'text-cyan-300' : 'text-cyan-700'}>
            {stats.final_levels}
          </span>
          <span className={`text-xs font-normal ml-1.5 ${mutedText}`}>levels</span>
        </div>
      </div>

      <div className="lg:col-span-2 p-4 flex flex-col justify-between">
        <span className={`text-[11px] font-semibold uppercase tracking-wider ${mutedText}`}>
          Equivalence
        </span>
        <div className="mt-2">
          <div
            className={`text-sm font-semibold ${
              equivalent === true
                ? isDark
                  ? 'text-emerald-400'
                  : 'text-emerald-700'
                : equivalent === false
                ? isDark
                  ? 'text-rose-400'
                  : 'text-rose-700'
                : mutedText
            }`}
          >
            {equivalent === true ? 'Equivalent' : equivalent === false ? 'Mismatch' : 'N/A'}
          </div>
          <div className={`text-[11px] font-mono mt-0.5 ${mutedText}`}>
            PI: {stats.num_inputs} &middot; PO: {stats.num_outputs}
            {outputs.length > 1 ? ` (${outputs.length})` : ''}
          </div>
        </div>
      </div>
    </section>
  );
};

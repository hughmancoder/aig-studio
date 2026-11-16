import React, { useState } from 'react';
import type { AigStats, OutputMapping } from '../lib/aigTypes';

interface MetricsPanelProps {
  stats: AigStats;
  originalExpr: string;
  simplifiedExpr: string;
  outputs?: OutputMapping[];
  equivalent: boolean | null;
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({
  stats,
  originalExpr,
  simplifiedExpr,
  outputs = [],
  equivalent,
}) => {
  const [copied, setCopied] = useState(false);

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

  return (
    <section className="border border-slate-300 rounded grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 bg-white text-slate-900">
      <div className="lg:col-span-6 p-4 flex items-start justify-between gap-4 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider mb-1 text-slate-500">
            Simplified Expression
          </div>
          <div
            className="text-lg md:text-xl font-mono font-semibold truncate text-indigo-700"
            title={simplifiedExpr}
          >
            {simplifiedExpr || '(empty)'}
          </div>
          <div className="text-xs font-mono truncate mt-1 text-slate-500" title={originalExpr}>
            Input: {originalExpr}
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="px-3 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 text-xs font-medium shrink-0 cursor-pointer transition-colors"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="lg:col-span-2 p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            AND Gates
          </span>
          {andReduction > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
              -{andReduction}%
            </span>
          )}
        </div>
        <div className="font-mono text-lg font-bold mt-2">
          <span className="text-slate-500">{stats.initial_and_nodes}</span>
          <span className="mx-1.5 text-slate-500">&rarr;</span>
          <span className="text-indigo-700">{stats.final_and_nodes}</span>
        </div>
      </div>

      <div className="lg:col-span-2 p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Logic Depth
          </span>
          {levelReduction > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
              -{levelReduction}%
            </span>
          )}
        </div>
        <div className="font-mono text-lg font-bold mt-2">
          <span className="text-slate-500">{stats.initial_levels}</span>
          <span className="mx-1.5 text-slate-500">&rarr;</span>
          <span className="text-cyan-700">{stats.final_levels}</span>
          <span className="text-xs font-normal ml-1.5 text-slate-500">levels</span>
        </div>
      </div>

      <div className="lg:col-span-2 p-4 flex flex-col justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Equivalence
        </span>
        <div className="mt-2">
          <div
            className={`text-sm font-semibold ${
              equivalent === true
                ? 'text-emerald-700'
                : equivalent === false
                ? 'text-rose-700'
                : 'text-slate-500'
            }`}
          >
            {equivalent === true ? 'Equivalent' : equivalent === false ? 'Mismatch' : 'N/A'}
          </div>
          <div className="text-[11px] font-mono mt-0.5 text-slate-500">
            PI: {stats.num_inputs} &middot; PO: {stats.num_outputs}
            {outputs.length > 1 ? ` (${outputs.length})` : ''}
          </div>
        </div>
      </div>
    </section>
  );
};

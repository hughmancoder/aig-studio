import React, { useState } from 'react';
import type { AigStats, OutputMapping } from '../lib/aigTypes';

interface SimplifiedExpressionBarProps {
  simplifiedExpr: string;
}

export const SimplifiedExpressionBar: React.FC<SimplifiedExpressionBarProps> = ({
  simplifiedExpr,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(simplifiedExpr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section className="bg-white border border-[#d0d7de] rounded-md px-4 py-3 flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider mb-0.5 text-[#656d76]">
          Simplified Expression
        </div>
        <div
          className="text-base md:text-lg font-mono font-semibold truncate text-[#1f2328]"
          title={simplifiedExpr}
        >
          {simplifiedExpr || '(empty)'}
        </div>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className="px-3 py-1.5 rounded-md border border-[#d0d7de] bg-[#f6f8fa] hover:bg-[#eef1f4] active:bg-[#e7ebef] text-[#24292f] text-xs font-medium shrink-0 cursor-pointer transition-colors"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </section>
  );
};

interface MetricsPanelProps {
  stats: AigStats;
  outputs?: OutputMapping[];
  equivalent: boolean | null;
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({
  stats,
  outputs = [],
  equivalent,
}) => {
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

  return (
    <section className="bg-white border border-[#d0d7de] rounded-md grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#d0d7de] text-[#1f2328]">
      <div className="p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#656d76]">
            AND Gates
          </span>
          {andReduction > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-[#dafbe1] text-[#1a7f37] border border-[#aceebb]">
              -{andReduction}%
            </span>
          )}
        </div>
        <div className="font-mono text-base font-semibold mt-1.5">
          <span className="text-[#656d76]">{stats.initial_and_nodes}</span>
          <span className="mx-1.5 text-[#656d76]">&rarr;</span>
          <span className="text-[#1f2328]">{stats.final_and_nodes}</span>
        </div>
      </div>

      <div className="p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#656d76]">
            Logic Depth
          </span>
          {levelReduction > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-[#dafbe1] text-[#1a7f37] border border-[#aceebb]">
              -{levelReduction}%
            </span>
          )}
        </div>
        <div className="font-mono text-base font-semibold mt-1.5">
          <span className="text-[#656d76]">Level {stats.initial_levels}</span>
          <span className="mx-1.5 text-[#656d76]">&rarr;</span>
          <span className="text-[#1f2328]">Level {stats.final_levels}</span>
        </div>
      </div>

      <div className="p-4 flex flex-col justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#656d76]">
          Primary I/O
        </span>
        <div className="font-mono text-sm font-medium mt-1.5 text-[#1f2328]">
          {stats.num_inputs} Inputs &middot; {stats.num_outputs} Outputs
          {outputs.length > 1 ? ` (${outputs.length})` : ''}
        </div>
      </div>

      <div className="p-4 flex flex-col justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#656d76]">
          Equivalence
        </span>
        <div
          className={`text-sm font-semibold mt-1.5 ${
            equivalent === true
              ? 'text-[#1a7f37]'
              : equivalent === false
              ? 'text-[#cf222e]'
              : 'text-[#656d76]'
          }`}
        >
          {equivalent === true
            ? 'Formally Equivalent'
            : equivalent === false
            ? 'Logic Mismatch'
            : 'N/A'}
        </div>
      </div>
    </section>
  );
};

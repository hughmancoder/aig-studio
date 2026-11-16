import React, { useState } from 'react';
import type { AigStats } from '../lib/aigTypes';

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
    <section className="bg-white border border-[#B6BFB8] rounded-md px-4 py-2.5 flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider mb-0.5 text-[#909692]">
          Simplified Expression
        </div>
        <div
          className="text-base md:text-lg font-mono font-semibold truncate text-[#101411]"
          title={simplifiedExpr}
        >
          {simplifiedExpr || '(empty)'}
        </div>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className="px-3 py-1.5 rounded-md border border-[#B6BFB8] bg-[#F2F5F3] hover:bg-[#E4EBE6] text-[#232925] text-xs font-medium shrink-0 cursor-pointer transition-colors"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </section>
  );
};

interface MetricsPanelProps {
  stats: AigStats;
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({ stats }) => {
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
    <section className="bg-white border border-[#B6BFB8] rounded-md grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#B6BFB8] text-[#101411]">
      <div className="p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#909692]">
            AND Gates
          </span>
          {andReduction > 0 && (
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#BFFFD1] text-[#08872B] border border-[#8CF2A6]">
              -{andReduction}%
            </span>
          )}
        </div>
        <div className="font-mono text-base font-semibold mt-1">
          <span className="text-[#909692]">{stats.initial_and_nodes}</span>
          <span className="mx-1.5 text-[#909692]">&rarr;</span>
          <span className="text-[#101411]">{stats.final_and_nodes}</span>
        </div>
      </div>

      <div className="p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#909692]">
            Logic Depth
          </span>
          {levelReduction > 0 && (
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#BFFFD1] text-[#08872B] border border-[#8CF2A6]">
              -{levelReduction}%
            </span>
          )}
        </div>
        <div className="font-mono text-base font-semibold mt-1">
          <span className="text-[#909692]">Level {stats.initial_levels}</span>
          <span className="mx-1.5 text-[#909692]">&rarr;</span>
          <span className="text-[#101411]">Level {stats.final_levels}</span>
        </div>
      </div>
    </section>
  );
};

import React, { useState } from 'react';
import { CheckCircle2, XCircle, ArrowRight, Copy, Check, Cpu, Layers, Sparkles } from 'lucide-react';
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
  theme = 'dark',
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
    setTimeout(() => setCopied(false), 2000);
  };

  const cardBg = isDark
    ? 'bg-slate-900/80 border-slate-800 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900 shadow-md';
  const subCardBg = isDark
    ? 'bg-slate-950/70 border-slate-800/80'
    : 'bg-slate-50 border-slate-200';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="flex flex-col gap-4">
      {/* Prominent Resulting Expression Banner */}
      <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-2xl border shadow-xl backdrop-blur-md ${cardBg}`}>
        <div className="flex items-start md:items-center gap-3.5 flex-1 min-w-0">
          <div className={`p-2.5 rounded-xl shrink-0 ${isDark ? 'bg-cyan-950/80 border border-cyan-800/60 text-cyan-400' : 'bg-cyan-100 border border-cyan-200 text-cyan-700'}`}>
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-semibold uppercase tracking-wider mb-1 ${textMuted}`}>
              Resulting Simplified Expression
            </div>
            <div
              className={`font-mono text-xl md:text-2xl lg:text-3xl font-extrabold tracking-tight truncate py-0.5 ${
                isDark ? 'text-cyan-300' : 'text-cyan-700'
              }`}
              title={simplifiedExpr}
            >
              {simplifiedExpr || '(empty)'}
            </div>
            <div className={`text-xs font-mono truncate mt-0.5 ${textMuted}`} title={originalExpr}>
              Input: {originalExpr}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium border transition-all cursor-pointer shrink-0 ${
            isDark
              ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200 hover:text-white'
              : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700 hover:text-slate-900 shadow-sm'
          }`}
          title="Copy Simplified Formula"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-500" />
              <span className="text-emerald-500 font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy Formula</span>
            </>
          )}
        </button>
      </div>

      {/* Numerical Metrics Cards */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 rounded-2xl border shadow-xl backdrop-blur-md ${cardBg}`}>
        {/* Metric 1: AND Gates */}
        <div className={`flex flex-col p-4 rounded-xl border ${subCardBg}`}>
          <div className={`flex items-center justify-between text-xs font-medium mb-2 ${textMuted}`}>
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-500" />
              AND Gates
            </span>
            {andReduction > 0 ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                -{andReduction}%
              </span>
            ) : andReduction < 0 ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-400 border border-amber-800">
                +{Math.abs(andReduction)}%
              </span>
            ) : null}
          </div>
          <div className="flex items-baseline gap-2 font-mono">
            <span className={`text-xl font-bold ${textMuted}`}>{stats.initial_and_nodes}</span>
            <ArrowRight className={`w-3.5 h-3.5 ${textMuted}`} />
            <span className={`text-2xl font-black ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>
              {stats.final_and_nodes}
            </span>
            <span className={`text-xs ml-auto ${textMuted}`}>gates</span>
          </div>
        </div>

        {/* Metric 2: Logic Depth / Delay Levels */}
        <div className={`flex flex-col p-4 rounded-xl border ${subCardBg}`}>
          <div className={`flex items-center justify-between text-xs font-medium mb-2 ${textMuted}`}>
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-500" />
              Logic Depth (Levels)
            </span>
            {levelReduction > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                -{levelReduction}%
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2 font-mono">
            <span className={`text-xl font-bold ${textMuted}`}>{stats.initial_levels}</span>
            <ArrowRight className={`w-3.5 h-3.5 ${textMuted}`} />
            <span className={`text-2xl font-black ${isDark ? 'text-cyan-300' : 'text-cyan-600'}`}>
              {stats.final_levels}
            </span>
            <span className={`text-xs ml-auto ${textMuted}`}>delay</span>
          </div>
        </div>

        {/* Metric 3: Equivalence & IO Summary */}
        <div className={`flex flex-col justify-between p-4 rounded-xl border ${subCardBg}`}>
          <div className={`text-xs font-medium mb-1 ${textMuted}`}>Formal Verification</div>
          <div>
            {equivalent === true && (
              <div className="flex items-center gap-2 text-emerald-500 font-medium text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Formally Equivalent (Exact Match)</span>
              </div>
            )}
            {equivalent === false && (
              <div className="flex items-center gap-2 text-rose-500 font-medium text-xs">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>Logic Mismatch</span>
              </div>
            )}
            {equivalent === null && (
              <div className={`flex items-center gap-2 font-medium text-xs ${textMuted}`}>
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span>Not evaluated</span>
              </div>
            )}
          </div>
          <div className={`flex items-center gap-3 text-[11px] font-mono mt-2 ${textMuted}`}>
            <span>PI: {stats.num_inputs}</span>
            <span>•</span>
            <span>PO: {stats.num_outputs}</span>
            {outputs.length > 1 && <span>({outputs.length} signals)</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

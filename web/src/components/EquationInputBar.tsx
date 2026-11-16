import React, { useState } from 'react';
import { Play, Sparkles, HelpCircle, Terminal } from 'lucide-react';

interface EquationInputBarProps {
  value: string;
  onChange: (val: string) => void;
  onSelectPreset?: (val: string) => void;
  onSynthesize: () => void;
  isProcessing?: boolean;
  theme?: 'dark' | 'light';
}

const PRESETS = [
  {
    name: 'Redundant Literal',
    equation: 'F = A & B & A & C',
    desc: 'Associative absorption: simplifies duplicate literal A down to A & B & C',
  },
  {
    name: 'Redundant SOP',
    equation: 'F = (A & B) | (A & ~B)',
    desc: 'Classic absorption: simplifies 3 ANDs down to 0 (just A)',
  },
  {
    name: 'Full Adder Carry',
    equation: 'Cout = (A & B) | (Cin & (A ^ B))',
    desc: 'Arithmetic carry logic with XOR and AND-OR tree',
  },
  {
    name: '4-bit Parity (XOR Chain)',
    equation: 'P = A ^ B ^ C ^ D',
    desc: 'Cascaded XOR gates ideal for tree balancing',
  },
  {
    name: 'Consensus Theorem',
    equation: 'F = (A & B) | (~A & C) | (B & C)',
    desc: 'Redundant consensus term (B & C) eliminated by rewriting',
  },
  {
    name: 'De Morgan Dual',
    equation: 'F = ~(~A | ~B)',
    desc: 'Dual form simplifies directly to A & B',
  },
  {
    name: 'Multi-Output',
    equation: 'Sum = A ^ B ^ Cin; Cout = (A & B) | (Cin & (A ^ B))',
    desc: 'Multiple outputs separated by semicolons',
  },
];

export const EquationInputBar: React.FC<EquationInputBarProps> = ({
  value,
  onChange,
  onSelectPreset,
  onSynthesize,
  isProcessing = false,
  theme = 'dark',
}) => {
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const isDark = theme === 'dark';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSynthesize();
    }
  };

  const containerBg = isDark
    ? 'bg-slate-900/80 border-slate-800'
    : 'bg-white border-slate-200 shadow-md';
  const inputBg = isDark
    ? 'bg-slate-950/80 border-slate-700/80 text-cyan-100 placeholder-slate-500'
    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400';
  const cheatSheetBg = isDark
    ? 'bg-slate-950/90 border-slate-800 text-slate-300'
    : 'bg-slate-50 border-slate-200 text-slate-700 shadow-inner';
  const presetBtn = isDark
    ? 'bg-slate-800/60 hover:bg-slate-700/80 border-slate-700/50 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-200'
    : 'bg-slate-100 hover:bg-slate-200 border-slate-200 hover:border-cyan-500 text-slate-700 hover:text-cyan-700 shadow-sm';

  return (
    <div className={`flex flex-col gap-3 w-full border rounded-2xl p-4 shadow-xl backdrop-blur-md transition-colors ${containerBg}`}>
      {/* Input row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 flex items-center">
          <div className="absolute left-3.5 flex items-center pointer-events-none">
            <Terminal className="w-4 h-4 text-cyan-500" />
          </div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. F = A & B & A & C or F = (A & B) | (A & ~B)"
            className={`w-full pl-10 pr-10 py-3 rounded-xl border text-sm font-mono focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all shadow-inner ${inputBg}`}
          />
          <button
            type="button"
            onClick={() => setShowCheatSheet(!showCheatSheet)}
            className={`absolute right-3 hover:text-cyan-500 transition-colors cursor-pointer ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
            title="Syntax Cheat Sheet"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onSynthesize}
          disabled={isProcessing || !value.trim()}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 active:scale-95 text-white font-medium text-sm shadow-[0_0_20px_rgba(6,182,212,0.35)] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          {isProcessing ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Play className="w-4 h-4 fill-current" />
          )}
          <span>Synthesize</span>
        </button>
      </div>

      {/* Syntax Cheat Sheet Accordion */}
      {showCheatSheet && (
        <div className={`grid grid-cols-2 md:grid-cols-4 gap-2 p-3 rounded-xl border text-xs font-mono ${cheatSheetBg}`}>
          <div className="flex items-center gap-2">
            <code className="text-cyan-500 font-bold">&, *</code>
            <span>AND operator</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-indigo-500 font-bold">|, +</code>
            <span>OR operator</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-amber-500 font-bold">^</code>
            <span>XOR operator</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-rose-500 font-bold">~, !, '</code>
            <span>NOT / complement</span>
          </div>
        </div>
      )}

      {/* Presets Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <div className={`flex items-center gap-1.5 text-xs shrink-0 mr-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Presets:</span>
        </div>
        {PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => {
              if (onSelectPreset) {
                onSelectPreset(preset.equation);
              } else {
                onChange(preset.equation);
              }
            }}
            title={preset.desc}
            className={`px-2.5 py-1 rounded-lg border text-xs font-mono transition-all shrink-0 cursor-pointer ${presetBtn}`}
          >
            {preset.name}
          </button>
        ))}
      </div>
    </div>
  );
};

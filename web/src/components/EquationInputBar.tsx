import React from 'react';

interface EquationInputBarProps {
  value: string;
  onChange: (val: string) => void;
  onSelectPreset?: (val: string) => void;
  onSynthesize: () => void;
}

const PRESETS = [
  {
    name: 'Redundant SOP',
    equation: 'F = (A & B) | (A & ~B)',
    desc: 'Simplifies 3 AND gates down to A',
  },
  {
    name: 'Consensus Theorem',
    equation: 'F = (A & B) | (~A & C) | (B & C)',
    desc: 'Eliminates redundant consensus term (B & C)',
  },
  {
    name: 'Distributive',
    equation: 'F = (A & B) | (A & C)',
    desc: 'Factors common literal A into A & (B | C)',
  },
  {
    name: 'Majority',
    equation: 'F = (A & B) | (B & C) | (A & C)',
    desc: '3-input majority voter gate simplified from 5 to 4 AND gates',
  },
  {
    name: '4-bit Parity',
    equation: 'P = A ^ B ^ C ^ D',
    desc: 'Cascaded XOR chain balanced from 6 to 4 levels',
  },
  {
    name: 'Full Adder',
    equation: 'Sum = A ^ B ^ Cin; Cout = (A & B) | (Cin & (A ^ B))',
    desc: 'Multi-output full adder sharing A ^ B sub-graph (12 to 9 AND gates)',
  },
  {
    name: "De Morgan's Law",
    equation: 'F = ~(~A | ~B)',
    desc: 'Simplifies dual form ~(~A | ~B) directly to A & B',
  },
];

export const EquationInputBar: React.FC<EquationInputBarProps> = ({
  value,
  onChange,
  onSelectPreset,
  onSynthesize,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSynthesize();
    }
  };

  return (
    <section className="flex flex-col gap-2.5 w-full bg-white border border-[#B6BFB8] rounded-md p-3">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="equation-input"
          className="text-[11px] font-semibold uppercase tracking-wider text-[#909692]"
        >
          Input
        </label>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <input
            id="equation-input"
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. F = (A & B) | (A & ~B)"
            className="flex-1 h-9 font-mono text-sm px-3 rounded-md border border-[#B6BFB8] bg-[#F2F5F3] focus:bg-white text-[#101411] placeholder-[#909692] focus:outline-none focus:border-[#1A61FE] focus:ring-2 focus:ring-[#1A61FE]/20 transition-colors"
          />
          <button
            type="button"
            onClick={onSynthesize}
            disabled={!value.trim()}
            className="h-9 w-24 inline-flex items-center justify-center rounded-md text-xs font-semibold bg-[#F2F5F3] hover:bg-[#E4EBE6] text-[#232925] border border-[#B6BFB8] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors shrink-0"
          >
            Simplify
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((preset) => {
          const isActive = value.trim() === preset.equation;
          return (
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
              className={`px-2.5 py-1 rounded-md border text-xs font-mono transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#E4EBE6] border-[#909692] text-[#101411] font-semibold'
                  : 'bg-[#F2F5F3] hover:bg-[#E4EBE6] border-[#B6BFB8] text-[#232925]'
              }`}
            >
              {preset.name}
            </button>
          );
        })}
      </div>
    </section>
  );
};

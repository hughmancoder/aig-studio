import React from 'react';

interface EquationInputBarProps {
  value: string;
  onChange: (val: string) => void;
  onSelectPreset?: (val: string) => void;
  onSynthesize: () => void;
}

const PRESETS = [
  {
    name: 'Redundant Literal',
    equation: 'F = A & B & A & C',
    desc: 'Simplifies duplicate literal A to A & B & C',
  },
  {
    name: 'Redundant SOP',
    equation: 'F = (A & B) | (A & ~B)',
    desc: 'Simplifies 3 AND gates down to A',
  },
  {
    name: 'Absorption',
    equation: 'F = A | (A & B)',
    desc: 'Absorbs redundant term (A & B) into A',
  },
  {
    name: 'Distributive',
    equation: 'F = (A & B) | (A & C)',
    desc: 'Factors common literal A into A & (B | C)',
  },
  {
    name: '2:1 MUX',
    equation: 'F = (S & A) | (~S & B)',
    desc: 'Multiplexer select logic',
  },
  {
    name: 'Consensus Theorem',
    equation: 'F = (A & B) | (~A & C) | (B & C)',
    desc: 'Eliminates redundant consensus term (B & C)',
  },
  {
    name: 'Majority',
    equation: 'F = (A & B) | (B & C) | (A & C)',
    desc: '3-input majority voter gate',
  },
  {
    name: 'De Morgan Dual',
    equation: 'F = ~(~A | ~B)',
    desc: 'Simplifies dual form directly to A & B',
  },
  {
    name: 'Contradiction',
    equation: 'F = (A & B) & ~A',
    desc: 'Collapses contradictory product to constant 0',
  },
  {
    name: 'XOR from NAND/OR',
    equation: 'F = (A | B) & ~(A & B)',
    desc: 'Synthesizes XOR from OR and NAND',
  },
  {
    name: '4-bit Parity',
    equation: 'P = A ^ B ^ C ^ D',
    desc: 'Cascaded XOR chain balanced for lower depth',
  },
  {
    name: 'Full Adder Carry',
    equation: 'Cout = (A & B) | (Cin & (A ^ B))',
    desc: 'Carry logic with XOR and AND-OR gates',
  },
  {
    name: 'Multi-Output',
    equation: 'Sum = A ^ B ^ Cin; Cout = (A & B) | (Cin & (A ^ B))',
    desc: 'Full adder with shared A ^ B sub-graph',
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
    <section className="flex flex-col gap-3 w-full bg-white border border-[#d0d7de] rounded-md p-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="equation-input"
          className="text-[11px] font-semibold uppercase tracking-wider text-[#656d76]"
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
            className="flex-1 font-mono text-sm px-3 py-1.5 rounded-md border border-[#d0d7de] bg-[#f6f8fa] focus:bg-white text-[#1f2328] placeholder-[#6e7781] focus:outline-none focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20 transition-colors"
          />
          <button
            type="button"
            onClick={onSynthesize}
            disabled={!value.trim()}
            className="px-4 py-1.5 rounded-md text-sm font-medium bg-[#f6f8fa] hover:bg-[#eef1f4] active:bg-[#e7ebef] text-[#24292f] border border-[#d0d7de] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors shrink-0"
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
                  ? 'bg-[#eaeef2] border-[#8c959f] text-[#1f2328] font-semibold'
                  : 'bg-[#f6f8fa] hover:bg-[#eef1f4] border-[#d0d7de] text-[#24292f]'
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

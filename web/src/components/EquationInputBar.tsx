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
    <section className="flex flex-col gap-3 w-full border rounded p-4 bg-white border-slate-300">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
        <label htmlFor="equation-input" className="sr-only">
          Boolean Expression
        </label>
        <input
          id="equation-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. F = (A & B) | (A & ~B)"
          className="flex-1 font-mono text-sm px-3 py-2 rounded border border-slate-300 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600"
        />
        <button
          type="button"
          onClick={onSynthesize}
          disabled={!value.trim()}
          className="px-4 py-2 rounded text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors shrink-0"
        >
          Simplify
        </button>
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
              className={`px-2.5 py-1 rounded border text-xs font-mono transition-colors cursor-pointer ${
                isActive
                  ? 'bg-indigo-50 border-indigo-600 text-indigo-800 font-medium'
                  : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
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

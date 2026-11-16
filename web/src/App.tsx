import { useState } from 'react';
import { useAigEngine } from './hooks/useAigEngine';
import type { AigProcessResult } from './lib/aigTypes';
import { synthesizeAndOptimizeTS } from './lib/aigEngine';
import { AigGraphCanvas, type GraphTab } from './components/AigGraphCanvas';
import { EquationInputBar } from './components/EquationInputBar';
import { MetricsPanel } from './components/MetricsPanel';

const DEFAULT_EQUATION = 'F = (A & B) | (A & ~B)';
const PASS_RECIPE = ['strash', 'balance', 'rewrite'];

export function App() {
  const { simplifyEquation } = useAigEngine();

  const [equation, setEquation] = useState<string>(DEFAULT_EQUATION);
  const [activeTab, setActiveTab] = useState<GraphTab>('simplified');
  const [result, setResult] = useState<AigProcessResult | null>(() =>
    synthesizeAndOptimizeTS(DEFAULT_EQUATION, PASS_RECIPE)
  );

  const runSynthesize = (nextEquation: string) => {
    if (!nextEquation.trim()) return;
    setResult(simplifyEquation(nextEquation, PASS_RECIPE));
  };

  const handleSynthesize = () => {
    runSynthesize(equation);
  };

  const handleSelectPreset = (presetEquation: string) => {
    setEquation(presetEquation);
    runSynthesize(presetEquation);
  };

  const activeGraph =
    activeTab === 'simplified'
      ? result?.graph || { nodes: [], edges: [] }
      : result?.initial_graph || { nodes: [], edges: [] };

  const activeBadge =
    activeTab === 'simplified'
      ? `${result?.stats.final_and_nodes ?? 0} AND gates · Level ${result?.stats.final_levels ?? 0}`
      : `${result?.stats.initial_and_nodes ?? 0} AND gates · Level ${result?.stats.initial_levels ?? 0}`;

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-3.5 border-b bg-white border-slate-300">
        <h1 className="text-base font-bold tracking-tight">
          And-Inverter Graph Logic Simplifier
        </h1>

        <div className="flex items-center gap-3 text-xs font-mono text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500 inline-block" /> PI
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600 inline-block" /> AND
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" /> PO
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-rose-600 inline-block" /> NOT
          </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-6 max-w-[1400px] w-full mx-auto gap-4">
        <EquationInputBar
          value={equation}
          onChange={setEquation}
          onSelectPreset={handleSelectPreset}
          onSynthesize={handleSynthesize}
        />

        {result?.status === 'error' && (
          <div className="px-4 py-3 rounded border text-sm font-mono bg-rose-50 border-rose-300 text-rose-800">
            Error: {result.error_message}
          </div>
        )}

        {result && result.status === 'ok' && (
          <MetricsPanel
            stats={result.stats}
            simplifiedExpr={result.simplified_expr}
            outputs={result.outputs}
            equivalent={result.equivalent}
          />
        )}

        <AigGraphCanvas
          data={activeGraph}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          badge={activeBadge}
        />
      </main>
    </div>
  );
}

export default App;

import { useState } from 'react';
import { useAigEngine } from './hooks/useAigEngine';
import type { AigProcessResult } from './lib/aigTypes';
import { synthesizeAndOptimizeTS } from './lib/aigEngine';
import { AigGraphCanvas, type GraphTab } from './components/AigGraphCanvas';
import { EquationInputBar } from './components/EquationInputBar';
import { SimplifiedExpressionBar, MetricsPanel } from './components/MetricsPanel';

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

  return (
    <div className="flex flex-col min-h-screen bg-[#f6f8fa] text-[#1f2328]">
      <header className="flex items-center px-6 py-3.5 border-b bg-[#f6f8fa] border-[#d0d7de]">
        <h1 className="text-sm font-semibold tracking-tight text-[#1f2328]">
          And-Inverter Graph Logic Simplifier
        </h1>
      </header>

      <main className="flex-1 flex flex-col p-6 max-w-[1280px] w-full mx-auto gap-4">
        <EquationInputBar
          value={equation}
          onChange={setEquation}
          onSelectPreset={handleSelectPreset}
          onSynthesize={handleSynthesize}
        />

        {result?.status === 'error' && (
          <div className="px-4 py-3 rounded-md border text-sm font-mono bg-[#ffebe9] border-[#ff8182] text-[#cf222e]">
            Error: {result.error_message}
          </div>
        )}

        {result && result.status === 'ok' && (
          <SimplifiedExpressionBar simplifiedExpr={result.simplified_expr} />
        )}

        <AigGraphCanvas
          data={activeGraph}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          initialGateCount={result?.stats.initial_and_nodes ?? 0}
          simplifiedGateCount={result?.stats.final_and_nodes ?? 0}
        />

        {result && result.status === 'ok' && (
          <MetricsPanel
            stats={result.stats}
            outputs={result.outputs}
            equivalent={result.equivalent}
          />
        )}
      </main>
    </div>
  );
}

export default App;

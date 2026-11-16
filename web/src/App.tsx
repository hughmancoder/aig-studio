import { useState } from 'react';
import { useAigEngine } from './hooks/useAigEngine';
import type { AigProcessResult } from './lib/aigTypes';
import { synthesizeAndOptimizeTS } from './lib/aigEngine';
import { AigGraphCanvas } from './components/AigGraphCanvas';
import { EquationInputBar } from './components/EquationInputBar';
import { MetricsPanel } from './components/MetricsPanel';

type ViewMode = 'split' | 'simplified';

const DEFAULT_EQUATION = 'F = A & B & A & C';
const PASS_RECIPE = ['strash', 'balance', 'rewrite'];

export function App() {
  const { simplifyEquation } = useAigEngine();

  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [equation, setEquation] = useState<string>(DEFAULT_EQUATION);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [result, setResult] = useState<AigProcessResult | null>(() =>
    synthesizeAndOptimizeTS(DEFAULT_EQUATION, PASS_RECIPE)
  );

  const isDark = theme === 'dark';

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

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div
      className={`flex flex-col min-h-screen transition-colors ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* Flat Material Header */}
      <header
        className={`flex flex-wrap items-center justify-between gap-4 px-6 py-3 border-b ${
          isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-300'
        }`}
      >
        <div>
          <h1 className="text-base font-bold tracking-tight">AIG Studio</h1>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            And-Inverter Graph Visualizer &amp; Logic Simplifier
          </p>
        </div>

        <div className="flex items-center gap-5">
          {/* Minimal Legend */}
          <div
            className={`hidden md:flex items-center gap-3 text-xs font-mono ${
              isDark ? 'text-slate-300' : 'text-slate-600'
            }`}
          >
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

          {/* Flat Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`px-3 py-1 rounded border text-xs font-medium cursor-pointer transition-colors ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            {isDark ? 'Light Theme' : 'Dark Theme'}
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col p-6 max-w-[1600px] w-full mx-auto gap-4">
        <EquationInputBar
          value={equation}
          onChange={setEquation}
          onSelectPreset={handleSelectPreset}
          onSynthesize={handleSynthesize}
          theme={theme}
        />

        {result?.status === 'error' && (
          <div
            className={`px-4 py-3 rounded border text-sm font-mono ${
              isDark
                ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                : 'bg-rose-50 border-rose-300 text-rose-800'
            }`}
          >
            Error: {result.error_message}
          </div>
        )}

        {/* Compact View Toggle Bar */}
        <div className="flex items-center justify-between">
          <span
            className={`text-xs font-semibold uppercase tracking-wider ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            AIG Representation
          </span>

          <div
            className={`inline-flex rounded border p-0.5 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
            }`}
          >
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-3 py-1 rounded-sm text-xs font-medium cursor-pointer transition-colors ${
                viewMode === 'split'
                  ? 'bg-indigo-600 text-white'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Side-by-Side
            </button>
            <button
              type="button"
              onClick={() => setViewMode('simplified')}
              className={`px-3 py-1 rounded-sm text-xs font-medium cursor-pointer transition-colors ${
                viewMode === 'simplified'
                  ? 'bg-indigo-600 text-white'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Simplified Only
            </button>
          </div>
        </div>

        {/* Graph Canvas(es) */}
        {viewMode === 'split' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AigGraphCanvas
              data={result?.initial_graph || { nodes: [], edges: [] }}
              title="Initial AIG"
              badge={`${result?.stats.initial_and_nodes ?? 0} AND gates · Level ${result?.stats.initial_levels ?? 0}`}
              accent="neutral"
              theme={theme}
            />
            <AigGraphCanvas
              data={result?.graph || { nodes: [], edges: [] }}
              title="Simplified AIG"
              badge={`${result?.stats.final_and_nodes ?? 0} AND gates · Level ${result?.stats.final_levels ?? 0}`}
              accent="emerald"
              theme={theme}
            />
          </div>
        ) : (
          <AigGraphCanvas
            data={result?.graph || { nodes: [], edges: [] }}
            title="Simplified AIG"
            badge={`${result?.stats.final_and_nodes ?? 0} AND gates · Level ${result?.stats.final_levels ?? 0}`}
            accent="emerald"
            theme={theme}
          />
        )}

        {/* Simplified Expression & Metrics */}
        {result && result.status === 'ok' && (
          <MetricsPanel
            stats={result.stats}
            originalExpr={result.original_expr}
            simplifiedExpr={result.simplified_expr}
            outputs={result.outputs}
            equivalent={result.equivalent}
            theme={theme}
          />
        )}
      </main>
    </div>
  );
}

export default App;

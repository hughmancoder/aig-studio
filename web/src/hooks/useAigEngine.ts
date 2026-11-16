import { useState, useEffect, useCallback } from 'react';
import type { AigProcessResult } from '../lib/aigTypes';
import { synthesizeAndOptimizeTS } from '../lib/aigEngine';

interface WasmModuleInstance {
  process_equation: (eq: string, passes: string) => string;
}

export function useAigEngine() {
  const [wasmModule, setWasmModule] = useState<WasmModuleInstance | null>(null);
  const [isWasmLoaded, setIsWasmLoaded] = useState(false);
  const [wasmError, setWasmError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function initWasm() {
      try {
        // Attempt to dynamically load the compiled Emscripten module
        // @ts-ignore
        const moduleFactory = (await import('../wasm/aig_wasm.js')).default;
        if (typeof moduleFactory === 'function') {
          const instance = await moduleFactory();
          if (mounted) {
            if (instance && typeof instance.process_equation === 'function') {
              setWasmModule(instance);
              setIsWasmLoaded(true);
              console.log('AIG WebAssembly engine initialized successfully.');
            }
            setIsLoading(false);
          }
        }
      } catch (err: any) {
        if (mounted) {
          setWasmError(err?.message || 'Wasm module not compiled yet');
          setIsLoading(false);
        }
      }
    }

    initWasm();

    return () => {
      mounted = false;
    };
  }, []);

  const simplifyEquation = useCallback(
    (equation: string, passes: string[]): AigProcessResult => {
      const passRecipe = passes.join(',');

      // If compiled Wasm module is active, run it directly!
      if (wasmModule && typeof wasmModule.process_equation === 'function') {
        try {
          const jsonStr = wasmModule.process_equation(equation, passRecipe);
          return JSON.parse(jsonStr) as AigProcessResult;
        } catch (e: any) {
          console.warn('Wasm execution error, falling back to TS engine:', e);
        }
      }

      // High-performance client-side AIG engine (pure TypeScript)
      return synthesizeAndOptimizeTS(equation, passes);
    },
    [wasmModule]
  );

  return {
    simplifyEquation,
    isWasmLoaded,
    wasmError,
    isLoading,
  };
}

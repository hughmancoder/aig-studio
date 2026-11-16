# AIG Studio (Web UI)

Interactive client-side And-Inverter Graph (AIG) synthesis, optimization, and DAG visualization workspace built with React 19, TypeScript, Tailwind CSS, React Flow, Dagre, and optional WebAssembly bindings.

## Scripts

```shell
npm install     # Install dependencies
npm run dev     # Start local Vite dev server
npm run lint    # Run Oxlint static checks
npm run build   # Type-check and build production bundle
```

To compile the C++ AIG engine to WebAssembly (`web/src/wasm/`), run `make wasm` from the repository root (requires Emscripten `em++`). When Wasm is not built, AIG Studio uses its built-in TypeScript AIG engine automatically.

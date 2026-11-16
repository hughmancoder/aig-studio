# AIG Studio

![Logic Synthesis](https://img.shields.io/badge/Logic_Synthesis-0F766E?style=flat-square)
![And-Inverter Graph](https://img.shields.io/badge/And--Inverter_Graph-4F46E5?style=flat-square)
![Structural Hashing](https://img.shields.io/badge/Structural_Hashing-0284C7?style=flat-square)
![DAG Cut Rewriting](https://img.shields.io/badge/DAG_Cut_Rewriting-7C3AED?style=flat-square)
![Tree Balancing](https://img.shields.io/badge/Tree_Balancing-059669?style=flat-square)
![AIGER / BLIF](https://img.shields.io/badge/AIGER_%2F_BLIF-D97706?style=flat-square)
![C++17](https://img.shields.io/badge/C%2B%2B17-00599C?style=flat-square)


A simple And-Inverter Graph library in C++ for representing and manipulating Boolean functions used in logical synthesis and physical design to help optimise gate-level netlists in digital design. This project was intially written  after taking the course `Logical Synthesis and Physical` Design at the `Technical University of Munich`.

This library has been updated to include an interactive React + WebAssembly Studio for representing, optimising, verifying, and visualising Boolean logic networks in electronic design automation.

![GUI](Images/GUI.png)


---

## Features

- **Multi-Format Support:** Import and export `.aag`, `.aig`, and `.blif` circuit files.
- **Deduplication (`strash`):** Reuses identical gates and simplifies trivial logic on the fly.
- **Dead-Code Removal (`sweep`):** Removes unused gates that never reach an output.
- **Depth Reduction (`balance`):** Rebuilds deep gate chains into shallower, faster trees.
- **Boolean Expression Parser:** Converts text equations (`*`, `+`/`|`, `^`, `~`/`!`/`'`) into logic graphs.

---

## Quick Start

Requires a C++17 compiler (GCC or Clang) and GNU Make.

```shell
make              # Build ./aig CLI
make test         # Build and run doctest unit suite
make show_stats FILE=examples/full_adder.aag
make truth_table FILE=examples/full_adder.aag
make tree FILE=examples/and2.aag
make dot FILE=examples/and2.aag OUT=examples/outputs/and2.dot
make optimize FILE=examples/and2_redundant.aag OUT=examples/outputs/and2_opt.aag
make simplify EXPR="(A * B) + (A * ~B)" PASSES="strash,balance,rewrite"
```

---

## CLI Usage

```shell
./aig stats       <file>            # Network statistics
./aig truth_table <file>            # Truth table simulation
./aig network     <file>            # Detailed node summary
./aig tree        <file>            # ASCII logic cone trees
./aig dot         <file> [out.dot]  # Export Graphviz DOT
./aig sweep       <file> [out.aag]  # Remove dead and duplicate nodes
./aig balance     <file> [out.aag]  # Minimize AND and XOR depth
./aig rewrite     <file> [out.aag]  # 4-input cut DAG rewriting
./aig optimize    <file> [out.aag]  # Full optimisation loop
./aig simplify    "<expr>" [passes] # Simplify Boolean expr to JSON DAG
./aig write       <file> <out.aag>  # Write ASCII AIGER (.aag)
./aig write_aig   <file> <out.aig>  # Write binary AIGER (.aig)
./aig write_blif  <file> <out.blif> # Write BLIF (.blif)
```

---

## GUI

```shell
make web-install   # Install web dependencies
make wasm          # Optional: compile C++ engine via Emscripten (em++)
make web           # Launch Vite dev server at http://localhost:5173
```



---

## Documentation

- [Library Notes](documentation/NOTES.md)
- [ASCII AIGER Format (.aag)](documentation/ASCII_AIGER_FORMAT.md)
- [Binary AIGER Format (.aig)](documentation/BINARY_AIGER_FORMAT.md)
- [BLIF Format (.blif)](documentation/BLIF_FORMAT.md)
- [Optimisation Theory](documentation/OPTIMISATION_THEORY.md)
- [Graph Export and Visualisation](documentation/GRAPH_EXPORT.md)
- [AIG Construction Examples](documentation/EXAMPLES.md)

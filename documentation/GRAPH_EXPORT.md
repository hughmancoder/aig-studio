# Graph Export and Visualization

This library provides multiple methods to visualize and inspect And-Inverter Graphs.

---

## 1. Graphviz DOT Export (`write_dot`)

Export the network to standard `.dot` format:

```shell
./aig dot examples/full_adder.aag examples/outputs/full_adder.dot
# Render to SVG or PNG with Graphviz
dot -Tpng examples/outputs/full_adder.dot -o full_adder.png
```

### Visual Styling:
- **Inputs**: Blue rectangular nodes grouped in `rank=source`.
- **Outputs**: Green double-octagons grouped in `rank=sink`.
- **AND Gates**: Amber circular nodes with gate ID and `&`.
- **Constants**: Gray boxes (`0` and `1`).
- **Normal Edges**: Solid charcoal arrows (`style=solid`).
- **Inverted Edges**: Dashed red arrows with circle arrowheads (`arrowhead=odot, style=dashed, color=red`) and labeled `NOT`.

---

## 2. Terminal Logic Cone Trees (`print_tree`)

Print hierarchical logic trees for all primary outputs in the terminal using Unicode box-drawing characters:

```shell
./aig tree examples/and2.aag
```

Output:
```text
=== AIG Output Logic Cone Trees ===
Output 0 [y1] driven by lit 6
└── AND 3 (lit 6)
    ├── INPUT x1 (lit 2)
    └── INPUT x2 (lit 4)
```

Shared nodes across multiple output logic cones are annotated with `[shared]` to prevent exponential subtree explosion.

---

## 3. Network Summary (`print_network`)

Print a formatted tabular breakdown of all inputs, outputs, AND gates, fanins, fanouts, and depth:

```shell
./aig network examples/and2.aag
```

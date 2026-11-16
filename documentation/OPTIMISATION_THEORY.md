# AIG Optimisation Theory

This document outlines the logic optimisation passes implemented in `src/optimizer.cpp`: structural hashing (`strash`), dead-node sweeping (`sweep`), tree balancing (`balance`), DAG-aware rewriting (`rewrite`), and the combined `optimize()` loop.

---

## 1. Structural Hashing (`strash`)

Structural hashing ensures every unique unordered pair of fanin literals maps to at most one canonical AND gate:

$$\text{unique table}: (f_0, f_1) \mapsto \text{Lit} \quad \text{where } f_0 \le f_1$$

Before inserting into the unique table, `get_or_create_and(f0, f1)` applies constant folding, trivial identities, and two-level algebraic reductions:

- **Basic identities:** $x \land 0 = 0$, $x \land 1 = x$, $x \land x = x$, $x \land \neg x = 0$
- **Two-level reductions** (for a gate $b = c \land d$):
  - **Subsumption:** $a \land (a \land d) = a \land d$
  - **Contradiction:** $a \land (\neg a \land d) = 0$
  - **Resolution:** $a \land \neg(a \land d) = a \land \neg d$
  - **Absorption:** $\neg c \land \neg(c \land d) = \neg c$

`strash()` rebuilds the network in topological order through `get_or_create_and`, deduplicating structurally equivalent subgraphs.

---

## 2. Dead-Node Sweeping (`sweep`)

`sweep()` removes unreachable logic and merges duplicates in two steps:

1. **Reachability:** A backward depth-first search from all primary outputs marks every reachable node as live.
2. **Topological rebuild:** Live AND gates are reconstructed in topological order via `get_or_create_and`, discarding dead cones and aliasing identical gates.

---

## 3. Tree Balancing (`balance`)

`balance()` reduces circuit depth by restructuring associative AND and XOR cones into minimum-depth binary trees:

1. **Cone extraction:** For each node, associative leaves are collected recursively—stopping at inverted edges or multi-fanout nodes (`fanout > 1` for AND; shared internal nodes for XOR) so existing node sharing is preserved.
2. **Huffman-style pairing:** Leaves are placed in a min-heap ordered by arrival depth. Repeatedly pairing the two shallowest nodes minimises the resulting tree height.

---

## 4. DAG-Aware Rewriting (`rewrite`)

`rewrite(zero_cost)` replaces local subgraphs with smaller, functionally equivalent AIGs using 4-input cuts and a pre-computed template database (`OptimalAigDatabase`):

1. **Cut enumeration:** Bottom-up 4-feasible cuts (up to 16 cuts per node, each with at most 4 leaves) are computed by merging fanin cuts.
2. **Truth-table lookup:** Each cut's cone is evaluated to a 16-bit truth table (`uint16_t`) and matched against `OptimalAigDatabase` (pre-computed minimum-gate 0- to 3-gate templates, including MUX and XOR structures).
3. **MFFC gain evaluation:** For each matching template, the Maximum Fanout-Free Cone (MFFC) determines how many internal gates would be freed if the root were replaced:
   $$\text{gain} = \text{freed} - \text{created}$$
   where `freed` counts cone nodes whose fanouts lie entirely within the cone.
4. **Selection & cleanup:** Replacements with $\text{gain} > 0$ (or $\text{gain} = 0$ with $\text{freed} > 0$ when `zero_cost = true`) are instantiated in topological order, followed by `sweep()` to drop orphaned cones. Without `zero_cost`, up to 4 passes run until gate count reaches a fixpoint.

---

## 5. Combined Optimisation Loop (`optimize`)

`optimize()` iteratively applies up to 10 passes (stopping early once AND-gate count stops decreasing):

1. `sweep()` — prune dead nodes and merge duplicates
2. `rewrite()` — 4-input cut DAG-aware rewriting
3. `balance()` — minimum-depth AND/XOR tree balancing
4. `rewrite_and()` pass + `sweep()` — two-level algebraic simplification and cleanup

# AIG Optimization & Structural Hashing

This document details the logic optimization, structural hashing (strashing), and sweeping techniques implemented in this library.

---

## 1. Structural Hashing (Strashing / Hash-Consing)

In naive AIG construction, adding two AND gates with the same inputs creates redundant graph nodes. Structural hashing ensures that every unique pair of fanins corresponds to at most one canonical node in the network.

### Unique Table
A hash table maps the unordered pair of canonical fanin literals to the existing gate literal:
$$\text{unique\_table}: (f_0, f_1) \mapsto \text{Lit} \quad \text{where } f_0 \le f_1$$

### On-the-Fly Constant Propagation & Trivial Identities
Before checking the unique table, `get_or_create_and(f0, f1)` applies basic Boolean axioms:
1. **Dominance**: $x \land 0 = 0$
2. **Identity**: $x \land 1 = x$
3. **Idempotence**: $x \land x = x$
4. **Contradiction**: $x \land \neg x = 0$
5. **Commutativity**: $f_0 \land f_1 = f_1 \land f_0$ (enforced by canonical ordering $f_0 \le f_1$)

---

## 2. Sweep (Dead and Duplicate Node Removal)

Over the course of synthesis or when parsing unoptimized netlists, some gates become unreachable from any primary output (dead nodes), and identical gates may exist (duplicate nodes).

### Algorithm:
1. **Reachability Analysis**:
   Starting from all primary outputs, perform a depth-first search (DFS) backwards through fanin pointers. Mark all visited nodes as `live`. Any node not marked `live` is dead.
2. **Deduplication and Aliasing**:
   Traverse live nodes in topological order. For each gate, substitute its fanins with canonical survivors. If a gate with identical fanins has already been encountered, record an alias and discard the duplicate.
3. **Reconnection**:
   Update all primary outputs to point to the surviving canonical literals.
4. **Result**:
   Unused logic (like gate 10 in `examples/and2_redundant.aag`) is swept away, and identical logic (gate 8 and gate 6) merges into a single gate, strictly preserving truth table semantics.

---

## 3. Two-Level Algebraic Rewriting (`optimize`)

To simplify complex tree structures into simpler equivalent logic formats, `optimize()` applies local algebraic transformations:

Given an AND gate $N = A \land B$:

### Case A: $B$ is a non-inverted AND gate $B = (C \land D)$
- **Subsumption**:
  $$A \land (A \land D) = A \land D = B$$
- **Contradiction**:
  $$A \land (\neg A \land D) = 0$$

### Case B: $B$ is an inverted AND gate $B = \neg(C \land D)$
- **Resolution**:
  $$A \land \neg(A \land D) = A \land (\neg A \lor \neg D) = A \land \neg D$$
  $$A \land \neg(C \land A) = A \land \neg C$$
- **Subsumption with negation**:
  $$\neg C \land \neg(C \land D) = \neg C = A$$

### Iterative Pass
The `optimize()` method executes iterative rounds of:
1. Backward reachability sweep
2. Structural hashing
3. Two-level algebraic rewrites
until gate count reaches a fixpoint.

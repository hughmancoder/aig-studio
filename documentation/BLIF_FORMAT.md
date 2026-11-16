# Berkeley Logic Interchange Format (BLIF)

BLIF is a standard textual format developed at UC Berkeley (SIS, ABC) for exchanging gate-level and netlist descriptions between logic synthesis and physical design tools.

---

## 1. Syntax Overview

A BLIF file consists of commands prefixed by `.` and optional comment lines starting with `#`:

```blif
.model full_adder
.inputs A B Cin
.outputs Sum Cout

# Logic gates in PLA Sum-of-Products (SOP) format
.names A B X1
01 1
10 1

.names A B A1
11 1

.names X1 Cin Sum
01 1
10 1

.names X1 Cin A2
11 1

.names A1 A2 Cout
1- 1
-1 1

.end
```

### Features Supported:
- Line continuation with trailing backslash `\`
- Inline comments starting with `#`
- Multi-input PLA covers with `0` (inverted), `1` (positive), `-` (don't care)
- Single-output PLA tables with `1` (ON-set) or `0` (OFF-set)
- Constant generators (`.names X` $\to 0$, `.names X \n 1` $\to 1$)
- Arbitrary signal ordering resolved via topological dependency resolution

---

## 2. Translating BLIF to AIG

Because an AIG contains exclusively two-input AND gates and edge inversions, each `.names` PLA block is mapped to AIG gates using **De Morgan's laws**:

1. **Product Term (Cube)**:
   For a cube $c_1 c_2 \dots c_N$:
   $$P = \bigwedge_{j: c_j \ne '-'} (c_j == '1' \ ?\ v_j : \neg v_j)$$
   Multi-input ANDs are constructed via balanced two-input AND gates.

2. **Sum of Products (OR of Cubes)**:
   For cubes $P_1, P_2, \dots, P_k$:
   $$Out = \bigvee_{i=1}^k P_i = \neg \left( \bigwedge_{i=1}^k \neg P_i \right)$$

3. **Structural Hashing**:
   During construction, `get_or_create_and` folds constants and unifies duplicate logic cones automatically.

---

## 3. Exporting AIG to BLIF

Each two-input AND gate $z = x \land y$ is written directly:
```blif
.names <x> <y> <z>
<b0><b1> 1
```
where `b0` is `1` if $x$ is non-inverted, or `0` if $x$ is inverted.

Primary outputs are aliased with `.names <driver> <out>` or assigned constants when driven by `0` or `1`.

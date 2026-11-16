# Binary AIGER Format (.aig)

Reference: <https://fmv.jku.at/aiger/FORMAT.aiger>

The binary AIGER format (.aig) is a compressed binary representation of an And-Inverter Graph. It provides significant compression over the ASCII (.aag) format while strictly enforcing topological order.

---

## 1. Header

```text
aig M I L O A [B [C [J [F]]]
```

- **`aig`**: Format identifier (binary AIGER).
- **`M`**: Maximum variable index ($M = I + L + A$).
- **`I`**: Number of primary inputs.
- **`L`**: Number of latches (usually 0 for combinational circuits).
- **`O`**: Number of primary outputs.
- **`A`**: Number of two-input AND gates.
- **Optional extensions**: `B` (bad state properties), `C` (invariant constraints), `J` (justice properties), `F` (fairness constraints).

The header is followed by a single newline character (`\n`).

---

## 2. Primary Inputs

In binary AIGER, primary inputs are **implicit** and omitted from the file to save space.
- Primary input $1$ has variable index 1, literal $2$.
- Primary input $2$ has variable index 2, literal $4$.
- Primary input $i$ has variable index $i$, literal $2 \times i$.

---

## 3. Latches and Outputs

- If $L > 0$, next $L$ lines specify latch next-state literals in ASCII.
- Outputs: Next $O$ lines specify primary output driving literals in ASCII, each terminated by `\n`.

---

## 4. Binary AND Gates

AND gates begin immediately following the newline character of the last output line.

### Invariants:
1. The $i$-th AND gate ($i = 1 \dots A$) defines variable:
   $$\text{var} = I + L + i$$
   $$\text{lhs} = 2 \times \text{var}$$
2. The gate inputs are $rhs_0$ and $rhs_1$, strictly ordered such that:
   $$\text{lhs} > rhs_0 \ge rhs_1$$

### Delta Encoding:
The inputs are delta-encoded as differences:
$$\delta_0 = \text{lhs} - rhs_0 \quad (\ge 1)$$
$$\delta_1 = rhs_0 - rhs_1 \quad (\ge 0)$$

Each delta is encoded as a variable-length byte sequence (LEB128):
- 7 bits of data per byte.
- MSB (bit 7) is set to `1` if more bytes follow for the integer.
- MSB is `0` for the last byte of the integer.

### Decoding in C++:
```cpp
Lit decode_delta(std::istream &in) {
  Lit delta = 0;
  unsigned shift = 0;
  unsigned char byte = 0;
  while (in.get(reinterpret_cast<char &>(byte))) {
    delta |= static_cast<Lit>(byte & 0x7Fu) << shift;
    if ((byte & 0x80u) == 0) return delta;
    shift += 7;
  }
  return delta;
}
```

Then:
$$rhs_0 = \text{lhs} - \delta_0$$
$$rhs_1 = rhs_0 - \delta_1$$

---

## 5. Symbols and Comments

Following the binary section, optional symbol table lines can appear:
- `i<index> <symbol>`: Name for primary input `<index>`
- `o<index> <symbol>`: Name for primary output `<index>`
- `c`: Comments section beginning on a line by itself, followed by arbitrary text until EOF.

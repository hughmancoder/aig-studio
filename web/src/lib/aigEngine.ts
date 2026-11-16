import type {
  AigProcessResult,
  AigGraphData,
  AigGraphNode,
  AigGraphEdge,
  AigStats,
} from './aigTypes';

// Literal encoding (matches C++ Aig):
//   0 = const 0, 1 = const 1
//   even (2*v) = canonical variable v, odd (2*v + 1) = inverted variable v
type Lit = number;

function litCanon(lit: Lit): Lit {
  return lit & ~1;
}

function litIsInverted(lit: Lit): boolean {
  return (lit & 1) !== 0;
}

function litNegate(lit: Lit): Lit {
  return lit ^ 1;
}

function litVar(lit: Lit): number {
  return lit >>> 1;
}

interface AndNode {
  literal: Lit;
  fanin0: Lit;
  fanin1: Lit;
}

// ------------------------------------------------------------ 4-input cut DB

const VAR_MASKS = [0xaaaa, 0xcccc, 0xf0f0, 0xff00] as const;

function not16(v: number): number {
  return ~v & 0xffff;
}

interface TemplateGate {
  in0: number;
  inv0: boolean;
  in1: number;
  inv1: boolean;
}

interface OptimalAig {
  numInputs: number;
  gates: TemplateGate[];
  rootInv: boolean;
  rootIdx: number;
}

function buildOptimalAigDatabase(): Map<number, OptimalAig> {
  const db = new Map<number, OptimalAig>();

  const registerTemplate = (tt: number, templ: OptimalAig) => {
    const key = tt & 0xffff;
    const existing = db.get(key);
    if (!existing || templ.gates.length < existing.gates.length) {
      db.set(key, templ);
    }
  };

  // Constants
  registerTemplate(0x0000, { numInputs: 4, gates: [], rootIdx: -1, rootInv: false });
  registerTemplate(0xffff, { numInputs: 4, gates: [], rootIdx: -1, rootInv: true });

  // Single variables and complements
  for (let i = 0; i < 4; i++) {
    registerTemplate(VAR_MASKS[i], { numInputs: 4, gates: [], rootIdx: i, rootInv: false });
    registerTemplate(not16(VAR_MASKS[i]), { numInputs: 4, gates: [], rootIdx: i, rootInv: true });
  }

  // 1-gate products
  const gate1List: { tt: number; gate: TemplateGate }[] = [];
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      for (let invI = 0; invI <= 1; invI++) {
        for (let invJ = 0; invJ <= 1; invJ++) {
          const vi = invI ? not16(VAR_MASKS[i]) : VAR_MASKS[i];
          const vj = invJ ? not16(VAR_MASKS[j]) : VAR_MASKS[j];
          const tt = (vi & vj) & 0xffff;
          const gate: TemplateGate = { in0: i, inv0: invI !== 0, in1: j, inv1: invJ !== 0 };
          gate1List.push({ tt, gate });

          registerTemplate(tt, { numInputs: 4, gates: [gate], rootIdx: 4, rootInv: false });
          registerTemplate(not16(tt), { numInputs: 4, gates: [gate], rootIdx: 4, rootInv: true });
        }
      }
    }
  }

  // 2-gate functions: combine a 1-gate output with a leaf literal
  for (const g1 of gate1List) {
    for (let k = 0; k < 4; k++) {
      for (let invG1 = 0; invG1 <= 1; invG1++) {
        for (let invK = 0; invK <= 1; invK++) {
          const v1 = invG1 ? not16(g1.tt) : g1.tt;
          const vk = invK ? not16(VAR_MASKS[k]) : VAR_MASKS[k];
          const tt = (v1 & vk) & 0xffff;
          const g2: TemplateGate = { in0: 4, inv0: invG1 !== 0, in1: k, inv1: invK !== 0 };
          const gates = [g1.gate, g2];

          registerTemplate(tt, { numInputs: 4, gates, rootIdx: 5, rootInv: false });
          registerTemplate(not16(tt), { numInputs: 4, gates, rootIdx: 5, rootInv: true });
        }
      }
    }
  }

  // 2-gate / 3-gate functions: combine two independent 1-gate outputs
  for (let a = 0; a < gate1List.length; a++) {
    for (let b = a + 1; b < gate1List.length; b++) {
      for (let invA = 0; invA <= 1; invA++) {
        for (let invB = 0; invB <= 1; invB++) {
          const va = invA ? not16(gate1List[a].tt) : gate1List[a].tt;
          const vb = invB ? not16(gate1List[b].tt) : gate1List[b].tt;
          const tt = (va & vb) & 0xffff;
          const g3: TemplateGate = { in0: 4, inv0: invA !== 0, in1: 5, inv1: invB !== 0 };
          const gates = [gate1List[a].gate, gate1List[b].gate, g3];

          registerTemplate(tt, { numInputs: 4, gates, rootIdx: 6, rootInv: false });
          registerTemplate(not16(tt), { numInputs: 4, gates, rootIdx: 6, rootInv: true });
        }
      }
    }
  }

  // 3-gate MUX: (s & a) | (!s & b)
  for (let s = 0; s < 4; s++) {
    for (let a = 0; a < 4; a++) {
      if (a === s) continue;
      for (let b = 0; b < 4; b++) {
        if (b === s || b === a) continue;
        for (let invS = 0; invS <= 1; invS++) {
          for (let invA = 0; invA <= 1; invA++) {
            for (let invB = 0; invB <= 1; invB++) {
              const vs = invS ? not16(VAR_MASKS[s]) : VAR_MASKS[s];
              const va = invA ? not16(VAR_MASKS[a]) : VAR_MASKS[a];
              const vb = invB ? not16(VAR_MASKS[b]) : VAR_MASKS[b];
              const tt = ((vs & va) | (not16(vs) & vb)) & 0xffff;

              const g0: TemplateGate = { in0: s, inv0: invS !== 0, in1: a, inv1: invA !== 0 };
              const g1: TemplateGate = { in0: s, inv0: invS === 0, in1: b, inv1: invB !== 0 };
              const g2: TemplateGate = { in0: 4, inv0: true, in1: 5, inv1: true };
              const gates = [g0, g1, g2];

              registerTemplate(tt, { numInputs: 4, gates, rootIdx: 6, rootInv: true });
              registerTemplate(not16(tt), { numInputs: 4, gates, rootIdx: 6, rootInv: false });
            }
          }
        }
      }
    }
  }

  // 3-gate XOR2: a ^ b
  for (let a = 0; a < 4; a++) {
    for (let b = a + 1; b < 4; b++) {
      const tt = (VAR_MASKS[a] ^ VAR_MASKS[b]) & 0xffff;
      const g0: TemplateGate = { in0: a, inv0: false, in1: b, inv1: true };
      const g1: TemplateGate = { in0: a, inv0: true, in1: b, inv1: false };
      const g2: TemplateGate = { in0: 4, inv0: true, in1: 5, inv1: true };
      const gates = [g0, g1, g2];

      registerTemplate(tt, { numInputs: 4, gates, rootIdx: 6, rootInv: true });
      registerTemplate(not16(tt), { numInputs: 4, gates, rootIdx: 6, rootInv: false });
    }
  }

  return db;
}

const OPTIMAL_AIG_DB = buildOptimalAigDatabase();

// ------------------------------------------------------------------ AIG net

class TSAig {
  inputs: Lit[] = [];
  inputNames: string[] = [];
  outputs: { name: string; lit: Lit }[] = [];
  andGates: Map<Lit, AndNode> = new Map(); // canonical literal -> AndNode (insertion/topo order)
  uniqueTable: Map<string, Lit> = new Map();
  maxVar = 0;

  addInputNode(lit: Lit, name: string): Lit {
    const canon = litCanon(lit);
    this.inputs.push(canon);
    this.inputNames.push(name);
    const v = litVar(canon);
    if (v > this.maxVar) this.maxVar = v;
    return canon;
  }

  private allocLit(): Lit {
    this.maxVar += 1;
    return this.maxVar * 2;
  }

  createAndRaw(f0: Lit, f1: Lit): Lit {
    const lit = this.allocLit();
    this.andGates.set(lit, { literal: lit, fanin0: f0, fanin1: f1 });
    return lit;
  }

  getOrCreateAnd(f0: Lit, f1: Lit): Lit {
    if (f0 === 0 || f1 === 0) return 0;
    if (f0 === 1) return f1;
    if (f1 === 1) return f0;
    if (f0 === f1) return f0;
    if (f0 === litNegate(f1)) return 0;

    if (f0 > f1) {
      const tmp = f0;
      f0 = f1;
      f1 = tmp;
    }

    const key = `${f0},${f1}`;
    const cached = this.uniqueTable.get(key);
    if (cached !== undefined) return cached;

    const tryAlgebraic = (a: Lit, b: Lit): Lit | null => {
      const bCanon = litCanon(b);
      const gate = this.andGates.get(bCanon);
      if (!gate) return null;
      const bInv = litIsInverted(b);
      const c = gate.fanin0;
      const d = gate.fanin1;

      if (!bInv) {
        if (a === c || a === d) return b;
        if (a === litNegate(c) || a === litNegate(d)) return 0;
      } else {
        if (a === c) return this.getOrCreateAnd(a, litNegate(d));
        if (a === d) return this.getOrCreateAnd(a, litNegate(c));
        if (a === litNegate(c) || a === litNegate(d)) return a;
      }
      return null;
    };

    const r1 = tryAlgebraic(f0, f1);
    if (r1 !== null) return r1;
    const r2 = tryAlgebraic(f1, f0);
    if (r2 !== null) return r2;

    const lit = this.allocLit();
    this.andGates.set(lit, { literal: lit, fanin0: f0, fanin1: f1 });
    this.uniqueTable.set(key, lit);
    return lit;
  }

  rewriteAnd(f0: Lit, f1: Lit): Lit {
    return this.getOrCreateAnd(f0, f1);
  }

  addOutput(name: string, lit: Lit) {
    this.outputs.push({ name, lit });
  }

  countAndGates(): number {
    return this.andGates.size;
  }

  computeDepth(): number {
    const memo = new Map<Lit, number>();
    const depthOf = (lit: Lit): number => {
      if (lit <= 1) return 0;
      const canon = litCanon(lit);
      const cached = memo.get(canon);
      if (cached !== undefined) return cached;
      const node = this.andGates.get(canon);
      if (!node) {
        memo.set(canon, 0);
        return 0;
      }
      const d = 1 + Math.max(depthOf(node.fanin0), depthOf(node.fanin1));
      memo.set(canon, d);
      return d;
    };

    let maxDepth = 0;
    for (const out of this.outputs) {
      maxDepth = Math.max(maxDepth, depthOf(out.lit));
    }
    return maxDepth;
  }

  computeFanoutCounts(): Map<Lit, number> {
    const fanouts = new Map<Lit, number>();
    const inc = (lit: Lit) => {
      if (lit > 1) {
        const c = litCanon(lit);
        fanouts.set(c, (fanouts.get(c) ?? 0) + 1);
      }
    };
    for (const gate of this.andGates.values()) {
      inc(gate.fanin0);
      inc(gate.fanin1);
    }
    for (const out of this.outputs) {
      inc(out.lit);
    }
    return fanouts;
  }

  private isXorNode(canon: Lit): [Lit, Lit] | null {
    const n = this.andGates.get(canon);
    if (!n || !litIsInverted(n.fanin0) || !litIsInverted(n.fanin1)) return null;
    const p = this.andGates.get(litCanon(n.fanin0));
    const q = this.andGates.get(litCanon(n.fanin1));
    if (!p || !q) return null;
    const a = p.fanin0;
    const b = p.fanin1;
    const c = q.fanin0;
    const d = q.fanin1;
    const match =
      (c === litNegate(a) && d === litNegate(b)) ||
      (c === litNegate(b) && d === litNegate(a));
    return match ? [a, b] : null;
  }

  sweep(): TSAig {
    const live = new Set<Lit>();
    const stack: Lit[] = [];
    for (const out of this.outputs) {
      if (out.lit > 1) stack.push(litCanon(out.lit));
    }
    while (stack.length > 0) {
      const curr = stack.pop()!;
      if (live.has(curr)) continue;
      live.add(curr);
      const gate = this.andGates.get(curr);
      if (gate) {
        if (gate.fanin0 > 1) stack.push(litCanon(gate.fanin0));
        if (gate.fanin1 > 1) stack.push(litCanon(gate.fanin1));
      }
    }

    const clean = new TSAig();
    const litMap = new Map<Lit, Lit>([
      [0, 0],
      [1, 1],
    ]);
    for (let i = 0; i < this.inputs.length; i++) {
      const inp = this.inputs[i];
      clean.addInputNode(inp, this.inputNames[i]);
      litMap.set(inp, inp);
    }

    const mapLit = (lit: Lit): Lit => {
      if (lit <= 1) return lit;
      const canon = litCanon(lit);
      const mapped = litMap.get(canon) ?? canon;
      return litIsInverted(lit) ? litNegate(mapped) : mapped;
    };

    for (const gate of this.andGates.values()) {
      if (!live.has(gate.literal)) continue;
      const res = clean.getOrCreateAnd(mapLit(gate.fanin0), mapLit(gate.fanin1));
      litMap.set(gate.literal, res);
    }

    for (const out of this.outputs) {
      clean.addOutput(out.name, mapLit(out.lit));
    }
    return clean;
  }

  strash(): TSAig {
    const strashed = new TSAig();
    const litMap = new Map<Lit, Lit>([
      [0, 0],
      [1, 1],
    ]);
    for (let i = 0; i < this.inputs.length; i++) {
      const inp = this.inputs[i];
      strashed.addInputNode(inp, this.inputNames[i]);
      litMap.set(inp, inp);
    }

    const mapLit = (lit: Lit): Lit => {
      if (lit <= 1) return lit;
      const canon = litCanon(lit);
      const mapped = litMap.get(canon) ?? canon;
      return litIsInverted(lit) ? litNegate(mapped) : mapped;
    };

    for (const gate of this.andGates.values()) {
      const res = strashed.getOrCreateAnd(mapLit(gate.fanin0), mapLit(gate.fanin1));
      litMap.set(gate.literal, res);
    }

    for (const out of this.outputs) {
      strashed.addOutput(out.name, mapLit(out.lit));
    }
    return strashed;
  }

  balance(): TSAig {
    const swept = this.sweep();
    const fanouts = swept.computeFanoutCounts();

    const balanced = new TSAig();
    const litMap = new Map<Lit, Lit>([
      [0, 0],
      [1, 1],
    ]);
    const depthMap = new Map<Lit, number>([
      [0, 0],
      [1, 0],
    ]);

    for (let i = 0; i < swept.inputs.length; i++) {
      const inp = swept.inputs[i];
      balanced.addInputNode(inp, swept.inputNames[i]);
      litMap.set(inp, inp);
      depthMap.set(inp, 0);
    }

    const mapLit = (lit: Lit): Lit => {
      if (lit <= 1) return lit;
      const canon = litCanon(lit);
      const mapped = litMap.get(canon) ?? canon;
      return litIsInverted(lit) ? litNegate(mapped) : mapped;
    };

    const getDepth = (lit: Lit): number => {
      if (lit <= 1) return 0;
      return depthMap.get(litCanon(lit)) ?? 0;
    };

    const makeBalancedAnd = (f0: Lit, f1: Lit): Lit => {
      const res = balanced.getOrCreateAnd(f0, f1);
      const canon = litCanon(res);
      if (canon > 1) {
        const node = balanced.andGates.get(canon);
        if (node) {
          depthMap.set(canon, 1 + Math.max(getDepth(node.fanin0), getDepth(node.fanin1)));
        }
      }
      return res;
    };

    const makeBalancedXor = (x: Lit, y: Lit): Lit => {
      const t0 = makeBalancedAnd(x, litNegate(y));
      const t1 = makeBalancedAnd(litNegate(x), y);
      return litNegate(makeBalancedAnd(litNegate(t0), litNegate(t1)));
    };

    const collectXorLeaves = (
      lit: Lit,
      leaves: Lit[],
      parityRef: { value: boolean },
      rootCanon: Lit
    ) => {
      if (lit === 0) return;
      if (lit === 1) {
        parityRef.value = !parityRef.value;
        return;
      }
      if (litIsInverted(lit)) {
        parityRef.value = !parityRef.value;
        lit = litCanon(lit);
      }
      const x = swept.isXorNode(lit);
      if (x) {
        const xn = swept.andGates.get(lit)!;
        const pCanon = litCanon(xn.fanin0);
        const qCanon = litCanon(xn.fanin1);
        const internalOnly =
          (fanouts.get(pCanon) ?? 0) === 1 && (fanouts.get(qCanon) ?? 0) === 1;
        if (internalOnly && (lit === rootCanon || (fanouts.get(lit) ?? 0) === 2)) {
          collectXorLeaves(x[0], leaves, parityRef, rootCanon);
          collectXorLeaves(x[1], leaves, parityRef, rootCanon);
          return;
        }
      }
      leaves.push(lit);
    };

    const collectAndLeaves = (lit: Lit, leaves: Lit[], rootCanon: Lit) => {
      if (lit <= 1 || litIsInverted(lit)) {
        leaves.push(lit);
        return;
      }
      const canon = litCanon(lit);
      const gate = swept.andGates.get(canon);
      if (!gate) {
        leaves.push(lit);
        return;
      }
      if (canon !== rootCanon && (fanouts.get(canon) ?? 0) > 1) {
        leaves.push(lit);
        return;
      }
      collectAndLeaves(gate.fanin0, leaves, rootCanon);
      collectAndLeaves(gate.fanin1, leaves, rootCanon);
    };

    const huffmanReduce = (
      items: { depth: number; lit: Lit }[],
      combine: (a: Lit, b: Lit) => Lit
    ): Lit => {
      const queue = [...items];
      const popMin = () => {
        let bestIdx = 0;
        for (let i = 1; i < queue.length; i++) {
          if (
            queue[i].depth < queue[bestIdx].depth ||
            (queue[i].depth === queue[bestIdx].depth && queue[i].lit < queue[bestIdx].lit)
          ) {
            bestIdx = i;
          }
        }
        return queue.splice(bestIdx, 1)[0];
      };
      while (queue.length > 1) {
        const a = popMin();
        const b = popMin();
        const combined = combine(a.lit, b.lit);
        queue.push({ depth: getDepth(combined), lit: combined });
      }
      return queue[0].lit;
    };

    for (const gate of swept.andGates.values()) {
      const canon = gate.literal;

      if (swept.isXorNode(canon)) {
        const xorLeaves: Lit[] = [];
        const parityRef = { value: false };
        collectXorLeaves(canon, xorLeaves, parityRef, canon);
        if (xorLeaves.length > 2) {
          const items = xorLeaves.map((leaf) => {
            const mLeaf = mapLit(leaf);
            return { depth: getDepth(mLeaf), lit: mLeaf };
          });
          const rootLit = huffmanReduce(items, makeBalancedXor);
          litMap.set(canon, parityRef.value ? litNegate(rootLit) : rootLit);
          continue;
        }
      }

      const leaves: Lit[] = [];
      collectAndLeaves(canon, leaves, canon);
      if (leaves.length <= 2) {
        litMap.set(canon, makeBalancedAnd(mapLit(gate.fanin0), mapLit(gate.fanin1)));
      } else {
        const items = leaves.map((leaf) => {
          const mLeaf = mapLit(leaf);
          return { depth: getDepth(mLeaf), lit: mLeaf };
        });
        litMap.set(canon, huffmanReduce(items, makeBalancedAnd));
      }
    }

    for (const out of swept.outputs) {
      balanced.addOutput(out.name, mapLit(out.lit));
    }

    return balanced.sweep();
  }

  rewrite(zeroCost = false): TSAig {
    let curr = this.sweep();
    const maxPasses = zeroCost ? 1 : 4;

    for (let pass = 0; pass < maxPasses; pass++) {
      const before = curr.countAndGates();
      const fanouts = curr.computeFanoutCounts();

      const out = new TSAig();
      const litMap = new Map<Lit, Lit>();
      for (let i = 0; i < curr.inputs.length; i++) {
        const inp = curr.inputs[i];
        out.addInputNode(inp, curr.inputNames[i]);
        litMap.set(inp, inp);
      }

      const mapLit = (lit: Lit): Lit => {
        if (lit <= 1) return lit;
        const mapped = litMap.get(litCanon(lit)) ?? litCanon(lit);
        return litIsInverted(lit) ? litNegate(mapped) : mapped;
      };

      const andOf = (lit: Lit): AndNode | undefined => curr.andGates.get(litCanon(lit));

      const nodeCuts = new Map<Lit, Lit[][]>();
      for (const inp of curr.inputs) {
        nodeCuts.set(inp, [[inp]]);
      }
      const getCuts = (lit: Lit): Lit[][] => {
        const c = litCanon(lit);
        if (c <= 1) return [[]];
        return nodeCuts.get(c) ?? [[]];
      };
      const cutsEqual = (a: Lit[], b: Lit[]): boolean =>
        a.length === b.length && a.every((v, idx) => v === b[idx]);

      for (const n of curr.andGates.values()) {
        const root = n.literal;
        const cuts: Lit[][] = [[root]];
        const cuts0 = getCuts(n.fanin0);
        const cuts1 = getCuts(n.fanin1);

        for (const c0 of cuts0) {
          for (const c1 of cuts1) {
            const merged = [...c0];
            for (const l of c1) {
              if (!merged.includes(l)) merged.push(l);
            }
            if (merged.length > 4) continue;
            merged.sort((a, b) => a - b);
            if (!cuts.some((existing) => cutsEqual(existing, merged))) {
              cuts.push(merged);
              if (cuts.length >= 16) break;
            }
          }
          if (cuts.length >= 16) break;
        }
        nodeCuts.set(root, cuts);

        let replaced = false;
        let bestResult: Lit = 0;
        let bestGain = -1;
        let bestCreated = 1000;

        for (const cut of cuts) {
          if (cut.length === 0 || (cut.length === 1 && cut[0] === root)) continue;

          const leafTt = new Map<Lit, number>();
          for (let i = 0; i < cut.length; i++) {
            leafTt.set(cut[i], VAR_MASKS[i]);
          }

          const cone = new Map<Lit, number>();
          let valid = true;
          const evalCut = (lit: Lit): number => {
            if (lit === 0) return 0x0000;
            if (lit === 1) return 0xffff;
            const c = litCanon(lit);
            let v: number;
            if (leafTt.has(c)) {
              v = leafTt.get(c)!;
            } else if (cone.has(c)) {
              v = cone.get(c)!;
            } else {
              const an = andOf(c);
              if (!an) {
                valid = false;
                return 0;
              }
              v = (evalCut(an.fanin0) & evalCut(an.fanin1)) & 0xffff;
              cone.set(c, v);
            }
            return litIsInverted(lit) ? not16(v) : v;
          };

          const tt = evalCut(root);
          if (!valid) continue;

          const opt = OPTIMAL_AIG_DB.get(tt);
          if (!opt) continue;

          let freed = 0;
          for (const c of cone.keys()) {
            if (c === root) {
              freed++;
              continue;
            }
            let internal = 0;
            for (const pk of cone.keys()) {
              const p = curr.andGates.get(pk)!;
              if (litCanon(p.fanin0) === c) internal++;
              if (litCanon(p.fanin1) === c) internal++;
            }
            const fo = fanouts.get(c);
            if (fo !== undefined && internal >= fo) freed++;
          }

          const created = opt.gates.length;
          const gain = freed - created;
          const accept = gain > 0 || (zeroCost && gain === 0 && freed > 0);
          if (!accept) continue;
          if (gain < bestGain || (gain === bestGain && created >= bestCreated)) continue;

          const sig: Lit[] = cut.map((leaf) => mapLit(leaf));
          while (sig.length < 4) sig.push(0);
          for (const g of opt.gates) {
            const s0 = g.inv0 ? litNegate(sig[g.in0]) : sig[g.in0];
            const s1 = g.inv1 ? litNegate(sig[g.in1]) : sig[g.in1];
            sig.push(out.getOrCreateAnd(s0, s1));
          }
          const r = opt.rootIdx >= 0 ? sig[opt.rootIdx] : 0;
          bestResult = opt.rootInv ? litNegate(r) : r;
          bestGain = gain;
          bestCreated = created;
          replaced = true;
        }

        const result = replaced
          ? bestResult
          : out.getOrCreateAnd(mapLit(n.fanin0), mapLit(n.fanin1));
        litMap.set(root, result);
      }

      for (const output of curr.outputs) {
        out.addOutput(output.name, mapLit(output.lit));
      }

      curr = out.sweep();
      if (curr.countAndGates() >= before) break;
    }

    return curr;
  }

  optimize(): TSAig {
    let prevGates = this.inputs.length + this.outputs.length + this.andGates.size;
    let curr = this.sweep();

    for (let pass = 0; pass < 10; pass++) {
      curr = curr.sweep().rewrite(false).balance();

      const rewritten = new TSAig();
      const litMap = new Map<Lit, Lit>([
        [0, 0],
        [1, 1],
      ]);
      for (let i = 0; i < curr.inputs.length; i++) {
        const inp = curr.inputs[i];
        rewritten.addInputNode(inp, curr.inputNames[i]);
        litMap.set(inp, inp);
      }
      const mapLit = (lit: Lit): Lit => {
        if (lit <= 1) return lit;
        const mapped = litMap.get(litCanon(lit)) ?? litCanon(lit);
        return litIsInverted(lit) ? litNegate(mapped) : mapped;
      };
      for (const n of curr.andGates.values()) {
        const res = rewritten.rewriteAnd(mapLit(n.fanin0), mapLit(n.fanin1));
        litMap.set(n.literal, res);
      }
      for (const out of curr.outputs) {
        rewritten.addOutput(out.name, mapLit(out.lit));
      }

      curr = rewritten.sweep();
      const currGates = curr.countAndGates();
      if (currGates >= prevGates) break;
      prevGates = currGates;
    }

    return curr;
  }

  evaluate(inputBits: boolean[]): boolean[] {
    const valMap = new Map<number, boolean>();
    for (let i = 0; i < this.inputs.length; i++) {
      valMap.set(litVar(this.inputs[i]), inputBits[i]);
    }
    const evalLit = (lit: Lit): boolean => {
      if (lit === 0) return false;
      if (lit === 1) return true;
      const v = valMap.get(litVar(lit)) ?? false;
      return litIsInverted(lit) ? !v : v;
    };
    for (const gate of this.andGates.values()) {
      valMap.set(litVar(gate.literal), evalLit(gate.fanin0) && evalLit(gate.fanin1));
    }
    return this.outputs.map((out) => evalLit(out.lit));
  }

  toGraphData(): AigGraphData {
    const nodes: AigGraphNode[] = [];
    const edges: AigGraphEdge[] = [];

    let usesConst = false;
    for (const out of this.outputs) {
      if (out.lit <= 1) usesConst = true;
    }
    for (const gate of this.andGates.values()) {
      if (gate.fanin0 <= 1 || gate.fanin1 <= 1) usesConst = true;
    }

    const levels = new Map<Lit, number>();
    const lvl = (lit: Lit): number => levels.get(litCanon(lit)) ?? 0;
    for (const gate of this.andGates.values()) {
      levels.set(gate.literal, 1 + Math.max(lvl(gate.fanin0), lvl(gate.fanin1)));
    }

    const nodeId = (lit: Lit): string => {
      const c = litCanon(lit);
      if (c === 0) return 'const0';
      if (this.andGates.has(c)) return `and_${c}`;
      return `pi_${c}`;
    };

    if (usesConst) {
      nodes.push({ id: 'const0', type: 'CONST', label: '0', level: 0 });
    }
    for (let i = 0; i < this.inputs.length; i++) {
      const inp = this.inputs[i];
      nodes.push({ id: nodeId(inp), type: 'PI', label: this.inputNames[i], level: 0 });
    }
    for (const gate of this.andGates.values()) {
      nodes.push({
        id: nodeId(gate.literal),
        type: 'AND',
        label: '&',
        level: levels.get(gate.literal) ?? 1,
      });
    }
    for (let i = 0; i < this.outputs.length; i++) {
      const out = this.outputs[i];
      nodes.push({
        id: `po_${i}`,
        type: 'PO',
        label: out.name,
        level: lvl(out.lit) + 1,
      });
    }

    let eid = 0;
    const addEdge = (src: Lit, dst: string) => {
      edges.push({
        id: `e${eid++}`,
        source: nodeId(src),
        target: dst,
        inverted: litIsInverted(src),
      });
    };

    for (const gate of this.andGates.values()) {
      const dst = nodeId(gate.literal);
      addEdge(gate.fanin0, dst);
      addEdge(gate.fanin1, dst);
    }
    for (let i = 0; i < this.outputs.length; i++) {
      addEdge(this.outputs[i].lit, `po_${i}`);
    }

    return { nodes, edges };
  }
}

// ------------------------------------------------------------ Lexer & Parser

type TokKind =
  | 'Ident'
  | 'Zero'
  | 'One'
  | 'And'
  | 'Or'
  | 'Xor'
  | 'Not'
  | 'Postfix'
  | 'LParen'
  | 'RParen'
  | 'Assign'
  | 'Sep'
  | 'End';

interface Token {
  kind: TokKind;
  text: string;
  pos: number;
}

function lex(s: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '\n' || c === ';') {
      out.push({ kind: 'Sep', text: c, pos: i++ });
      continue;
    }
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '#') {
      while (i < s.length && s[i] !== '\n') i++;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      const start = i;
      while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) i++;
      out.push({ kind: 'Ident', text: s.slice(start, i), pos: start });
      continue;
    }
    switch (c) {
      case '0':
        out.push({ kind: 'Zero', text: '0', pos: i });
        break;
      case '1':
        out.push({ kind: 'One', text: '1', pos: i });
        break;
      case '&':
      case '*':
        out.push({ kind: 'And', text: c, pos: i });
        break;
      case '|':
      case '+':
        out.push({ kind: 'Or', text: c, pos: i });
        break;
      case '^':
        out.push({ kind: 'Xor', text: '^', pos: i });
        break;
      case '~':
      case '!':
        out.push({ kind: 'Not', text: c, pos: i });
        break;
      case "'":
        out.push({ kind: 'Postfix', text: "'", pos: i });
        break;
      case '(':
        out.push({ kind: 'LParen', text: '(', pos: i });
        break;
      case ')':
        out.push({ kind: 'RParen', text: ')', pos: i });
        break;
      case '=':
        out.push({ kind: 'Assign', text: '=', pos: i });
        break;
      default:
        throw new Error(`Unexpected character '${c}' (at column ${i + 1})`);
    }
    if ((c === '&' || c === '|') && i + 1 < s.length && s[i + 1] === c) {
      i++;
    }
    i++;
  }
  out.push({ kind: 'End', text: '', pos: s.length });
  return out;
}

class ExprParser {
  private pos = 0;
  private inputNames: string[] = [];
  private signals = new Map<string, Lit>();
  private toks: Token[];
  private aig: TSAig;
  private useStrash: boolean;

  constructor(aig: TSAig, toks: Token[], useStrash: boolean) {
    this.aig = aig;
    this.toks = toks;
    this.useStrash = useStrash;
  }

  run() {
    this.collectInputs();
    for (let i = 0; i < this.inputNames.length; i++) {
      const lit = 2 * (i + 1);
      this.aig.addInputNode(lit, this.inputNames[i]);
      this.signals.set(this.inputNames[i], lit);
    }

    this.pos = 0;
    let unnamed = 0;
    this.skipSeps();
    while (this.peek().kind !== 'End') {
      let name: string;
      if (this.peek().kind === 'Ident' && this.peek(1).kind === 'Assign') {
        name = this.next().text;
        this.next();
      } else {
        name = unnamed === 0 ? 'F' : `F${unnamed}`;
        unnamed++;
      }
      const f = this.parseOr();
      if (this.peek().kind !== 'Sep' && this.peek().kind !== 'End') {
        throw new Error(`Unexpected '${this.peek().text}' (at column ${this.peek().pos + 1})`);
      }
      this.aig.addOutput(name, f);
      this.signals.set(name, f);
      this.skipSeps();
    }
    if (this.aig.outputs.length === 0) {
      throw new Error('Empty expression (at column 1)');
    }
  }

  private collectInputs() {
    const defined = new Set<string>();
    const seen = new Set<string>();
    const pendingDefs: string[] = [];
    let atStmtStart = true;

    for (let i = 0; i < this.toks.length; i++) {
      const t = this.toks[i];
      if (t.kind === 'Sep') {
        atStmtStart = true;
        continue;
      }
      if (
        atStmtStart &&
        t.kind === 'Ident' &&
        i + 1 < this.toks.length &&
        this.toks[i + 1].kind === 'Assign'
      ) {
        pendingDefs.push(t.text);
        i++;
        atStmtStart = false;
        continue;
      }
      atStmtStart = false;
      if (t.kind === 'Ident' && !defined.has(t.text) && !seen.has(t.text)) {
        seen.add(t.text);
        this.inputNames.push(t.text);
      }
      if (
        i + 1 < this.toks.length &&
        (this.toks[i + 1].kind === 'Sep' || this.toks[i + 1].kind === 'End')
      ) {
        for (const d of pendingDefs) defined.add(d);
        pendingDefs.length = 0;
      }
    }
  }

  private peek(ahead = 0): Token {
    const idx = Math.min(this.pos + ahead, this.toks.length - 1);
    return this.toks[idx];
  }

  private next(): Token {
    const tok = this.toks[this.pos];
    if (this.pos < this.toks.length - 1) this.pos++;
    return tok;
  }

  private skipSeps() {
    while (this.peek().kind === 'Sep') this.next();
  }

  private mkAnd(a: Lit, b: Lit): Lit {
    return this.useStrash ? this.aig.getOrCreateAnd(a, b) : this.aig.createAndRaw(a, b);
  }

  private mkOr(a: Lit, b: Lit): Lit {
    return litNegate(this.mkAnd(litNegate(a), litNegate(b)));
  }

  private mkXor(a: Lit, b: Lit): Lit {
    return this.mkOr(this.mkAnd(a, litNegate(b)), this.mkAnd(litNegate(a), b));
  }

  private parseOr(): Lit {
    let l = this.parseXor();
    while (this.peek().kind === 'Or') {
      this.next();
      l = this.mkOr(l, this.parseXor());
    }
    return l;
  }

  private parseXor(): Lit {
    let l = this.parseAnd();
    while (this.peek().kind === 'Xor') {
      this.next();
      l = this.mkXor(l, this.parseAnd());
    }
    return l;
  }

  private parseAnd(): Lit {
    let l = this.parseUnary();
    while (this.peek().kind === 'And') {
      this.next();
      l = this.mkAnd(l, this.parseUnary());
    }
    return l;
  }

  private parseUnary(): Lit {
    if (this.peek().kind === 'Not') {
      this.next();
      return litNegate(this.parseUnary());
    }
    let l = this.parsePrimary();
    while (this.peek().kind === 'Postfix') {
      this.next();
      l = litNegate(l);
    }
    return l;
  }

  private parsePrimary(): Lit {
    const t = this.peek();
    switch (t.kind) {
      case 'Zero':
        this.next();
        return 0;
      case 'One':
        this.next();
        return 1;
      case 'Ident': {
        this.next();
        const sig = this.signals.get(t.text);
        if (sig === undefined) {
          throw new Error(`Unknown signal '${t.text}' (at column ${t.pos + 1})`);
        }
        return sig;
      }
      case 'LParen': {
        this.next();
        const l = this.parseOr();
        if (this.peek().kind !== 'RParen') {
          throw new Error(`Expected ')' (at column ${this.peek().pos + 1})`);
        }
        this.next();
        return l;
      }
      case 'End':
      case 'Sep':
        throw new Error(`Unexpected end of expression (at column ${t.pos + 1})`);
      default:
        throw new Error(`Unexpected '${t.text}' (at column ${t.pos + 1})`);
    }
  }
}

// ------------------------------------------------------------------ Printer

const P_OR = 1;
const P_XOR = 2;
const P_AND = 3;
const P_UNARY = 4;
const P_ATOM = 5;

class TooLargeError extends Error {}

class ExprPrinter {
  private names = new Map<Lit, string>();
  private memo = new Map<Lit, [string, number]>();
  private aig: TSAig;
  private maxChars: number;

  constructor(aig: TSAig, maxChars = 4000) {
    this.aig = aig;
    this.maxChars = maxChars;
    for (let i = 0; i < aig.inputs.length; i++) {
      this.names.set(litCanon(aig.inputs[i]), aig.inputNames[i]);
    }
  }

  render(lit: Lit): string {
    try {
      return this.emit(lit)[0];
    } catch (e) {
      if (e instanceof TooLargeError) return '<too large>';
      throw e;
    }
  }

  private andNode(lit: Lit): AndNode | undefined {
    return this.aig.andGates.get(litCanon(lit));
  }

  private rawXorOperands(lit: Lit): [Lit, Lit] | null {
    const n = this.andNode(lit);
    if (!n || !litIsInverted(n.fanin0) || !litIsInverted(n.fanin1)) return null;
    const p = this.andNode(n.fanin0);
    const q = this.andNode(n.fanin1);
    if (!p || !q) return null;
    const a = p.fanin0;
    const b = p.fanin1;
    const c = q.fanin0;
    const d = q.fanin1;
    const match =
      (c === litNegate(a) && d === litNegate(b)) ||
      (c === litNegate(b) && d === litNegate(a));
    return match ? [a, b] : null;
  }

  private collectXor(lit: Lit, terms: Lit[], parityRef: { value: boolean }) {
    if (lit === 0) return;
    if (lit === 1) {
      parityRef.value = !parityRef.value;
      return;
    }
    if (litIsInverted(lit)) {
      parityRef.value = !parityRef.value;
      lit = litCanon(lit);
    }
    const x = this.rawXorOperands(lit);
    if (x) {
      this.collectXor(x[0], terms, parityRef);
      this.collectXor(x[1], terms, parityRef);
    } else {
      terms.push(lit);
    }
  }

  private sortIfDistinct(lits: Lit[]) {
    const seen = new Set<Lit>();
    for (const l of lits) {
      const c = litCanon(l);
      if (seen.has(c)) return;
      seen.add(c);
    }
    lits.sort((x, y) => litCanon(x) - litCanon(y));
  }

  private wrap(lit: Lit, need: number): string {
    const [text, prec] = this.emit(lit);
    return prec < need ? `(${text})` : text;
  }

  private collectAnd(lit: Lit, leaves: Lit[]) {
    const n = this.andNode(lit);
    if (n && !litIsInverted(lit) && !this.rawXorOperands(lit)) {
      this.collectAnd(n.fanin0, leaves);
      this.collectAnd(n.fanin1, leaves);
    } else {
      leaves.push(lit);
    }
  }

  private collectOr(lit: Lit, terms: Lit[]) {
    const n = this.andNode(lit);
    if (n && litIsInverted(lit) && !this.rawXorOperands(lit)) {
      this.collectOr(litNegate(n.fanin0), terms);
      this.collectOr(litNegate(n.fanin1), terms);
    } else {
      terms.push(lit);
    }
  }

  private emit(lit: Lit): [string, number] {
    const cached = this.memo.get(lit);
    if (cached) return cached;

    let result: [string, number];
    if (lit === 0) {
      result = ['0', P_ATOM];
    } else if (lit === 1) {
      result = ['1', P_ATOM];
    } else if (this.names.has(litCanon(lit))) {
      const nm = this.names.get(litCanon(lit))!;
      result = litIsInverted(lit) ? [`~${nm}`, P_UNARY] : [nm, P_ATOM];
    } else if (this.rawXorOperands(lit)) {
      const terms: Lit[] = [];
      const parityRef = { value: false };
      this.collectXor(lit, terms, parityRef);
      if (terms.length === 0) {
        result = [parityRef.value ? '1' : '0', P_ATOM];
      } else {
        this.sortIfDistinct(terms);
        if (parityRef.value) {
          let target = terms.length - 1;
          for (let i = terms.length - 1; i >= 0; i--) {
            if (this.names.has(litCanon(terms[i]))) {
              target = i;
              break;
            }
          }
          terms[target] = litNegate(terms[target]);
        }
        if (terms.length === 1) {
          result = this.emit(terms[0]);
        } else {
          result = [terms.map((t) => this.wrap(t, P_XOR)).join(' ^ '), P_XOR];
        }
      }
    } else if (this.andNode(lit) && !litIsInverted(lit)) {
      const leaves: Lit[] = [];
      this.collectAnd(lit, leaves);
      this.sortIfDistinct(leaves);
      result = [leaves.map((l) => this.wrap(l, P_AND)).join(' & '), P_AND];
    } else if (this.andNode(lit)) {
      const terms: Lit[] = [];
      this.collectOr(lit, terms);
      this.sortIfDistinct(terms);
      result = [terms.map((t) => this.wrap(t, P_OR)).join(' | '), P_OR];
    } else {
      result = [`n${litCanon(lit)}`, P_ATOM];
    }

    if (result[0].length > this.maxChars) throw new TooLargeError();
    this.memo.set(lit, result);
    return result;
  }
}

// ------------------------------------------------------------------ Facade

function applyPass(aig: TSAig, rawPass: string): TSAig {
  const p = rawPass.trim().toLowerCase();
  if (p === 'strash' || p === 'st') return aig.strash();
  if (p === 'sweep') return aig.sweep();
  if (p === 'balance' || p === 'b') return aig.balance();
  if (p === 'rewrite' || p === 'rw') return aig.rewrite(false);
  if (p === 'rewrite_z' || p === 'rwz' || p === 'zero_cost_rewrite') return aig.rewrite(true);
  if (p === 'optimize' || p === 'opt') return aig.optimize();
  throw new Error(
    `Unknown pass '${p}' (expected strash, sweep, balance, rewrite, rewrite_z, optimize)`
  );
}

function checkEquivalence(a: TSAig, b: TSAig): boolean | null {
  const n = a.inputs.length;
  if (n !== b.inputs.length) return false;
  if (n > 16) return null;
  const rows = 1 << n;
  const bits = new Array<boolean>(n);
  for (let row = 0; row < rows; row++) {
    for (let i = 0; i < n; i++) {
      bits[i] = ((row >> (n - 1 - i)) & 1) === 1;
    }
    const va = a.evaluate(bits);
    const vb = b.evaluate(bits);
    if (va.length !== vb.length) return false;
    for (let j = 0; j < va.length; j++) {
      if (va[j] !== vb[j]) return false;
    }
  }
  return true;
}

export function synthesizeAndOptimizeTS(equation: string, passes: string[]): AigProcessResult {
  const trimmed = equation.trim();
  const emptyStats: AigStats = {
    initial_and_nodes: 0,
    final_and_nodes: 0,
    initial_levels: 0,
    final_levels: 0,
    num_inputs: 0,
    num_outputs: 0,
  };

  if (!trimmed) {
    return {
      status: 'error',
      error_message: 'Empty equation',
      original_expr: '',
      simplified_expr: '',
      outputs: [],
      passes_applied: [],
      equivalent: null,
      stats: emptyStats,
      initial_graph: { nodes: [], edges: [] },
      graph: { nodes: [], edges: [] },
    };
  }

  try {
    const initial = new TSAig();
    new ExprParser(initial, lex(trimmed), false).run();

    const normalizedPasses = passes.map((p) => p.trim().toLowerCase()).filter(Boolean);
    let finalAig = initial;
    for (const pass of normalizedPasses) {
      finalAig = applyPass(finalAig, pass);
    }

    const origPrinter = new ExprPrinter(initial);
    const simpPrinter = new ExprPrinter(finalAig);

    const outputMappings = finalAig.outputs.map((out, i) => ({
      name: out.name,
      original: origPrinter.render(initial.outputs[i].lit),
      simplified: simpPrinter.render(out.lit),
    }));

    const named = !(outputMappings.length === 1 && !equation.includes('='));
    const simplifiedExpr = outputMappings
      .map((o) => (named ? `${o.name} = ${o.simplified}` : o.simplified))
      .join('; ');

    return {
      status: 'ok',
      error_message: '',
      original_expr: trimmed,
      simplified_expr: simplifiedExpr,
      outputs: outputMappings,
      passes_applied: normalizedPasses,
      equivalent: checkEquivalence(initial, finalAig),
      stats: {
        initial_and_nodes: initial.countAndGates(),
        final_and_nodes: finalAig.countAndGates(),
        initial_levels: initial.computeDepth(),
        final_levels: finalAig.computeDepth(),
        num_inputs: finalAig.inputs.length,
        num_outputs: finalAig.outputs.length,
      },
      initial_graph: initial.toGraphData(),
      graph: finalAig.toGraphData(),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 'error',
      error_message: message,
      original_expr: trimmed,
      simplified_expr: '',
      outputs: [],
      passes_applied: [],
      equivalent: null,
      stats: emptyStats,
      initial_graph: { nodes: [], edges: [] },
      graph: { nodes: [], edges: [] },
    };
  }
}

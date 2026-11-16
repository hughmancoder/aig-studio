#include "optimizer.hpp"
#include "aig.hpp"
#include <algorithm>
#include <optional>
#include <queue>
#include <unordered_map>
#include <unordered_set>
#include <vector>

namespace optimizer {

static const uint16_t VAR_MASKS[4] = {
    0xAAAA, // v0: 1010101010101010
    0xCCCC, // v1: 1100110011001100
    0xF0F0, // v2: 1111000011110000
    0xFF00  // v3: 1111111100000000
};

OptimalAigDatabase &OptimalAigDatabase::get_instance() {
  static OptimalAigDatabase instance;
  return instance;
}

const OptimalAig *OptimalAigDatabase::lookup(uint16_t truth_table) const {
  auto it = db_.find(truth_table);
  if (it != db_.end()) {
    return &it->second;
  }
  return nullptr;
}

OptimalAigDatabase::OptimalAigDatabase() {
  build_database();
}

void OptimalAigDatabase::register_template(uint16_t tt, const OptimalAig &templ) {
  auto it = db_.find(tt);
  if (it == db_.end()) {
    db_[tt] = templ;
  } else if (templ.gates.size() < it->second.gates.size()) {
    db_[tt] = templ;
  }
}

void OptimalAigDatabase::build_database() {
  // 0-gate functions: constants and single literals
  // Constant 0
  OptimalAig c0;
  c0.num_inputs = 4;
  c0.root_idx = -1;
  c0.root_inv = false;
  register_template(0x0000, c0);

  // Constant 1
  OptimalAig c1;
  c1.num_inputs = 4;
  c1.root_idx = -1;
  c1.root_inv = true;
  register_template(0xFFFF, c1);

  // Variables and negated variables
  for (int i = 0; i < 4; ++i) {
    OptimalAig pos;
    pos.num_inputs = 4;
    pos.root_idx = i;
    pos.root_inv = false;
    register_template(VAR_MASKS[i], pos);

    OptimalAig neg;
    neg.num_inputs = 4;
    neg.root_idx = i;
    neg.root_inv = true;
    register_template(~VAR_MASKS[i], neg);
  }

  // 1-gate functions: A & B where A, B are leaf literals
  struct Gate1Info {
    uint16_t tt;
    TemplateGate gate;
  };
  std::vector<Gate1Info> gate1_list;

  for (int i = 0; i < 4; ++i) {
    for (int j = i + 1; j < 4; ++j) {
      for (int inv_i = 0; inv_i <= 1; ++inv_i) {
        for (int inv_j = 0; inv_j <= 1; ++inv_j) {
          uint16_t vi = inv_i ? ~VAR_MASKS[i] : VAR_MASKS[i];
          uint16_t vj = inv_j ? ~VAR_MASKS[j] : VAR_MASKS[j];
          uint16_t tt = vi & vj;

          TemplateGate g{i, (inv_i != 0), j, (inv_j != 0)};
          gate1_list.push_back({tt, g});

          OptimalAig pos;
          pos.num_inputs = 4;
          pos.gates.push_back(g);
          pos.root_idx = 4;
          pos.root_inv = false;
          register_template(tt, pos);

          OptimalAig neg;
          neg.num_inputs = 4;
          neg.gates.push_back(g);
          neg.root_idx = 4;
          neg.root_inv = true;
          register_template(~tt, neg);
        }
      }
    }
  }

  // 2-gate functions: combine a 1-gate output with a leaf literal
  struct Gate2Info {
    uint16_t tt;
    std::vector<TemplateGate> gates;
  };
  std::vector<Gate2Info> gate2_list;

  for (const auto &g1 : gate1_list) {
    for (int k = 0; k < 4; ++k) {
      for (int inv_g1 = 0; inv_g1 <= 1; ++inv_g1) {
        for (int inv_k = 0; inv_k <= 1; ++inv_k) {
          uint16_t v1 = inv_g1 ? ~g1.tt : g1.tt;
          uint16_t vk = inv_k ? ~VAR_MASKS[k] : VAR_MASKS[k];
          uint16_t tt = v1 & vk;

          TemplateGate g2{4, (inv_g1 != 0), k, (inv_k != 0)};
          std::vector<TemplateGate> gates = {g1.gate, g2};
          gate2_list.push_back({tt, gates});

          OptimalAig pos;
          pos.num_inputs = 4;
          pos.gates = gates;
          pos.root_idx = 5;
          pos.root_inv = false;
          register_template(tt, pos);

          OptimalAig neg;
          neg.num_inputs = 4;
          neg.gates = gates;
          neg.root_idx = 5;
          neg.root_inv = true;
          register_template(~tt, neg);
        }
      }
    }
  }

  // 2-gate functions: combine two independent 1-gate outputs
  for (size_t a = 0; a < gate1_list.size(); ++a) {
    for (size_t b = a + 1; b < gate1_list.size(); ++b) {
      for (int inv_a = 0; inv_a <= 1; ++inv_a) {
        for (int inv_b = 0; inv_b <= 1; ++inv_b) {
          uint16_t va = inv_a ? ~gate1_list[a].tt : gate1_list[a].tt;
          uint16_t vb = inv_b ? ~gate1_list[b].tt : gate1_list[b].tt;
          uint16_t tt = va & vb;

          TemplateGate g3{4, (inv_a != 0), 5, (inv_b != 0)};
          std::vector<TemplateGate> gates = {gate1_list[a].gate, gate1_list[b].gate, g3};

          OptimalAig pos;
          pos.num_inputs = 4;
          pos.gates = gates;
          pos.root_idx = 6;
          pos.root_inv = false;
          register_template(tt, pos);

          OptimalAig neg;
          neg.num_inputs = 4;
          neg.gates = gates;
          neg.root_idx = 6;
          neg.root_inv = true;
          register_template(~tt, neg);
        }
      }
    }
  }

  // 3-gate functions: MUX (s ? a : b), XOR2, XOR3, and combinations
  // MUX: (s & a) | (!s & b) = !(!(s & a) & !(!s & b))
  for (int s = 0; s < 4; ++s) {
    for (int a = 0; a < 4; ++a) {
      if (a == s) continue;
      for (int b = 0; b < 4; ++b) {
        if (b == s || b == a) continue;
        for (int inv_s = 0; inv_s <= 1; ++inv_s) {
          for (int inv_a = 0; inv_a <= 1; ++inv_a) {
            for (int inv_b = 0; inv_b <= 1; ++inv_b) {
              uint16_t vs = inv_s ? ~VAR_MASKS[s] : VAR_MASKS[s];
              uint16_t va = inv_a ? ~VAR_MASKS[a] : VAR_MASKS[a];
              uint16_t vb = inv_b ? ~VAR_MASKS[b] : VAR_MASKS[b];
              uint16_t tt = (vs & va) | (~vs & vb);

              TemplateGate g0{s, (inv_s != 0), a, (inv_a != 0)};
              TemplateGate g1{s, (inv_s == 0), b, (inv_b != 0)};
              TemplateGate g2{4, true, 5, true}; // !g0 & !g1

              OptimalAig mux_aig;
              mux_aig.num_inputs = 4;
              mux_aig.gates = {g0, g1, g2};
              mux_aig.root_idx = 6;
              mux_aig.root_inv = true; // !(!g0 & !g1)
              register_template(tt, mux_aig);

              mux_aig.root_inv = false;
              register_template(~tt, mux_aig);
            }
          }
        }
      }
    }
  }

  // XOR2: a ^ b = (a & !b) | (!a & b)
  for (int a = 0; a < 4; ++a) {
    for (int b = a + 1; b < 4; ++b) {
      uint16_t tt = VAR_MASKS[a] ^ VAR_MASKS[b];

      TemplateGate g0{a, false, b, true};  // a & !b
      TemplateGate g1{a, true, b, false};  // !a & b
      TemplateGate g2{4, true, 5, true};   // !g0 & !g1

      OptimalAig xor_aig;
      xor_aig.num_inputs = 4;
      xor_aig.gates = {g0, g1, g2};
      xor_aig.root_idx = 6;
      xor_aig.root_inv = true;
      register_template(tt, xor_aig);

      xor_aig.root_inv = false;
      register_template(~tt, xor_aig);
    }
  }
}

} // namespace optimizer

Lit Aig::get_next_available_lit() {
  uint32_t new_var = ++max_var_;
  return 2 * new_var;
}

Lit Aig::create_and_raw(Lit f0, Lit f1) {
  Lit lit = get_next_available_lit();
  add_and_gate(lit, f0, f1);
  return lit;
}

std::size_t Aig::count_and_gates() const {
  std::size_t n = 0;
  for (const auto &node : nodes_)
    if (node.type == Type::AND)
      n++;
  return n;
}

Lit Aig::get_or_create_and(Lit f0, Lit f1) {
  // Constant propagation & basic identities
  if (f0 == 0 || f1 == 0)
    return 0; // 0 & x = 0
  if (f0 == 1)
    return f1; // 1 & x = x
  if (f1 == 1)
    return f0; // x & 1 = x
  if (f0 == f1)
    return f0; // x & x = x
  if (f0 == negate(f1))
    return 0; // x & !x = 0

  // Canonical ordering: fanin0 <= fanin1
  if (f0 > f1)
    std::swap(f0, f1);

  // Check unique table for structural hashing
  auto key = std::make_pair(f0, f1);
  auto it = unique_table_.find(key);
  if (it != unique_table_.end()) {
    return it->second;
  }

  // Two-level algebraic reduction on the fly:
  // a & (a & b) -> (a & b)
  // a & !(a & b) -> a & !b
  // a & (!a & b) -> 0
  auto try_algebraic = [this](Lit a, Lit b) -> std::pair<bool, Lit> {
    Lit b_canon = get_canonical_lit(b);
    auto it = id_node_map_.find(b_canon);
    if (it == id_node_map_.end() || it->second.type != Type::AND) {
      return {false, 0};
    }
    bool b_inv = is_inverted(b);
    Lit c = it->second.fanin0;
    Lit d = it->second.fanin1;

    if (!b_inv) {
      if (a == c || a == d) {
        return {true, b};
      }
      if (a == negate(c) || a == negate(d)) {
        return {true, 0};
      }
    } else {
      if (a == c) {
        return {true, get_or_create_and(a, negate(d))};
      }
      if (a == d) {
        return {true, get_or_create_and(a, negate(c))};
      }
      if (a == negate(c) || a == negate(d)) {
        return {true, a};
      }
    }
    return {false, 0};
  };

  auto r1 = try_algebraic(f0, f1);
  if (r1.first)
    return r1.second;
  auto r2 = try_algebraic(f1, f0);
  if (r2.first)
    return r2.second;

  // Allocate new literal and add node
  Lit new_lit = get_next_available_lit();
  add_and_gate(new_lit, f0, f1);
  unique_table_[key] = new_lit;
  return new_lit;
}

Lit Aig::rewrite_and(Lit f0, Lit f1) {
  if (f0 == 0 || f1 == 0)
    return 0;
  if (f0 == 1)
    return f1;
  if (f1 == 1)
    return f0;
  if (f0 == f1)
    return f0;
  if (f0 == negate(f1))
    return 0;

  // Two-level algebraic rewrite rules
  auto try_rewrite = [this](Lit a, Lit b) -> std::pair<bool, Lit> {
    Lit b_canon = get_canonical_lit(b);
    auto it = id_node_map_.find(b_canon);
    if (it == id_node_map_.end() || it->second.type != Type::AND) {
      return {false, 0};
    }
    bool b_inv = is_inverted(b);
    Lit c = it->second.fanin0;
    Lit d = it->second.fanin1;

    if (!b_inv) {
      if (a == c || a == d) {
        return {true, b};
      }
      if (a == negate(c) || a == negate(d)) {
        return {true, 0};
      }
    } else {
      if (a == c) {
        return {true, get_or_create_and(a, negate(d))};
      }
      if (a == d) {
        return {true, get_or_create_and(a, negate(c))};
      }
      if (a == negate(c) || a == negate(d)) {
        return {true, a};
      }
    }
    return {false, 0};
  };

  auto r1 = try_rewrite(f0, f1);
  if (r1.first)
    return r1.second;

  auto r2 = try_rewrite(f1, f0);
  if (r2.first)
    return r2.second;

  return get_or_create_and(f0, f1);
}

void Aig::sweep() {
  // 1. Mark live nodes via backward traversal from outputs
  std::unordered_set<Lit> live_nodes;
  std::vector<Lit> stack;

  for (Lit out : outputs_) {
    if (out > 1) {
      stack.push_back(get_canonical_lit(out));
    }
  }

  while (!stack.empty()) {
    Lit curr = stack.back();
    stack.pop_back();

    if (!live_nodes.insert(curr).second) {
      continue;
    }

    auto it = id_node_map_.find(curr);
    if (it != id_node_map_.end() && it->second.type == Type::AND) {
      if (it->second.fanin0 > 1)
        stack.push_back(get_canonical_lit(it->second.fanin0));
      if (it->second.fanin1 > 1)
        stack.push_back(get_canonical_lit(it->second.fanin1));
    }
  }

  // 2. Rebuild clean network keeping only live nodes and merging duplicates
  Aig clean;
  clean.model_name_ = model_name_;

  std::unordered_map<Lit, Lit> lit_map;
  lit_map[0] = 0;
  lit_map[1] = 1;

  for (size_t i = 0; i < inputs_.size(); ++i) {
    Lit in = inputs_[i];
    clean.add_input_node(in, get_input_name(i));
    lit_map[get_canonical_lit(in)] = get_canonical_lit(in);
  }

  auto map_lit = [&](Lit lit) -> Lit {
    if (lit <= 1)
      return lit;
    Lit canon = get_canonical_lit(lit);
    auto it = lit_map.find(canon);
    Lit mapped = (it != lit_map.end()) ? it->second : canon;
    return is_inverted(lit) ? negate(mapped) : mapped;
  };

  for (const auto &n : nodes_) {
    if (n.type != Type::AND)
      continue;
    Lit canon = get_canonical_lit(n.literal);
    if (live_nodes.find(canon) == live_nodes.end()) {
      continue;
    }
    Lit f0 = map_lit(n.fanin0);
    Lit f1 = map_lit(n.fanin1);
    Lit res = clean.get_or_create_and(f0, f1);
    lit_map[canon] = res;
  }

  for (size_t i = 0; i < outputs_.size(); ++i) {
    Lit out = map_lit(outputs_[i]);
    clean.add_output_node(out, get_output_name(i));
  }

  *this = std::move(clean);
}

void Aig::strash() {
  Aig strashed;
  strashed.model_name_ = model_name_;

  std::unordered_map<Lit, Lit> lit_map;
  lit_map[0] = 0;
  lit_map[1] = 1;

  for (size_t i = 0; i < inputs_.size(); ++i) {
    Lit in = inputs_[i];
    strashed.add_input_node(in, get_input_name(i));
    lit_map[get_canonical_lit(in)] = get_canonical_lit(in);
  }

  auto map_lit = [&](Lit lit) -> Lit {
    if (lit <= 1)
      return lit;
    Lit canon = get_canonical_lit(lit);
    auto it = lit_map.find(canon);
    Lit mapped = (it != lit_map.end()) ? it->second : canon;
    return is_inverted(lit) ? negate(mapped) : mapped;
  };

  for (const auto &n : nodes_) {
    if (n.type != Type::AND)
      continue;
    Lit f0 = map_lit(n.fanin0);
    Lit f1 = map_lit(n.fanin1);
    Lit res = strashed.get_or_create_and(f0, f1);
    lit_map[get_canonical_lit(n.literal)] = res;
  }

  for (size_t i = 0; i < outputs_.size(); ++i) {
    Lit out = map_lit(outputs_[i]);
    strashed.add_output_node(out, get_output_name(i));
  }

  *this = std::move(strashed);
}

void Aig::balance() {
  sweep();

  auto fanouts = compute_fanout_counts();

  Aig balanced;
  balanced.set_model_name(model_name_);

  std::unordered_map<Lit, Lit> lit_map;
  lit_map[0] = 0;
  lit_map[1] = 1;

  std::unordered_map<Lit, int> depth_map;
  depth_map[0] = 0;
  depth_map[1] = 0;

  for (size_t i = 0; i < inputs_.size(); ++i) {
    Lit in = inputs_[i];
    balanced.add_input_node(in, get_input_name(i));
    lit_map[get_canonical_lit(in)] = get_canonical_lit(in);
    depth_map[get_canonical_lit(in)] = 0;
  }

  auto map_lit = [&](Lit lit) -> Lit {
    if (lit <= 1)
      return lit;
    Lit canon = get_canonical_lit(lit);
    auto it = lit_map.find(canon);
    Lit mapped = (it != lit_map.end()) ? it->second : canon;
    return is_inverted(lit) ? negate(mapped) : mapped;
  };

  auto get_depth = [&](Lit lit) -> int {
    if (lit <= 1)
      return 0;
    Lit canon = get_canonical_lit(lit);
    auto it = depth_map.find(canon);
    return (it != depth_map.end()) ? it->second : 0;
  };

  auto make_balanced_and = [&](Lit f0, Lit f1) -> Lit {
    Lit res = balanced.get_or_create_and(f0, f1);
    Lit canon = get_canonical_lit(res);
    if (canon > 1) {
      auto it = balanced.id_node_map_.find(canon);
      if (it != balanced.id_node_map_.end() && it->second.type == Type::AND) {
        depth_map[canon] =
            1 + std::max(get_depth(it->second.fanin0), get_depth(it->second.fanin1));
      }
    }
    return res;
  };

  auto make_balanced_xor = [&](Lit x, Lit y) -> Lit {
    Lit t0 = make_balanced_and(x, negate(y));
    Lit t1 = make_balanced_and(negate(x), y);
    return negate(make_balanced_and(negate(t0), negate(t1)));
  };

  auto is_xor_node = [&](Lit canon) -> std::optional<std::pair<Lit, Lit>> {
    auto it = id_node_map_.find(canon);
    if (it == id_node_map_.end() || it->second.type != Type::AND)
      return std::nullopt;
    const AigNode &n = it->second;
    if (!is_inverted(n.fanin0) || !is_inverted(n.fanin1))
      return std::nullopt;
    auto pit = id_node_map_.find(get_canonical_lit(n.fanin0));
    auto qit = id_node_map_.find(get_canonical_lit(n.fanin1));
    if (pit == id_node_map_.end() || qit == id_node_map_.end())
      return std::nullopt;
    if (pit->second.type != Type::AND || qit->second.type != Type::AND)
      return std::nullopt;
    Lit a = pit->second.fanin0, b = pit->second.fanin1;
    Lit c = qit->second.fanin0, d = qit->second.fanin1;
    bool match = (c == negate(a) && d == negate(b)) ||
                 (c == negate(b) && d == negate(a));
    if (!match)
      return std::nullopt;
    return std::make_pair(a, b);
  };

  auto collect_xor_leaves = [&](auto &self, Lit lit, std::vector<Lit> &leaves,
                                bool &parity, Lit root_canon) -> void {
    if (lit == 0)
      return;
    if (lit == 1) {
      parity = !parity;
      return;
    }
    if (is_inverted(lit)) {
      parity = !parity;
      lit = get_canonical_lit(lit);
    }
    if (auto x = is_xor_node(lit)) {
      const AigNode &xn = id_node_map_.at(lit);
      Lit p_canon = get_canonical_lit(xn.fanin0);
      Lit q_canon = get_canonical_lit(xn.fanin1);
      bool internal_only = (fanouts[p_canon] == 1 && fanouts[q_canon] == 1);
      if (internal_only && (lit == root_canon || fanouts[lit] == 2)) {
        self(self, x->first, leaves, parity, root_canon);
        self(self, x->second, leaves, parity, root_canon);
        return;
      }
    }
    leaves.push_back(lit);
  };

  // Helper to collect leaves of a multi-input non-inverted AND tree
  auto collect_and_leaves = [&](auto &self, Lit lit, std::vector<Lit> &leaves, Lit root_canon) -> void {
    if (lit <= 1 || is_inverted(lit)) {
      leaves.push_back(lit);
      return;
    }
    Lit canon = get_canonical_lit(lit);
    auto it = id_node_map_.find(canon);
    if (it == id_node_map_.end() || it->second.type != Type::AND) {
      leaves.push_back(lit);
      return;
    }
    if (canon != root_canon) {
      auto fo_it = fanouts.find(canon);
      if (fo_it != fanouts.end() && fo_it->second > 1) {
        // Node with fanout > 1 is kept as a leaf to preserve node sharing
        leaves.push_back(lit);
        return;
      }
    }
    self(self, it->second.fanin0, leaves, root_canon);
    self(self, it->second.fanin1, leaves, root_canon);
  };

  struct QueueItem {
    int depth;
    Lit lit;
    bool operator>(const QueueItem &other) const {
      if (depth != other.depth)
        return depth > other.depth;
      return lit > other.lit;
    }
  };

  for (const auto &n : nodes_) {
    if (n.type != Type::AND)
      continue;
    Lit canon = get_canonical_lit(n.literal);

    if (is_xor_node(canon)) {
      std::vector<Lit> xor_leaves;
      bool parity = false;
      collect_xor_leaves(collect_xor_leaves, canon, xor_leaves, parity, canon);
      if (xor_leaves.size() > 2) {
        std::priority_queue<QueueItem, std::vector<QueueItem>, std::greater<QueueItem>> pq;
        for (Lit leaf : xor_leaves) {
          Lit m_leaf = map_lit(leaf);
          pq.push({get_depth(m_leaf), m_leaf});
        }
        while (pq.size() > 1) {
          auto item1 = pq.top();
          pq.pop();
          auto item2 = pq.top();
          pq.pop();
          Lit combined = make_balanced_xor(item1.lit, item2.lit);
          pq.push({get_depth(combined), combined});
        }
        Lit root_lit = pq.top().lit;
        lit_map[canon] = parity ? negate(root_lit) : root_lit;
        continue;
      }
    }

    std::vector<Lit> leaves;
    collect_and_leaves(collect_and_leaves, canon, leaves, canon);

    if (leaves.size() <= 2) {
      Lit f0 = map_lit(n.fanin0);
      Lit f1 = map_lit(n.fanin1);
      Lit res = make_balanced_and(f0, f1);
      lit_map[canon] = res;
    } else {
      // Balance multi-input tree using min-priority queue (Huffman-style minimum depth)
      std::priority_queue<QueueItem, std::vector<QueueItem>, std::greater<QueueItem>> pq;
      for (Lit leaf : leaves) {
        Lit m_leaf = map_lit(leaf);
        pq.push({get_depth(m_leaf), m_leaf});
      }

      while (pq.size() > 1) {
        auto item1 = pq.top();
        pq.pop();
        auto item2 = pq.top();
        pq.pop();

        Lit combined = make_balanced_and(item1.lit, item2.lit);
        pq.push({get_depth(combined), combined});
      }

      Lit root_lit = pq.top().lit;
      lit_map[canon] = root_lit;
    }
  }

  for (size_t i = 0; i < outputs_.size(); ++i) {
    Lit out = map_lit(outputs_[i]);
    balanced.add_output_node(out, get_output_name(i));
  }

  *this = std::move(balanced);
  sweep();
}

void Aig::rewrite(bool zero_cost) {
  sweep();

  auto &db = optimizer::OptimalAigDatabase::get_instance();
  const int max_passes = zero_cost ? 1 : 4;

  for (int pass = 0; pass < max_passes; ++pass) {
    const std::size_t before = count_and_gates();
    auto fanouts = compute_fanout_counts();

    // Rebuild into a fresh network in topological order. Replacement
    // structures are instantiated directly in the new network from the
    // (already mapped) cut leaves, so no in-place mutation is needed.
    Aig out;
    out.model_name_ = model_name_;

    std::unordered_map<Lit, Lit> lit_map;
    for (size_t i = 0; i < inputs_.size(); ++i) {
      out.add_input_node(inputs_[i], get_input_name(i));
      lit_map[get_canonical_lit(inputs_[i])] = get_canonical_lit(inputs_[i]);
    }

    auto map_lit = [&](Lit lit) -> Lit {
      if (lit <= 1)
        return lit;
      auto it = lit_map.find(get_canonical_lit(lit));
      Lit mapped = (it != lit_map.end()) ? it->second : get_canonical_lit(lit);
      return is_inverted(lit) ? negate(mapped) : mapped;
    };

    auto and_of = [&](Lit lit) -> const AigNode * {
      auto it = id_node_map_.find(get_canonical_lit(lit));
      if (it == id_node_map_.end() || it->second.type != Type::AND)
        return nullptr;
      return &it->second;
    };

    // Bottom-up 4-feasible cut enumeration so multi-level cones (e.g. consensus
    // terms at depth 3) are exposed to the 4-input optimal AIG database.
    std::unordered_map<Lit, std::vector<std::vector<Lit>>> node_cuts;
    for (Lit in : inputs_) {
      Lit c = get_canonical_lit(in);
      node_cuts[c] = {{c}};
    }
    auto get_cuts = [&](Lit lit) -> const std::vector<std::vector<Lit>> & {
      static const std::vector<std::vector<Lit>> empty_cut = {{}};
      Lit c = get_canonical_lit(lit);
      if (c <= 1)
        return empty_cut;
      auto it = node_cuts.find(c);
      return (it != node_cuts.end()) ? it->second : empty_cut;
    };

    for (const auto &n : nodes_) {
      if (n.type != Type::AND)
        continue;
      const Lit root = get_canonical_lit(n.literal);

      std::vector<std::vector<Lit>> cuts;
      cuts.push_back({root});

      const auto &cuts0 = get_cuts(n.fanin0);
      const auto &cuts1 = get_cuts(n.fanin1);
      for (const auto &c0 : cuts0) {
        for (const auto &c1 : cuts1) {
          std::vector<Lit> merged = c0;
          for (Lit l : c1) {
            if (std::find(merged.begin(), merged.end(), l) == merged.end())
              merged.push_back(l);
          }
          if (merged.size() > 4)
            continue;
          std::sort(merged.begin(), merged.end());
          if (std::find(cuts.begin(), cuts.end(), merged) == cuts.end()) {
            cuts.push_back(std::move(merged));
            if (cuts.size() >= 16)
              break;
          }
        }
        if (cuts.size() >= 16)
          break;
      }
      node_cuts[root] = cuts;

      bool replaced = false;
      Lit best_result = 0;
      int best_gain = -1;
      int best_created = 1000;

      for (const auto &cut : cuts) {
        if (cut.empty() || (cut.size() == 1 && cut[0] == root))
          continue;

        // 16-bit truth table of the root as a function of the cut leaves
        std::unordered_map<Lit, uint16_t> leaf_tt;
        for (size_t i = 0; i < cut.size(); ++i)
          leaf_tt[cut[i]] = optimizer::VAR_MASKS[i];

        std::unordered_map<Lit, uint16_t> cone; // internal nodes -> tt
        bool valid = true;
        auto eval = [&](auto &self, Lit lit) -> uint16_t {
          if (lit == 0)
            return 0x0000;
          if (lit == 1)
            return 0xFFFF;
          Lit c = get_canonical_lit(lit);
          uint16_t v;
          if (auto it = leaf_tt.find(c); it != leaf_tt.end()) {
            v = it->second;
          } else if (auto mit = cone.find(c); mit != cone.end()) {
            v = mit->second;
          } else {
            const AigNode *an = and_of(c);
            if (!an) { // reached a signal outside the cut: not a valid cut
              valid = false;
              return 0;
            }
            v = self(self, an->fanin0) & self(self, an->fanin1);
            cone[c] = v;
          }
          return is_inverted(lit) ? static_cast<uint16_t>(~v) : v;
        };
        const uint16_t tt = eval(eval, root);
        if (!valid)
          continue;

        const optimizer::OptimalAig *opt = db.lookup(tt);
        if (!opt)
          continue;

        // Gates freed = cone nodes whose every fanout is inside the cone
        // (maximum fanout-free cone of the root w.r.t. this cut).
        int freed = 0;
        for (const auto &kv : cone) {
          Lit c = kv.first;
          if (c == root) {
            freed++;
            continue;
          }
          std::size_t internal = 0;
          for (const auto &pk : cone) {
            const AigNode &p = id_node_map_.at(pk.first);
            if (get_canonical_lit(p.fanin0) == c) internal++;
            if (get_canonical_lit(p.fanin1) == c) internal++;
          }
          auto fo = fanouts.find(c);
          if (fo != fanouts.end() && internal >= fo->second)
            freed++;
        }

        const int created = static_cast<int>(opt->gates.size());
        const int gain = freed - created;
        const bool accept = gain > 0 || (zero_cost && gain == 0 && freed > 0);
        if (!accept)
          continue;
        if (gain < best_gain || (gain == best_gain && created >= best_created))
          continue;

        // Instantiate the optimal template in the new network
        std::vector<Lit> sig;
        for (Lit leaf : cut)
          sig.push_back(map_lit(leaf));
        while (sig.size() < 4)
          sig.push_back(0);
        for (const auto &g : opt->gates) {
          Lit s0 = g.inv0 ? negate(sig[g.in0]) : sig[g.in0];
          Lit s1 = g.inv1 ? negate(sig[g.in1]) : sig[g.in1];
          sig.push_back(out.get_or_create_and(s0, s1));
        }
        Lit r = (opt->root_idx >= 0) ? sig[opt->root_idx] : 0;
        best_result = opt->root_inv ? negate(r) : r;
        best_gain = gain;
        best_created = created;
        replaced = true;
      }

      Lit result = replaced ? best_result
                            : out.get_or_create_and(map_lit(n.fanin0), map_lit(n.fanin1));
      lit_map[root] = result;
    }

    for (size_t i = 0; i < outputs_.size(); ++i)
      out.add_output_node(map_lit(outputs_[i]), get_output_name(i));

    *this = std::move(out);
    sweep(); // drop cones orphaned by replacements

    if (count_and_gates() >= before)
      break; // fixpoint
  }
}



void Aig::optimize() {
  size_t prev_gates = nodes_.size();

  const int max_passes = 10;
  for (int pass = 0; pass < max_passes; ++pass) {
    // 1. Sweep dead nodes and merge duplicates
    sweep();

    // 2. DAG-aware rewriting pass
    rewrite();

    // 3. Tree balancing pass
    balance();

    // 4. Two-level algebraic rewriting pass
    Aig rewritten;
    rewritten.model_name_ = model_name_;

    std::unordered_map<Lit, Lit> lit_map;
    lit_map[0] = 0;
    lit_map[1] = 1;

    for (size_t i = 0; i < inputs_.size(); ++i) {
      Lit in = inputs_[i];
      rewritten.add_input_node(in, get_input_name(i));
      lit_map[get_canonical_lit(in)] = get_canonical_lit(in);
    }

    auto map_lit = [&](Lit lit) -> Lit {
      if (lit <= 1)
        return lit;
      Lit canon = get_canonical_lit(lit);
      auto it = lit_map.find(canon);
      Lit mapped = (it != lit_map.end()) ? it->second : canon;
      return is_inverted(lit) ? negate(mapped) : mapped;
    };

    for (const auto &n : nodes_) {
      if (n.type != Type::AND)
        continue;
      Lit f0 = map_lit(n.fanin0);
      Lit f1 = map_lit(n.fanin1);
      Lit res = rewritten.rewrite_and(f0, f1);
      lit_map[get_canonical_lit(n.literal)] = res;
    }

    for (size_t i = 0; i < outputs_.size(); ++i) {
      Lit out = map_lit(outputs_[i]);
      rewritten.add_output_node(out, get_output_name(i));
    }

    *this = std::move(rewritten);
    sweep();

    size_t curr_gates = 0;
    for (const auto &n : nodes_) {
      if (n.type == Type::AND)
        curr_gates++;
    }

    if (curr_gates >= prev_gates) {
      break;
    }
    prev_gates = curr_gates;
  }
}

void Aig::compact() {
  sweep();

  Aig comp;
  comp.model_name_ = model_name_;

  std::unordered_map<Lit, Lit> lit_map;
  lit_map[0] = 0;
  lit_map[1] = 1;

  for (size_t i = 0; i < inputs_.size(); ++i) {
    Lit new_in = static_cast<Lit>(2 * (i + 1));
    comp.add_input_node(new_in, get_input_name(i));
    lit_map[get_canonical_lit(inputs_[i])] = new_in;
  }

  auto map_lit = [&](Lit lit) -> Lit {
    if (lit <= 1)
      return lit;
    Lit canon = get_canonical_lit(lit);
    auto it = lit_map.find(canon);
    Lit mapped = (it != lit_map.end()) ? it->second : canon;
    return is_inverted(lit) ? negate(mapped) : mapped;
  };

  size_t and_index = 0;
  for (const auto &n : nodes_) {
    if (n.type != Type::AND)
      continue;
    Lit new_and = static_cast<Lit>(2 * (inputs_.size() + 1 + and_index));
    Lit f0 = map_lit(n.fanin0);
    Lit f1 = map_lit(n.fanin1);

    comp.add_and_gate(new_and, f0, f1);
    lit_map[get_canonical_lit(n.literal)] = new_and;
    and_index++;
  }

  for (size_t i = 0; i < outputs_.size(); ++i) {
    Lit out = map_lit(outputs_[i]);
    comp.add_output_node(out, get_output_name(i));
  }

  *this = std::move(comp);
}

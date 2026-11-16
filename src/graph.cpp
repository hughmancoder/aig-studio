#include "graph.hpp"
#include "aig.hpp"
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <unordered_set>

void Aig::write_dot(std::ostream &out, const std::string &graph_name) const {
  std::string name = graph_name.empty() ? model_name_ : graph_name;
  if (name.empty()) {
    name = "AIG";
  }

  out << "digraph \"" << name << "\" {\n";
  out << "  rankdir=TB;\n";
  out << "  node [fontname=\"Helvetica\", fontsize=10];\n";
  out << "  edge [fontname=\"Helvetica\", fontsize=9];\n\n";

  // Inputs
  out << "  // Primary Inputs\n";
  out << "  subgraph cluster_inputs {\n";
  out << "    label=\"Inputs\";\n";
  out << "    style=dotted;\n";
  out << "    rank=source;\n";
  out << "    node [shape=box, style=filled, fillcolor=\"#E3F2FD\", "
         "color=\"#1976D2\"];\n";
  for (size_t i = 0; i < inputs_.size(); ++i) {
    Lit in_lit = get_canonical_lit(inputs_[i]);
    std::string in_name = get_input_name(i);
    out << "    \"node_" << in_lit << "\" [label=\"" << in_name << "\\n(lit "
        << in_lit << ")\"];\n";
  }
  out << "  }\n\n";

  // AND nodes
  out << "  // AND Gates\n";
  out << "  node [shape=circle, style=filled, fillcolor=\"#FFF9C4\", "
         "color=\"#FBC02D\"];\n";
  for (const auto &n : nodes_) {
    if (n.type != Type::AND)
      continue;
    Lit canon = get_canonical_lit(n.literal);
    out << "  \"node_" << canon << "\" [label=\"&\\n" << canon << "\"];\n";
  }
  out << "\n";

  // Constant nodes (if referenced)
  bool uses_const0 = false;
  bool uses_const1 = false;
  for (Lit o : outputs_) {
    if (o == 0)
      uses_const0 = true;
    if (o == 1)
      uses_const1 = true;
  }
  for (const auto &n : nodes_) {
    if (n.type == Type::AND) {
      if (n.fanin0 == 0 || n.fanin1 == 0)
        uses_const0 = true;
      if (n.fanin0 == 1 || n.fanin1 == 1)
        uses_const1 = true;
    }
  }
  if (uses_const0) {
    out << "  \"node_0\" [shape=box, style=filled, fillcolor=\"#ECEFF1\", "
           "label=\"0\"];\n";
  }
  if (uses_const1) {
    out << "  \"node_1\" [shape=box, style=filled, fillcolor=\"#ECEFF1\", "
           "label=\"1\"];\n";
  }

  // Outputs
  out << "  // Primary Outputs\n";
  out << "  subgraph cluster_outputs {\n";
  out << "    label=\"Outputs\";\n";
  out << "    style=dotted;\n";
  out << "    rank=sink;\n";
  out << "    node [shape=doubleoctagon, style=filled, fillcolor=\"#E8F5E9\", "
         "color=\"#388E3C\"];\n";
  for (size_t i = 0; i < outputs_.size(); ++i) {
    std::string out_name = get_output_name(i);
    out << "    \"out_" << i << "\" [label=\"" << out_name << "\"];\n";
  }
  out << "  }\n\n";

  // Edges
  out << "  // Connections\n";
  auto emit_edge = [&](Lit src, const std::string &dst_node) {
    Lit src_canon = get_canonical_lit(src);
    std::string src_node = "node_" + std::to_string(src_canon);
    if (is_inverted(src)) {
      out << "  \"" << src_node << "\" -> \"" << dst_node
          << "\" [style=dashed, color=\"#D32F2F\", arrowhead=odot, "
             "label=\"NOT\"];\n";
    } else {
      out << "  \"" << src_node << "\" -> \"" << dst_node
          << "\" [style=solid, color=\"#37474F\"];\n";
    }
  };

  for (const auto &n : nodes_) {
    if (n.type != Type::AND)
      continue;
    std::string dst = "node_" + std::to_string(get_canonical_lit(n.literal));
    emit_edge(n.fanin0, dst);
    emit_edge(n.fanin1, dst);
  }

  for (size_t i = 0; i < outputs_.size(); ++i) {
    std::string dst = "out_" + std::to_string(i);
    emit_edge(outputs_[i], dst);
  }

  out << "}\n";
}

void Aig::print_tree(std::ostream &out) const {
  out << "=== AIG Output Logic Cone Trees ===\n";
  std::unordered_set<Lit> visited;

  auto print_subtree = [&](auto &self, Lit lit, const std::string &prefix,
                           bool is_last) -> void {
    out << prefix << (is_last ? "└── " : "├── ");

    if (lit == 0) {
      out << "CONST 0\n";
      return;
    }
    if (lit == 1) {
      out << "CONST 1\n";
      return;
    }

    bool inv = is_inverted(lit);
    Lit canon = get_canonical_lit(lit);

    if (inv) {
      out << "NOT (lit " << lit << ") -> ";
    }

    auto nit = id_node_map_.find(canon);
    if (nit == id_node_map_.end()) {
      out << "UNKNOWN (lit " << canon << ")\n";
      return;
    }

    if (nit->second.type == Type::INPUT) {
      std::string name;
      for (size_t i = 0; i < inputs_.size(); ++i) {
        if (get_canonical_lit(inputs_[i]) == canon) {
          name = get_input_name(i);
          break;
        }
      }
      out << "INPUT " << name << " (lit " << canon << ")\n";
      return;
    }

    // AND Gate
    out << "AND " << get_variable_index(canon) << " (lit " << canon << ")";
    if (visited.count(canon)) {
      out << " [shared]\n";
      return;
    }
    visited.insert(canon);
    out << "\n";

    std::string next_prefix = prefix + (is_last ? "    " : "│   ");
    self(self, nit->second.fanin0, next_prefix, false);
    self(self, nit->second.fanin1, next_prefix, true);
  };

  for (size_t i = 0; i < outputs_.size(); ++i) {
    Lit out_lit = outputs_[i];
    std::string name = get_output_name(i);
    out << "Output " << i << " [" << name << "] driven by lit " << out_lit
        << "\n";
    print_subtree(print_subtree, out_lit, "", true);
    out << "\n";
  }
}

void Aig::print_network(std::ostream &out) const {
  auto fanouts = compute_fanout_counts();
  std::size_t max_fo = get_max_fanout(fanouts);

  size_t and_count = 0;
  for (const auto &n : nodes_) {
    if (n.type == Type::AND)
      and_count++;
  }

  out << "====================================================================="
         "=========\n";
  out << "AIG Network Summary (Model: " << model_name_ << ")\n";
  out << "====================================================================="
         "=========\n";
  out << "Inputs: " << inputs_.size() << " | Outputs: " << outputs_.size()
      << " | AND Gates: " << and_count << " | Depth: " << compute_depth()
      << " | Max Fan-out: " << max_fo << "\n";
  out << "---------------------------------------------------------------------"
         "---------\n";

  // Primary Inputs
  out << "Primary Inputs (" << inputs_.size() << "):\n";
  for (size_t i = 0; i < inputs_.size(); ++i) {
    Lit in_lit = inputs_[i];
    out << "  [" << i << "] var " << get_variable_index(in_lit) << " (lit "
        << in_lit << "): " << get_input_name(i)
        << " (fanout: " << fanouts[in_lit] << ")\n";
  }
  out << "---------------------------------------------------------------------"
         "---------\n";

  // Primary Outputs
  out << "Primary Outputs (" << outputs_.size() << "):\n";
  for (size_t i = 0; i < outputs_.size(); ++i) {
    Lit out_lit = outputs_[i];
    out << "  [" << i << "] " << get_output_name(i) << ": driver lit "
        << out_lit << " (var " << get_variable_index(out_lit)
        << (is_inverted(out_lit) ? ", inverted" : ", non-inverted") << ")\n";
  }
  out << "---------------------------------------------------------------------"
         "---------\n";

  // AND Gates
  out << "AND Gates (" << and_count << "):\n";
  std::unordered_map<Lit, std::size_t> memo;
  for (const auto &n : nodes_) {
    if (n.type != Type::AND)
      continue;
    Lit canon = get_canonical_lit(n.literal);
    out << "  var " << std::setw(3) << get_variable_index(canon) << " (lit "
        << std::setw(3) << canon << "): fanin0=" << std::setw(3) << n.fanin0
        << " (" << (is_inverted(n.fanin0) ? "!" : " ")
        << get_variable_index(n.fanin0) << "), fanin1=" << std::setw(3)
        << n.fanin1 << " (" << (is_inverted(n.fanin1) ? "!" : " ")
        << get_variable_index(n.fanin1) << ") | depth=" << depth_of(canon, memo)
        << " | fanout=" << fanouts[canon] << "\n";
  }
  out << "====================================================================="
         "=========\n";
}

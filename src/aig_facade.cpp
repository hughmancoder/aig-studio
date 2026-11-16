#include "aig_facade.hpp"
#include "aig.hpp"
#include "expr.hpp"

#include <algorithm>
#include <cctype>
#include <cstdio>
#include <sstream>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <vector>

namespace {

std::string json_escape(const std::string &s) {
  std::string out;
  out.reserve(s.size() + 2);
  out += '"';
  for (unsigned char c : s) {
    switch (c) {
    case '"': out += "\\\""; break;
    case '\\': out += "\\\\"; break;
    case '\n': out += "\\n"; break;
    case '\r': out += "\\r"; break;
    case '\t': out += "\\t"; break;
    default:
      if (c < 0x20) {
        char buf[8];
        std::snprintf(buf, sizeof(buf), "\\u%04x", c);
        out += buf;
      } else {
        out += static_cast<char>(c);
      }
    }
  }
  out += '"';
  return out;
}

std::string node_id(const Aig &aig, Lit lit) {
  Lit c = Aig::get_canonical_lit(lit);
  if (c == 0)
    return "const0";
  auto it = aig.get_id_node_map().find(c);
  if (it != aig.get_id_node_map().end() && it->second.type == Aig::Type::INPUT)
    return "pi_" + std::to_string(c);
  return "and_" + std::to_string(c);
}

// Serialise the AIG as a node/edge list for the graph canvas.
std::string graph_json(const Aig &aig) {
  std::ostringstream o;
  bool uses_const = false;
  for (Lit out : aig.get_outputs())
    uses_const |= out <= 1;
  for (const auto &n : aig.get_nodes())
    if (n.type == Aig::Type::AND)
      uses_const |= n.fanin0 <= 1 || n.fanin1 <= 1;

  // Per-node logic level (inputs = 0), nodes_ are in topological order.
  std::unordered_map<Lit, int> level;
  auto lvl = [&](Lit l) {
    auto it = level.find(Aig::get_canonical_lit(l));
    return it == level.end() ? 0 : it->second;
  };
  for (const auto &n : aig.get_nodes())
    if (n.type == Aig::Type::AND)
      level[n.literal] = 1 + std::max(lvl(n.fanin0), lvl(n.fanin1));

  o << "{\"nodes\":[";
  bool first = true;
  auto sep = [&] {
    if (!first)
      o << ',';
    first = false;
  };
  if (uses_const) {
    sep();
    o << "{\"id\":\"const0\",\"type\":\"CONST\",\"label\":\"0\",\"level\":0}";
  }
  const auto &ins = aig.get_inputs();
  for (std::size_t i = 0; i < ins.size(); ++i) {
    sep();
    o << "{\"id\":" << json_escape(node_id(aig, ins[i])) << ",\"type\":\"PI\",\"label\":"
      << json_escape(aig.get_input_name(i)) << ",\"level\":0}";
  }
  for (const auto &n : aig.get_nodes()) {
    if (n.type != Aig::Type::AND)
      continue;
    sep();
    o << "{\"id\":" << json_escape(node_id(aig, n.literal)) << ",\"type\":\"AND\",\"label\":\"&\""
      << ",\"level\":" << level[n.literal] << "}";
  }
  const auto &outs = aig.get_outputs();
  for (std::size_t i = 0; i < outs.size(); ++i) {
    sep();
    o << "{\"id\":\"po_" << i << "\",\"type\":\"PO\",\"label\":" << json_escape(aig.get_output_name(i))
      << ",\"level\":" << lvl(outs[i]) + 1 << "}";
  }

  o << "],\"edges\":[";
  first = true;
  int eid = 0;
  auto edge = [&](Lit src, const std::string &dst) {
    sep();
    o << "{\"id\":\"e" << eid++ << "\",\"source\":" << json_escape(node_id(aig, src))
      << ",\"target\":" << json_escape(dst) << ",\"inverted\":" << (Aig::is_inverted(src) ? "true" : "false")
      << "}";
  };
  for (const auto &n : aig.get_nodes()) {
    if (n.type != Aig::Type::AND)
      continue;
    std::string dst = node_id(aig, n.literal);
    edge(n.fanin0, dst);
    edge(n.fanin1, dst);
  }
  for (std::size_t i = 0; i < outs.size(); ++i)
    edge(outs[i], "po_" + std::to_string(i));
  o << "]}";
  return o.str();
}

std::vector<std::string> split_recipe(const std::string &recipe) {
  std::vector<std::string> passes;
  std::string cur;
  for (char c : recipe) {
    if (c == ',' || c == ';' || std::isspace(static_cast<unsigned char>(c))) {
      if (!cur.empty())
        passes.push_back(cur);
      cur.clear();
    } else {
      cur += static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    }
  }
  if (!cur.empty())
    passes.push_back(cur);
  return passes;
}

void apply_pass(Aig &aig, const std::string &p) {
  if (p == "strash" || p == "st")
    aig.strash();
  else if (p == "sweep")
    aig.sweep();
  else if (p == "balance" || p == "b")
    aig.balance();
  else if (p == "rewrite" || p == "rw")
    aig.rewrite(false);
  else if (p == "rewrite_z" || p == "rwz" || p == "zero_cost_rewrite")
    aig.rewrite(true);
  else if (p == "optimize" || p == "opt")
    aig.optimize();
  else
    throw std::runtime_error("Unknown pass '" + p +
                             "' (expected strash, sweep, balance, rewrite, rewrite_z, optimize)");
}

// Exhaustive functional equivalence check (null if too many inputs).
std::string check_equivalence(const Aig &a, const Aig &b) {
  const std::size_t n = a.get_inputs().size();
  if (n != b.get_inputs().size())
    return "false";
  if (n > 16)
    return "null";
  std::vector<bool> bits(n);
  for (uint32_t row = 0; row < (1u << n); ++row) {
    for (std::size_t i = 0; i < n; ++i)
      bits[i] = (row >> (n - 1 - i)) & 1u;
    if (a.evaluate_aig(bits) != b.evaluate_aig(bits))
      return "false";
  }
  return "true";
}

std::string trim(const std::string &s) {
  auto b = s.find_first_not_of(" \t\r\n");
  if (b == std::string::npos)
    return "";
  auto e = s.find_last_not_of(" \t\r\n");
  return s.substr(b, e - b + 1);
}

std::string join_outputs(const std::vector<expr::OutputExpr> &v, bool named) {
  std::string s;
  for (std::size_t i = 0; i < v.size(); ++i) {
    if (i)
      s += "; ";
    s += named ? v[i].name + " = " + v[i].expression : v[i].expression;
  }
  return s;
}

std::string error_json(const std::string &equation, const std::string &msg) {
  return "{\"status\":\"error\",\"error_message\":" + json_escape(msg) +
         ",\"original_expr\":" + json_escape(trim(equation)) +
         ",\"simplified_expr\":\"\",\"outputs\":[],\"passes_applied\":[],\"equivalent\":null,"
         "\"stats\":{\"initial_and_nodes\":0,\"final_and_nodes\":0,\"initial_levels\":0,"
         "\"final_levels\":0,\"num_inputs\":0,\"num_outputs\":0},"
         "\"initial_graph\":{\"nodes\":[],\"edges\":[]},\"graph\":{\"nodes\":[],\"edges\":[]}}";
}

} // namespace

std::string process_equation(const std::string &equation, const std::string &pass_recipe) {
  try {
    Aig initial;
    expr::parse_into(initial, equation, expr::BuildMode::Raw);

    const auto passes = split_recipe(pass_recipe);
    Aig final_aig = initial;
    for (const auto &p : passes)
      apply_pass(final_aig, p);

    const auto orig_exprs = expr::outputs_to_strings(initial);
    const auto simp_exprs = expr::outputs_to_strings(final_aig);
    // A single unnamed expression echoes back without the implicit "F = ".
    const bool named = !(orig_exprs.size() == 1 && equation.find('=') == std::string::npos);

    std::ostringstream o;
    o << "{\"status\":\"ok\",\"error_message\":\"\""
      << ",\"original_expr\":" << json_escape(trim(equation))
      << ",\"simplified_expr\":" << json_escape(join_outputs(simp_exprs, named));

    o << ",\"outputs\":[";
    for (std::size_t i = 0; i < simp_exprs.size(); ++i) {
      if (i)
        o << ',';
      o << "{\"name\":" << json_escape(simp_exprs[i].name)
        << ",\"original\":" << json_escape(orig_exprs[i].expression)
        << ",\"simplified\":" << json_escape(simp_exprs[i].expression) << "}";
    }
    o << "],\"passes_applied\":[";
    for (std::size_t i = 0; i < passes.size(); ++i)
      o << (i ? "," : "") << json_escape(passes[i]);
    o << "],\"equivalent\":" << check_equivalence(initial, final_aig);

    o << ",\"stats\":{\"initial_and_nodes\":" << initial.count_and_gates()
      << ",\"final_and_nodes\":" << final_aig.count_and_gates()
      << ",\"initial_levels\":" << initial.compute_depth()
      << ",\"final_levels\":" << final_aig.compute_depth()
      << ",\"num_inputs\":" << final_aig.get_inputs().size()
      << ",\"num_outputs\":" << final_aig.get_outputs().size() << "}";

    o << ",\"initial_graph\":" << graph_json(initial) << ",\"graph\":" << graph_json(final_aig) << "}";
    return o.str();
  } catch (const std::exception &e) {
    return error_json(equation, e.what());
  }
}

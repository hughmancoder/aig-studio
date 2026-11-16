#include "blif.hpp"
#include "aig.hpp"
#include <algorithm>
#include <cctype>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <vector>

namespace {

// Helper to trim whitespace from both ends
std::string trim(const std::string &s) {
  size_t start = 0;
  while (start < s.size() && std::isspace(static_cast<unsigned char>(s[start]))) {
    start++;
  }
  size_t end = s.size();
  while (end > start && std::isspace(static_cast<unsigned char>(s[end - 1]))) {
    end--;
  }
  return s.substr(start, end - start);
}

// Intermediate representation of a BLIF .names gate
struct BlifGate {
  std::string output;
  std::vector<std::string> inputs;
  std::vector<std::pair<std::string, char>> cubes; // pattern and output char ('0' or '1')
};

} // namespace

void Aig::parse_blif(std::istream &in) {
  clear();

  std::vector<std::string> logical_lines;
  std::string current_line;
  std::string raw_line;

  // 1. Join line continuations with backslash '\' and strip comments '#'
  while (std::getline(in, raw_line)) {
    size_t comment_pos = raw_line.find('#');
    if (comment_pos != std::string::npos) {
      raw_line = raw_line.substr(0, comment_pos);
    }
    raw_line = trim(raw_line);
    if (raw_line.empty()) {
      continue;
    }

    if (raw_line.back() == '\\') {
      raw_line.pop_back();
      current_line += " " + trim(raw_line);
    } else {
      current_line += " " + raw_line;
      std::string t = trim(current_line);
      if (!t.empty()) {
        logical_lines.push_back(t);
      }
      current_line.clear();
    }
  }
  if (!current_line.empty()) {
    std::string t = trim(current_line);
    if (!t.empty()) {
      logical_lines.push_back(t);
    }
  }

  // 2. Parse commands
  std::vector<std::string> input_order;
  std::vector<std::string> output_order;
  std::unordered_map<std::string, BlifGate> gate_map;
  std::unordered_map<std::string, Lit> sig_to_lit;

  BlifGate current_gate;
  bool in_gate = false;

  for (const auto &line : logical_lines) {
    if (line[0] == '.') {
      if (in_gate) {
        gate_map[current_gate.output] = current_gate;
        in_gate = false;
        current_gate = BlifGate{};
      }

      std::stringstream ss(line);
      std::string cmd;
      ss >> cmd;

      if (cmd == ".model") {
        std::string m;
        if (ss >> m) {
          model_name_ = m;
        }
      } else if (cmd == ".inputs") {
        std::string name;
        while (ss >> name) {
          input_order.push_back(name);
        }
      } else if (cmd == ".outputs") {
        std::string name;
        while (ss >> name) {
          output_order.push_back(name);
        }
      } else if (cmd == ".names") {
        in_gate = true;
        std::vector<std::string> tokens;
        std::string tok;
        while (ss >> tok) {
          tokens.push_back(tok);
        }
        if (tokens.empty()) {
          throw std::runtime_error("Malformed .names line with no tokens");
        }
        current_gate.output = tokens.back();
        for (size_t i = 0; i + 1 < tokens.size(); ++i) {
          current_gate.inputs.push_back(tokens[i]);
        }
      } else if (cmd == ".end") {
        break;
      }
    } else {
      // PLA truth table cube row for the current gate
      if (in_gate) {
        std::stringstream ss(line);
        std::string pat;
        std::string val = "1";
        ss >> pat;
        if (ss >> val) {
          current_gate.cubes.push_back({pat, val[0]});
        } else {
          // If only 1 token, e.g. "1" for a 0-input constant gate or single char
          if (current_gate.inputs.empty()) {
            current_gate.cubes.push_back({"", pat[0]});
          } else {
            current_gate.cubes.push_back({pat, '1'});
          }
        }
      }
    }
  }

  if (in_gate) {
    gate_map[current_gate.output] = current_gate;
  }

  // 3. Add primary inputs
  for (size_t i = 0; i < input_order.size(); ++i) {
    Lit in_lit = static_cast<Lit>(2 * (i + 1));
    add_input_node(in_lit, input_order[i]);
    sig_to_lit[input_order[i]] = in_lit;
  }

  // 4. Resolve signals in topological order using DFS
  std::unordered_set<std::string> visiting;

  auto resolve_signal = [&](auto &self, const std::string &sig) -> Lit {
    if (sig == "0" || sig == "$false" || sig == "GND")
      return 0;
    if (sig == "1" || sig == "$true" || sig == "VCC")
      return 1;

    auto it = sig_to_lit.find(sig);
    if (it != sig_to_lit.end()) {
      return it->second;
    }

    auto git = gate_map.find(sig);
    if (git == gate_map.end()) {
      throw std::runtime_error("Undefined signal in BLIF: '" + sig + "'");
    }

    if (visiting.count(sig)) {
      throw std::runtime_error("Combinational cycle detected involving signal '" +
                               sig + "'");
    }
    visiting.insert(sig);

    const auto &gate = git->second;
    Lit result_lit = 0;

    if (gate.cubes.empty()) {
      // No cubes means constant 0
      result_lit = 0;
    } else if (gate.inputs.empty()) {
      // Constant gate
      char out_c = gate.cubes[0].second;
      result_lit = (out_c == '1') ? 1 : 0;
    } else {
      bool is_offset = false;
      Lit accumulated_or = 0;
      bool first_cube = true;

      for (const auto &cube : gate.cubes) {
        const std::string &pat = cube.first;
        char out_c = cube.second;
        if (out_c == '0') {
          is_offset = true;
        }

        Lit cube_term = 1;
        for (size_t j = 0; j < pat.size() && j < gate.inputs.size(); ++j) {
          char bit = pat[j];
          if (bit == '-') {
            continue; // don't care
          }
          Lit in_lit = self(self, gate.inputs[j]);
          if (bit == '1') {
            cube_term = get_or_create_and(cube_term, in_lit);
          } else if (bit == '0') {
            cube_term = get_or_create_and(cube_term, negate(in_lit));
          }
        }

        if (first_cube) {
          accumulated_or = cube_term;
          first_cube = false;
        } else {
          // A OR B = !(!A & !B)
          accumulated_or =
              negate(get_or_create_and(negate(accumulated_or), negate(cube_term)));
        }
      }

      if (is_offset) {
        accumulated_or = negate(accumulated_or);
      }
      result_lit = accumulated_or;
    }

    visiting.erase(sig);
    sig_to_lit[sig] = result_lit;
    set_node_name(result_lit, sig);
    return result_lit;
  };

  // 5. Connect primary outputs
  for (const auto &out_name : output_order) {
    Lit out_lit = resolve_signal(resolve_signal, out_name);
    add_output_node(out_lit, out_name);
  }
}

void Aig::write_blif(std::ostream &out, const std::string &model_name) const {
  std::string name = model_name.empty() ? model_name_ : model_name;
  if (name.empty()) {
    name = "top";
  }

  out << ".model " << name << "\n";

  // Inputs
  out << ".inputs";
  for (size_t i = 0; i < inputs_.size(); ++i) {
    out << " " << get_input_name(i);
  }
  out << "\n";

  // Outputs
  out << ".outputs";
  for (size_t i = 0; i < outputs_.size(); ++i) {
    out << " " << get_output_name(i);
  }
  out << "\n";

  // Helper to format signal name: use distinct internal names for AND gates (n<canon>)
  // to avoid colliding with primary output names
  auto get_sig_name = [this](Lit lit) -> std::string {
    Lit canon = get_canonical_lit(lit);
    for (size_t i = 0; i < inputs_.size(); ++i) {
      if (get_canonical_lit(inputs_[i]) == canon) {
        return get_input_name(i);
      }
    }
    return "n" + std::to_string(canon);
  };

  // AND gates
  for (const auto &n : nodes_) {
    if (n.type != Type::AND)
      continue;
    std::string out_name = get_sig_name(n.literal);
    std::string in0_name = get_sig_name(n.fanin0);
    std::string in1_name = get_sig_name(n.fanin1);

    char b0 = is_inverted(n.fanin0) ? '0' : '1';
    char b1 = is_inverted(n.fanin1) ? '0' : '1';

    out << ".names " << in0_name << " " << in1_name << " " << out_name << "\n";
    out << b0 << b1 << " 1\n";
  }

  // Connect outputs
  for (size_t i = 0; i < outputs_.size(); ++i) {
    Lit out_lit = outputs_[i];
    std::string out_name = get_output_name(i);

    if (out_lit == 0) {
      out << ".names " << out_name << "\n";
    } else if (out_lit == 1) {
      out << ".names " << out_name << "\n1\n";
    } else {
      std::string driver_name = get_sig_name(out_lit);
      char b = is_inverted(out_lit) ? '0' : '1';
      out << ".names " << driver_name << " " << out_name << "\n";
      out << b << " 1\n";
    }
  }

  out << ".end\n";
}

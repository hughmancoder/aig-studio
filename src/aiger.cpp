#include "aiger.hpp"
#include "aig.hpp"
#include <algorithm>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>

namespace aiger {

Lit decode_delta(std::istream &in) {
  Lit delta = 0;
  unsigned shift = 0;
  unsigned char byte = 0;
  while (in.get(reinterpret_cast<char &>(byte))) {
    delta |= static_cast<Lit>(byte & 0x7Fu) << shift;
    if ((byte & 0x80u) == 0) {
      return delta;
    }
    shift += 7;
    if (shift >= 32) {
      break;
    }
  }
  return delta;
}

void encode_delta(Lit delta, std::ostream &out) {
  while (delta & ~0x7Fu) {
    out.put(static_cast<char>((delta & 0x7Fu) | 0x80u));
    delta >>= 7;
  }
  out.put(static_cast<char>(delta & 0x7Fu));
}

} // namespace aiger

void Aig::parse_aag_and_construct(std::istream &in) {
  parse_aag(in);
}

void Aig::parse_aag(std::istream &in) {
  clear();

  std::string header;
  if (!(in >> header)) {
    throw std::runtime_error("Empty or invalid stream for AAG");
  }
  if (header != "aag") {
    throw std::runtime_error("Expected 'aag' header, got '" + header + "'");
  }

  int M, I, L, O, A;
  if (!(in >> M >> I >> L >> O >> A)) {
    throw std::runtime_error("Invalid AAG header dimensions");
  }

  inputs_.reserve(I);
  outputs_.reserve(O);
  nodes_.reserve(static_cast<size_t>(I + O + A));
  id_node_map_.reserve(static_cast<size_t>(I + A));

  // Inputs
  for (int i = 0; i < I; ++i) {
    Lit id;
    in >> id;
    add_input_node(id);
  }

  // Latches (skip)
  for (int i = 0; i < L; ++i) {
    Lit out_lit, in_lit;
    in >> out_lit >> in_lit;
  }

  // Outputs
  for (int i = 0; i < O; ++i) {
    Lit driver;
    in >> driver;
    add_output_node(driver);
  }

  // AND gates
  for (int i = 0; i < A; ++i) {
    Lit id, l, r;
    in >> id >> l >> r;
    add_and_gate(id, l, r);
  }

  // Symbol table and comments
  std::string line;
  while (std::getline(in, line)) {
    if (line.empty())
      continue;
    if (line[0] == 'c') {
      break; // Comments section
    }
    if (line[0] == 'i' || line[0] == 'o') {
      std::stringstream ss(line);
      char kind;
      size_t idx;
      std::string name;
      if (ss >> kind >> idx >> name) {
        if (kind == 'i')
          set_input_name(idx, name);
        else if (kind == 'o')
          set_output_name(idx, name);
      }
    }
  }
}

void Aig::read_aiger_binary(std::istream &in) {
  clear();

  std::string header;
  if (!(in >> header)) {
    throw std::runtime_error("Empty or invalid stream for binary AIGER");
  }
  if (header != "aig") {
    throw std::runtime_error("Expected 'aig' header, got '" + header + "'");
  }

  int M, I, L, O, A;
  if (!(in >> M >> I >> L >> O >> A)) {
    throw std::runtime_error("Invalid binary AIGER header dimensions");
  }

  // Read optional B C J F if on the same header line
  std::string rest_header;
  std::getline(in, rest_header);

  inputs_.reserve(I);
  outputs_.reserve(O);
  nodes_.reserve(static_cast<size_t>(I + O + A));
  id_node_map_.reserve(static_cast<size_t>(I + A));

  // In binary AIGER, inputs are implicitly literals 2, 4, ..., 2*I
  for (int i = 1; i <= I; ++i) {
    add_input_node(static_cast<Lit>(2 * i));
  }

  // Latches: L ASCII lines
  for (int i = 0; i < L; ++i) {
    std::string latch_line;
    std::getline(in, latch_line);
  }

  // Outputs: O ASCII lines
  for (int i = 0; i < O; ++i) {
    Lit driver;
    if (!(in >> driver)) {
      throw std::runtime_error("Failed to read output literal in binary AIGER");
    }
    add_output_node(driver);
  }

  // Consume the single trailing newline character after the last output literal
  int c = in.get();
  if (c == '\r') {
    c = in.get();
  }

  // Binary AND gates: exactly A gates
  for (int i = 0; i < A; ++i) {
    Lit var = static_cast<Lit>(I + L + 1 + i);
    Lit lhs = 2 * var;

    Lit delta0 = aiger::decode_delta(in);
    Lit delta1 = aiger::decode_delta(in);

    if (delta0 > lhs) {
      throw std::runtime_error("Invalid delta0 in binary AIGER: delta0 > lhs");
    }
    Lit rhs0 = lhs - delta0;
    if (delta1 > rhs0) {
      throw std::runtime_error("Invalid delta1 in binary AIGER: delta1 > rhs0");
    }
    Lit rhs1 = rhs0 - delta1;

    add_and_gate(lhs, rhs0, rhs1);
  }

  // Parse optional symbol table and comments
  std::string sym_line;
  while (std::getline(in, sym_line)) {
    if (sym_line.empty())
      continue;
    if (sym_line[0] == 'c') {
      break; // Comments section
    }
    if (sym_line[0] == 'i' || sym_line[0] == 'o') {
      std::stringstream ss(sym_line);
      char kind;
      size_t idx;
      std::string name;
      if (ss >> kind >> idx >> name) {
        if (kind == 'i')
          set_input_name(idx, name);
        else if (kind == 'o')
          set_output_name(idx, name);
      }
    }
  }
}

void Aig::write_aag(std::ostream &out) const {
  const std::size_t I = inputs_.size();
  const std::size_t L = 0;
  const std::size_t O = outputs_.size();
  std::size_t A = 0;
  for (const auto &n : nodes_) {
    if (n.type == Type::AND)
      A++;
  }

  uint32_t max_idx = 0;
  auto update_max = [&](Lit lit) {
    if (lit > 1) {
      max_idx = std::max(max_idx, static_cast<uint32_t>(get_variable_index(lit)));
    }
  };

  for (auto in : inputs_)
    update_max(in);
  for (auto outL : outputs_)
    update_max(outL);
  for (const auto &n : nodes_) {
    if (n.type == Type::AND) {
      update_max(n.literal);
      update_max(n.fanin0);
      update_max(n.fanin1);
    }
  }

  out << "aag " << max_idx << " " << I << " " << L << " " << O << " " << A << "\n";

  for (auto in : inputs_)
    out << get_canonical_lit(in) << "\n";

  for (auto outL : outputs_)
    out << outL << "\n";

  std::vector<AigNode> ands;
  ands.reserve(A);
  for (const auto &n : nodes_) {
    if (n.type == Type::AND)
      ands.push_back(n);
  }

  std::sort(ands.begin(), ands.end(),
            [](const AigNode &a, const AigNode &b) {
              return a.literal < b.literal;
            });

  for (const auto &n : ands) {
    out << n.literal << " " << n.fanin0 << " " << n.fanin1 << "\n";
  }

  // Symbol table
  for (size_t i = 0; i < input_names_.size(); ++i) {
    if (!input_names_[i].empty()) {
      out << "i" << i << " " << input_names_[i] << "\n";
    }
  }
  for (size_t i = 0; i < output_names_.size(); ++i) {
    if (!output_names_[i].empty()) {
      out << "o" << i << " " << output_names_[i] << "\n";
    }
  }
  out << "c\nGenerated by AIG package\n";
}

void Aig::write_aig(std::ostream &out) const {
  // Binary AIGER requires contiguous numbering: inputs 1..I, ANDs I+1..I+A
  // Make a compacted copy
  Aig net = *this;
  net.compact();

  size_t I = net.inputs_.size();
  size_t L = 0;
  size_t O = net.outputs_.size();
  size_t A = 0;
  for (const auto &n : net.nodes_) {
    if (n.type == Type::AND)
      A++;
  }
  uint32_t M = static_cast<uint32_t>(I + A);

  out << "aig " << M << " " << I << " " << L << " " << O << " " << A << "\n";

  for (Lit out_lit : net.outputs_) {
    out << out_lit << "\n";
  }

  for (const auto &n : net.nodes_) {
    if (n.type != Type::AND)
      continue;
    Lit lhs = n.literal;
    Lit f0 = n.fanin0;
    Lit f1 = n.fanin1;

    Lit rhs0 = std::max(f0, f1);
    Lit rhs1 = std::min(f0, f1);

    Lit delta0 = lhs - rhs0;
    Lit delta1 = rhs0 - rhs1;

    aiger::encode_delta(delta0, out);
    aiger::encode_delta(delta1, out);
  }

  // Symbol table
  for (size_t i = 0; i < net.input_names_.size(); ++i) {
    if (!net.input_names_[i].empty()) {
      out << "i" << i << " " << net.input_names_[i] << "\n";
    }
  }
  for (size_t i = 0; i < net.output_names_.size(); ++i) {
    if (!net.output_names_[i].empty()) {
      out << "o" << i << " " << net.output_names_[i] << "\n";
    }
  }
  out << "c\nGenerated by AIG package (binary)\n";
}

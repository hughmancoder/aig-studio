#include "aig.hpp"
#include <algorithm>
#include <cctype>
#include <cstddef>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>

void Aig::clear() {
  inputs_.clear();
  outputs_.clear();
  nodes_.clear();
  id_node_map_.clear();
  unique_table_.clear();
  input_names_.clear();
  output_names_.clear();
  node_names_.clear();
  model_name_ = "top";
  max_var_ = 0;
}

void Aig::parse(std::istream &in) {
  // Peek at the first non-whitespace character / token to determine format
  std::string first_token;
  while (in >> first_token) {
    if (first_token.empty())
      continue;
    if (first_token[0] == '#') {
      // BLIF or AIGER comment, skip line
      std::string line;
      std::getline(in, line);
      continue;
    }
    break;
  }

  if (first_token.empty()) {
    throw std::runtime_error("Empty input stream in Aig::parse");
  }

  // Prepend the first token back by putting it into a combined stream or handling
  if (first_token == "aag") {
    // Put back "aag "
    std::string rest;
    std::getline(in, rest);
    std::string full_first_line = first_token + rest;
    std::stringstream ss;
    ss << full_first_line << "\n" << in.rdbuf();
    parse_aag(ss);
  } else if (first_token == "aig") {
    std::string rest;
    std::getline(in, rest);
    std::string full_first_line = first_token + rest;
    std::stringstream ss;
    ss << full_first_line << "\n" << in.rdbuf();
    read_aiger_binary(ss);
  } else if (first_token[0] == '.' || first_token.find(".model") != std::string::npos ||
             first_token.find(".inputs") != std::string::npos ||
             first_token.find(".names") != std::string::npos) {
    std::string rest;
    std::getline(in, rest);
    std::string full_first_line = first_token + rest;
    std::stringstream ss;
    ss << full_first_line << "\n" << in.rdbuf();
    parse_blif(ss);
  } else {
    throw std::runtime_error("Unknown format header: '" + first_token + "'");
  }
}

void Aig::add_input_node(Lit id, const std::string &name) {
  Lit canon = get_canonical_lit(id);
  AigNode node;
  node.type = Type::INPUT;
  node.literal = canon;
  node.fanin0 = 0;
  node.fanin1 = 0;

  inputs_.push_back(canon);
  nodes_.push_back(node);
  id_node_map_[canon] = node;

  uint32_t var = static_cast<uint32_t>(get_variable_index(canon));
  if (var > max_var_)
    max_var_ = var;

  if (!name.empty()) {
    input_names_.resize(inputs_.size());
    input_names_.back() = name;
    node_names_[canon] = name;
  }
}

void Aig::add_output_node(Lit driver_lit, const std::string &name) {
  AigNode node;
  node.type = Type::OUTPUT;
  node.literal = 0;
  node.fanin0 = driver_lit;
  node.fanin1 = 0;

  outputs_.push_back(driver_lit);
  nodes_.push_back(node);

  if (!name.empty()) {
    output_names_.resize(outputs_.size());
    output_names_.back() = name;
  }
}

void Aig::add_and_gate(Lit id, Lit l, Lit r) {
  Lit canon = get_canonical_lit(id);
  AigNode node;
  node.type = Type::AND;
  node.literal = canon;
  node.fanin0 = l;
  node.fanin1 = r;

  nodes_.push_back(node);
  id_node_map_[canon] = node;

  uint32_t var = static_cast<uint32_t>(get_variable_index(canon));
  if (var > max_var_)
    max_var_ = var;

  Lit f0 = l;
  Lit f1 = r;
  if (f0 > f1)
    std::swap(f0, f1);
  unique_table_[std::make_pair(f0, f1)] = canon;
}

void Aig::set_input_name(size_t index, const std::string &name) {
  if (index >= inputs_.size())
    return;
  if (input_names_.size() < inputs_.size())
    input_names_.resize(inputs_.size());
  input_names_[index] = name;
  node_names_[inputs_[index]] = name;
}

std::string Aig::get_input_name(size_t index) const {
  if (index < input_names_.size() && !input_names_[index].empty()) {
    return input_names_[index];
  }
  return "x" + std::to_string(index + 1);
}

void Aig::set_output_name(size_t index, const std::string &name) {
  if (index >= outputs_.size())
    return;
  if (output_names_.size() < outputs_.size())
    output_names_.resize(outputs_.size());
  output_names_[index] = name;
}

std::string Aig::get_output_name(size_t index) const {
  if (index < output_names_.size() && !output_names_[index].empty()) {
    return output_names_[index];
  }
  return "y" + std::to_string(index + 1);
}

void Aig::set_node_name(Lit lit, const std::string &name) {
  node_names_[get_canonical_lit(lit)] = name;
}

std::string Aig::get_node_name(Lit lit) const {
  Lit canon = get_canonical_lit(lit);
  auto it = node_names_.find(canon);
  if (it != node_names_.end()) {
    return it->second;
  }
  return "n" + std::to_string(canon);
}

std::size_t Aig::depth_of(Lit lit,
                          std::unordered_map<Lit, std::size_t> &memo) const {
  if (lit <= 1)
    return 0;

  Lit node_id = get_canonical_lit(lit);
  auto it = memo.find(node_id);
  if (it != memo.end())
    return it->second;

  auto nit = id_node_map_.find(node_id);
  if (nit == id_node_map_.end() || nit->second.type != Type::AND) {
    return memo[node_id] = 0;
  }

  const auto &node = nit->second;
  std::size_t left_depth = depth_of(node.fanin0, memo);
  std::size_t right_depth = depth_of(node.fanin1, memo);

  return memo[node_id] = 1 + std::max(left_depth, right_depth);
}

int Aig::compute_depth() const {
  std::unordered_map<Lit, std::size_t> memo;
  memo.reserve(id_node_map_.size());

  std::size_t maxDepth = 0;
  for (Lit out : outputs_) {
    maxDepth = std::max(maxDepth, depth_of(out, memo));
  }
  return static_cast<int>(maxDepth);
}

std::unordered_map<Lit, std::size_t> Aig::compute_fanout_counts() const {
  std::unordered_map<Lit, std::size_t> fanouts;
  fanouts.reserve(nodes_.size());

  auto inc = [&](Lit lit) {
    if (lit > 1) {
      fanouts[get_canonical_lit(lit)]++;
    }
  };

  for (const auto &n : nodes_) {
    if (n.type == Type::AND) {
      inc(n.fanin0);
      inc(n.fanin1);
    }
  }
  for (Lit out : outputs_) {
    inc(out);
  }
  return fanouts;
}

std::size_t
Aig::get_max_fanout(const std::unordered_map<Lit, std::size_t> &fanout) const {
  std::size_t max_fo = 0;
  for (const auto &kv : fanout) {
    if (kv.second > max_fo)
      max_fo = kv.second;
  }
  return max_fo;
}

std::size_t Aig::get_max_fanout() const {
  auto fo = compute_fanout_counts();
  return get_max_fanout(fo);
}

void Aig::print_stats() const {
  std::size_t andCnt = 0;
  for (const auto &n : nodes_) {
    if (n.type == Type::AND)
      andCnt++;
  }

  std::size_t max_fo = get_max_fanout();

  std::cout << "Model        : " << model_name_     << '\n'
            << "Inputs       : " << inputs_.size()  << '\n'
            << "Outputs      : " << outputs_.size() << '\n'
            << "AND gates    : " << andCnt          << '\n'
            << "Depth        : " << compute_depth() << '\n'
            << "Max Fan-out  : " << max_fo          << '\n';
}

std::vector<std::vector<bool>> Aig::enumerate_inputs(size_t numInputs) const {
  if (numInputs >= 31) {
    throw std::runtime_error("enumerate_inputs supports up to 30 inputs");
  }
  const size_t numRows = 1u << numInputs;
  std::vector<std::vector<bool>> truthTable;
  truthTable.reserve(numRows);

  for (size_t i = 0; i < numRows; ++i) {
    std::vector<bool> row;
    row.reserve(numInputs);
    for (int bit = static_cast<int>(numInputs) - 1; bit >= 0; bit--) {
      row.push_back((i >> bit) & 1u);
    }
    truthTable.push_back(std::move(row));
  }
  return truthTable;
}

std::vector<std::vector<bool>> Aig::generate_truth_table() const {
  auto input_boolean = enumerate_inputs(inputs_.size());
  std::vector<std::vector<bool>> table;
  table.reserve(input_boolean.size());

  for (const auto &inBits : input_boolean) {
    std::vector<bool> row = inBits;
    auto outs = evaluate_aig(inBits);
    row.insert(row.end(), outs.begin(), outs.end());
    table.push_back(std::move(row));
  }
  return table;
}

void Aig::display_truth_table(const std::vector<std::vector<bool>> &tt,
                              size_t numInputs) const {
  if (numInputs == 0) {
    numInputs = inputs_.size();
  }

  for (const auto &row : tt) {
    for (size_t i = 0; i < row.size(); ++i) {
      std::cout << row[i];
      if (i == numInputs - 1) {
        std::cout << " | ";
      } else if (i + 1 < row.size()) {
        std::cout << " ";
      }
    }
    std::cout << "\n";
  }
}

std::vector<bool> Aig::evaluate_aig(const std::vector<bool> &inputBits) const {
  if (inputBits.size() != inputs_.size()) {
    throw std::runtime_error("evaluate_aig: input vector size (" +
                             std::to_string(inputBits.size()) +
                             ") does not match primary input count (" +
                             std::to_string(inputs_.size()) + ")");
  }

  std::unordered_map<int, bool> val_map;
  val_map.reserve(nodes_.size() + 2);

  for (size_t i = 0; i < inputBits.size(); ++i) {
    val_map[get_variable_index(inputs_[i])] = inputBits[i];
  }

  auto eval_lit = [&](Lit lit) -> bool {
    if (lit == 0)
      return false;
    if (lit == 1)
      return true;
    bool val = val_map[get_variable_index(lit)];
    return is_inverted(lit) ? !val : val;
  };

  for (const auto &n : nodes_) {
    if (n.type != Type::AND)
      continue;
    bool lhs = eval_lit(n.fanin0);
    bool rhs = eval_lit(n.fanin1);
    val_map[get_variable_index(n.literal)] = lhs && rhs;
  }

  std::vector<bool> out_vals;
  out_vals.reserve(outputs_.size());
  for (Lit out : outputs_) {
    out_vals.push_back(eval_lit(out));
  }
  return out_vals;
}

bool Aig::is_topologically_sorted() const {
  std::unordered_set<Lit> defined;
  defined.insert(0); // const 0
  defined.insert(1); // const 1

  for (Lit in : inputs_) {
    defined.insert(get_canonical_lit(in));
  }

  for (const auto &n : nodes_) {
    if (n.type == Type::AND) {
      Lit c0 = get_canonical_lit(n.fanin0);
      Lit c1 = get_canonical_lit(n.fanin1);
      if (defined.find(c0) == defined.end() ||
          defined.find(c1) == defined.end()) {
        return false;
      }
      defined.insert(get_canonical_lit(n.literal));
    }
  }

  for (Lit out : outputs_) {
    Lit c = get_canonical_lit(out);
    if (defined.find(c) == defined.end()) {
      return false;
    }
  }

  return true;
}

void Aig::rebuild_unique_table() {
  unique_table_.clear();
  for (const auto &n : nodes_) {
    if (n.type == Type::AND) {
      Lit f0 = n.fanin0;
      Lit f1 = n.fanin1;
      if (f0 > f1)
        std::swap(f0, f1);
      unique_table_[std::make_pair(f0, f1)] = get_canonical_lit(n.literal);
    }
  }
}
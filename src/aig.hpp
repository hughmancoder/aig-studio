#ifndef AIG_HPP
#define AIG_HPP

#include <cstddef>
#include <cstdint>
#include <iostream>
#include <istream>
#include <ostream>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>

using Lit = uint32_t;

// Hash functor for pairs of literals (used by structural hashing unique table)
struct PairHash {
  std::size_t operator()(const std::pair<Lit, Lit> &p) const noexcept {
    return std::hash<Lit>()(p.first) ^
           (std::hash<Lit>()(p.second) + 0x9e3779b9u + (p.first << 6) +
            (p.first >> 2));
  }
};

class Aig {
public:
  enum class Type { INPUT, AND, OUTPUT };

  static int get_variable_index(Lit lit) { return static_cast<int>(lit >> 1); }
  static bool is_inverted(Lit lit) { return (lit & 1u) != 0; }
  static Lit get_canonical_lit(Lit lit) { return lit & ~1u; }
  static Lit negate(Lit lit) { return lit ^ 1u; }

  struct AigNode {
    Type type;
    Lit literal;    // even for input / and
    Lit fanin0 = 0; // left child literal
    Lit fanin1 = 0; // right child literal
  };

  Aig() = default;

  // Clear all nodes and reset network state
  void clear();

  // Unified parser: auto-detects ASCII AIGER (.aag), binary AIGER (.aig), or BLIF (.blif)
  void parse(std::istream &in);

  // Explicit format parsers
  void parse_aag(std::istream &in);
  void read_aiger_binary(std::istream &in);
  void parse_binary(std::istream &in) { read_aiger_binary(in); }
  void parse_blif(std::istream &in);

  // Format writers
  void write_aag(std::ostream &out) const;
  void write_aig(std::ostream &out) const;
  void write_blif(std::ostream &out, const std::string &model_name = "") const;

  // Graph export & visualization
  void write_dot(std::ostream &out, const std::string &graph_name = "AIG") const;
  void print_tree(std::ostream &out = std::cout) const;
  void print_network(std::ostream &out = std::cout) const;

  // Node construction
  void add_input_node(Lit id, const std::string &name = "");
  void add_output_node(Lit driver_lit, const std::string &name = "");
  void add_and_gate(Lit id, Lit l, Lit r);

  // Structural hashing: returns existing canonical literal or creates new node
  Lit get_or_create_and(Lit fanin0, Lit fanin1);

  // Raw construction: always allocates a fresh AND node (no hashing, no folding).
  // Used to build the literal, unoptimised structure of a parsed expression.
  Lit create_and_raw(Lit fanin0, Lit fanin1);

  // Number of AND gates currently in the network
  std::size_t count_and_gates() const;

  // Transformations and optimizations
  // Sweep: removes dead nodes (unreachable from outputs) and merges duplicate nodes
  void sweep();

  // Strash: structural hashing pass rebuilding the network from inputs to outputs
  void strash();

  // Balance: uses associativity to balance deep/lopsided AND chains into minimum-depth trees
  void balance();

  // DAG-Aware Rewriting: computes 4-input cuts, evaluates 16-bit truth tables,
  // and replaces subgraphs with optimal AIG structures from a pre-computed database
  // zero_cost=true also accepts replacements that keep the gate count equal
  // (restructures logic so later passes can find further savings).
  void rewrite(bool zero_cost = false);

  // Optimize: combines strashing, two-level algebraic rewrites, and dead node sweep
  void optimize();

  // Compact: renumbers literals topologically to contiguous variables (1..I inputs, I+1..I+A gates)
  void compact();

  // Network verification
  bool is_topologically_sorted() const;

  // Accessors
  const std::vector<Lit> &get_inputs() const { return inputs_; }
  const std::vector<Lit> &get_outputs() const { return outputs_; }
  const std::vector<AigNode> &get_nodes() const { return nodes_; }
  const std::unordered_map<Lit, AigNode> &get_id_node_map() const {
    return id_node_map_;
  }

  // Model and signal naming
  void set_model_name(const std::string &name) { model_name_ = name; }
  const std::string &get_model_name() const { return model_name_; }

  void set_input_name(size_t index, const std::string &name);
  std::string get_input_name(size_t index) const;

  void set_output_name(size_t index, const std::string &name);
  std::string get_output_name(size_t index) const;

  void set_node_name(Lit lit, const std::string &name);
  std::string get_node_name(Lit lit) const;

  // Circuit analysis
  int compute_depth() const;
  std::unordered_map<Lit, std::size_t> compute_fanout_counts() const;
  std::size_t
  get_max_fanout(const std::unordered_map<Lit, std::size_t> &fanout) const;
  std::size_t get_max_fanout() const;
  void print_stats() const;

  // Truth table & simulation
  std::vector<std::vector<bool>> enumerate_inputs(size_t numInputs) const;
  std::vector<std::vector<bool>> generate_truth_table() const;
  void display_truth_table(const std::vector<std::vector<bool>> &tt,
                           size_t numInputs = 0) const;
  std::vector<bool> evaluate_aig(const std::vector<bool> &inputBits) const;

  // Unique table helper
  void rebuild_unique_table();

private:
  void parse_aag_and_construct(std::istream &in);
  std::size_t depth_of(Lit lit,
                       std::unordered_map<Lit, std::size_t> &memo) const;

  Lit get_next_available_lit();
  Lit rewrite_and(Lit f0, Lit f1);

  std::string model_name_ = "top";
  std::vector<Lit> inputs_;
  std::vector<Lit> outputs_;
  std::vector<AigNode> nodes_;
  std::unordered_map<Lit, AigNode> id_node_map_;

  // Structural hashing unique table
  std::unordered_map<std::pair<Lit, Lit>, Lit, PairHash> unique_table_;

  // Variable index tracking
  uint32_t max_var_ = 0;

  // Signal names
  std::vector<std::string> input_names_;
  std::vector<std::string> output_names_;
  std::unordered_map<Lit, std::string> node_names_;
};

#endif // AIG_HPP

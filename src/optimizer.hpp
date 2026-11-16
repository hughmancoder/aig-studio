#ifndef OPTIMIZER_HPP
#define OPTIMIZER_HPP

#include "aig.hpp"
#include <cstdint>
#include <unordered_map>
#include <vector>

namespace optimizer {

// A two-input AND gate in an optimal AIG template
// Inputs refer to leaf indices (0..k-1) or previously generated gates (k, k+1, ...)
struct TemplateGate {
  int in0;
  bool inv0;
  int in1;
  bool inv1;
};

// Optimal AIG structure representation for a Boolean function
struct OptimalAig {
  int num_inputs = 0;
  std::vector<TemplateGate> gates;
  bool root_inv = false;
  int root_idx = 0; // index of the root gate or leaf (0..k-1 for leaves, >=k for gates)
};

// Pre-computed database of optimal AIG structures indexed by 16-bit truth tables
class OptimalAigDatabase {
public:
  static OptimalAigDatabase &get_instance();

  const OptimalAig *lookup(uint16_t truth_table) const;

private:
  OptimalAigDatabase();
  void build_database();
  void register_template(uint16_t tt, const OptimalAig &templ);

  std::unordered_map<uint16_t, OptimalAig> db_;
};

} // namespace optimizer

#endif // OPTIMIZER_HPP

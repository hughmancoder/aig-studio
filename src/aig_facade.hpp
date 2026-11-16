#ifndef AIG_FACADE_HPP
#define AIG_FACADE_HPP

#include <string>

// Stateless facade over the AIG library used by the WebAssembly bindings and
// the native `aig simplify` CLI command. No pointers cross this boundary:
// everything goes in as strings and comes out as a JSON document.
//
//   equation    : one or more Boolean expressions, e.g. "(A & B) | (A & ~B)"
//                 or "S = A ^ B ^ C; Co = (A & B) | (C & (A ^ B))"
//   pass_recipe : comma/space separated passes applied in order:
//                 strash, sweep, balance, rewrite, rewrite_z (zero-cost), optimize
//
// Returned JSON schema (see web/src/lib/aigTypes.ts for the TypeScript mirror):
// {
//   "status": "ok" | "error", "error_message": "...",
//   "original_expr": "...", "simplified_expr": "...",
//   "outputs": [ { "name", "original", "simplified" } ],
//   "passes_applied": [ ... ],
//   "equivalent": true | false | null,   // exhaustive check for <= 16 inputs
//   "stats": { initial_and_nodes, final_and_nodes, initial_levels, final_levels,
//              num_inputs, num_outputs },
//   "initial_graph": { "nodes": [...], "edges": [...] },
//   "graph":         { "nodes": [...], "edges": [...] }
// }
std::string process_equation(const std::string &equation, const std::string &pass_recipe);

#endif // AIG_FACADE_HPP

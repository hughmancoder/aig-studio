#ifndef EXPR_HPP
#define EXPR_HPP

#include "aig.hpp"
#include <stdexcept>
#include <string>
#include <vector>

// Boolean expression <-> AIG translation.
//
// Grammar (C-like precedence, lowest to highest):
//   program := stmt ((';' | '\n') stmt)*
//   stmt    := [IDENT '='] or_expr          (unnamed outputs are called F, F1, F2, ...)
//   or_expr := xor_expr (('|' | '+') xor_expr)*
//   xor_expr:= and_expr ('^' and_expr)*
//   and_expr:= unary (('&' | '*') unary)*
//   unary   := ('~' | '!') unary | primary ['\'']*
//   primary := IDENT | '0' | '1' | '(' or_expr ')'
//
// Identifiers that name a previously defined output refer to that output's
// signal; every other identifier becomes a primary input (in order of first use).
namespace expr {

struct ParseError : std::runtime_error {
  std::size_t position;
  ParseError(const std::string &msg, std::size_t pos)
      : std::runtime_error(msg + " (at column " + std::to_string(pos + 1) + ")"),
        position(pos) {}
};

enum class BuildMode {
  Raw,       // literal structure: one fresh AND per operator, no hashing
  Strashed,  // structural hashing + constant folding while building
};

// Parse `source` and build it into `aig` (which is cleared first).
void parse_into(Aig &aig, const std::string &source, BuildMode mode = BuildMode::Raw);

// Render the function driven by `lit` as a readable Boolean expression.
// Recognises OR (De Morgan) and XOR/XNOR patterns, flattens associative chains.
// Returns "<too large>" if the printed form exceeds `max_chars`.
std::string to_string(const Aig &aig, Lit lit, std::size_t max_chars = 4000);

struct OutputExpr {
  std::string name;
  std::string expression;
};

// One rendered expression per primary output.
std::vector<OutputExpr> outputs_to_strings(const Aig &aig, std::size_t max_chars = 4000);

} // namespace expr

#endif // EXPR_HPP

#include "expr.hpp"
#include <algorithm>
#include <cctype>
#include <optional>
#include <unordered_map>
#include <unordered_set>

namespace expr {
namespace {

// ---------------------------------------------------------------- lexer --

enum class Tok { Ident, Zero, One, And, Or, Xor, Not, Postfix, LParen, RParen, Assign, Sep, End };

struct Token {
  Tok kind;
  std::string text;
  std::size_t pos;
};

std::vector<Token> lex(const std::string &s) {
  std::vector<Token> out;
  std::size_t i = 0;
  while (i < s.size()) {
    char c = s[i];
    if (c == '\n' || c == ';') {
      out.push_back({Tok::Sep, std::string(1, c), i++});
      continue;
    }
    if (std::isspace(static_cast<unsigned char>(c))) {
      i++;
      continue;
    }
    if (c == '#') { // comment to end of line
      while (i < s.size() && s[i] != '\n')
        i++;
      continue;
    }
    if (std::isalpha(static_cast<unsigned char>(c)) || c == '_') {
      std::size_t start = i;
      while (i < s.size() && (std::isalnum(static_cast<unsigned char>(s[i])) || s[i] == '_'))
        i++;
      out.push_back({Tok::Ident, s.substr(start, i - start), start});
      continue;
    }
    switch (c) {
    case '0': out.push_back({Tok::Zero, "0", i}); break;
    case '1': out.push_back({Tok::One, "1", i}); break;
    case '&': case '*': out.push_back({Tok::And, std::string(1, c), i}); break;
    case '|': case '+': out.push_back({Tok::Or, std::string(1, c), i}); break;
    case '^': out.push_back({Tok::Xor, "^", i}); break;
    case '~': case '!': out.push_back({Tok::Not, std::string(1, c), i}); break;
    case '\'': out.push_back({Tok::Postfix, "'", i}); break;
    case '(': out.push_back({Tok::LParen, "(", i}); break;
    case ')': out.push_back({Tok::RParen, ")", i}); break;
    case '=': out.push_back({Tok::Assign, "=", i}); break;
    default:
      throw ParseError(std::string("Unexpected character '") + c + "'", i);
    }
    // Allow C-style doubled operators: && || !!
    if ((c == '&' || c == '|') && i + 1 < s.size() && s[i + 1] == c)
      i++;
    i++;
  }
  out.push_back({Tok::End, "", s.size()});
  return out;
}

// --------------------------------------------------------------- parser --

class Parser {
public:
  Parser(Aig &aig, std::vector<Token> toks, BuildMode mode)
      : aig_(aig), toks_(std::move(toks)), mode_(mode) {}

  void run() {
    collect_inputs();
    for (std::size_t i = 0; i < input_names_.size(); ++i) {
      Lit lit = static_cast<Lit>(2 * (i + 1));
      aig_.add_input_node(lit, input_names_[i]);
      signals_[input_names_[i]] = lit;
    }

    pos_ = 0;
    int unnamed = 0;
    skip_seps();
    while (peek().kind != Tok::End) {
      std::string name;
      if (peek().kind == Tok::Ident && peek(1).kind == Tok::Assign) {
        name = next().text;
        next(); // '='
      } else {
        name = unnamed == 0 ? "F" : "F" + std::to_string(unnamed);
        unnamed++;
      }
      Lit f = parse_or();
      if (peek().kind != Tok::Sep && peek().kind != Tok::End)
        throw ParseError("Unexpected '" + peek().text + "'", peek().pos);
      aig_.add_output_node(f, name);
      signals_[name] = f; // later statements may reference this output
      skip_seps();
    }
    if (aig_.get_outputs().empty())
      throw ParseError("Empty expression", 0);
  }

private:
  // First pass: decide which identifiers are primary inputs.
  void collect_inputs() {
    std::unordered_set<std::string> defined, seen;
    bool at_stmt_start = true;
    for (std::size_t i = 0; i < toks_.size(); ++i) {
      const Token &t = toks_[i];
      if (t.kind == Tok::Sep) {
        at_stmt_start = true;
        continue;
      }
      if (at_stmt_start && t.kind == Tok::Ident && i + 1 < toks_.size() &&
          toks_[i + 1].kind == Tok::Assign) {
        pending_defs_.push_back(t.text);
        i++; // skip '='
        at_stmt_start = false;
        continue;
      }
      at_stmt_start = false;
      if (t.kind == Tok::Ident && !defined.count(t.text) && seen.insert(t.text).second)
        input_names_.push_back(t.text);
      // Output names become visible after their own statement
      if (i + 1 < toks_.size() && (toks_[i + 1].kind == Tok::Sep || toks_[i + 1].kind == Tok::End)) {
        for (auto &d : pending_defs_)
          defined.insert(d);
        pending_defs_.clear();
      }
    }
  }

  const Token &peek(std::size_t ahead = 0) const {
    std::size_t idx = std::min(pos_ + ahead, toks_.size() - 1);
    return toks_[idx];
  }
  const Token &next() { return toks_[pos_ < toks_.size() - 1 ? pos_++ : pos_]; }
  void skip_seps() {
    while (peek().kind == Tok::Sep)
      next();
  }

  Lit mk_and(Lit a, Lit b) {
    return mode_ == BuildMode::Raw ? aig_.create_and_raw(a, b) : aig_.get_or_create_and(a, b);
  }
  Lit mk_or(Lit a, Lit b) { return Aig::negate(mk_and(Aig::negate(a), Aig::negate(b))); }
  Lit mk_xor(Lit a, Lit b) {
    // a ^ b = (a & ~b) | (~a & b)
    return mk_or(mk_and(a, Aig::negate(b)), mk_and(Aig::negate(a), b));
  }

  Lit parse_or() {
    Lit l = parse_xor();
    while (peek().kind == Tok::Or) {
      next();
      l = mk_or(l, parse_xor());
    }
    return l;
  }
  Lit parse_xor() {
    Lit l = parse_and();
    while (peek().kind == Tok::Xor) {
      next();
      l = mk_xor(l, parse_and());
    }
    return l;
  }
  Lit parse_and() {
    Lit l = parse_unary();
    while (peek().kind == Tok::And) {
      next();
      l = mk_and(l, parse_unary());
    }
    return l;
  }
  Lit parse_unary() {
    if (peek().kind == Tok::Not) {
      next();
      return Aig::negate(parse_unary());
    }
    Lit l = parse_primary();
    while (peek().kind == Tok::Postfix) {
      next();
      l = Aig::negate(l);
    }
    return l;
  }
  Lit parse_primary() {
    const Token &t = peek();
    switch (t.kind) {
    case Tok::Zero: next(); return 0;
    case Tok::One: next(); return 1;
    case Tok::Ident: {
      next();
      auto it = signals_.find(t.text);
      if (it == signals_.end())
        throw ParseError("Unknown signal '" + t.text + "'", t.pos);
      return it->second;
    }
    case Tok::LParen: {
      next();
      Lit l = parse_or();
      if (peek().kind != Tok::RParen)
        throw ParseError("Expected ')'", peek().pos);
      next();
      return l;
    }
    case Tok::End:
    case Tok::Sep:
      throw ParseError("Unexpected end of expression", t.pos);
    default:
      throw ParseError("Unexpected '" + t.text + "'", t.pos);
    }
  }

  Aig &aig_;
  std::vector<Token> toks_;
  BuildMode mode_;
  std::size_t pos_ = 0;
  std::vector<std::string> input_names_;
  std::vector<std::string> pending_defs_;
  std::unordered_map<std::string, Lit> signals_;
};

// -------------------------------------------------------------- printer --

enum Prec { P_OR = 1, P_XOR = 2, P_AND = 3, P_UNARY = 4, P_ATOM = 5 };

struct TooLarge {};

class Printer {
public:
  Printer(const Aig &aig, std::size_t max_chars) : aig_(aig), max_(max_chars) {
    const auto &ins = aig.get_inputs();
    for (std::size_t i = 0; i < ins.size(); ++i)
      names_[Aig::get_canonical_lit(ins[i])] = aig.get_input_name(i);
  }

  std::string render(Lit lit) {
    try {
      return emit(lit).first;
    } catch (const TooLarge &) {
      return "<too large>";
    }
  }

private:
  using Piece = std::pair<std::string, int>;

  const Aig::AigNode *and_node(Lit lit) const {
    const auto &m = aig_.get_id_node_map();
    auto it = m.find(Aig::get_canonical_lit(lit));
    if (it == m.end() || it->second.type != Aig::Type::AND)
      return nullptr;
    return &it->second;
  }

  // If canonical `lit` computes a ^ b, return {a, b}.
  // N = ~P & ~Q with P = a & b, Q = ~a & ~b  =>  N = a ^ b, ~N = (a ^ b) ^ 1
  std::optional<std::pair<Lit, Lit>> raw_xor_operands(Lit lit) const {
    const Aig::AigNode *n = and_node(lit);
    if (!n || !Aig::is_inverted(n->fanin0) || !Aig::is_inverted(n->fanin1))
      return std::nullopt;
    const Aig::AigNode *p = and_node(n->fanin0);
    const Aig::AigNode *q = and_node(n->fanin1);
    if (!p || !q)
      return std::nullopt;
    Lit a = p->fanin0, b = p->fanin1;
    Lit c = q->fanin0, d = q->fanin1;
    bool match = (c == Aig::negate(a) && d == Aig::negate(b)) ||
                 (c == Aig::negate(b) && d == Aig::negate(a));
    if (!match)
      return std::nullopt;
    return std::make_pair(a, b);
  }

  void collect_xor(Lit lit, std::vector<Lit> &terms, bool &parity) const {
    if (lit == 0)
      return;
    if (lit == 1) {
      parity = !parity;
      return;
    }
    if (Aig::is_inverted(lit)) {
      parity = !parity;
      lit = Aig::get_canonical_lit(lit);
    }
    if (auto x = raw_xor_operands(lit)) {
      collect_xor(x->first, terms, parity);
      collect_xor(x->second, terms, parity);
    } else {
      terms.push_back(lit);
    }
  }

  static void sort_if_distinct(std::vector<Lit> &lits) {
    std::unordered_set<Lit> seen;
    seen.reserve(lits.size());
    for (Lit l : lits) {
      if (!seen.insert(Aig::get_canonical_lit(l)).second)
        return;
    }
    std::sort(lits.begin(), lits.end(), [](Lit x, Lit y) {
      return Aig::get_canonical_lit(x) < Aig::get_canonical_lit(y);
    });
  }

  std::string wrap(Lit lit, int need) {
    Piece p = emit(lit);
    return p.second < need ? "(" + p.first + ")" : p.first;
  }

  void collect_and(Lit lit, std::vector<Lit> &leaves) {
    const Aig::AigNode *n = and_node(lit);
    if (n && !Aig::is_inverted(lit) && !raw_xor_operands(lit)) {
      collect_and(n->fanin0, leaves);
      collect_and(n->fanin1, leaves);
    } else {
      leaves.push_back(lit);
    }
  }

  // Terms t1..tk with lit == t1 | ... | tk
  void collect_or(Lit lit, std::vector<Lit> &terms) {
    const Aig::AigNode *n = and_node(lit);
    if (n && Aig::is_inverted(lit) && !raw_xor_operands(lit)) {
      collect_or(Aig::negate(n->fanin0), terms);
      collect_or(Aig::negate(n->fanin1), terms);
    } else {
      terms.push_back(lit);
    }
  }

  Piece emit(Lit lit) {
    if (auto it = memo_.find(lit); it != memo_.end())
      return it->second;

    Piece result;
    if (lit == 0) {
      result = {"0", P_ATOM};
    } else if (lit == 1) {
      result = {"1", P_ATOM};
    } else if (auto nm = names_.find(Aig::get_canonical_lit(lit)); nm != names_.end()) {
      result = Aig::is_inverted(lit) ? Piece{"~" + nm->second, P_UNARY} : Piece{nm->second, P_ATOM};
    } else if (raw_xor_operands(lit)) {
      std::vector<Lit> terms;
      bool parity = false;
      collect_xor(lit, terms, parity);
      if (terms.empty()) {
        result = {parity ? "1" : "0", P_ATOM};
      } else {
        sort_if_distinct(terms);
        if (parity) {
          std::size_t target = terms.size() - 1;
          for (std::size_t i = terms.size(); i-- > 0;) {
            if (names_.count(Aig::get_canonical_lit(terms[i]))) {
              target = i;
              break;
            }
          }
          terms[target] = Aig::negate(terms[target]);
        }
        if (terms.size() == 1) {
          result = emit(terms[0]);
        } else {
          std::string s;
          for (std::size_t i = 0; i < terms.size(); ++i)
            s += (i ? " ^ " : "") + wrap(terms[i], P_XOR);
          result = {s, P_XOR};
        }
      }
    } else if (and_node(lit) && !Aig::is_inverted(lit)) {
      std::vector<Lit> leaves;
      collect_and(lit, leaves);
      sort_if_distinct(leaves);
      std::string s;
      for (std::size_t i = 0; i < leaves.size(); ++i)
        s += (i ? " & " : "") + wrap(leaves[i], P_AND);
      result = {s, P_AND};
    } else if (and_node(lit)) {
      std::vector<Lit> terms;
      collect_or(lit, terms);
      sort_if_distinct(terms);
      std::string s;
      for (std::size_t i = 0; i < terms.size(); ++i)
        s += (i ? " | " : "") + wrap(terms[i], P_OR);
      result = {s, P_OR};
    } else {
      result = {"n" + std::to_string(Aig::get_canonical_lit(lit)), P_ATOM};
    }

    if (result.first.size() > max_)
      throw TooLarge{};
    memo_[lit] = result;
    return result;
  }

  const Aig &aig_;
  std::size_t max_;
  std::unordered_map<Lit, std::string> names_;
  std::unordered_map<Lit, Piece> memo_;
};

} // namespace

void parse_into(Aig &aig, const std::string &source, BuildMode mode) {
  aig.clear();
  Parser p(aig, lex(source), mode);
  p.run();
}

std::string to_string(const Aig &aig, Lit lit, std::size_t max_chars) {
  Printer p(aig, max_chars);
  return p.render(lit);
}

std::vector<OutputExpr> outputs_to_strings(const Aig &aig, std::size_t max_chars) {
  Printer p(aig, max_chars);
  std::vector<OutputExpr> out;
  const auto &outs = aig.get_outputs();
  for (std::size_t i = 0; i < outs.size(); ++i)
    out.push_back({aig.get_output_name(i), p.render(outs[i])});
  return out;
}

} // namespace expr

#ifndef AIGER_HPP
#define AIGER_HPP

#include "aig.hpp"

// Free functions / helpers for AIGER format
namespace aiger {
  Lit decode_delta(std::istream &in);
  void encode_delta(Lit delta, std::ostream &out);
}

#endif // AIGER_HPP

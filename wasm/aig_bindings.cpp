#include "../src/aig_facade.hpp"
#include <emscripten/bind.h>
#include <string>

using namespace emscripten;

std::string process_equation_wasm(std::string equation,
                                  std::string pass_recipe) {
  return process_equation(equation, pass_recipe);
}

EMSCRIPTEN_BINDINGS(aig_module) {
  function("process_equation", &process_equation_wasm);
}

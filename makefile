# Compiler and flags
CXX = g++
CXXFLAGS = -std=c++17 -Wall -Wextra -Isrc -O2

# Core library source files
LIB_SRCS = src/aig.cpp src/aiger.cpp src/blif.cpp src/optimizer.cpp src/graph.cpp src/expr.cpp src/aig_facade.cpp
HEADERS  = src/aig.hpp src/aiger.hpp src/blif.hpp src/optimizer.hpp src/graph.hpp src/expr.hpp src/aig_facade.hpp

# Default build target
all: aig

FILE ?= examples/and2.aag

# Build the main CLI executable (aig)
aig: src/main.cpp $(LIB_SRCS) $(HEADERS)
	$(CXX) $(CXXFLAGS) -o ./aig src/main.cpp $(LIB_SRCS)

.PHONY: main
main: aig
	./aig

show_stats: aig
	@./aig stats $(FILE)

truth_table: aig
	@./aig truth_table $(FILE)

network: aig
	@./aig network $(FILE)

tree: aig
	@./aig tree $(FILE)

dot: aig
	@./aig dot $(FILE) $(OUT)

sweep: aig
	@./aig sweep $(FILE) $(OUT)

balance: aig
	@./aig balance $(FILE) $(OUT)

rewrite: aig
	@./aig rewrite $(FILE) $(OUT)

optimize: aig
	@./aig optimize $(FILE) $(OUT)

write_to_aag: aig
	@./aig write $(FILE) $(OUT)

write_to_aig: aig
	@./aig write_aig $(FILE) $(OUT)

write_to_blif: aig
	@./aig write_blif $(FILE) $(OUT)

.PHONY: test
test: run_tests
	@./run_tests

# Build test runner
run_tests: tests/test_aig.cpp $(LIB_SRCS) $(HEADERS)
	$(CXX) $(CXXFLAGS) -Itests -o ./run_tests tests/test_aig.cpp $(LIB_SRCS)

.PHONY: clean
clean:
	rm -f ./aig ./run_tests

# Simplify a Boolean expression from the CLI (prints JSON)
#   make simplify EXPR="(A & B) | (A & ~B)" PASSES=strash,rewrite,balance
EXPR   ?= (A & B) | (A & ~B)
PASSES ?= strash,rewrite,balance,rewrite
simplify: aig
	@./aig simplify "$(EXPR)" "$(PASSES)"

# ---- WebAssembly + web UI (requires Emscripten `emcc` on PATH for Wasm) ----
.PHONY: wasm web web-install web-build
wasm:
	@./scripts/build_wasm.sh

web-install:
	@$(MAKE) -C web install

web:
	@$(MAKE) -C web dev

web-build:
	@$(MAKE) -C web build


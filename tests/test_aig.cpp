#define DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN
#include "doctest.h"
#include "../src/aig.hpp"
#include "../src/aig_facade.hpp"
#include <fstream>
#include <sstream>

// Expected truth tables
static const std::vector<std::vector<bool>> FULL_ADDER_EXPECTED_TT = {
    // A B Cin | Cout Sum (or Sum Cout depending on order)
    // Note: full_adder.aag outputs Cout then Sum or Sum then Cout:
    // In full_adder.aag: outputs are 17 (Cout), 29 (Sum)
    {0, 0, 0, 0, 0}, {0, 0, 1, 0, 1}, {0, 1, 0, 0, 1}, {0, 1, 1, 1, 0},
    {1, 0, 0, 0, 1}, {1, 0, 1, 1, 0}, {1, 1, 0, 1, 0}, {1, 1, 1, 1, 1}};

static const std::vector<std::vector<bool>> AND_EXPECTED_TT = {
    // A B | Y
    {0, 0, 0},
    {0, 1, 0},
    {1, 0, 0},
    {1, 1, 1}};

TEST_CASE("ASCII AIGER (.aag) Parsing, Depth, and Truth Table") {
  SUBCASE("and2.aag") {
    std::ifstream in("examples/and2.aag");
    REQUIRE(in.is_open());
    Aig aig;
    aig.parse(in);

    CHECK(aig.get_inputs().size() == 2);
    CHECK(aig.get_outputs().size() == 1);
    CHECK(aig.compute_depth() == 1);
    CHECK(aig.is_topologically_sorted() == true);

    size_t and_count = 0;
    for (const auto &n : aig.get_nodes()) {
      if (n.type == Aig::Type::AND)
        and_count++;
    }
    CHECK(and_count == 1);

    auto tt = aig.generate_truth_table();
    CHECK(tt == AND_EXPECTED_TT);
  }

  SUBCASE("full_adder.aag") {
    std::ifstream in("examples/full_adder.aag");
    REQUIRE(in.is_open());
    Aig aig;
    aig.parse(in);

    CHECK(aig.get_inputs().size() == 3);
    CHECK(aig.get_outputs().size() == 2);
    CHECK(aig.compute_depth() == 4);
    CHECK(aig.is_topologically_sorted() == true);

    size_t and_count = 0;
    for (const auto &n : aig.get_nodes()) {
      if (n.type == Aig::Type::AND)
        and_count++;
    }
    CHECK(and_count == 11);

    auto tt = aig.generate_truth_table();
    CHECK(tt == FULL_ADDER_EXPECTED_TT);
  }
}

TEST_CASE("Fan-out Analysis") {
  Aig aig;
  std::ifstream in("examples/full_adder.aag");
  REQUIRE(in.is_open());
  aig.parse(in);

  auto fanouts = aig.compute_fanout_counts();
  CHECK(fanouts[2] == 4);
  CHECK(fanouts[4] == 4);
  CHECK(fanouts[6] == 4);
  CHECK(aig.get_max_fanout() == 4);
}

TEST_CASE("Structural Hashing (Unique-table)") {
  Aig aig;
  aig.add_input_node(2, "A");
  aig.add_input_node(4, "B");

  // Constant folding & basic identities
  CHECK(aig.get_or_create_and(2, 0) == 0);
  CHECK(aig.get_or_create_and(0, 2) == 0);
  CHECK(aig.get_or_create_and(2, 1) == 2);
  CHECK(aig.get_or_create_and(1, 4) == 4);
  CHECK(aig.get_or_create_and(2, 2) == 2);
  CHECK(aig.get_or_create_and(2, Aig::negate(2)) == 0);

  // Commutativity
  Lit g1 = aig.get_or_create_and(2, 4);
  Lit g2 = aig.get_or_create_and(4, 2);
  CHECK(g1 == g2);

  // Deduplication / Unique-table: adding (2, 4) again should return existing g1
  Lit g3 = aig.get_or_create_and(2, 4);
  CHECK(g3 == g1);

  // Only 1 AND gate was created
  size_t and_count = 0;
  for (const auto &n : aig.get_nodes()) {
    if (n.type == Aig::Type::AND)
      and_count++;
  }
  CHECK(and_count == 1);
}

TEST_CASE("Sweep (Dead and Duplicate Node Removal)") {
  std::ifstream in("examples/and2_redundant.aag");
  REQUIRE(in.is_open());

  Aig aig;
  aig.parse(in);

  // Initially: 3 AND gates (gate 6: 2&4, gate 8: 2&4, gate 10: 2&2)
  size_t initial_and_count = 0;
  for (const auto &n : aig.get_nodes()) {
    if (n.type == Aig::Type::AND)
      initial_and_count++;
  }
  CHECK(initial_and_count == 3);

  // Verify truth table before sweep
  auto tt_before = aig.generate_truth_table();
  CHECK(tt_before == AND_EXPECTED_TT);

  // Run sweep: should eliminate dead gate 10 and merge duplicate gate 8 into gate 6
  aig.sweep();

  size_t swept_and_count = 0;
  for (const auto &n : aig.get_nodes()) {
    if (n.type == Aig::Type::AND)
      swept_and_count++;
  }
  CHECK(swept_and_count == 1);

  // Output truth table must be identical
  auto tt_after = aig.generate_truth_table();
  CHECK(tt_after == AND_EXPECTED_TT);
}

TEST_CASE("Optimization & Algebraic Rewriting") {
  Aig aig;
  aig.add_input_node(2, "x");
  aig.add_input_node(4, "y");

  // Construct redundant expression:
  // g1 = x & y
  // g2 = x & g1  (which algebraically is x & (x & y) = x & y)
  // Output is g2
  Lit g1 = aig.create_and_raw(2, 4);
  Lit g2 = aig.create_and_raw(2, g1);
  aig.add_output_node(g2, "out");

  // 2 AND gates originally
  size_t before_and = 0;
  for (const auto &n : aig.get_nodes())
    if (n.type == Aig::Type::AND)
      before_and++;
  CHECK(before_and == 2);

  auto tt_before = aig.generate_truth_table();

  // Run optimization
  aig.optimize();

  size_t after_and = 0;
  for (const auto &n : aig.get_nodes())
    if (n.type == Aig::Type::AND)
      after_and++;
  CHECK(after_and == 1);

  auto tt_after = aig.generate_truth_table();
  CHECK(tt_after == tt_before);
}

TEST_CASE("Binary AIGER (.aig) Read and Write Roundtrip") {
  SUBCASE("and2 binary roundtrip") {
    std::ifstream in("examples/and2.aag");
    REQUIRE(in.is_open());
    Aig original;
    original.parse(in);

    // Write binary AIGER
    std::stringstream bin_ss(std::ios::in | std::ios::out | std::ios::binary);
    original.write_aig(bin_ss);

    // Read back using read_aiger_binary
    Aig recovered;
    recovered.read_aiger_binary(bin_ss);

    CHECK(recovered.get_inputs().size() == original.get_inputs().size());
    CHECK(recovered.get_outputs().size() == original.get_outputs().size());
    CHECK(recovered.compute_depth() == original.compute_depth());

    auto tt_recovered = recovered.generate_truth_table();
    CHECK(tt_recovered == AND_EXPECTED_TT);
  }

  SUBCASE("full_adder binary roundtrip") {
    std::ifstream in("examples/full_adder.aag");
    REQUIRE(in.is_open());
    Aig original;
    original.parse(in);

    std::stringstream bin_ss(std::ios::in | std::ios::out | std::ios::binary);
    original.write_aig(bin_ss);

    Aig recovered;
    recovered.read_aiger_binary(bin_ss);

    CHECK(recovered.get_inputs().size() == 3);
    CHECK(recovered.get_outputs().size() == 2);
    CHECK(recovered.compute_depth() == 4);

    auto tt_recovered = recovered.generate_truth_table();
    CHECK(tt_recovered == FULL_ADDER_EXPECTED_TT);
  }
}

TEST_CASE("BLIF Import and Export") {
  SUBCASE("and2.blif") {
    std::ifstream in("examples/blif/and2.blif");
    REQUIRE(in.is_open());
    Aig aig;
    aig.parse_blif(in);

    CHECK(aig.get_inputs().size() == 2);
    CHECK(aig.get_outputs().size() == 1);

    auto tt = aig.generate_truth_table();
    CHECK(tt == AND_EXPECTED_TT);
  }

  SUBCASE("full_adder.blif") {
    std::ifstream in("examples/blif/full_adder.blif");
    REQUIRE(in.is_open());
    Aig aig;
    aig.parse_blif(in);

    CHECK(aig.get_inputs().size() == 3);
    CHECK(aig.get_outputs().size() == 2);

    auto tt = aig.generate_truth_table();
    // Notice in full_adder.blif outputs are defined as: .outputs Sum Cout
    // Whereas full_adder.aag outputs were Cout, Sum.
    // For each row (A, B, Cin):
    // Sum = A ^ B ^ Cin, Cout = (A & B) | (Cin & (A ^ B))
    for (const auto &row : tt) {
      bool A = row[0];
      bool B = row[1];
      bool Cin = row[2];
      bool Sum = row[3];
      bool Cout = row[4];
      CHECK(Sum == (A ^ B ^ Cin));
      CHECK(Cout == ((A && B) || (Cin && (A ^ B))));
    }

    // Export to BLIF and read back
    std::stringstream blif_ss;
    aig.write_blif(blif_ss, "full_adder");

    Aig recovered;
    recovered.parse_blif(blif_ss);
    CHECK(recovered.get_inputs().size() == 3);
    CHECK(recovered.get_outputs().size() == 2);

    auto tt_rec = recovered.generate_truth_table();
    CHECK(tt_rec == tt);
  }
}

TEST_CASE("Graph Export and Pretty Printing") {
  std::ifstream in("examples/and2.aag");
  REQUIRE(in.is_open());
  Aig aig;
  aig.parse(in);

  // Test DOT output
  std::stringstream dot_ss;
  aig.write_dot(dot_ss, "TestAnd2");
  std::string dot_str = dot_ss.str();
  CHECK(dot_str.find("digraph \"TestAnd2\"") != std::string::npos);
  CHECK(dot_str.find("node_") != std::string::npos);

  // Test ASCII tree output
  std::stringstream tree_ss;
  aig.print_tree(tree_ss);
  std::string tree_str = tree_ss.str();
  CHECK(tree_str.find("AND") != std::string::npos);

  // Test network print output
  std::stringstream net_ss;
  aig.print_network(net_ss);
  std::string net_str = net_ss.str();
  CHECK(net_str.find("AIG Network Summary") != std::string::npos);
}

TEST_CASE("Tree Balancing (Slashing Logic Depth)") {
  // Construct a deep linear chain of 8 inputs:
  // (((((((x1 & x2) & x3) & x4) & x5) & x6) & x7) & x8)
  Aig aig;
  std::vector<Lit> in_lits;
  for (int i = 1; i <= 8; ++i) {
    Lit in = 2 * i;
    aig.add_input_node(in, "x" + std::to_string(i));
    in_lits.push_back(in);
  }

  Lit curr = aig.create_and_raw(in_lits[0], in_lits[1]);
  for (size_t i = 2; i < in_lits.size(); ++i) {
    curr = aig.create_and_raw(curr, in_lits[i]);
  }
  aig.add_output_node(curr, "out");

  // Initial depth is 7 (linear chain of 7 AND gates)
  CHECK(aig.compute_depth() == 7);
  CHECK(aig.count_and_gates() == 7);

  auto tt_before = aig.generate_truth_table();

  // Balance tree using associative restructuring
  aig.balance();

  // Balanced depth should be ceil(log2(8)) = 3
  CHECK(aig.compute_depth() == 3);
  CHECK(aig.count_and_gates() == 7);

  // Semantics must be 100% preserved
  auto tt_after = aig.generate_truth_table();
  CHECK(tt_before == tt_after);
}

TEST_CASE("DAG-Aware 4-Input Cut Rewriting") {
  // Test expression: (A & B) | (A & ~B)
  // Initially creates 3 AND gates (De Morgan OR of two products)
  Aig aig;
  Lit a = 2, b = 4;
  aig.add_input_node(a, "A");
  aig.add_input_node(b, "B");

  Lit p1 = aig.create_and_raw(a, b);                    // A & B
  Lit p2 = aig.create_and_raw(a, Aig::negate(b));       // A & ~B
  // OR(p1, p2) = ~(~p1 & ~p2)
  Lit nor_gate = aig.create_and_raw(Aig::negate(p1), Aig::negate(p2));
  Lit out = Aig::negate(nor_gate);
  aig.add_output_node(out, "F");

  CHECK(aig.count_and_gates() == 3);
  auto tt_before = aig.generate_truth_table();

  // Run DAG-aware rewriting
  aig.rewrite();

  // Should reduce to direct wire A (0 AND gates)
  CHECK(aig.count_and_gates() == 0);
  auto tt_after = aig.generate_truth_table();
  CHECK(tt_before == tt_after);
}

TEST_CASE("Boolean Expression Parser & Facade JSON") {
  SUBCASE("Redundant SOP rewriting") {
    std::string json = process_equation("(A & B) | (A & ~B)", "strash,rewrite,balance,rewrite");
    CHECK(json.find("\"status\":\"ok\"") != std::string::npos);
    CHECK(json.find("\"simplified_expr\":\"A\"") != std::string::npos);
    CHECK(json.find("\"equivalent\":true") != std::string::npos);
    CHECK(json.find("\"initial_and_nodes\":3") != std::string::npos);
    CHECK(json.find("\"final_and_nodes\":0") != std::string::npos);
  }

  SUBCASE("4-bit Parity XOR tree balancing") {
    std::string json = process_equation("P = A ^ B ^ C ^ D", "strash,balance,rewrite");
    CHECK(json.find("\"status\":\"ok\"") != std::string::npos);
    CHECK(json.find("\"simplified_expr\":\"P = A ^ B ^ C ^ D\"") != std::string::npos);
    CHECK(json.find("\"equivalent\":true") != std::string::npos);
    CHECK(json.find("\"initial_levels\":6") != std::string::npos);
    CHECK(json.find("\"final_levels\":4") != std::string::npos);
    CHECK(json.find("\"final_and_nodes\":9") != std::string::npos);
  }

  SUBCASE("Consensus theorem rewriting") {
    std::string json = process_equation("F = (A & B) | (~A & C) | (B & C)", "strash,balance,rewrite");
    CHECK(json.find("\"status\":\"ok\"") != std::string::npos);
    CHECK(json.find("\"simplified_expr\":\"F = A & B | ~A & C\"") != std::string::npos);
    CHECK(json.find("\"equivalent\":true") != std::string::npos);
    CHECK(json.find("\"initial_and_nodes\":5") != std::string::npos);
    CHECK(json.find("\"final_and_nodes\":3") != std::string::npos);
  }

  SUBCASE("Multi-output full adder") {
    std::string json = process_equation("Sum = A ^ B ^ Cin; Cout = (A & B) | (Cin & (A ^ B))", "strash,balance,rewrite");
    CHECK(json.find("\"status\":\"ok\"") != std::string::npos);
    CHECK(json.find("\"equivalent\":true") != std::string::npos);
    CHECK(json.find("\"initial_and_nodes\":12") != std::string::npos);
    CHECK(json.find("\"final_and_nodes\":9") != std::string::npos);
  }
}

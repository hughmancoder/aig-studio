#include "aig.hpp"
#include "aig_facade.hpp"
#include <fstream>
#include <iostream>
#include <string>

void print_usage(const char *prog) {
  std::cerr << "AIG (And-Inverter Graph) Package\n"
            << "Usage:\n"
            << "  " << prog << " stats       <file>            Show network statistics\n"
            << "  " << prog << " truth_table <file>            Generate and print truth table\n"
            << "  " << prog << " network     <file>            Print detailed network summary\n"
            << "  " << prog << " tree        <file>            Print ASCII logic cone trees\n"
            << "  " << prog << " dot         <file> [out.dot]  Export to Graphviz DOT format\n"
            << "  " << prog << " sweep       <file> [out.aag]  Remove dead and duplicate nodes\n"
            << "  " << prog << " balance     <file> [out.aag]  Balance multi-input AND trees (minimize depth)\n"
            << "  " << prog << " rewrite     <file> [out.aag]  DAG-aware 4-input cut rewriting\n"
            << "  " << prog << " optimize    <file> [out.aag]  Full optimization (strash, sweep, rewrite)\n"
            << "  " << prog << " write       <file> <out.aag>  Save to ASCII AIGER (.aag)\n"
            << "  " << prog << " write_aig   <file> <out.aig>  Save to binary AIGER (.aig)\n"
            << "  " << prog << " write_blif  <file> <out.blif> Save to BLIF (.blif)\n"
            << "  " << prog << " simplify    \"<expr>\" [passes] Simplify a Boolean expression, print JSON\n"
            << "                                     e.g. simplify \"(A & B) | (A & ~B)\" strash,rewrite,balance\n"
            << "\nSupported input formats: .aag (ASCII AIGER), .aig (binary AIGER), .blif (Berkeley BLIF)\n";
}

int main(int argc, char *argv[]) {
  if (argc < 3) {
    print_usage(argv[0]);
    return 1;
  }

  std::string cmd(argv[1]);

  if (cmd == "simplify") {
    std::string recipe = argc >= 4 ? argv[3] : "strash,rewrite,balance,rewrite";
    std::cout << process_equation(argv[2], recipe) << "\n";
    return 0;
  }

  std::string filename(argv[2]);

  std::ifstream in(filename, std::ios::binary);
  if (!in) {
    std::cerr << "Error: Cannot open input file '" << filename << "'\n";
    return 1;
  }

  Aig aig;
  try {
    aig.parse(in);
  } catch (const std::exception &e) {
    std::cerr << "Error parsing '" << filename << "': " << e.what() << "\n";
    return 1;
  }

  if (cmd == "stats") {
    aig.print_stats();
  } else if (cmd == "truth_table" || cmd == "truth") {
    auto tt = aig.generate_truth_table();
    std::cout << "Truth table (" << tt.size() << " rows):\n";
    aig.display_truth_table(tt, aig.get_inputs().size());
  } else if (cmd == "network" || cmd == "print") {
    aig.print_network();
  } else if (cmd == "tree") {
    aig.print_tree();
  } else if (cmd == "dot") {
    if (argc >= 4) {
      std::ofstream out(argv[3]);
      if (!out) {
        std::cerr << "Failed to open output file: " << argv[3] << "\n";
        return 1;
      }
      aig.write_dot(out);
      std::cout << "Wrote DOT graph to " << argv[3] << "\n";
    } else {
      aig.write_dot(std::cout);
    }
  } else if (cmd == "sweep") {
    size_t before_nodes = aig.get_nodes().size();
    size_t before_and = 0;
    for (const auto &n : aig.get_nodes())
      if (n.type == Aig::Type::AND)
        before_and++;

    aig.sweep();

    size_t after_nodes = aig.get_nodes().size();
    size_t after_and = 0;
    for (const auto &n : aig.get_nodes())
      if (n.type == Aig::Type::AND)
        after_and++;

    std::cout << "Sweep completed:\n"
              << "  AND gates: " << before_and << " -> " << after_and << " ("
              << (before_and - after_and) << " removed)\n"
              << "  Total nodes: " << before_nodes << " -> " << after_nodes << "\n";

    if (argc >= 4) {
      std::ofstream out(argv[3]);
      if (!out) {
        std::cerr << "Failed to open output file: " << argv[3] << "\n";
        return 1;
      }
      aig.write_aag(out);
      std::cout << "Saved swept network to " << argv[3] << "\n";
    }
  } else if (cmd == "balance") {
    int before_depth = aig.compute_depth();
    size_t before_and = 0;
    for (const auto &n : aig.get_nodes())
      if (n.type == Aig::Type::AND)
        before_and++;

    aig.balance();

    int after_depth = aig.compute_depth();
    size_t after_and = 0;
    for (const auto &n : aig.get_nodes())
      if (n.type == Aig::Type::AND)
        after_and++;

    std::cout << "Balancing completed:\n"
              << "  Depth:     " << before_depth << " -> " << after_depth << "\n"
              << "  AND gates: " << before_and << " -> " << after_and << "\n";

    if (argc >= 4) {
      std::ofstream out(argv[3]);
      if (!out) {
        std::cerr << "Failed to open output file: " << argv[3] << "\n";
        return 1;
      }
      aig.write_aag(out);
      std::cout << "Saved balanced network to " << argv[3] << "\n";
    }
  } else if (cmd == "rewrite") {
    size_t before_and = 0;
    for (const auto &n : aig.get_nodes())
      if (n.type == Aig::Type::AND)
        before_and++;
    int before_depth = aig.compute_depth();

    aig.rewrite();

    size_t after_and = 0;
    for (const auto &n : aig.get_nodes())
      if (n.type == Aig::Type::AND)
        after_and++;
    int after_depth = aig.compute_depth();

    std::cout << "DAG-aware rewriting completed:\n"
              << "  AND gates: " << before_and << " -> " << after_and << "\n"
              << "  Depth:     " << before_depth << " -> " << after_depth << "\n";

    if (argc >= 4) {
      std::ofstream out(argv[3]);
      if (!out) {
        std::cerr << "Failed to open output file: " << argv[3] << "\n";
        return 1;
      }
      aig.write_aag(out);
      std::cout << "Saved rewritten network to " << argv[3] << "\n";
    }
  } else if (cmd == "optimize" || cmd == "opt") {
    size_t before_and = 0;
    for (const auto &n : aig.get_nodes())
      if (n.type == Aig::Type::AND)
        before_and++;
    int before_depth = aig.compute_depth();

    aig.optimize();

    size_t after_and = 0;
    for (const auto &n : aig.get_nodes())
      if (n.type == Aig::Type::AND)
        after_and++;
    int after_depth = aig.compute_depth();

    std::cout << "Optimization completed:\n"
              << "  AND gates: " << before_and << " -> " << after_and << "\n"
              << "  Depth:     " << before_depth << " -> " << after_depth << "\n";

    if (argc >= 4) {
      std::ofstream out(argv[3]);
      if (!out) {
        std::cerr << "Failed to open output file: " << argv[3] << "\n";
        return 1;
      }
      aig.write_aag(out);
      std::cout << "Saved optimized network to " << argv[3] << "\n";
    }
  } else if (cmd == "write") {
    if (argc < 4) {
      std::cerr << "Missing output filename. Usage: " << argv[0] << " write <in> <out.aag>\n";
      return 1;
    }
    std::ofstream out(argv[3]);
    if (!out) {
      std::cerr << "Failed to open output file: " << argv[3] << "\n";
      return 1;
    }
    aig.write_aag(out);
    std::cout << "Wrote ASCII AIGER to " << argv[3] << "\n";
  } else if (cmd == "write_aig") {
    if (argc < 4) {
      std::cerr << "Missing output filename. Usage: " << argv[0] << " write_aig <in> <out.aig>\n";
      return 1;
    }
    std::ofstream out(argv[3], std::ios::binary);
    if (!out) {
      std::cerr << "Failed to open output file: " << argv[3] << "\n";
      return 1;
    }
    aig.write_aig(out);
    std::cout << "Wrote binary AIGER to " << argv[3] << "\n";
  } else if (cmd == "write_blif") {
    if (argc < 4) {
      std::cerr << "Missing output filename. Usage: " << argv[0] << " write_blif <in> <out.blif>\n";
      return 1;
    }
    std::ofstream out(argv[3]);
    if (!out) {
      std::cerr << "Failed to open output file: " << argv[3] << "\n";
      return 1;
    }
    aig.write_blif(out);
    std::cout << "Wrote BLIF to " << argv[3] << "\n";
  } else {
    std::cerr << "Unknown command '" << cmd << "'\n";
    print_usage(argv[0]);
    return 1;
  }

  return 0;
}

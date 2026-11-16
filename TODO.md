# TODO

## Core

- [x] AIG Node class
- [x] AIG.hpp (node)
- [x] Parsing AAG (ASCII)
- [x] Verify counts & topological order
- [x] Resolve TODOS
- [x] Test and.aig (check inputs, outputs, fan-ins of gates)
- [x] show depth
- [x] show fan-out analysis
- [x] Output AAG (write) from AigNodes

## Extensions

- [x] Sweep (remove dead/duplicate nodes)
- [x] Structural hashing (replace naive push_back with a unique-table)
- [x] Very basic optimization (remove duplicate nodes)
- [x] Graph export/print and pretty printing
- [x] Import / Parse blif
- [x] Export / Save to blif
- [x] Binary AIG Support (read_aiger_binary)
- [x] On-the-Fly Structural Hashing (Strashing)

## GUI

- [x] Create a GUI to write logic and simplify it, showing the equivalent AIG logic tree diagrams and outputting the simplified logic and formal equivalence check.
- [x] Represent complex operators (`^`, `|`, `~`, `&`) converted into AIG equivalents (`&` and `~`) and integrate into the interactive web GUI.

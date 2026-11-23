// Decompiles every function that references the given external symbols (directly or via pointer tables).
// args: <outFile> <symbol1> <symbol2> ...
import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.*;
import ghidra.program.model.listing.*;
import ghidra.program.model.symbol.*;
import ghidra.program.model.address.*;
import java.io.*;
import java.util.*;

public class FindCallers extends GhidraScript {
  public void run() throws Exception {
    String[] args = getScriptArgs();
    PrintWriter out = new PrintWriter(new FileWriter(args[0]));
    DecompInterface di = new DecompInterface();
    di.openProgram(currentProgram);
    Set<Function> done = new LinkedHashSet<>();
    Map<Function, Set<String>> uses = new LinkedHashMap<>();
    SymbolTable st = currentProgram.getSymbolTable();
    ReferenceManager rm = currentProgram.getReferenceManager();
    for (int i = 1; i < args.length; i++) {
      String name = args[i];
      List<Address> targets = new ArrayList<>();
      for (Symbol s : st.getSymbols(name)) targets.add(s.getAddress());
      for (Symbol s : st.getSymbols("_" + name)) targets.add(s.getAddress());
      List<Address> more = new ArrayList<>();
      for (Address t : targets) for (Reference r : rm.getReferencesTo(t)) more.add(r.getFromAddress());
      targets.addAll(more); // pointer-table entries / thunks
      for (Address t : targets) {
        for (Reference r : rm.getReferencesTo(t)) {
          Function f = getFunctionContaining(r.getFromAddress());
          if (f == null) continue;
          if (f.isThunk()) { for (Address a2 : f.getFunctionThunkAddresses(true) == null ? new Address[0] : f.getFunctionThunkAddresses(true)) {} }
          uses.computeIfAbsent(f, k -> new TreeSet<>()).add(name);
        }
      }
    }
    out.println("== funções que usam os símbolos ==");
    for (Map.Entry<Function, Set<String>> e : uses.entrySet())
      out.println(e.getKey().getEntryPoint() + " " + e.getKey().getName() + " size=" + e.getKey().getBody().getNumAddresses() + " usa " + e.getValue());
    for (Function f : uses.keySet()) {
      if (f.getBody().getNumAddresses() > 6000) { out.println("\n// " + f.getName() + " grande demais, pulada"); continue; }
      DecompileResults res = di.decompileFunction(f, 60, monitor);
      out.println("\n// ================= " + f.getName() + " @ " + f.getEntryPoint() + " usa " + uses.get(f));
      out.println(res.decompileCompleted() ? res.getDecompiledFunction().getC() : "// falhou: " + res.getErrorMessage());
    }
    out.close();
  }
}

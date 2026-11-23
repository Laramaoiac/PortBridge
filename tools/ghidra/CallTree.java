// args: <outFile> <depth> <addr1> <addr2> ...  -> callers tree + decompilation of the given functions
import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.*;
import ghidra.program.model.listing.*;
import ghidra.program.model.symbol.*;
import java.io.*;
import java.util.*;
public class CallTree extends GhidraScript {
  PrintWriter out;
  void up(Function f, int depth, int max, Set<Function> seen) {
    if (depth > max) return;
    for (Function c : f.getCallingFunctions(monitor)) {
      out.println("  ".repeat(depth) + "<- " + c.getEntryPoint() + " " + c.getName(true));
      if (seen.add(c)) up(c, depth + 1, max, seen);
    }
  }
  Function fn(String addr) {
    Function f = getFunctionAt(toAddr(addr));
    if (f == null) f = getFunctionContaining(toAddr(addr));
    if (f == null) { disassemble(toAddr(addr)); f = createFunction(toAddr(addr), null); }
    return f;
  }
  public void run() throws Exception {
    String[] a = getScriptArgs();
    out = new PrintWriter(new FileWriter(a[0]));
    int max = Integer.parseInt(a[1]);
    DecompInterface di = new DecompInterface();
    di.openProgram(currentProgram);
    for (int i = 2; i < a.length; i++) {
      Function f = fn(a[i]);
      if (f == null) { out.println("== sem função em " + a[i]); continue; }
      out.println("== " + f.getEntryPoint() + " " + f.getName(true));
      up(f, 1, max, new HashSet<>());
    }
    for (int i = 2; i < a.length; i++) {
      Function f = fn(a[i]);
      if (f == null) continue;
      DecompileResults r = di.decompileFunction(f, 60, monitor);
      out.println("\n// ======== " + f.getName(true));
      out.println(r.decompileCompleted() ? r.getDecompiledFunction().getC() : "falhou");
    }
    out.close();
  }
}

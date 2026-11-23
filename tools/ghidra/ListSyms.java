import ghidra.app.script.GhidraScript;
import ghidra.program.model.symbol.*;
import java.io.*;
public class ListSyms extends GhidraScript {
  public void run() throws Exception {
    String[] a = getScriptArgs();
    PrintWriter out = new PrintWriter(new FileWriter(a[0]));
    for (Symbol s : currentProgram.getSymbolTable().getAllSymbols(true)) {
      String n = s.getName();
      if (n.matches(a[1])) {
        int refs = currentProgram.getReferenceManager().getReferenceCountTo(s.getAddress());
        out.println(s.getAddress() + " " + n + " type=" + s.getSymbolType() + " ext=" + s.isExternal() + " refs=" + refs);
      }
    }
    out.close();
  }
}

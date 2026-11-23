// Resolves ARM/Thumb PIC address computations (ldr rX,=lit ; add rX, pc) and reports
// which functions reach given data addresses (e.g. non-lazy pointers of imported symbols).
// args: <outFile> <symbolRegex>
import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.*;
import ghidra.program.model.symbol.*;
import ghidra.program.model.address.*;
import ghidra.program.model.scalar.Scalar;
import ghidra.program.model.lang.Register;
import java.io.*;
import java.util.*;

public class PicRefs extends GhidraScript {
  public void run() throws Exception {
    String[] a = getScriptArgs();
    PrintWriter out = new PrintWriter(new FileWriter(a[0]));
    Map<Long, String> wanted = new HashMap<>();
    try (BufferedReader br = new BufferedReader(new FileReader(a[1]))) {
      String line;
      while ((line = br.readLine()) != null) {
        String[] kv = line.trim().split("=");
        if (kv.length == 2) wanted.put(Long.decode(kv[0]), kv[1]);
      }
    }
    out.println("alvos: " + wanted.size());
    Map<Function, Set<String>> uses = new TreeMap<>(Comparator.comparing(f -> f.getEntryPoint()));
    Listing l = currentProgram.getListing();
    Map<String, Long> regLit = new HashMap<>();
    Function cur = null;
    for (Instruction ins : l.getInstructions(true)) {
      Function f = getFunctionContaining(ins.getAddress());
      if (f != cur) { regLit.clear(); cur = f; }
      String m = ins.getMnemonicString().toLowerCase();
      if (m.startsWith("ldr") && ins.getNumOperands() == 2) {
        Object[] o0 = ins.getOpObjects(0);
        Reference[] refs = ins.getReferencesFrom();
        if (o0.length == 1 && o0[0] instanceof Register && refs.length > 0) {
          try {
            long v = currentProgram.getMemory().getInt(refs[0].getToAddress()) & 0xFFFFFFFFL;
            regLit.put(((Register) o0[0]).getName(), v);
          } catch (Exception e) { }
        }
      } else if (m.startsWith("add") && ins.toString().toLowerCase().contains("pc")) {
        Object[] o0 = ins.getOpObjects(0);
        if (o0.length == 1 && o0[0] instanceof Register) {
          String r = ((Register) o0[0]).getName();
          Long v = regLit.get(r);
          if (v != null) {
            boolean thumb = ins.getLength() == 2 || currentProgram.getRegister("TMode") != null
                && currentProgram.getProgramContext().getValue(currentProgram.getRegister("TMode"), ins.getAddress(), false) != null
                && currentProgram.getProgramContext().getValue(currentProgram.getRegister("TMode"), ins.getAddress(), false).intValue() == 1;
            long target = (v + ins.getAddress().getOffset() + (thumb ? 4 : 8)) & 0xFFFFFFFFL;
            String name = wanted.get(target);
            if (name != null && f != null) uses.computeIfAbsent(f, k -> new TreeSet<>()).add(name);
            regLit.remove(r);
          }
        }
      }
    }
    for (Map.Entry<Function, Set<String>> e : uses.entrySet())
      out.println(e.getKey().getEntryPoint() + " " + e.getKey().getName() + " size=" + e.getKey().getBody().getNumAddresses() + " " + e.getValue());
    out.close();
  }
}

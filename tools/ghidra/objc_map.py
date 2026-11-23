import struct, sys
d = open(sys.argv[1], 'rb').read()
ncmds = struct.unpack('<I', d[16:20])[0]; p = 28; segs = []; sects = {}
for _ in range(ncmds):
    cmd, sz = struct.unpack('<II', d[p:p+8])
    if cmd == 1:
        vm, vs, fo, fs = struct.unpack('<IIII', d[p+24:p+40]); segs.append((vm, vs, fo, fs))
        ns = struct.unpack('<I', d[p+48:p+52])[0]
        for j in range(ns):
            s = p + 56 + j*68
            name = d[s:s+16].rstrip(b'\0').decode(); addr, size, off = struct.unpack('<III', d[s+32:s+44])
            sects[name] = (addr, size, off)
    p += sz
def off(a):
    for vm, vs, fo, fs in segs:
        if vm <= a < vm + fs: return fo + a - vm
def u32(a):
    o = off(a); return struct.unpack('<I', d[o:o+4])[0] if o is not None else 0
def cs(a):
    o = off(a)
    if o is None: return '?'
    return d[o:d.index(b'\0', o)].decode('utf-8', 'replace')
imps = {}
def methods(lst, cls, meta):
    if not lst: return
    ent, cnt = u32(lst) & 0xfffc, u32(lst+4)
    for i in range(cnt):
        e = lst + 8 + i*ent
        imps[u32(e+8) & ~1] = f"{'+' if meta else '-'}[{cls} {cs(u32(e))}]"
a, size, o = sects['__objc_classlist']
for i in range(size // 4):
    c = struct.unpack('<I', d[o+4*i:o+4*i+4])[0]
    for cl, meta in ((c, False), (u32(c), True)):
        ro = u32(cl + 16) & ~3
        methods(u32(ro + 20), cs(u32(ro + 16)), meta)
lo, hi = int(sys.argv[2], 16), int(sys.argv[3], 16)
for k in sorted(imps):
    if lo <= k < hi: print(hex(k), imps[k])

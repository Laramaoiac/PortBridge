#include "game.hpp"

#include <algorithm>

#include "miniz.h"

namespace pb {
namespace {

constexpr uint16_t CH_APPHEADER = 0x2223, CH_EXTLIST = 0x2234, CH_FRAMEITEMS = 0x2229,
                   CH_FRAMEHANDLES = 0x222B, CH_GLOBALVALUES = 0x2232,
                   CH_GLOBALSTRINGS = 0x2233, CH_OTHEREXT = 0x2231, CH_FRAME = 0x3333,
                   CH_FRAMEHEADER = 0x3334, CH_FRAMENAME = 0x3335, CH_VIRTUALRECT = 0x3342,
                   CH_LAYERS = 0x3341, CH_INSTANCES = 0x3338, CH_EVENTS = 0x333D,
                   CH_IMAGES = 0x6666, CH_FONTS = 0x6667, CH_SOUNDS = 0x6668,
                   CH_OBJHEADER = 0x4444, CH_OBJNAME = 0x4445, CH_OBJPROPS = 0x4446,
                   CH_LAST = 0x7F7F;

struct Chunk {
    uint16_t id = 0, flags = 0;
    size_t data_off = 0, size = 0;   // posição/tamanho no buffer de origem
    std::vector<uint8_t> unpacked;   // só para chunks comprimidos
};

// Itera chunks a partir de p até o 0x7F7F. Chunks comprimidos são expandidos.
std::vector<Chunk> read_chunks(const uint8_t* d, size_t n, size_t p) {
    std::vector<Chunk> out;
    while (p + 8 <= n) {
        Chunk c;
        std::memcpy(&c.id, d + p, 2);
        std::memcpy(&c.flags, d + p + 2, 2);
        uint32_t sz;
        std::memcpy(&sz, d + p + 4, 4);
        if (p + 8 + sz > n) throw ParseError("chunk ultrapassa o fim do arquivo");
        c.data_off = p + 8;
        c.size = sz;
        if (c.flags & 2) throw ParseError("chunk criptografado não suportado");
        if ((c.flags & 1) && sz >= 8) {
            uint32_t usize, csize;
            std::memcpy(&usize, d + c.data_off, 4);
            std::memcpy(&csize, d + c.data_off + 4, 4);
            c.unpacked.resize(usize);
            mz_ulong out_len = usize;
            if (mz_uncompress(c.unpacked.data(), &out_len, d + c.data_off + 8, csize) != MZ_OK)
                throw ParseError("falha ao descomprimir chunk");
        }
        out.push_back(std::move(c));
        p += 8 + sz;
        if (out.back().id == CH_LAST) break;
    }
    return out;
}

Reader chunk_reader(const uint8_t* d, const Chunk& c) {
    if (!c.unpacked.empty()) return Reader(c.unpacked.data(), c.unpacked.size());
    return Reader(d + c.data_off, c.size);
}

// --------------------------------------------------------------- eventos
void read_expressions(Reader& r, size_t end, std::vector<Expr>& out) {
    while (r.pos() + 4 <= end) {
        size_t start = r.pos();
        Expr e;
        e.type = r.i16();
        e.num = r.i16();
        if (e.type == 0 && e.num == 0) break;
        uint16_t size = r.u16();
        if (size < 6) throw ParseError("token de expressão inválido");
        if (e.type == OBJ_SYSTEM) {
            switch (e.num) {
                case 0: e.ival = r.i32(); break;                 // Long
                case 3: e.sval = r.cstr(); break;                // String
                case 23: e.dval = r.f64(); break;                // Double
                case 24: case 50: r.skip(4); e.index = r.i16(); break;  // global
                default: break;
            }
        } else if (e.type >= 2 || e.type == OBJ_PLAYER) {
            e.oi = r.u16();
            e.oilist = r.i16();
            if (e.num == 16 || e.num == 19) e.index = r.i16();  // alterável
        }
        out.push_back(std::move(e));
        r.seek(start + size);
    }
}

void read_position(Reader& r, PositionParam& p) {
    p.oi_parent = r.u16();
    p.flags = r.u16();
    p.x = r.i16();
    p.y = r.i16();
    p.slope = r.i16();
    p.angle = r.i16();
    p.direction = r.i32();
    p.type_parent = r.i16();
    p.oilist_parent = r.i16();
    p.layer = r.i16();
}

bool is_expression_param(int code) {
    switch (code) {
        case 15: case 22: case 23: case 27: case 28: case 45: case 46: case 52: case 53:
        case 54: case 59: case 62: return true;
        default: return false;
    }
}

Param read_param(Reader& r, bool unicode) {
    size_t start = r.pos();
    uint16_t size = r.u16();
    Param p;
    p.file_pos = uint32_t(start);
    p.code = r.i16();
    size_t end = start + size;
    switch (p.code) {
        case P_OBJECT: p.oilist = r.i16(); p.oi = r.u16(); p.objtype = r.i16(); break;
        case P_TIME: p.i0 = r.i32(); p.i1 = r.i32(); break;
        case P_EVERY: p.i0 = r.i32(); p.i1 = r.i32(); break;
        case P_CMPTIME: p.i0 = r.i32(); p.i1 = r.i32(); p.comparison = r.i16(); break;
        case P_SAMPLE: case P_MUSIC: case P_CNDSAMPLE: case P_CNDMUSIC:
            p.i0 = r.i16(); p.i1 = r.u16(); p.str = r.cstr(unicode); break;
        case P_POSITION: case P_NEWPOSITION: read_position(r, p.pos); break;
        case P_CREATE: case P_SYSCREATE:
            read_position(r, p.pos); r.u16(); p.oi = r.u16(); r.skip(4); break;
        case P_SHOOT:
            read_position(r, p.pos); r.u16(); p.oi = r.u16(); r.skip(4); p.i0 = r.i16(); break;
        case P_ZONE: p.i0 = r.i16(); p.i1 = r.i16(); p.i2 = r.i16(); p.comparison = r.i16(); break;
        case P_CLICK: p.i0 = r.u8(); p.i1 = r.u8(); break;
        case P_COLOUR: p.i0 = int32_t(r.u32()); break;
        case P_GROUPTITLE: p.i0 = r.u16(); p.i1 = r.u16(); p.str = r.cstr(unicode); break;
        case P_GROUPPOINTER: p.i0 = r.i32(); p.i1 = r.i16(); break;
        case P_FILENAME: case P_STRING: case P_FILENAME2: case 64: p.str = r.cstr(unicode); break;
        case 47: case 51: p.i0 = r.i16(); p.i1 = r.i16(); break;  // dois shorts
        case P_EXTENSION: {
            int16_t esz = r.i16();
            p.i0 = r.i16();
            p.i1 = r.i16();
            if (esz > 6) p.raw = r.bytes(std::min<size_t>(esz - 6, end - r.pos()));
            break;
        }
        case P_INT: case P_BUFFER: case P_NEWDIRECTION: case 34: case 48: case 56:
            p.i0 = r.i32(); break;
        case P_REMARK: case P_PROGRAM: case 65: case 66: break;
        default:
            if (is_expression_param(p.code)) {
                p.comparison = r.i16();
                read_expressions(r, end, p.expr);
            } else if (end - r.pos() >= 2) {
                p.i0 = r.i16();  // parâmetros "short"
            }
    }
    r.seek(end);
    return p;
}

EventItem read_item(Reader& r, bool condition, bool unicode) {
    size_t start = r.pos();
    uint16_t size = r.u16();
    EventItem it;
    it.type = r.i16();
    it.num = r.i16();
    it.oi = r.u16();
    it.oilist = r.i16();
    it.flags = r.u8();
    it.flags2 = r.u8();
    uint8_t nparams = r.u8();
    it.def_type = r.u8();
    if (condition) it.identifier = r.u16();
    for (int i = 0; i < nparams; ++i) it.params.push_back(read_param(r, unicode));
    r.seek(start + size);
    return it;
}

void read_events(Reader r, FrameEvents& ev, bool unicode) {
    while (r.remaining() >= 4) {
        auto tag = r.bytes(4);
        std::string t(tag.begin(), tag.end());
        if (t == "ER>>") {
            r.i16(); r.i16(); r.i16();
            r.skip(17 * 2);
            int n = r.i16();
            for (int i = 0; i < n; ++i) {
                uint16_t oi = r.u16();
                int16_t type = r.i16();
                ev.qualifiers.emplace_back(oi, type);
            }
        } else if (t == "ERes") {
            r.i32();
        } else if (t == "ERev") {
            size_t end = r.pos() + r.i32();
            size_t base = r.pos();
            while (r.pos() < end) {
                size_t gstart = r.pos();
                int size = -r.i16();
                if (size <= 0) throw ParseError("grupo de eventos inválido");
                EventGroup g;
                g.offset = uint32_t(gstart);
                int nc = r.u8(), na = r.u8();
                g.flags = r.u16();
                r.skip(8);
                for (int i = 0; i < nc; ++i) g.conditions.push_back(read_item(r, true, unicode));
                for (int i = 0; i < na; ++i) g.actions.push_back(read_item(r, false, unicode));
                r.seek(gstart + size);
                ev.groups.push_back(std::move(g));
            }
        } else if (t == "ERop") {
            r.skip(r.i32());
        } else if (t == "<<ER") {
            return;
        } else {
            throw ParseError("marcador de eventos desconhecido: " + t);
        }
    }
}

// --------------------------------------------------------------- objetos
std::vector<MovementDef> read_movements(const uint8_t* b, size_t n, size_t base, bool unicode) {
    Reader r(b, n, base);
    uint32_t count = r.u32();
    if (count > 64) throw ParseError("bloco de movimentos inválido");
    std::vector<MovementDef> out;
    for (uint32_t i = 0; i < count; ++i) {
        Reader t(b, n, base + 4 + i * 16);
        int32_t name_off = t.i32(), id = t.i32(), data_off = t.i32(), data_size = t.i32();
        (void)id;
        size_t start = base + data_off;
        if (data_size < 12 || start + data_size > n) throw ParseError("movimento fora dos limites");
        Reader m(b, start + data_size, start);
        MovementDef mv;
        mv.player = m.u16();
        mv.type = m.u16();
        mv.move_at_start = m.u8() != 0;
        m.skip(3);
        mv.dirs_at_start = m.u32();
        switch (mv.type) {
            case MV_MOUSE: for (int k = 0; k < 5; ++k) mv.v.push_back(m.i16()); break;
            case MV_RACE: for (int k = 0; k < 7; ++k) mv.v.push_back(m.i16()); break;
            case MV_EIGHTDIR:
                for (int k = 0; k < 4; ++k) mv.v.push_back(m.i16());
                mv.v.push_back(int32_t(m.u32()));
                break;
            case MV_BALL: for (int k = 0; k < 5; ++k) mv.v.push_back(m.i16()); break;
            case MV_PLATFORM: for (int k = 0; k < 6; ++k) mv.v.push_back(m.i16()); break;
            case MV_PATH: {
                int steps = m.i16();
                mv.v.push_back(m.i16());  // vel. mínima
                mv.v.push_back(m.i16());  // vel. máxima
                mv.loop = m.u8();
                mv.reposition = m.u8();
                mv.reverse = m.u8();
                m.skip(1);
                for (int k = 0; k < steps; ++k) {
                    size_t s = m.pos();
                    m.skip(1);
                    uint8_t sz = m.u8();
                    PathStep st;
                    st.speed = m.u8();
                    st.direction = m.u8();
                    st.dx = m.i16();
                    st.dy = m.i16();
                    m.skip(4);  // cos, sen
                    st.length = m.i16();
                    st.pause = m.i16();
                    if (m.pos() < s + sz) st.name = m.cstr(unicode);
                    mv.steps.push_back(st);
                    if (sz < 2) throw ParseError("passo de trajetória inválido");
                    m.seek(s + sz);
                }
                break;
            }
            case MV_EXTENSION: {
                if (name_off) {
                    Reader nr(b, n, base + name_off);
                    mv.module = nr.cstr(unicode);
                    if (mv.module.size() > 4 && mv.module.substr(mv.module.size() - 4) == ".mvx")
                        mv.module.resize(mv.module.size() - 4);
                }
                m.skip(14 + 1);  // reservados + byte que os runtimes pulam
                while (m.remaining() >= 4) mv.v.push_back(m.i32());
                break;
            }
            default: break;
        }
        out.push_back(std::move(mv));
    }
    return out;
}

void read_animations(const uint8_t* b, size_t n, size_t base, std::vector<Animation>& out) {
    Reader r(b, n, base);
    r.u16();
    int count = r.u16();
    std::vector<uint16_t> offs(count);
    for (auto& o : offs) o = r.u16();
    out.resize(count);
    for (int a = 0; a < count; ++a) {
        if (!offs[a]) continue;
        size_t astart = base + offs[a];
        Reader ar(b, n, astart);
        std::array<uint16_t, 32> doffs;
        for (auto& o : doffs) o = ar.u16();
        out[a].present = true;
        for (int d = 0; d < 32; ++d) {
            if (!doffs[d]) continue;
            Reader dr(b, n, astart + doffs[d]);
            AnimDir& ad = out[a].dirs[d];
            ad.present = true;
            ad.min_speed = dr.u8();
            ad.max_speed = dr.u8();
            ad.repeat = dr.u16();
            ad.back_to = dr.u16();
            int nf = dr.u16();
            if (nf > 4096) throw ParseError("animação com quadros demais");
            ad.frames.resize(nf);
            for (auto& f : ad.frames) f = dr.u16();
        }
    }
}

void read_common(ObjectDef& o, const uint8_t* b, size_t n, bool unicode) {
    Reader r(b, n);
    r.i32();
    uint16_t o_mov = r.u16(), o_anim = r.u16();
    r.u16();
    uint16_t o_counter = r.u16(), o_data = r.u16();
    r.u16();
    o.oe_flags = r.u32();
    for (auto& q : o.qualifiers) q = r.i16();
    r.u16();  // extensão
    uint16_t o_values = r.u16(), o_strings = r.u16();
    o.flags2 = r.u16();
    o.prefs = r.u16();
    if (n >= 0x32) o.identifier.assign(reinterpret_cast<const char*>(b + 0x2E), 4);
    o.identifier.erase(std::find(o.identifier.begin(), o.identifier.end(), '\0'), o.identifier.end());

    if (o_anim) read_animations(b, n, o_anim, o.anims);
    if (o_mov) {
        try {
            o.movements = read_movements(b, n, o_mov, unicode);
        } catch (const ParseError& e) {
            o.parse_warning = std::string("movimentos: ") + e.what();
        }
    }
    if (o_values) {
        Reader v(b, n, o_values);
        int cnt = v.u16();
        for (int i = 0; i < cnt; ++i) o.values.push_back(v.i32());
    }
    if (o_strings) {
        Reader s(b, n, o_strings);
        int cnt = s.u16();
        for (int i = 0; i < cnt; ++i) o.strings.push_back(s.cstr(unicode));
    }
    if (o_counter) {
        Reader c(b, n, o_counter);
        c.u16();
        o.counter_init = c.i32();
        o.counter_min = c.i32();
        o.counter_max = c.i32();
    }
    if (o_data && (o.type == OBJ_COUNTER || o.type == OBJ_SCORE || o.type == OBJ_LIVES)) {
        Reader c(b, n, o_data);
        c.i32();
        o.counter_w = c.i32();
        o.counter_h = c.i32();
        c.i16();
        o.counter_display = c.i16();
        c.i16();
        o.counter_font = c.i16();
        if (o.counter_display == 1 || o.counter_display == 4) {
            int nf = c.i16();
            for (int i = 0; i < nf; ++i) o.counter_frames.push_back(c.u16());
        }
    }
    if (o_data && o.type == OBJ_TEXT) {
        Reader t(b, n, o_data);
        t.i32();
        o.text_w = t.i32();
        o.text_h = t.i32();
        int count = t.i32();
        std::vector<int32_t> offs(count);
        for (auto& x : offs) x = t.i32();
        for (int32_t off : offs) {
            Reader pr(b, n, o_data + off);
            TextParagraph p;
            p.font = pr.u16();
            p.flags = pr.u16();
            p.color = pr.u32();
            p.text = pr.cstr(unicode);
            o.paragraphs.push_back(std::move(p));
        }
    }
}

void read_objects(Game& g, Reader r) {
    uint32_t count = r.u32();
    const uint8_t* d = r.data();
    size_t p = r.pos();
    for (uint32_t i = 0; i < count; ++i) {
        auto parts = read_chunks(d, r.size(), p);
        if (parts.empty()) throw ParseError("objeto vazio");
        p = parts.back().data_off + parts.back().size;
        ObjectDef o;
        bool has_header = false;
        for (auto& c : parts) {
            Reader cr = chunk_reader(d, c);
            if (c.id == CH_OBJHEADER) {
                o.handle = cr.i16();
                o.type = cr.i16();
                o.flags = cr.u16();
                cr.u16();
                o.ink_effect = cr.u32();
                o.ink_param = cr.u32();
                has_header = true;
            } else if (c.id == CH_OBJNAME) {
                o.name = cr.cstr(g.unicode);
            } else if (c.id == CH_OBJPROPS && c.size) {
                // o tipo vem no cabeçalho, que precede as propriedades
                try {
                    read_common(o, cr.data(), cr.size(), g.unicode);
                } catch (const ParseError& e) {
                    o.parse_warning = e.what();
                }
            }
        }
        if (!has_header) throw ParseError("objeto sem cabeçalho");
        if (!o.parse_warning.empty()) g.warnings.push_back(o.name + ": " + o.parse_warning);
        g.objects[o.handle] = std::move(o);
    }
}

// --------------------------------------------------------------- frames
FrameDef read_frame(Game& g, const uint8_t* d, const Chunk& fc) {
    FrameDef f;
    Reader fr = chunk_reader(d, fc);
    auto subs = read_chunks(fr.data(), fr.size(), 0);
    for (auto& c : subs) {
        Reader r = chunk_reader(fr.data(), c);
        switch (c.id) {
            case CH_FRAMEHEADER:
                f.width = r.i32(); f.height = r.i32(); f.background = r.u32(); f.flags = r.u32();
                break;
            case CH_FRAMENAME: f.name = r.cstr(g.unicode); break;
            case CH_VIRTUALRECT: f.vx1 = r.i32(); f.vy1 = r.i32(); f.vx2 = r.i32(); f.vy2 = r.i32(); break;
            case CH_LAYERS: {
                uint32_t n = r.u32();
                for (uint32_t i = 0; i < n; ++i) {
                    Layer l;
                    l.flags = r.u32();
                    // O export iOS grava os coeficientes em ponto fixo 16.16; o do Windows, em float.
                    auto coef = [](uint32_t raw) {
                        if (raw != 0 && (raw & 0x7F800000u) == 0) return float(raw / 65536.0);
                        float f;
                        std::memcpy(&f, &raw, 4);
                        return f;
                    };
                    l.x_coef = coef(r.u32());
                    l.y_coef = coef(r.u32());
                    r.skip(8);
                    l.name = r.cstr(g.unicode);
                    f.layers.push_back(l);
                }
                break;
            }
            case CH_INSTANCES: {
                uint32_t n = r.u32();
                for (uint32_t i = 0; i < n; ++i) {
                    Instance in;
                    in.handle = r.u16(); in.oi = r.u16();
                    in.x = r.i32(); in.y = r.i32();
                    in.parent_type = r.i16(); in.parent_handle = r.i16(); in.layer = r.i16();
                    r.i16();
                    f.instances.push_back(in);
                }
                break;
            }
            case CH_EVENTS:
                try {
                    read_events(r, f.events, g.unicode);
                } catch (const ParseError& e) {
                    f.events_error = e.what();
                }
                break;
            default: break;
        }
    }
    if (f.layers.empty()) f.layers.push_back(Layer{"Layer 1"});
    return f;
}

// --------------------------------------------------------------- mídia
void read_images(Game& g, const Chunk& c) {
    Reader r(g.buf.data(), c.data_off + c.size, c.data_off);
    r.u16();
    int count = r.u16();
    for (int i = 0; i < count; ++i) {
        ImageInfo im;
        im.handle = r.u16(); im.format = r.u16(); im.flags = r.u16();
        im.width = r.u16(); im.height = r.u16();
        im.hot_x = r.i16(); im.hot_y = r.i16(); im.act_x = r.i16(); im.act_y = r.i16();
        im.csize = r.u32();
        im.offset = r.pos();
        if (im.format > 4) throw ParseError("banco de imagens fora do layout iOS");
        r.skip(im.csize);
        g.images[im.handle] = im;
    }
}

void read_sounds(Game& g, const Chunk& c) {
    Reader r(g.buf.data(), c.data_off + c.size, c.data_off);
    r.u16();
    int count = r.u16();
    for (int i = 0; i < count; ++i) {
        SoundInfo s;
        s.handle = r.u16();
        int len = r.u16();
        if (g.unicode) {
            std::vector<uint16_t> tmp(len);
            for (auto& ch : tmp) ch = r.u16();
            s.name = utf16_to_utf8(tmp.data(), tmp.size());
        } else {
            auto raw = r.bytes(len);
            s.name = cp1252_to_utf8(raw.data(), raw.size());
        }
        s.duration_ms = r.u32();
        s.size = r.u32();
        s.offset = r.pos();
        r.skip(s.size);
        g.sounds[s.handle] = s;
    }
}

void read_fonts(Game& g, Reader r) {
    uint32_t count = r.u32();
    for (uint32_t i = 0; i < count; ++i) {
        size_t s = r.pos();
        FontInfo f;
        f.handle = r.i32();
        r.skip(12);
        f.height = r.i32();
        r.skip(12);
        f.weight = r.i32();
        f.italic = r.u8() != 0;
        r.skip(7);
        auto face = r.bytes(32);
        size_t len = std::find(face.begin(), face.end(), 0) - face.begin();
        f.face = cp1252_to_utf8(face.data(), len);
        r.seek(s + 76);
        g.fonts.push_back(f);
    }
}

}  // namespace

std::string Game::extension_name(int obj_type) const {
    for (auto& e : extensions)
        if (e.handle + OBJ_EXTENSION_BASE == obj_type) return e.name;
    return {};
}

int Game::frame_index_from_handle(int handle) const {
    if (handle >= 0 && handle < int(frame_handles.size())) return frame_handles[handle];
    return handle;
}

bool Game::decode_image(const ImageInfo& im, std::vector<uint8_t>& rgba) const {
    static const int bpp_of[5] = {4, 2, 2, 3, 2};
    if (im.format > 4) return false;
    int bpp = bpp_of[im.format];
    size_t stride = (size_t(im.width) * bpp + 3) & ~size_t(3);
    std::vector<uint8_t> raw(stride * im.height);
    mz_ulong len = raw.size();
    if (mz_uncompress(raw.data(), &len, buf.data() + im.offset, im.csize) != MZ_OK) return false;
    rgba.resize(size_t(im.width) * im.height * 4);
    for (int y = 0; y < im.height; ++y) {
        const uint8_t* s = raw.data() + y * stride;
        uint8_t* o = rgba.data() + size_t(y) * im.width * 4;
        for (int x = 0; x < im.width; ++x, o += 4) {
            uint8_t R, G, B, A = 255;
            if (im.format == 0) {
                R = s[x * 4]; G = s[x * 4 + 1]; B = s[x * 4 + 2]; A = s[x * 4 + 3];
            } else if (im.format == 3) {
                R = s[x * 3]; G = s[x * 3 + 1]; B = s[x * 3 + 2];
            } else {
                uint16_t v = uint16_t(s[x * 2] | (s[x * 2 + 1] << 8));
                if (im.format == 1) {
                    R = ((v >> 12) & 15) * 17; G = ((v >> 8) & 15) * 17;
                    B = ((v >> 4) & 15) * 17; A = (v & 15) * 17;
                } else if (im.format == 2) {
                    R = ((v >> 11) & 31) * 255 / 31; G = ((v >> 6) & 31) * 255 / 31;
                    B = ((v >> 1) & 31) * 255 / 31; A = (v & 1) ? 255 : 0;
                } else {
                    R = ((v >> 11) & 31) * 255 / 31; G = ((v >> 5) & 63) * 255 / 63;
                    B = (v & 31) * 255 / 31;
                }
            }
            o[0] = R; o[1] = G; o[2] = B; o[3] = A;
        }
    }
    return true;
}

std::unique_ptr<Game> load_game(std::vector<uint8_t> data) {
    auto g = std::make_unique<Game>();
    g->buf = std::move(data);
    const uint8_t* d = g->buf.data();
    size_t n = g->buf.size();
    if (n < 16) throw ParseError("arquivo pequeno demais");
    if (std::memcmp(d, "PAMU", 4) == 0) g->unicode = true;
    else if (std::memcmp(d, "PAME", 4) != 0) throw ParseError("não é um jogo Clickteam (PAME/PAMU)");
    std::memcpy(&g->runtime_version, d + 4, 2);
    std::memcpy(&g->product_build, d + 12, 4);

    for (auto& c : read_chunks(d, n, 16)) {
        Reader r = chunk_reader(d, c);
        try {
            switch (c.id) {
                case CH_APPHEADER: {
                    r.i32(); r.skip(8);
                    g->width = r.u16(); g->height = r.u16();
                    g->initial_score = ~r.i32(); g->initial_lives = ~r.i32();
                    r.skip(8 + 64); r.u32();
                    g->frame_count = r.i32(); g->frame_rate = r.i32();
                    if (g->frame_rate <= 0) g->frame_rate = 60;
                    break;
                }
                case CH_EXTLIST: {
                    int count = r.u16(); r.u16();
                    for (int i = 0; i < count; ++i) {
                        size_t s = r.pos();
                        int size = std::abs(r.i16());
                        Extension e;
                        e.handle = r.i16();
                        r.skip(12);
                        e.name = r.cstr(g->unicode);
                        if (e.name.size() > 4) e.name.resize(e.name.size() - 4);  // ".mfx"
                        g->extensions.push_back(e);
                        r.seek(s + size);
                    }
                    break;
                }
                case CH_OTHEREXT: {
                    int count = r.u16();
                    for (int i = 0; i < count; ++i) g->movement_extensions.push_back(r.cstr(g->unicode));
                    break;
                }
                case CH_GLOBALVALUES: {
                    int count = r.u16();
                    std::vector<int32_t> vals(count);
                    for (auto& v : vals) v = r.i32();
                    g->global_values = vals;
                    break;
                }
                case CH_GLOBALSTRINGS: {
                    uint32_t count = r.u32();
                    for (uint32_t i = 0; i < count; ++i) g->global_strings.push_back(r.cstr(g->unicode));
                    break;
                }
                case CH_FRAMEHANDLES:
                    while (r.remaining() >= 2) g->frame_handles.push_back(r.u16());
                    break;
                case CH_FRAMEITEMS: read_objects(*g, r); break;
                case CH_FRAME: g->frames.push_back(read_frame(*g, d, c)); break;
                case CH_IMAGES: read_images(*g, c); break;
                case CH_SOUNDS: read_sounds(*g, c); break;
                case CH_FONTS: read_fonts(*g, r); break;
                default: break;
            }
        } catch (const ParseError& e) {
            g->warnings.push_back("chunk " + std::to_string(c.id) + ": " + e.what());
        }
    }
    if (g->frames.empty()) throw ParseError("jogo sem frames");
    return g;
}

}  // namespace pb

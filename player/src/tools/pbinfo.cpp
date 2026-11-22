// pbinfo: mostra o que o núcleo C++ leu de um IPA/.cci (para validar o parser).
#include <cstdio>
#include <cstdlib>
#include <map>

#include <string>

#include "core/game.hpp"
#include "core/names.hpp"
#include "core/package.hpp"

static const pb::Game* G = nullptr;

static std::string obj_name(int oi) {
    if (oi & 0x8000) return "qualif" + std::to_string(oi & 0x7FFF);
    auto* o = G->object(oi);
    return o ? o->name : "oi" + std::to_string(oi);
}

static std::string expr_str(const std::vector<pb::Expr>& ex) {
    std::string s;
    for (auto& e : ex) {
        if (!s.empty()) s += ' ';
        if (e.type == -1 && e.num == 0) s += std::to_string(e.ival);
        else if (e.type == -1 && e.num == 23) s += std::to_string(e.dval);
        else if (e.type == -1 && e.num == 3) s += '"' + e.sval + '"';
        else if (e.type == -1 && (e.num == 24 || e.num == 50)) s += (e.num == 24 ? "GV" : "GS") + std::to_string(e.index);
        else if (e.type == -1 && e.num == -1) s += '(';
        else if (e.type == -1 && e.num == -2) s += ')';
        else if (e.type == -1 && e.num == -3) s += ',';
        else if (e.type == 0) {
            static const char* ops[] = {"?", "+", "-", "*", "/", "mod", "pow", "and", "or", "xor"};
            s += (e.num / 2 <= 9) ? ops[e.num / 2] : "op?";
        } else {
            s += pb::item_name(pb::ItemKind::Expression, e.type, e.num);
            if (e.type >= 2) s += "[" + obj_name(e.oi) + "]";
            if (e.num == 16 || e.num == 19) s += "#" + std::to_string(e.index);
        }
    }
    return s;
}

static std::string param_str(const pb::Param& p) {
    static const char* cmp[] = {"==", "!=", "<=", "<", ">=", ">"};
    if (!p.expr.empty()) {
        std::string c = (p.code == 23 || p.code == 46) && p.comparison >= 0 && p.comparison < 6 ? std::string(cmp[p.comparison]) + " " : "";
        return c + expr_str(p.expr);
    }
    switch (p.code) {
        case pb::P_OBJECT: return "obj " + obj_name(p.oi);
        case pb::P_CREATE: case pb::P_SHOOT:
            return "create " + obj_name(p.oi) + " @(" + std::to_string(p.pos.x) + "," + std::to_string(p.pos.y) + ") parent=" + (p.pos.type_parent ? obj_name(p.pos.oi_parent) : std::string("frame")) + " layer=" + std::to_string(p.pos.layer);
        case pb::P_POSITION: case pb::P_NEWPOSITION:
            return "pos (" + std::to_string(p.pos.x) + "," + std::to_string(p.pos.y) + ") parent=" + (p.pos.type_parent ? obj_name(p.pos.oi_parent) : std::string("frame"));
        case pb::P_SAMPLE: case pb::P_CNDSAMPLE: return "sample " + std::to_string(p.i0) + " '" + p.str + "'";
        case pb::P_GROUPTITLE: return "group '" + p.str + "' id=" + std::to_string(p.i1) + " flags=" + std::to_string(p.i0);
        case pb::P_GROUPPOINTER: return "group id=" + std::to_string(p.i1) + " ptr=" + std::to_string(p.i0);
        case pb::P_TIME: case pb::P_EVERY: return std::to_string(p.i0) + "ms";
        case pb::P_ZONE: return "zone(" + std::to_string(p.i0) + "," + std::to_string(p.i1) + ")-(" + std::to_string(p.i2) + "," + std::to_string(p.comparison) + ")";
        case pb::P_EXTENSION: return "ext data " + std::to_string(p.raw.size()) + "b";
        default: return "p" + std::to_string(p.code) + "=" + std::to_string(p.i0) + (p.str.empty() ? "" : " '" + p.str + "'");
    }
}

static void dump_events(const pb::FrameDef& f, size_t from, size_t count) {
    for (size_t i = from; i < f.events.groups.size() && i < from + count; ++i) {
        auto& g = f.events.groups[i];
        std::printf("#%zu flags=%04x @%u\n", i, g.flags, g.offset);
        for (auto* list : {&g.conditions, &g.actions}) {
            bool cond = list == &g.conditions;
            for (auto& it : *list) {
                std::printf("   %s %s%s", cond ? "?" : "!", cond && it.negated() ? "NOT " : "",
                            pb::item_name(cond ? pb::ItemKind::Condition : pb::ItemKind::Action, it.type, it.num).c_str());
                if (it.type >= 2) std::printf(" [%s]", obj_name(it.oi).c_str());
                for (auto& p : it.params) std::printf(" | %s", param_str(p).c_str());
                std::printf("\n");
            }
        }
    }
}

int main(int argc, char** argv) {
    if (argc < 2) {
        std::fprintf(stderr, "uso: pbinfo <jogo.ipa | Application.cci>\n");
        return 2;
    }
    try {
        pb::PackageInfo pkg = pb::open_package(argv[1]);
        auto g = pb::load_game(std::move(pkg.game_data));
        G = g.get();
        if (argc > 3 && std::string(argv[2]) == "--instances") {
            const auto& f = g->frames[size_t(std::atoi(argv[3]))];
            for (const auto& in : f.instances) {
                const pb::ObjectDef* od = g->object(in.oi);
                std::string mv;
                if (od) for (const auto& m : od->movements) mv += " mov" + std::to_string(m.type) + (m.move_at_start ? "*" : "");
                std::printf("%-24s (%d,%d) camada %d pai %d%s\n", od ? od->name.c_str() : "?", in.x, in.y, in.layer,
                            in.parent_type, mv.c_str());
            }
            return 0;
        }
        if (argc > 2 && std::string(argv[2]) == "--objects") {
            // Contadores, textos e fontes: o que o runtime precisa desenhar além das imagens.
            for (const auto& f : g->fonts)
                std::printf("fonte %d '%s' altura %d peso %d%s\n", f.handle, f.face.c_str(), f.height, f.weight,
                            f.italic ? " itálico" : "");
            if (argc > 3) {  // --objects NOME: flags de um objeto
                for (const auto& [h, o] : g->objects)
                    if (o.name == argv[3])
                        std::printf("%d '%s' tipo %d oe_flags %#x flags %#x flags2 %#x prefs %#x neverkill %d\n", h,
                                    o.name.c_str(), o.type, o.oe_flags, o.flags, o.flags2, o.prefs,
                                    int((o.oe_flags & 0x2000) != 0));
                for (const auto& [h, o] : g->objects)  // valores alteráveis iniciais (A, B, C...)
                    if (o.name == argv[3] && !o.values.empty()) {
                        std::printf("  valores iniciais:");
                        for (size_t i = 0; i < o.values.size(); ++i)
                            if (o.values[i]) std::printf(" %c=%d", char('A' + (i < 26 ? i : 25)), o.values[i]);
                        std::printf("\n");
                    }
                for (const auto& [h, o] : g->objects)
                    if (o.name == argv[3])
                        for (const auto& a : o.anims)
                            for (const auto& d : a.dirs)
                                if (d.present && !d.frames.empty()) {
                                    auto it = g->images.find(d.frames[0]);
                                    if (it != g->images.end())
                                        std::printf("  imagem %d: %dx%d ponto quente (%d,%d) ação (%d,%d)\n", d.frames[0],
                                                    it->second.width, it->second.height, it->second.hot_x,
                                                    it->second.hot_y, it->second.act_x, it->second.act_y);
                                    goto movs;
                                }
            movs:
                for (const auto& [h, o] : g->objects)
                    if (o.name == argv[3])
                        for (const auto& m : o.movements) {
                            std::printf("  movimento tipo %d %s:", m.type, m.module.c_str());
                            for (auto v : m.v) std::printf(" %d", v);
                            std::printf("\n");
                        }
            next_obj:
                return 0;
            }
                        static const char* kDisp[] = {"oculto", "números", "barra vertical", "barra horizontal", "animação", "texto"};
            for (const auto& [h, o] : g->objects) {
                if (o.type == pb::OBJ_COUNTER || o.type == pb::OBJ_SCORE || o.type == pb::OBJ_LIVES)
                    std::printf("contador %d '%s' tipo %d exibição %d (%s) %dx%d fonte %d imagens %zu valor %d [%d..%d] visível %d\n",
                                h, o.name.c_str(), o.type, o.counter_display,
                                o.counter_display >= 0 && o.counter_display < 6 ? kDisp[o.counter_display] : "?",
                                o.counter_w, o.counter_h, o.counter_font, o.counter_frames.size(), o.counter_init,
                                o.counter_min, o.counter_max, int(o.visible_at_start()));
                if (o.counter_display == 2 || o.counter_display == 3 || o.counter_display == 5)
                    std::printf("   preenchimento %d cor1 %#08x cor2 %#08x flags %#x\n", o.counter_fill, o.counter_color1, o.counter_color2, o.counter_flags);
                if (o.type == pb::OBJ_TEXT) {
                    std::printf("texto %d '%s' %dx%d visível %d\n", h, o.name.c_str(), o.text_w, o.text_h,
                                int(o.visible_at_start()));
                    for (const auto& p : o.paragraphs)
                        std::printf("   fonte %d flags %#06x cor %#08x \"%s\"\n", p.font, p.flags, p.color, p.text.c_str());
                }
            }
            return 0;
        }
        if (argc > 2 && std::string(argv[2]) == "--layers") {
            for (size_t fi = 0; fi < g->frames.size(); ++fi) {
                const auto& f = g->frames[fi];
                std::printf("frame %zu '%s' %dx%d\n", fi, f.name.c_str(), f.width, f.height);
                for (const auto& l : f.layers)
                    std::printf("   %-10s flags %#06x  coef x %.3f  y %.3f\n", l.name.c_str(), l.flags, l.x_coef, l.y_coef);
            }
            return 0;
        }
        if (argc > 3 && std::string(argv[2]) == "--group-pointers") {
            // calibra a fórmula dos "group pointers": alvo = pos + ptr + k
            int fi = std::atoi(argv[3]);
            const auto& ev = g->frames[size_t(fi)].events;
            std::map<uint32_t, size_t> starts;
            for (size_t i = 0; i < ev.groups.size(); ++i) starts[ev.groups[i].offset] = i;
            std::map<long, int> hits;
            int total = 0;
            for (size_t i = 0; i < ev.groups.size(); ++i)
                for (auto& a : ev.groups[i].actions)
                    for (auto& p : a.params)
                        if (p.code == pb::P_GROUPPOINTER) {
                            ++total;
                            for (long k = -64; k <= 64; ++k) {
                                auto it = starts.find(uint32_t(long(p.file_pos) + p.i0 + k));
                                if (it != starts.end()) {
                                    auto& c = ev.groups[it->second].conditions;
                                    if (!c.empty() && c[0].type == -1 && c[0].num == -10) ++hits[k];
                                }
                            }
                        }
            std::printf("ponteiros: %d\n", total);
            for (auto& [k, n] : hits) std::printf("k=%ld acertos=%d\n", k, n);
            return 0;
        }
        if (argc > 3 && std::string(argv[2]) == "--events") {
            int fi = std::atoi(argv[3]);
            size_t from = argc > 4 ? std::strtoul(argv[4], nullptr, 10) : 0;
            size_t count = argc > 5 ? std::strtoul(argv[5], nullptr, 10) : 100000;
            dump_events(g->frames.at(fi), from, count);
            return 0;
        }
        std::printf("pacote: %s  nome: %s  id: %s  versão: %s\n", pkg.kind.c_str(),
                    pkg.display_name.c_str(), pkg.bundle_id.c_str(), pkg.version.c_str());
        std::printf("tela %dx%d  %d fps  frames %zu  build %u  ícone %zu bytes\n", g->width,
                    g->height, g->frame_rate, g->frames.size(), g->product_build, pkg.icon.size());
        std::printf("objetos %zu  imagens %zu  sons %zu  fontes %zu  extensões %zu\n",
                    g->objects.size(), g->images.size(), g->sounds.size(), g->fonts.size(),
                    g->extensions.size());
        std::map<std::string, int> mv;
        size_t anims = 0;
        for (auto& [h, o] : g->objects) {
            for (auto& m : o.movements) mv[m.type == pb::MV_EXTENSION ? m.module : std::to_string(m.type)]++;
            if (!o.anims.empty()) ++anims;
        }
        std::printf("objetos com animação %zu  movimentos:", anims);
        for (auto& [k, v] : mv) std::printf(" %s=%d", k.c_str(), v);
        std::printf("\n");
        size_t groups = 0, conds = 0, acts = 0, exprs = 0;
        for (auto& f : g->frames) {
            groups += f.events.groups.size();
            for (auto& gr : f.events.groups) {
                conds += gr.conditions.size();
                acts += gr.actions.size();
                for (auto* list : {&gr.conditions, &gr.actions})
                    for (auto& it : *list)
                        for (auto& p : it.params) exprs += p.expr.size();
            }
            std::printf("  frame %-22s %4dx%-4d instâncias %4zu  grupos %5zu %s\n", f.name.c_str(),
                        f.width, f.height, f.instances.size(), f.events.groups.size(),
                        f.events_error.c_str());
        }
        std::printf("grupos %zu  condições %zu  ações %zu  tokens de expressão %zu\n", groups,
                    conds, acts, exprs);
        std::printf("frame_handles:");
        for (auto h : g->frame_handles) std::printf(" %u", h);
        std::printf("\navisos: %zu\n", g->warnings.size());
        for (size_t i = 0; i < g->warnings.size() && i < 10; ++i)
            std::printf("  %s\n", g->warnings[i].c_str());
        if (argc > 2) {  // decodifica todas as imagens (teste de integridade)
            std::vector<uint8_t> rgba;
            size_t ok = 0;
            for (auto& [h, im] : g->images) ok += g->decode_image(im, rgba);
            std::printf("imagens decodificadas: %zu/%zu\n", ok, g->images.size());
            double px = 0;
            for (const auto& [h, im] : g->images) px += double(im.width) * im.height;
            std::printf("pixels de todas as imagens: %.1f milhões (%.0f MB como textura RGBA)\n", px / 1e6, px * 4 / 1048576);
        }
    } catch (const std::exception& e) {
        std::fprintf(stderr, "erro: %s\n", e.what());
        return 1;
    }
    return 0;
}

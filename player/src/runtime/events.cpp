// Interpretador de eventos Clickteam.
//
// A cada loop os grupos de eventos são avaliados em ordem. Condições sobre objetos
// filtram a "seleção" de instâncias; as ações seguintes valem só para as instâncias
// selecionadas (ou para todas, se o objeto não apareceu nas condições).
#include <algorithm>
#include <cmath>
#include <cstdlib>

#include "core/names.hpp"
#include "runtime/audio.hpp"
#include "runtime/diag.hpp"
#include "runtime/runtime.hpp"

namespace pb {
namespace {

constexpr double kPi = 3.14159265358979323846;

int param_int(EvalContext& c, const Param& p) {
    if (!p.expr.empty()) return eval_expr(c, p.expr).as_int();
    return p.i0;
}

Value param_value(EvalContext& c, const Param& p) {
    if (!p.expr.empty()) return eval_expr(c, p.expr);
    if (!p.str.empty()) return Value(p.str);
    return Value(p.i0);
}

bool cmp_param(EvalContext& c, const Param& p, const Value& lhs) {
    return compare(lhs, p.comparison, eval_expr(c, p.expr));
}

uint32_t colorref_to_rgb(uint32_t c) {
    return ((c & 0xFF) << 16) | (c & 0xFF00) | ((c >> 16) & 0xFF);
}

const Param* P(const EventItem& it, size_t i) { return i < it.params.size() ? &it.params[i] : nullptr; }

bool in_zone(double x, double y, const Param& z) {
    return x >= z.i0 && x < z.i2 && y >= z.i1 && y < z.comparison;
}

// Filtra as instâncias de `it.oi` com um predicado (respeitando "NOT").
// Com "NOT" e nenhuma instância (o objeto não existe), a condição é verdadeira,
// como no Clickteam: nenhum objeto satisfaz a condição positiva. Ex.: na loja do
// Zorbié, "NOT descrição sobrepondo o botão" com a descrição ainda inexistente
// precisa ser verdadeiro para o item poder ser escolhido (senão a loja trava).
template <class Pred>
bool filter(EvalContext& c, const EventItem& it, Pred pred) {
    bool any = false;
    for (int oi : c.f.expand_oi(it.oi)) {
        std::vector<Obj*> cand;
        if (c.s.touched.count(oi)) cand = c.s.sel[oi];
        else cand = c.f.instances(oi);
        std::vector<Obj*> kept;
        bool live = false;
        for (Obj* o : cand) {
            if (o->destroyed) continue;
            live = true;
            c.current = o;
            c.current_oi = oi;
            bool r = pred(o);
            if (it.negated()) r = !r;
            if (r) kept.push_back(o);
        }
        any |= !kept.empty() || (it.negated() && !live);
        c.s.sel[oi] = std::move(kept);
        c.s.touched.insert(oi);
    }
    c.current = nullptr;
    c.current_oi = -1;
    return any;
}

// Condições de colisão: seleciona os dois lados.
bool collision(EvalContext& c, const EventItem& it, int gi, bool edge) {
    const Param* p = P(it, 0);
    if (!p) return false;
    App& app = c.f.app;
    auto others = targets(c, p->oi);
    std::vector<Obj*> other_kept;
    auto& st = c.f.event_state[size_t(gi)];
    (void)st;
    bool any = false;
    for (int oi : c.f.expand_oi(it.oi)) {
        std::vector<Obj*> cand = c.s.touched.count(oi) ? c.s.sel[oi] : c.f.instances(oi);
        std::vector<Obj*> kept;
        bool live = false;
        for (Obj* a : cand) {
            if (a->destroyed) continue;
            live = true;
            bool hit = false;
            for (Obj* b : others) {
                if (b == a || b->destroyed) continue;
                if (!overlap(app, *a, *b)) continue;
                if (edge) {
                    bool moved = a->x != a->prev_x || a->y != a->prev_y || b->x != b->prev_x ||
                                 b->y != b->prev_y;
                    if (!moved) continue;
                }
                hit = true;
                if (!it.negated() &&
                    std::find(other_kept.begin(), other_kept.end(), b) == other_kept.end())
                    other_kept.push_back(b);
            }
            if (it.negated()) hit = !hit;
            if (hit) kept.push_back(a);
        }
        any |= !kept.empty() || (it.negated() && !live);  // NOT sem instâncias: verdadeiro
        c.s.sel[oi] = std::move(kept);
        c.s.touched.insert(oi);
    }
    if (any && !it.negated()) {
        for (int oi : c.f.expand_oi(p->oi)) {
            std::vector<Obj*> v;
            for (Obj* b : other_kept)
                if (b->oi == oi) v.push_back(b);
            c.s.sel[oi] = v;
            c.s.touched.insert(oi);
        }
    }
    return any;
}

bool mouse_over(App& app, Obj* o) {
    Frame* f = app.frame();
    double ox = 0, oy = 0;
    f->layer_offset(o->layer, ox, oy);   // mesma posição em que o objeto é desenhado
    double mx = app.input.mouse_x + ox, my = app.input.mouse_y + oy;
    if (!o->visible) return false;
    Rect r = obj_rect(app, *o);
    return mx >= r.x1 && mx < r.x2 && my >= r.y1 && my < r.y2;
}

// "Mouse sobre X" / "X clicado": verdadeiro se o ponteiro está sobre alguma instância.
// Com NOT, verdadeiro se não está sobre nenhuma (mesmo quando X não existe).
bool mouse_objects(EvalContext& c, const EventItem& it, int oi, bool gate) {
    std::vector<Obj*> hit;
    if (gate)
        for (Obj* o : targets(c, oi))
            if (mouse_over(c.f.app, o)) hit.push_back(o);
    if (it.negated()) return hit.empty();
    if (hit.empty()) return false;
    for (int m : c.f.expand_oi(oi)) {
        std::vector<Obj*> v;
        for (Obj* o : hit) if (o->oi == m) v.push_back(o);
        c.s.sel[m] = v;
        c.s.touched.insert(m);
    }
    return true;
}

int click_button(int b) { return b == 1 ? 2 : b == 2 ? 1 : 0; }  // 0 esq., 1 meio, 2 dir. -> SDL

bool condition(EvalContext& c, const EventItem& it, int gi) {
    Frame& f = c.f;
    App& app = f.app;
    EventState& st = f.event_state[size_t(gi)];
    auto neg = [&](bool v) { return it.negated() ? !v : v; };
    const Param* p0 = P(it, 0);
    const Param* p1 = P(it, 1);

    switch (it.type) {
        case OBJ_SYSTEM:
            switch (it.num) {
                case -1: return neg(true);
                case -2: return neg(false);
                case -3: return p0 && p1 && neg(cmp_param(c, *p1, param_value(c, *p0)));
                case -4: {  // restringir ações por X
                    uint32_t t = p0 ? uint32_t(param_int(c, *p0)) : 0;
                    if (f.timer_ms - st.restrict_last >= t || st.restrict_last == 0) {
                        st.restrict_last = f.timer_ms;
                        return true;
                    }
                    return false;
                }
                case -5: {  // repetir N vezes
                    int n = p0 ? param_int(c, *p0) : 1;
                    if (st.repeat_count < n) { ++st.repeat_count; return true; }
                    return false;
                }
                case -6:
                    if (!st.once_done) { st.once_done = true; return true; }
                    return false;
                case -7: {
                    bool r = st.not_always_stamp != f.loop - 1;
                    st.not_always_stamp = f.loop;
                    return r;
                }
                case -8: {
                    if (!p0 || !p1) return false;
                    size_t idx = size_t(param_int(c, *p0));
                    Value v = idx < app.global_values.size() ? app.global_values[idx] : Value(0);
                    return neg(cmp_param(c, *p1, v));
                }
                case -9: case -10: case -11: case -24: case -25: return true;
                case -20: {
                    if (!p0 || !p1) return false;
                    size_t idx = size_t(param_int(c, *p0));
                    std::string v = idx < app.global_strings.size() ? app.global_strings[idx] : "";
                    return neg(cmp_param(c, *p1, Value(v)));
                }
                case -26: {
                    int pct = p0 ? param_int(c, *p0) : 50;
                    return neg(int(app.rng()() % 100) < pct);
                }
                default: break;
            }
            break;
        case OBJ_SOUND: {
            Audio* au = app.audio();
            switch (it.num) {
                case -1: return neg(!(au && p0 && au->sound_playing(p0->i0)));
                case -3: return neg(!(au && au->any_playing()));
                case -8: return neg(!(au && p0 && au->channel_playing(param_int(c, *p0))));
                case -9: return neg(au && p0 && au->channel_paused(param_int(c, *p0)));
                default: break;
            }
            break;
        }
        case OBJ_GAME:
            switch (it.num) {
                case -1: return neg(f.loop == 1);
                case -2: return neg(false);
                case -8: return neg(app.resumed_flag);
                default: break;
            }
            break;
        case OBJ_TIMER: {
            uint32_t t = p0 ? uint32_t(param_int(c, *p0)) : 0;
            switch (it.num) {
                case -1: return neg(f.timer_ms > t);
                case -2: return neg(f.timer_ms < t);
                case -3:
                    if (!st.timer_equals_done && f.timer_ms >= t) { st.timer_equals_done = true; return true; }
                    return false;
                case -4: case -8:
                    if (t == 0) return true;
                    if (f.timer_ms - st.every_last >= t) {
                        st.every_last += t * ((f.timer_ms - st.every_last) / t);
                        return true;
                    }
                    return false;
                default: break;
            }
            break;
        }
        case OBJ_KEYBOARD: {
            auto& in = app.input;
            switch (it.num) {
                case -1: case -2: return neg(false);  // teclado: não há no celular
                case -3: {
                    double mx = in.mouse_x + f.scroll_x, my = in.mouse_y + f.scroll_y;
                    return p0 && neg(in_zone(mx, my, *p0));
                }
                case -4: return p0 && mouse_objects(c, it, p0->oi, true);
                case -5: {
                    int b = p0 ? click_button(p0->i0) : 0;
                    bool dbl = p0 && p0->i1;
                    return neg(in.clicked[b] && (!dbl || in.dbl[b]));
                }
                case -6: {
                    int b = p0 ? click_button(p0->i0) : 0;
                    double mx = in.mouse_x + f.scroll_x, my = in.mouse_y + f.scroll_y;
                    return p1 && neg(in.clicked[b] && in_zone(mx, my, *p1));
                }
                case -7: {
                    int b = p0 ? click_button(p0->i0) : 0;
                    return p1 && mouse_objects(c, it, p1->oi, in.clicked[b]);
                }
                case -8: {
                    int key = p0 ? p0->i0 : 1;
                    bool down = key == 2 ? in.down[2] : key == 4 ? in.down[1] : in.down[0];
                    return neg(down);
                }
                default: break;
            }
            break;
        }
        default: break;
    }

    if (it.type >= OBJ_EXTENSION_BASE && it.num <= -80) {
        bool handled = false;
        bool any = false, called = false;
        for (int oi : f.expand_oi(it.oi)) {
            for (Obj* o : f.instances(oi)) {
                called = true;
                any |= ext_condition(c, it, o, handled);
            }
        }
        if (!called) any = ext_condition(c, it, nullptr, handled);
        if (!handled) app.note_unimplemented(item_name(ItemKind::Condition, it.type, it.num));
        return neg(any);
    }

    if (it.type >= 0) {
        switch (it.num) {
            case -1: return p0 && filter(c, it, [&](Obj* o) { return cmp_param(c, *p0, Value(o->frame)); });
            case -2: {
                int a = p0 ? param_int(c, *p0) : 0;
                return filter(c, it, [&](Obj* o) { return o->anim_finished == a; });
            }
            case -3: {
                int a = p0 ? param_int(c, *p0) : 0;
                // Uma animação com repetições finitas deixa de "tocar" quando termina.
                return filter(c, it, [&](Obj* o) { return o->anim == a && !o->anim_stopped && !o->anim_done; });
            }
            case -4: return collision(c, it, gi, false);
            case -14: return collision(c, it, gi, true);
            case -7: return filter(c, it, [&](Obj* o) { return o->speed() == 0; });
            case -8: {
                uint32_t mask = p0 ? uint32_t(p0->expr.empty() ? p0->i0 : (1u << (param_int(c, *p0) & 31))) : 0;
                return filter(c, it, [&](Obj* o) { return (mask >> (o->dir & 31)) & 1; });
            }
            case -15: return p0 && filter(c, it, [&](Obj* o) { return cmp_param(c, *p0, Value(o->speed())); });
            case -16: return p0 && filter(c, it, [&](Obj* o) { return cmp_param(c, *p0, Value(int64_t(std::floor(o->y)))); });
            case -17: return p0 && filter(c, it, [&](Obj* o) { return cmp_param(c, *p0, Value(int64_t(std::floor(o->x)))); });
            case -21: return filter(c, it, [&](Obj* o) { return o->mv() && o->mv()->finished(); });
            case -24: case -25: {
                int bit = p0 ? param_int(c, *p0) : 0;
                bool want = it.num == -25;
                return filter(c, it, [&](Obj* o) { return bool((o->flags >> (bit & 31)) & 1) == want; });
            }
            case -27: {
                if (!p0 || !p1) return false;
                size_t idx = size_t(param_int(c, *p0));
                return filter(c, it, [&](Obj* o) {
                    Value v = idx < o->values.size() ? o->values[idx] : Value(0);
                    return cmp_param(c, *p1, v);
                });
            }
            case -28: return filter(c, it, [&](Obj* o) { return !o->visible; });
            case -29: return filter(c, it, [&](Obj* o) { return o->visible; });
            case -30: case -31: {
                if (!p0) return false;
                std::vector<Obj*> inside;
                for (Obj* o : targets(c, it.oi))
                    if (in_zone(o->x, o->y, *p0)) inside.push_back(o);
                if (it.num == -31) return neg(inside.empty());
                bool ok = p1 ? cmp_param(c, *p1, Value(int64_t(inside.size()))) : !inside.empty();
                if (!neg(ok)) return false;
                for (int oi : f.expand_oi(it.oi)) {
                    std::vector<Obj*> v;
                    for (Obj* o : inside) if (o->oi == oi) v.push_back(o);
                    c.s.sel[oi] = v;
                    c.s.touched.insert(oi);
                }
                return true;
            }
            case -32: {
                if (!p0) return false;
                int64_t n = 0;
                for (int oi : f.expand_oi(it.oi)) n += int64_t(f.instances(oi).size());
                return neg(cmp_param(c, *p0, Value(n)));
            }
            case -34: {
                auto t = targets(c, it.oi);
                if (t.empty()) return false;
                Obj* pick = t[app.rng()() % t.size()];
                for (int oi : f.expand_oi(it.oi)) {
                    c.s.sel[oi] = pick->oi == oi ? std::vector<Obj*>{pick} : std::vector<Obj*>{};
                    c.s.touched.insert(oi);
                }
                return true;
            }
            case -81:
                if (it.type == OBJ_COUNTER || it.type == OBJ_SCORE || it.type == OBJ_LIVES ||
                    (it.oi & 0x8000))
                    return p0 && filter(c, it, [&](Obj* o) {
                        double v = o->counter;
                        return cmp_param(c, *p0, std::floor(v) == v ? Value(int64_t(v)) : Value(v));
                    });
                break;
            default: break;
        }
    }
    app.note_unimplemented(item_name(ItemKind::Condition, it.type, it.num));
    return false;
}

// ---------------------------------------------------------------- posições
struct Pos { double x, y; int layer; int dir; Obj* parent; };

std::vector<Pos> resolve_position(EvalContext& c, const PositionParam& p) {
    std::vector<Pos> out;
    int layer = p.layer;
    if (p.type_parent == 0 || p.oi_parent == 0xFFFF) {
        out.push_back({double(p.x), double(p.y), layer < 0 ? 0 : layer, p.direction & 31, nullptr});
        return out;
    }
    for (Obj* par : targets(c, p.oi_parent)) {
        double dx = p.x, dy = p.y;
        if (p.flags & 1) {  // relativo à direção do pai
            double a = par->dir * kPi / 16.0;
            double rx = dx * std::cos(a) + dy * std::sin(a);
            double ry = -dx * std::sin(a) + dy * std::cos(a);
            dx = rx;
            dy = ry;
        }
        double bx = par->x, by = par->y;
        if (p.flags & 2) {  // ponto de ação do pai
            if (const ImageInfo* im = par->image >= 0 ? c.f.app.image(par->image) : nullptr) {
                bx += (im->act_x - im->hot_x) * par->scale_x;
                by += (im->act_y - im->hot_y) * par->scale_y;
            }
        }
        int dir = (p.flags & 4) ? par->dir : (p.direction & 31);
        // relativo a um objeto: nasce na camada do objeto-pai (o valor de camada
        // gravado no parâmetro vale só para posições relativas ao frame)
        out.push_back({bx + dx, by + dy, par->layer, dir, par});
    }
    return out;
}

int direction_param(EvalContext& c, const Param& p) {
    if (!p.expr.empty()) return param_int(c, p) & 31;
    return dir_from_mask(c.f.app, uint32_t(p.i0));
}

void set_alterable(Obj* o, size_t idx, const Value& v, int mode) {
    if (idx >= o->values.size()) o->values.resize(idx + 1);
    Value& cur = o->values[idx];
    if (mode == 0) cur = v;
    else if (mode == 1) cur = (cur.kind == Value::INT && v.kind == Value::INT) ? Value(cur.i + v.i) : Value(cur.num() + v.num());
    else cur = (cur.kind == Value::INT && v.kind == Value::INT) ? Value(cur.i - v.i) : Value(cur.num() - v.num());
}

void set_global(App& app, size_t idx, const Value& v, int mode) {
    if (idx >= app.global_values.size()) app.global_values.resize(idx + 1);
    Value& cur = app.global_values[idx];
    if (mode == 0) cur = v;
    else if (mode == 1) cur = (cur.kind == Value::INT && v.kind == Value::INT) ? Value(cur.i + v.i) : Value(cur.num() + v.num());
    else cur = (cur.kind == Value::INT && v.kind == Value::INT) ? Value(cur.i - v.i) : Value(cur.num() - v.num());
}

void set_counter(Obj* o, double v) {
    if (o->counter_max > o->counter_min) v = std::clamp(v, o->counter_min, o->counter_max);
    o->counter = v;
}

void set_group(Frame& f, const Param& p, bool active) {
    // PB_GROUPS=1: registra cada mudança de grupo com o nome (depuração).
    static const bool log_groups = std::getenv("PB_GROUPS") != nullptr;
    auto apply = [&](int index) {
        GroupInfo& g = f.groups[size_t(index)];
        if (log_groups && g.active != active) {
            const auto& c0 = f.def.events.groups[size_t(index)].conditions;
            SDL_Log("grupo %s frame %d passo %lld: #%d '%s'", active ? "ligado" : "desligado", f.index,
                    (long long)f.loop, index, c0.empty() || c0[0].params.empty() ? "" : c0[0].params[0].str.c_str());
        }
        if (active && !g.active) g.just_activated = true;
        g.active = active;
    };
    // O alvo real é a posição apontada (posição do parâmetro + ponteiro). O id
    // não basta: os eventos de behaviors reaproveitam ids (0, 1, 2...) que
    // também existem nos grupos do frame.
    auto at = f.group_by_offset.find(uint32_t(int64_t(p.file_pos) + p.i0));
    if (at != f.group_by_offset.end()) {
        apply(at->second);
        return;
    }
    auto range = f.group_by_id.equal_range(p.i1);
    for (auto it = range.first; it != range.second; ++it) apply(it->second);
}

std::vector<Obj*> create_objects(EvalContext& c, const Param& p) {
    std::vector<Obj*> made;
    for (const Pos& pos : resolve_position(c, p.pos)) {
        Obj* o = c.f.create(p.oi, pos.x, pos.y, pos.layer);
        if (!o) continue;
        if (pos.parent && (p.pos.flags & 4)) o->dir = pos.parent->dir;
        made.push_back(o);
    }
    if (!made.empty()) {
        c.s.sel[p.oi] = made;
        c.s.touched.insert(p.oi);
    }
    return made;
}

void shoot(EvalContext& c, Obj* shooter, const Param& sp, const Param* toward) {
    EvalContext sc{c.f, c.s, shooter, shooter->oi};
    PositionParam pp = sp.pos;
    std::vector<Obj*> par{shooter};
    double bx = shooter->x + pp.x, by = shooter->y + pp.y;
    if (pp.flags & 2) {
        if (const ImageInfo* im = shooter->image >= 0 ? c.f.app.image(shooter->image) : nullptr) {
            bx += (im->act_x - im->hot_x) * shooter->scale_x;
            by += (im->act_y - im->hot_y) * shooter->scale_y;
        }
    }
    Obj* b = c.f.create(sp.oi, bx, by, pp.layer < 0 ? shooter->layer : pp.layer);
    if (!b) return;
    double angle = shooter->dir * 11.25;
    if (toward) {
        auto tp = resolve_position(sc, toward->pos);
        if (!tp.empty()) angle = std::atan2(-(tp[0].y - by), tp[0].x - bx) * 180.0 / kPi;
    }
    b->movements.clear();
    MovementDef def;
    def.type = 13;  // bala
    def.v = {int32_t(sp.i0), int32_t(std::lround(angle * 1000))};
    b->movements.push_back(make_movement(b, def));
    b->mv_index = 0;
    b->dir = int(std::lround(((angle < 0 ? angle + 360 : angle)) / 11.25)) & 31;
    c.s.sel[sp.oi] = {b};
    c.s.touched.insert(sp.oi);
}

void object_action(EvalContext& c, const EventItem& it, Obj* o) {
    Frame& f = c.f;
    App& app = f.app;
    const Param* p0 = P(it, 0);
    const Param* p1 = P(it, 1);
    Movement* mv = o->mv();
    switch (it.num) {
        case 1:
            if (p0) {
                auto pos = resolve_position(c, p0->pos);
                if (!pos.empty()) {
                    const Pos& q = pos[size_t(std::max(0, c.loop_index)) % pos.size()];
                    o->x = q.x;
                    o->y = q.y;
                }
            }
            return;
        case 2: if (p0) o->x = eval_expr(c, p0->expr).num(); return;
        case 3: if (p0) o->y = eval_expr(c, p0->expr).num(); return;
        case 4: if (mv) mv->stop(); return;
        case 5: if (mv) mv->start(); return;
        case 6: if (mv && p0) mv->set_speed(param_int(c, *p0)); return;
        case 9: if (mv) mv->bounce(); return;
        case 11: case 12: case 13: {
            if (o->movements.empty()) return;
            int n = int(o->movements.size());
            int idx = it.num == 11 ? o->mv_index + 1 : it.num == 12 ? o->mv_index - 1 : (p0 ? param_int(c, *p0) : 0);
            idx = std::clamp(idx, 0, n - 1);
            if (idx != o->mv_index) {
                o->mv_index = idx;
                if (o->def->movements[size_t(idx)].move_at_start) o->mv()->start();
            }
            return;
        }
        case 14:
            if (p0) {
                auto pos = resolve_position(c, p0->pos);
                if (!pos.empty()) {
                    const Pos& q = pos[size_t(std::max(0, c.loop_index)) % pos.size()];
                    double a = std::atan2(-(q.y - o->y), q.x - o->x) * 180.0 / kPi;
                    if (a < 0) a += 360;
                    int d = int(std::lround(a / 11.25)) & 31;
                    o->dir = d;
                    if (mv) mv->set_direction(d);
                }
            }
            return;
        case 15: o->anim_stopped = true; return;
        case 16: o->anim_stopped = false; return;
        case 17:
            if (p0) {
                int a = param_int(c, *p0);
                // forçar de novo uma animação que já terminou recomeça do início
                if (o->anim_done && (o->forced_anim == a || o->anim == a)) {
                    o->frame = 0;
                    o->anim_counter = 0;
                    o->anim_loops = 0;
                    o->anim_done = false;
                }
                o->forced_anim = a;
                o->anim_stopped = false;
            }
            return;
        case 18: if (p0) o->forced_dir = direction_param(c, *p0); return;
        case 19: if (p0) o->forced_speed = std::clamp(param_int(c, *p0), 0, 100); return;
        case 20: o->forced_anim = -1; return;
        case 21: o->forced_dir = -1; return;
        case 22: o->forced_speed = -1; return;
        case 23:
            if (p0) {
                int d = direction_param(c, *p0);
                o->dir = d;
                if (mv) mv->set_direction(d);
            }
            return;
        case 24: f.destroy(o); return;
        case 26: o->visible = false; o->flash_period = 0; return;
        case 27: o->visible = true; o->flash_period = 0; return;
        case 28: if (p0) { o->flash_period = std::max(1, param_int(c, *p0)); o->flash_timer = 0; } return;
        case 29: if (p0) shoot(c, o, *p0, nullptr); return;
        case 30: if (p0) shoot(c, o, *p0, p1); return;
        case 31: case 32: case 33:
            if (p0 && p1) set_alterable(o, size_t(param_int(c, *p0)), eval_expr(c, p1->expr), it.num - 31);
            return;
        case 35: case 36: case 37: {
            int bit = p0 ? param_int(c, *p0) & 31 : 0;
            if (it.num == 35) o->flags |= 1u << bit;
            else if (it.num == 36) o->flags &= ~(1u << bit);
            else o->flags ^= 1u << bit;
            return;
        }
        case 40: if (p0) o->forced_frame = std::max(0, param_int(c, *p0)); return;
        case 41: o->forced_frame = -1; return;
        case 43: if (mv && p0) mv->set_deceleration(param_int(c, *p0)); return;
        case 57: o->z = f.next_z++; return;
        case 58: {
            int mn = 0;
            for (auto& x : f.objects) mn = std::min(mn, x->z);
            o->z = mn - 1;
            return;
        }
        case 59: case 60:
            if (p0) {
                Obj* other = first_target(c, p0->oi);
                if (other && other != o) {
                    o->layer = other->layer;
                    o->z = it.num == 59 ? other->z - 1 : other->z + 1;
                    // evita empate com o vizinho
                    for (auto& x : f.objects)
                        if (x.get() != o && x->layer == o->layer && x->z == o->z) x->z += (it.num == 59 ? 1 : -1);
                }
            }
            return;
        case 61:
            if (p0) o->layer = std::clamp(param_int(c, *p0) - 1, 0, int(f.def.layers.size()) - 1);
            return;
        case 65: if (p0) o->alpha = std::clamp(param_int(c, *p0), 0, 255); return;
        case 66: if (p0) o->rgb = colorref_to_rgb(uint32_t(p0->expr.empty() ? p0->i0 : param_int(c, *p0))); return;
        default: break;
    }
    if (o->type == OBJ_ACTIVE) {
        switch (it.num) {
            case 85: if (p0) o->scale_x = o->scale_y = float(eval_expr(c, p0->expr).num()); return;
            case 86: if (p0) o->scale_x = float(eval_expr(c, p0->expr).num()); return;
            case 87: if (p0) o->scale_y = float(eval_expr(c, p0->expr).num()); return;
            case 88: {
                if (!p0) return;
                double a = std::fmod(eval_expr(c, p0->expr).num(), 360.0);
                o->angle = float(a < 0 ? a + 360 : a);
                return;
            }
            default: break;
        }
    } else if (o->type == OBJ_COUNTER || o->type == OBJ_SCORE || o->type == OBJ_LIVES) {
        switch (it.num) {
            case 80: if (p0) set_counter(o, eval_expr(c, p0->expr).num()); return;
            case 81: if (p0) set_counter(o, o->counter + eval_expr(c, p0->expr).num()); return;
            case 82: if (p0) set_counter(o, o->counter - eval_expr(c, p0->expr).num()); return;
            case 83: if (p0) { o->counter_min = eval_expr(c, p0->expr).num(); set_counter(o, o->counter); } return;
            case 84: if (p0) { o->counter_max = eval_expr(c, p0->expr).num(); set_counter(o, o->counter); } return;
            case 85: if (p0) o->bar_color1 = colorref_to_rgb(uint32_t(p0->expr.empty() ? p0->i0 : param_int(c, *p0))); return;
            case 86: if (p0) o->bar_color2 = colorref_to_rgb(uint32_t(p0->expr.empty() ? p0->i0 : param_int(c, *p0))); return;
            default: break;
        }
    } else if (o->type == OBJ_TEXT) {
        switch (it.num) {
            case 88: if (p0) o->text = param_value(c, *p0).str(); return;
            case 80: o->text.clear(); return;
            default: break;
        }
    }
    app.note_unimplemented(item_name(ItemKind::Action, it.type, it.num));
}

void action(EvalContext& c, const EventItem& it) {
    Frame& f = c.f;
    App& app = f.app;
    const Param* p0 = P(it, 0);
    const Param* p1 = P(it, 1);
    const Param* p2 = P(it, 2);
    Audio* au = app.audio();
    switch (it.type) {
        case OBJ_SYSTEM:
            switch (it.num) {
                case 0: return;
                case 3: case 4: case 5:
                    if (p0 && p1) {
                        int mode = it.num == 3 ? 0 : it.num == 5 ? 1 : 2;
                        set_global(app, size_t(param_int(c, *p0)), eval_expr(c, p1->expr), mode);
                    }
                    return;
                case 6: case 7: if (p0) set_group(f, *p0, it.num == 6); return;
                case 19:
                    if (p0 && p1) {
                        size_t idx = size_t(param_int(c, *p0));
                        if (idx >= app.global_strings.size()) app.global_strings.resize(idx + 1);
                        app.global_strings[idx] = eval_expr(c, p1->expr).str();
                    }
                    return;
                default: break;
            }
            break;
        case OBJ_SOUND:
            if (!au) return;
            switch (it.num) {
                case 0: if (p0) au->play(p0->i0, -1, 1); return;
                case 1: au->stop_all(); return;
                case 6: if (p0) au->stop_sound(p0->i0); return;
                case 11: if (p0 && p1) au->play(p0->i0, param_int(c, *p1), 1); return;
                case 12: if (p0 && p1) au->play(p0->i0, param_int(c, *p1), p2 ? param_int(c, *p2) : 0); return;
                case 13: if (p0) au->pause_channel(param_int(c, *p0), true); return;
                case 14: if (p0) au->pause_channel(param_int(c, *p0), false); return;
                case 15: if (p0) au->stop_channel(param_int(c, *p0)); return;
                case 17: if (p0 && p1) au->set_channel_volume(param_int(c, *p0), param_int(c, *p1)); return;
                case 32: if (p0 && p1) au->set_channel_frequency(param_int(c, *p0), param_int(c, *p1)); return;
                case 24: au->pause_all(true); return;
                case 25: au->pause_all(false); return;
                default: break;
            }
            break;
        case OBJ_GAME:
            switch (it.num) {
                case 0: app.request_frame(f.index + 1); return;
                case 1: app.request_frame(std::max(0, f.index - 1)); return;
                case 2:
                    if (p0) {
                        int idx = p0->expr.empty() ? app.game().frame_index_from_handle(p0->i0)
                                                   : param_int(c, *p0) - 1;
                        app.request_frame(idx);
                    }
                    return;
                case 3: app.request_frame(f.index); return;
                case 4: app.quit(); return;
                case 7:
                    if (p0) {
                        auto pos = resolve_position(c, p0->pos);
                        if (!pos.empty()) { f.center_display_x(pos[0].x); f.center_display_y(pos[0].y); }
                    }
                    return;
                case 8: if (p0) f.center_display_x(eval_expr(c, p0->expr).num()); return;
                case 9: if (p0) f.center_display_y(eval_expr(c, p0->expr).num()); return;
                case 16: if (p0) app.frame_rate = std::clamp(param_int(c, *p0), 1, 240); return;
                case 18: app.paused = true; return;
                case 23:
                    if (p0) f.background = colorref_to_rgb(uint32_t(p0->expr.empty() ? p0->i0 : param_int(c, *p0)));
                    return;
                case 26: if (p0) f.width = std::max(1, param_int(c, *p0)); return;
                case 27: if (p0) f.height = std::max(1, param_int(c, *p0)); return;
                default: break;
            }
            break;
        case OBJ_TIMER:
            if (it.num == 0 && p0) {
                f.timer_ms = uint32_t(std::max(0, param_int(c, *p0)));
                for (auto& s : f.event_state) {
                    s.every_last = f.timer_ms;
                    s.timer_equals_done = false;
                }
                return;
            }
            break;
        case OBJ_CREATE:
            if (it.num == 0 && p0) { create_objects(c, *p0); return; }
            break;
        case OBJ_PLAYER:
            switch (it.num) {
                case 0: if (p0) app.score = param_int(c, *p0); return;
                case 1: if (p0) app.lives = param_int(c, *p0); return;
                case 4: if (p0) app.score += param_int(c, *p0); return;
                case 5: if (p0) app.lives += param_int(c, *p0); return;
                case 6: if (p0) app.score -= param_int(c, *p0); return;
                case 7: if (p0) app.lives -= param_int(c, *p0); return;
                default: return;
            }
        default: break;
    }

    if (it.type >= 0) {
        // "Espalhar valor": incrementa a cada instância.
        if (it.num == 34 && p0 && p1) {
            Value v = eval_expr(c, p1->expr);
            size_t idx = size_t(param_int(c, *p0));
            for (Obj* o : targets(c, it.oi)) {
                set_alterable(o, idx, v, 0);
                v = Value(v.int_() + 1);
            }
            return;
        }
        std::vector<Obj*> tg = targets(c, it.oi);
        int k = 0;
        for (Obj* o : tg) {
            if (o->destroyed && it.num != 24) continue;
            c.current = o;
            c.current_oi = o->oi;
            c.loop_index = k++;
            if (it.type >= OBJ_EXTENSION_BASE && it.num >= 80) ext_action(c, it, o);
            else object_action(c, it, o);
        }
        c.current = nullptr;
        c.current_oi = -1;
        c.loop_index = -1;
        return;
    }
    app.note_unimplemented(item_name(ItemKind::Action, it.type, it.num));
}

bool is_marker(const EventItem& it, int num) { return it.type == OBJ_SYSTEM && it.num == num; }

// PB_TRACE="594,595" imprime o resultado de cada condição desses grupos (depuração).
bool traced(int gi) {
    static std::vector<int> list = [] {
        std::vector<int> v;
        if (const char* t = std::getenv("PB_TRACE")) {
            for (const char* p = t; *p;) {
                v.push_back(std::atoi(p));
                while (*p && *p != ',') ++p;
                if (*p) ++p;
            }
        }
        return v;
    }();
    return std::find(list.begin(), list.end(), gi) != list.end();
}

void eval_group(Frame& f, int gi) {
    const EventGroup& g = f.def.events.groups[size_t(gi)];
    const bool trace = traced(gi);
    g_diag.group = gi;
    // Blocos separados por "OU" (lógico ou filtrado).
    std::vector<std::pair<size_t, size_t>> blocks;
    size_t start = 0;
    for (size_t i = 0; i < g.conditions.size(); ++i) {
        if (is_marker(g.conditions[i], -25) || is_marker(g.conditions[i], -24)) {
            blocks.push_back({start, i});
            start = i + 1;
        }
    }
    blocks.push_back({start, g.conditions.size()});

    Selection sel;
    bool any = false;
    for (auto [b, e] : blocks) {
        Selection bs;
        EvalContext bc{f, bs};
        bool ok = true;
        for (size_t i = b; i < e; ++i) {
            bool r = condition(bc, g.conditions[i], gi);
            if (trace)
                SDL_Log("trace #%d loop %lld cond %zu %s -> %d (mouse %d,%d scroll %.0f,%.0f)", gi,
                        (long long)f.loop, i,
                        item_name(ItemKind::Condition, g.conditions[i].type, g.conditions[i].num).c_str(),
                        r, f.app.input.mouse_x, f.app.input.mouse_y, f.scroll_x, f.scroll_y);
            if (!r) { ok = false; break; }
        }
        if (!ok) continue;
        if (!any) sel = std::move(bs);
        else {
            for (auto& [oi, v] : bs.sel) {
                auto& dst = sel.sel[oi];
                for (Obj* o : v)
                    if (std::find(dst.begin(), dst.end(), o) == dst.end()) dst.push_back(o);
                sel.touched.insert(oi);
            }
        }
        any = true;
    }
    if (!any) return;
    if (f.app.audit.on) {
        auto& v = f.app.audit.fired[f.index];
        if (v.size() < f.def.events.groups.size()) v.resize(f.def.events.groups.size());
        ++v[size_t(gi)];
    }
    EvalContext c{f, sel};
    for (const EventItem& a : g.actions) {
        action(c, a);
        if (f.app.frame() != &f) return;
    }
}

}  // namespace

std::vector<Obj*> targets(EvalContext& c, int oi) {
    std::vector<Obj*> out;
    for (int m : c.f.expand_oi(oi)) {
        if (c.s.touched.count(m)) {
            for (Obj* o : c.s.sel[m])
                if (!o->destroyed) out.push_back(o);
        } else {
            const auto& all = c.f.instances(m);
            out.insert(out.end(), all.begin(), all.end());
        }
    }
    return out;
}

// Pareamento do Clickteam: numa ação que roda em várias instâncias de A, uma
// referência a outro objeto B (posição relativa, X/Y/ângulo de B...) usa a
// k-ésima instância de B para a k-ésima de A, voltando ao começo se B tiver
// menos instâncias. Na loja do Zorbié, as 3 barras ("Set position relativa a
// shop_gauge_shape") iam todas para a primeira linha.
Obj* paired_target(EvalContext& c, int oi) {
    if (c.loop_index <= 0) return first_target(c, oi);
    std::vector<Obj*> list = targets(c, oi);
    list.erase(std::remove_if(list.begin(), list.end(), [](Obj* o) { return o->destroyed; }), list.end());
    if (list.empty()) return nullptr;
    return list[size_t(c.loop_index) % list.size()];
}

Obj* first_target(EvalContext& c, int oi) {
    for (int m : c.f.expand_oi(oi)) {
        if (c.s.touched.count(m)) {
            for (Obj* o : c.s.sel[m])
                if (!o->destroyed) return o;
        } else {
            const auto& all = c.f.instances(m);
            if (!all.empty()) return all.front();
        }
    }
    return nullptr;
}

void run_events(Frame& f) {
    const auto& groups = f.def.events.groups;
    for (int i = 0; i < int(groups.size()); ++i) {
        const EventGroup& g = groups[size_t(i)];
        if (g.conditions.empty()) continue;
        const EventItem& c0 = g.conditions[0];
        if (is_marker(c0, -10)) {
            const GroupInfo& gi = f.groups[size_t(i)];
            if (!gi.active && gi.end > i) i = gi.end;
            continue;
        }
        if (is_marker(c0, -11) || is_marker(c0, -16)) continue;
        eval_group(f, i);
        if (f.app.frame() != &f || f.app.finished()) return;
    }
    for (auto& g : f.groups) g.just_activated = false;
}

}  // namespace pb

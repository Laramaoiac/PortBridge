// Avaliador de expressões Clickteam.
//
// O formato é uma lista de tokens em ordem infixa. Funções (Random, Sin, Min...) e
// expressões de extensão com parâmetros não têm token de "(": os argumentos vêm logo
// depois, separados por "," (-1,-3) e terminados por ")" (-1,-2).
#include <algorithm>
#include <cmath>

#include "core/names.hpp"
#include "runtime/runtime.hpp"

namespace pb {
namespace {

constexpr double kPi = 3.14159265358979323846;
inline double rad(double d) { return d * kPi / 180.0; }
inline double deg(double r) { return r * 180.0 / kPi; }

bool is_system_function(int num) {
    switch (num) {
        case 1: case 2: case 4: case 5: case 10: case 11: case 12: case 13: case 14: case 15:
        case 16: case 17: case 18: case 19: case 20: case 21: case 22: case 28: case 29:
        case 30: case 31: case 32: case 33: case 34: case 35: case 40: case 41: case 42:
        case 43: case 44: case 45: case 46: case 48: case 49: case 51: case 52: case 53:
        case 54: case 58: case 59: case 62: case 63: case 64: case 65: case 68:
            return true;
        default: return false;
    }
}

int precedence(int op) {
    switch (op) {
        case 16: case 18: return 1;   // or, xor
        case 14: return 2;            // and
        case 2: case 4: return 3;     // + -
        case 6: case 8: case 10: return 4;  // * / mod
        case 12: return 5;            // potência
        default: return 0;
    }
}

Value arith(int op, const Value& a, const Value& b) {
    if (op == 2 && (a.is_str() || b.is_str())) return Value(a.str() + b.str());
    bool ints = a.kind == Value::INT && b.kind == Value::INT;
    switch (op) {
        case 2: return ints ? Value(a.i + b.i) : Value(a.num() + b.num());
        case 4: return ints ? Value(a.i - b.i) : Value(a.num() - b.num());
        case 6: return ints ? Value(a.i * b.i) : Value(a.num() * b.num());
        case 8:
            if (ints) return b.i == 0 ? Value(0) : Value(a.i / b.i);
            return b.num() == 0 ? Value(0) : Value(a.num() / b.num());
        case 10:
            if (ints) return b.i == 0 ? Value(0) : Value(a.i % b.i);
            return b.num() == 0 ? Value(0) : Value(std::fmod(a.num(), b.num()));
        case 12: return Value(std::pow(a.num(), b.num()));
        case 14: return Value(a.int_() & b.int_());
        case 16: return Value(a.int_() | b.int_());
        case 18: return Value(a.int_() ^ b.int_());
        default: return a;
    }
}

struct Parser {
    EvalContext& c;
    const std::vector<Expr>& t;
    size_t p = 0;

    const Expr* peek() const { return p < t.size() ? &t[p] : nullptr; }
    bool at(int type, int num) const {
        const Expr* e = peek();
        return e && e->type == type && e->num == num;
    }

    Value parse(int min_prec) {
        Value lhs = unary();
        while (const Expr* e = peek()) {
            if (e->type != 0) break;
            int prec = precedence(e->num);
            if (prec == 0 || prec < min_prec) break;
            ++p;
            Value rhs = parse(prec + 1);
            lhs = arith(e->num, lhs, rhs);
        }
        return lhs;
    }

    Value unary() {
        if (at(0, 4)) {  // "-" em posição de operando
            ++p;
            Value v = unary();
            return v.kind == Value::INT ? Value(-v.i) : Value(-v.num());
        }
        return operand();
    }

    std::vector<Value> args() {
        std::vector<Value> a;
        while (peek()) {
            if (at(-1, -2)) { ++p; break; }
            a.push_back(parse(0));
            if (at(-1, -3)) ++p;
        }
        return a;
    }

    Value operand() {
        const Expr* e = peek();
        if (!e) return Value(0);
        ++p;
        if (e->type == -1) {
            switch (e->num) {
                case -1: { Value v = parse(0); if (at(-1, -2)) ++p; return v; }
                case 0: return Value(int64_t(e->ival));
                case 3: return Value(e->sval);
                case 23: return Value(e->dval);
                case 24: {
                    auto& gv = c.f.app.global_values;
                    return size_t(e->index) < gv.size() ? gv[size_t(e->index)] : Value(0);
                }
                case 50: {
                    auto& gs = c.f.app.global_strings;
                    return Value(size_t(e->index) < gs.size() ? gs[size_t(e->index)] : std::string());
                }
                default:
                    if (is_system_function(e->num)) return system_function(e->num, args());
                    c.f.app.note_unimplemented(item_name(ItemKind::Expression, e->type, e->num));
                    return Value(0);
            }
        }
        if (e->type >= OBJ_EXTENSION_BASE && e->num >= 80) {
            std::vector<Value> a;
            if (ext_expression_arity(c.f.app.game(), *e) > 0) a = args();
            bool handled = false;
            Value v = ext_expression(c, *e, a, handled);
            if (!handled) c.f.app.note_unimplemented(item_name(ItemKind::Expression, e->type, e->num));
            return v;
        }
        if (e->type >= 2 || e->type == OBJ_PLAYER) return object_expression(*e);
        return special_expression(*e);
    }

    Value system_function(int num, const std::vector<Value>& a) {
        auto A = [&](size_t i) { return i < a.size() ? a[i] : Value(0); };
        App& app = c.f.app;
        switch (num) {
            case 1: {
                int64_t n = A(0).int_();
                if (n <= 0) return Value(0);
                return Value(int64_t(std::uniform_int_distribution<int64_t>(0, n - 1)(app.rng())));
            }
            case 2: {
                size_t i = size_t(A(0).int_());
                return i < app.global_values.size() ? app.global_values[i] : Value(0);
            }
            case 4: return Value(A(0).str());
            case 5: {
                std::string s = A(0).str();
                if (s.find('.') != std::string::npos) return Value(std::atof(s.c_str()));
                return Value(int64_t(std::atoll(s.c_str())));
            }
            case 10: return Value(std::sin(rad(A(0).num())));
            case 11: return Value(std::cos(rad(A(0).num())));
            case 12: return Value(std::tan(rad(A(0).num())));
            case 13: return Value(std::sqrt(A(0).num()));
            case 14: return Value(std::log10(A(0).num()));
            case 15: return Value(std::log(A(0).num()));
            case 18: return Value(std::exp(A(0).num()));
            case 19: { auto s = A(0).str(); return Value(s.substr(0, size_t(std::max<int64_t>(0, A(1).int_())))); }
            case 20: {
                auto s = A(0).str();
                size_t n = size_t(std::max<int64_t>(0, A(1).int_()));
                return Value(n >= s.size() ? s : s.substr(s.size() - n));
            }
            case 21: {
                auto s = A(0).str();
                size_t st = size_t(std::max<int64_t>(0, A(1).int_()));
                return Value(st >= s.size() ? std::string() : s.substr(st, size_t(std::max<int64_t>(0, A(2).int_()))));
            }
            case 22: return Value(int64_t(A(0).str().size()));
            case 28: return Value(A(0).int_());
            case 29: return A(0).kind == Value::INT ? Value(std::llabs(A(0).i)) : Value(std::fabs(A(0).num()));
            case 30: return Value(std::ceil(A(0).num()));
            case 31: return Value(std::floor(A(0).num()));
            case 32: return Value(deg(std::acos(A(0).num())));
            case 33: return Value(deg(std::asin(A(0).num())));
            case 34: return Value(deg(std::atan(A(0).num())));
            case 35: return Value(~A(0).int_());
            case 40: return compare(A(0), 3, A(1)) ? A(0) : A(1);
            case 41: return compare(A(0), 5, A(1)) ? A(0) : A(1);
            case 42: return Value(A(0).int_() | (A(1).int_() << 8) | (A(2).int_() << 16));
            case 43: return Value(A(0).int_() & 0xFF);
            case 44: return Value((A(0).int_() >> 8) & 0xFF);
            case 45: return Value((A(0).int_() >> 16) & 0xFF);
            case 48: return Value(int64_t(std::llround(A(0).num())));
            case 49: {
                size_t i = size_t(A(0).int_());
                auto& gs = app.global_strings;
                return Value(i < gs.size() ? gs[i] : std::string());
            }
            case 51: { auto s = A(0).str(); for (auto& ch : s) ch = char(std::tolower(ch)); return Value(s); }
            case 52: { auto s = A(0).str(); for (auto& ch : s) ch = char(std::toupper(ch)); return Value(s); }
            case 53: { auto s = A(0).str(); auto r = s.find(A(1).str(), size_t(std::max<int64_t>(0, A(2).int_()))); return Value(r == std::string::npos ? int64_t(-1) : int64_t(r)); }
            case 59: return Value(deg(std::atan2(A(0).num(), A(1).num())));
            case 62: return Value(std::hypot(A(2).num() - A(0).num(), A(3).num() - A(1).num()));
            case 63: {
                double a = deg(std::atan2(-(A(3).num() - A(1).num()), A(2).num() - A(0).num()));
                return Value(a < 0 ? a + 360 : a);
            }
            case 64: return Value(std::clamp(A(0).num(), A(1).num(), A(2).num()));
            case 65: {
                int64_t lo = A(0).int_(), hi = A(1).int_();
                if (hi < lo) std::swap(lo, hi);
                return Value(int64_t(std::uniform_int_distribution<int64_t>(lo, hi)(app.rng())));
            }
            default:
                app.note_unimplemented(item_name(ItemKind::Expression, -1, num));
                return Value(0);
        }
    }

    Value special_expression(const Expr& e) {
        Frame& f = c.f;
        App& app = f.app;
        int ww = app.view_w, wh = app.view_h;
        switch (e.type) {
            case OBJ_GAME:
                switch (e.num) {
                    case 0: case 8: return Value(f.index + 1);
                    case 2: return Value(int64_t(f.scroll_x));
                    case 3: return Value(int64_t(f.scroll_x + ww));
                    case 4: return Value(int64_t(f.scroll_y));
                    case 5: return Value(int64_t(f.scroll_y + wh));
                    case 6: case 11: return Value(f.width);
                    case 7: case 12: return Value(f.height);
                    case 10: return Value(app.frame_rate);
                    case 13: return Value(int64_t(f.background));
                    default: break;
                }
                break;
            case OBJ_TIMER:
                switch (e.num) {
                    case 0: return Value(int64_t(f.timer_ms));
                    case 1: return Value(int64_t((f.timer_ms / 10) % 100));
                    case 2: return Value(int64_t((f.timer_ms / 1000) % 60));
                    case 3: return Value(int64_t(f.timer_ms / 3600000));
                    case 4: return Value(int64_t((f.timer_ms / 60000) % 60));
                    default: break;
                }
                break;
            case OBJ_CREATE:
                if (e.num == 0) {
                    int64_t n = 0;
                    for (auto& o : f.objects) n += !o->destroyed;
                    return Value(n);
                }
                break;
            case OBJ_KEYBOARD:
                if (e.num == 0) return Value(int64_t(app.input.mouse_x + f.scroll_x));
                if (e.num == 1) return Value(int64_t(app.input.mouse_y + f.scroll_y));
                break;
            case OBJ_SOUND:
                return Value(0);
            default: break;
        }
        app.note_unimplemented(item_name(ItemKind::Expression, e.type, e.num));
        return Value(0);
    }

    Obj* resolve(int oi) {
        if (c.current && (c.current_oi == oi || c.current->oi == oi)) return c.current;
        if (c.current && (oi & 0x8000)) {
            for (int m : c.f.expand_oi(oi))
                if (m == c.current->oi) return c.current;
        }
        return paired_target(c, oi);
    }

    Value object_expression(const Expr& e) {
        App& app = c.f.app;
        if (e.type == OBJ_PLAYER) {
            if (e.num == 0) return Value(app.score);
            if (e.num == 1) return Value(app.lives);
            return Value(0);
        }
        if (e.num == 15) {  // número de instâncias
            int64_t n = 0;
            for (int oi : c.f.expand_oi(e.oi)) n += int64_t(c.f.instances(oi).size());
            return Value(n);
        }
        Obj* o = resolve(e.oi);
        if (!o) return Value(0);
        const ImageInfo* im = o->image >= 0 ? app.image(o->image) : nullptr;
        switch (e.num) {
            case 1: return Value(int64_t(std::floor(o->y)));
            case 11: return Value(int64_t(std::floor(o->x)));
            case 2: return Value(o->frame);
            case 3: return Value(o->speed());
            case 6: return Value(o->dir);
            case 7: case 8: case 9: case 10: {
                Rect r = obj_rect(app, *o);
                double v = e.num == 7 ? r.x1 : e.num == 8 ? r.x2 : e.num == 9 ? r.y1 : r.y2;
                return Value(int64_t(std::floor(v)));
            }
            case 12: return Value(o->uid);
            case 13: return Value(int64_t((o->flags >> (e.index & 31)) & 1));
            case 14: return Value(o->anim);
            case 16: return size_t(e.index) < o->values.size() ? o->values[size_t(e.index)] : Value(0);
            case 19: return Value(size_t(e.index) < o->strings.size() ? o->strings[size_t(e.index)] : std::string());
            case 25: return Value(int64_t(o->x + (im ? (im->act_x - im->hot_x) * o->scale_x : 0)));
            case 26: return Value(int64_t(o->y + (im ? (im->act_y - im->hot_y) * o->scale_y : 0)));
            case 27: return Value(o->alpha);
            case 28: {  // devolve no formato COLORREF (0x00BBGGRR)
                uint32_t v = o->rgb;
                return Value(int64_t(((v >> 16) & 0xFF) | (v & 0xFF00) | ((v & 0xFF) << 16)));
            }
            case 40: { Rect r = obj_rect(app, *o); return Value(int64_t(r.x2 - r.x1)); }
            case 41: { Rect r = obj_rect(app, *o); return Value(int64_t(r.y2 - r.y1)); }
            default: break;
        }
        if (o->type == OBJ_ACTIVE) {
            switch (e.num) {
                case 81: return Value(double(o->scale_x));
                case 82: return Value(double(o->scale_y));
                case 83: return Value(double(o->angle));
                default: break;
            }
        } else if (o->type == OBJ_COUNTER || o->type == OBJ_SCORE || o->type == OBJ_LIVES) {
            auto num = [](double v) { return std::floor(v) == v ? Value(int64_t(v)) : Value(v); };
            switch (e.num) {
                case 80: return num(o->counter);
                case 81: return num(o->counter_min);
                case 82: return num(o->counter_max);
                default: break;
            }
        } else if (o->type == OBJ_TEXT) {
            if (e.num == 81 || e.num == 82) return Value(o->text);
        }
        app.note_unimplemented(item_name(ItemKind::Expression, e.type, e.num));
        return Value(0);
    }
};

}  // namespace

Value eval_expr(EvalContext& c, const std::vector<Expr>& ex) {
    if (ex.empty()) return Value(0);
    Parser p{c, ex};
    return p.parse(0);
}

}  // namespace pb

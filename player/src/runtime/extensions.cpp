// Extensões Clickteam usadas por jogos iOS:
//   kcini (INI)     — implementada, grava em save_dir
//   AdvDir          — matemática de direção/distância
//   iOS*, GameCenter*, RateMe — substitutos: condições falsas, ações sem efeito.
//     (Ex.: com o iOSGetDevice falso, o Zorbié escolhe a qualidade gráfica máxima.)
#include <cmath>
#include <fstream>
#include <map>
#include <set>
#include <sstream>

#include "runtime/runtime.hpp"

namespace pb {
namespace {

struct Ini;
// INIs com alterações ainda não gravadas (ver flush_ini_files).
std::set<Ini*>& dirty_inis() {
    static std::set<Ini*> s;
    return s;
}

// Gravação adiada: o Zorbié grava dezenas de chaves no mesmo passo (ex.: 8 a
// cada compra na loja, muito mais ao fim da partida). Regravar o arquivo
// inteiro a cada chave travava o jogo por dezenas de ms (bem mais no celular).
// Agora as chaves mudam na memória e o arquivo é gravado uma vez no fim do
// passo, ao trocar de frame, ao pausar e ao sair.
struct Ini {
    std::string path, group, item;
    std::map<std::string, std::map<std::string, std::string>> data;
    bool loaded = false, dirty = false;

    ~Ini() { flush(); }
    void flush() {
        if (!dirty) return;
        dirty = false;
        dirty_inis().erase(this);
        save();
    }
    void mark() {
        dirty = true;
        dirty_inis().insert(this);
    }

    void load(const std::string& p) {
        flush();  // não perde o que ainda não foi gravado
        path = p;
        data.clear();
        loaded = true;
        std::ifstream f(path);
        std::string line, cur;
        while (std::getline(f, line)) {
            if (!line.empty() && line.back() == '\r') line.pop_back();
            if (line.size() >= 2 && line.front() == '[' && line.back() == ']') {
                cur = line.substr(1, line.size() - 2);
                data[cur];
            } else if (auto eq = line.find('='); eq != std::string::npos) {
                data[cur][line.substr(0, eq)] = line.substr(eq + 1);
            }
        }
    }
    void save() const {
        if (path.empty()) return;
        std::ofstream f(path, std::ios::trunc);
        for (auto& [g, items] : data) {
            f << '[' << g << "]\n";
            for (auto& [k, v] : items) f << k << '=' << v << '\n';
        }
    }
    std::string get(const std::string& g, const std::string& k) const {
        auto gi = data.find(g);
        if (gi == data.end()) return {};
        auto ki = gi->second.find(k);
        return ki == gi->second.end() ? std::string() : ki->second;
    }
    void set(const std::string& g, const std::string& k, const std::string& v) {
        auto& slot = data[g][k];
        if (slot == v && !path.empty()) return;  // mesmo valor: nada a gravar
        slot = v;
        mark();
    }
};

std::string ext_name(EvalContext& c, int type) { return c.f.app.game().extension_name(type); }

Ini& ini_of(EvalContext& c, Obj* o) {
    if (!o->ext) o->ext = std::make_shared<Ini>();
    Ini& ini = *static_cast<Ini*>(o->ext.get());
    if (!ini.loaded) ini.load(c.f.app.save_dir + "/" + (o->def ? o->def->name : "default.ini"));
    return ini;
}

std::string clean_filename(std::string f) {
    while (f.rfind("./", 0) == 0) f = f.substr(2);
    for (auto& ch : f)
        if (ch == '/' || ch == '\\' || ch == ':') ch = '_';
    return f.empty() ? "default.ini" : f;
}

Value ini_value(const std::string& s) {
    if (s.empty()) return Value(0);
    if (s.find('.') != std::string::npos) return Value(std::atof(s.c_str()));
    return Value(int64_t(std::atoll(s.c_str())));
}

Value arg(EvalContext& c, const EventItem& it, size_t i) {
    if (i >= it.params.size()) return Value(0);
    const Param& p = it.params[i];
    if (!p.expr.empty()) return eval_expr(c, p.expr);
    if (!p.str.empty()) return Value(p.str);
    return Value(p.i0);
}

bool is_ios_stub(const std::string& n) {
    return n.rfind("iOS", 0) == 0 || n.rfind("GameCenter", 0) == 0 || n == "RateMe" ||
           n == "iOSStore" || n == "iOSTwitter";
}

}  // namespace

void flush_ini_files() {
    std::vector<Ini*> list(dirty_inis().begin(), dirty_inis().end());
    for (Ini* ini : list) ini->flush();
}

bool ext_condition(EvalContext& c, const EventItem& it, Obj* o, bool& handled) {
    std::string n = ext_name(c, it.type);
    if (n == "iOS") {
        // Condições 1 e 2 do objeto iOS: o app foi interrompido (ligação, outro
        // app). O Zorbié abre a pausa com elas; aqui valem no passo em que o app
        // volta do segundo plano.
        handled = true;
        const int idx = -it.num - 81;
        return (idx == 1 || idx == 2) && c.f.app.interrupted_flag;
    }
    if (is_ios_stub(n)) { handled = true; return false; }
    if (n == "AdvDir") { handled = true; return false; }
    (void)o;
    return false;
}

void ext_action(EvalContext& c, const EventItem& it, Obj* o) {
    std::string n = ext_name(c, it.type);
    int idx = it.num - 80;
    if (is_ios_stub(n) || n == "AdvDir") return;
    if (n == "kcini") {
        Ini& ini = ini_of(c, o);
        switch (idx) {
            case 0: ini.group = arg(c, it, 0).str(); return;
            case 1: ini.item = arg(c, it, 0).str(); return;
            case 2: ini.set(ini.group, ini.item, arg(c, it, 0).str()); return;
            case 5: ini.set(ini.group, ini.item, arg(c, it, 0).str()); return;
            case 6: ini.load(c.f.app.save_dir + "/" + clean_filename(arg(c, it, 0).str())); return;
            case 7: case 9: ini.set(ini.group, arg(c, it, 0).str(), arg(c, it, 1).str()); return;
            case 8: case 10: ini.set(arg(c, it, 0).str(), arg(c, it, 1).str(), arg(c, it, 2).str()); return;
            case 11: ini.data[ini.group].erase(arg(c, it, 0).str()); ini.mark(); return;
            case 12: ini.data[arg(c, it, 0).str()].erase(arg(c, it, 1).str()); ini.mark(); return;
            case 13: ini.data.erase(arg(c, it, 0).str()); ini.mark(); return;
            default: break;
        }
    }
    c.f.app.note_unimplemented(n + "#" + std::to_string(idx));
}

int ext_expression_arity(const Game& g, const Expr& e) {
    std::string n = g.extension_name(e.type);
    int idx = e.num - 80;
    if (n == "kcini") {
        static const int ar[] = {0, 0, 1, 2, 1, 2};
        return idx >= 0 && idx < 6 ? ar[idx] : 0;
    }
    if (n == "AdvDir") {
        switch (idx) {
            case 1: case 2: case 3: case 4: return 4;
            case 6: return 2;
            default: return 0;
        }
    }
    return 0;
}

Value ext_expression(EvalContext& c, const Expr& e, const std::vector<Value>& a, bool& handled) {
    std::string n = ext_name(c, e.type);
    int idx = e.num - 80;
    auto A = [&](size_t i) { return i < a.size() ? a[i].num() : 0.0; };
    if (n == "kcini") {
        Obj* o = first_target(c, e.oi);
        if (!o) { handled = true; return Value(0); }
        Ini& ini = ini_of(c, o);
        handled = true;
        switch (idx) {
            case 0: return ini_value(ini.get(ini.group, ini.item));
            case 1: return Value(ini.get(ini.group, ini.item));
            case 2: return ini_value(ini.get(ini.group, a.size() > 0 ? a[0].str() : ""));
            case 3: return ini_value(ini.get(a.size() > 0 ? a[0].str() : "", a.size() > 1 ? a[1].str() : ""));
            case 4: return Value(ini.get(ini.group, a.size() > 0 ? a[0].str() : ""));
            case 5: return Value(ini.get(a.size() > 0 ? a[0].str() : "", a.size() > 1 ? a[1].str() : ""));
            default: handled = false; return Value(0);
        }
    }
    if (n == "AdvDir") {
        handled = true;
        double dx = A(2) - A(0), dy = A(3) - A(1);
        switch (idx) {
            case 1: case 3: {
                double ang = std::atan2(-dy, dx) * 180.0 / 3.14159265358979323846;
                if (ang < 0) ang += 360;
                return idx == 3 ? Value(int64_t(ang)) : Value(ang);
            }
            case 2: return Value(std::hypot(dx, dy));
            case 4: return Value(int64_t(std::hypot(dx, dy)));
            case 6: {
                double d = std::fmod(std::fabs(A(0) - A(1)), 360.0);
                return Value(d > 180 ? 360 - d : d);
            }
            default: handled = false; return Value(0);
        }
    }
    if (is_ios_stub(n)) { handled = true; return Value(0); }
    return Value(0);
}

}  // namespace pb

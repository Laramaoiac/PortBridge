import JSZip from 'jszip';

export interface PatchedNativeFile {
  path: string;
  title: string;
  language: 'cpp' | 'yaml' | 'markdown';
  summary: string;
  content: string;
}

export const EXT_IOS_STORE_HPP = `#pragma once

// Emulador StoreKit (extensão Clickteam iOSStore) para PortBridge (libmain.so).
// Adaptado 1:1 às estruturas reais do PortBridge (runtime.hpp, game.hpp, value.hpp):
//   - EvalContext& c -> c.f.loop (tick), c.f.app.game().extension_name(it.type)
//   - Ações:     idx = it.num - 80   (MMF2 iOSStore: 0=RequestPayment, 1=RequestInfo, 2=Restore)
//   - Condições: idx = -it.num - 81  (suporta parâmetro opcional product_id em it.params[0])
//   - Expressões: idx = e.num - 80   (retorna Value(std::string), Value(double), Value(int64_t))
//
// Quando o jogo (ex.: Zorbié) pede compra ou restauração na loja, o emulador aprova a
// transação de forma assíncrona no passo seguinte (begin_step), dispara a condição
// correspondente uma única vez (one-shot) e devolve os dados do produto via expressões —
// fazendo o próprio código de eventos do Application.cci desbloquear a DLC e gravar o INI
// automaticamente via pb::flush_ini_files().

#include <SDL_log.h>

#include <algorithm>
#include <cstdint>
#include <deque>
#include <map>
#include <set>
#include <string>
#include <utility>
#include <vector>

namespace pb {

namespace ios_store_ace {
    // Ações (idx = it.num - 80)
    // Confirmado no Application.cci do Zorbié (MMF2 iOS Exporter / CRuniOSStore.m):
    //   idx == 0 é chamado ao clicar em Comprar (Request Payment).
    //   Defina PB_IOS_STORE_FUSION25_ORDER se um jogo Fusion 2.5 inverter 0 (Info) e 1 (Payment).
#ifdef PB_IOS_STORE_FUSION25_ORDER
    constexpr int ACT_REQUEST_PRODUCT_INFO = 0;  // Request information for product (1 param: string id)
    constexpr int ACT_REQUEST_PAYMENT      = 1;  // Request payment for product     (1 param: string id)
#else
    constexpr int ACT_REQUEST_PAYMENT      = 0;  // Request payment for product     (1 param: string id)
    constexpr int ACT_REQUEST_PRODUCT_INFO = 1;  // Request information for product (1 param: string id)
#endif
    constexpr int ACT_RESTORE_TRANSACTIONS = 2;  // Restore completed transactions  (0 params)
    constexpr int ACT_REQUEST_PAYMENT_QTY  = 3;  // Request payment w/ quantity     (2 params: string id, int qty)

    // Condições (idx = -it.num - 81)
    constexpr int CND_CAN_PAYMENTS_BE_MADE = 0;  // Booleana contínua -> sempre TRUE
    constexpr int CND_REQUEST_RESPONSE     = 1;  // One-shot: informações do produto recebidas
    constexpr int CND_PAYMENT_PROCESSED    = 2;  // One-shot: compra aprovada
    constexpr int CND_PAYMENT_FAILED       = 3;  // One-shot: falha na compra -> sempre FALSE
    constexpr int CND_PAYMENT_CANCELLED    = 4;  // One-shot: compra cancelada -> sempre FALSE
    constexpr int CND_PAYMENT_RESTORED     = 5;  // One-shot: compra restaurada
    constexpr int CND_INVALID_IDENTIFIER   = 6;  // One-shot: identificador inválido -> sempre FALSE
    constexpr int CND_RESTORE_FINISHED     = 7;  // One-shot: restauração concluída
    constexpr int CND_RESTORE_FAILED       = 8;  // One-shot: falha na restauração -> sempre FALSE

    // Expressões (idx = e.num - 80)
    constexpr int EXP_PRODUCT_NAME         = 0;  // String: título localizado
    constexpr int EXP_PRODUCT_DESCRIPTION  = 1;  // String: descrição localizada
    constexpr int EXP_PRODUCT_PRICE        = 2;  // Float/Double: preço numérico (0.0)
    constexpr int EXP_PRODUCT_PRICE_LOCALE = 3;  // String: moeda/locale ("USD")
    constexpr int EXP_PRODUCT_IDENTIFIER   = 4;  // String: ProductIdentifier da transação atual
    constexpr int EXP_PRODUCT_FORMATTED    = 5;  // String: preço formatado ("FREE")
    constexpr int EXP_PRODUCT_QUANTITY     = 6;  // Int: quantidade comprada (1)
    constexpr int EXP_RECEIPT_DATA         = 7;  // String: recibo sintético offline
    constexpr int EXP_ERROR_CODE           = 8;  // Int: 0 (sem erro)
    constexpr int EXP_ERROR_STRING         = 9;  // String: "" (sem erro)
}  // namespace ios_store_ace

class IosStoreEmulator {
public:
    // Registra um ProductIdentifier conhecido (ex.: extraído do .cci em tweaks.cpp)
    // para que "Restore Purchases" funcione mesmo antes da primeira compra.
    void register_product(const std::string& product_id) {
        if (!product_id.empty()) {
            known_ids_.insert(product_id);
        }
    }

    // Promove pedidos feitos no passo anterior para as filas prontas no passo atual.
    // Assim o jogo recebe a confirmação no tick seguinte (como o StoreKit real),
    // evitando que o evento de clique e o de conclusão colidam no mesmo frame.
    void begin_step() {
        move_all(staged_info_, q_info_);
        move_all(staged_purchased_, q_purchased_);
        move_all(staged_restored_, q_restored_);
        if (staged_restore_finished_) {
            pending_restore_finished_ = true;
            staged_restore_finished_ = false;
        }
    }

    void on_request_info(const std::string& product_id) {
        const std::string id = product_id.empty() ? "default.product" : product_id;
        known_ids_.insert(id);
        current_id_ = id;
        staged_info_.push_back(id);
        SDL_Log("[PortBridge][iOSStore] RequestProductInfo('%s') -> agendado para o próximo passo",
                id.c_str());
    }

    void on_request_payment(const std::string& product_id, int qty = 1) {
        const std::string id = product_id.empty() ? current_id_ : product_id;
        if (id.empty()) return;
        known_ids_.insert(id);
        purchased_ids_.insert(id);
        current_id_ = id;
        current_qty_ = qty > 0 ? qty : 1;
        // Alguns jogos verificam RequestResponse e PaymentProcessed; enfileiramos ambos.
        staged_info_.push_back(id);
        staged_purchased_.push_back(id);
        SDL_Log("[PortBridge][iOSStore] RequestPayment('%s', qty=%d) -> APROVADO (modo offline grátis)",
                id.c_str(), current_qty_);
    }

    void on_restore_transactions() {
        SDL_Log("[PortBridge][iOSStore] RestoreTransactions() -> restaurando %zu produto(s) conhecido(s)",
                known_ids_.size());
        for (const auto& id : known_ids_) {
            purchased_ids_.insert(id);
            staged_restored_.push_back(id);
        }
        staged_restore_finished_ = true;
    }

    // Avalia uma condição one-shot com suporte a filtro opcional por product_id (it.params[0]).
    bool check_condition(int local_cnd, int64_t current_tick, const std::string& filter_id) {
        using namespace ios_store_ace;
        switch (local_cnd) {
            case CND_CAN_PAYMENTS_BE_MADE:
                return true;

            case CND_REQUEST_RESPONSE:
                return consume_queue_for_tick(q_info_, CND_REQUEST_RESPONSE, current_tick, filter_id);

            case CND_PAYMENT_PROCESSED:
                return consume_queue_for_tick(q_purchased_, CND_PAYMENT_PROCESSED, current_tick, filter_id);

            case CND_PAYMENT_RESTORED:
                return consume_queue_for_tick(q_restored_, CND_PAYMENT_RESTORED, current_tick, filter_id);

            case CND_RESTORE_FINISHED: {
                if (last_restore_finished_tick_ == current_tick) return true;
                if (pending_restore_finished_ && q_restored_.empty()) {
                    pending_restore_finished_ = false;
                    last_restore_finished_tick_ = current_tick;
                    SDL_Log("[PortBridge][iOSStore] -> CND_RESTORE_FINISHED disparada (tick=%lld)",
                            (long long)current_tick);
                    return true;
                }
                return false;
            }

            case CND_PAYMENT_FAILED:
            case CND_PAYMENT_CANCELLED:
            case CND_INVALID_IDENTIFIER:
            case CND_RESTORE_FAILED:
            default:
                return false;
        }
    }

    const std::string& current_id() const { return current_id_; }
    int current_qty() const { return current_qty_; }
    const std::set<std::string>& purchased_ids() const { return purchased_ids_; }

    void reset() {
        staged_info_.clear();
        staged_purchased_.clear();
        staged_restored_.clear();
        q_info_.clear();
        q_purchased_.clear();
        q_restored_.clear();
        fired_this_tick_.clear();
        staged_restore_finished_ = false;
        pending_restore_finished_ = false;
        last_restore_finished_tick_ = -1;
        current_qty_ = 1;
    }

private:
    static void move_all(std::deque<std::string>& from, std::deque<std::string>& to) {
        while (!from.empty()) {
            to.push_back(std::move(from.front()));
            from.pop_front();
        }
    }

    // Consome um item da fila (casando filter_id quando a condição do Clickteam passa o ID
    // do produto como parâmetro 0, ex.: "On payment processed for com.gameatelier.zorbie.pack").
    // Se a mesma condição for testada mais de uma vez no mesmo tick para o mesmo produto,
    // permanece TRUE durante todo aquele tick e expira no tick seguinte.
    bool consume_queue_for_tick(std::deque<std::string>& q, int cnd, int64_t tick,
                                const std::string& filter_id) {
        if (last_fired_tick_ != tick) {
            last_fired_tick_ = tick;
            fired_this_tick_.clear();
        }

        const auto key = std::make_pair(cnd, filter_id);
        auto active_it = fired_this_tick_.find(key);
        if (active_it != fired_this_tick_.end()) {
            current_id_ = active_it->second;
            return true;
        }

        if (q.empty()) return false;

        std::string matched;
        if (filter_id.empty()) {
            matched = q.front();
            q.pop_front();
        } else {
            auto it = std::find(q.begin(), q.end(), filter_id);
            if (it == q.end()) return false;
            matched = *it;
            q.erase(it);
        }

        current_id_ = matched;
        fired_this_tick_[key] = matched;
        SDL_Log("[PortBridge][iOSStore] -> CND#%d disparada para '%s' (tick=%lld)",
                cnd, matched.c_str(), (long long)tick);
        return true;
    }

    std::deque<std::string> staged_info_;
    std::deque<std::string> staged_purchased_;
    std::deque<std::string> staged_restored_;

    std::deque<std::string> q_info_;
    std::deque<std::string> q_purchased_;
    std::deque<std::string> q_restored_;

    std::set<std::string> known_ids_;
    std::set<std::string> purchased_ids_;

    std::string current_id_;
    int current_qty_ = 1;

    bool staged_restore_finished_ = false;
    bool pending_restore_finished_ = false;
    int64_t last_restore_finished_tick_ = -1;

    int64_t last_fired_tick_ = -1;
    std::map<std::pair<int, std::string>, std::string> fired_this_tick_;
};

// Instância global por processo do player
inline IosStoreEmulator& ios_store() {
    static IosStoreEmulator instance;
    return instance;
}

// Identifica a extensão da loja iOS em diferentes versões do exporter MMF2 / Fusion 2.5
inline bool is_ios_store_ext(const std::string& name) {
    return name == "iOSStore" || name == "kcstore" || name == "Store" ||
           name == "iOS Store" || name == "InAppPurchase";
}

}  // namespace pb
`;

export const PATCHED_EXTENSIONS_CPP = `// Extensões Clickteam usadas por jogos iOS:
//   kcini (INI)     — implementada, grava em save_dir (com flush adiado)
//   iOSStore        — emulador StoreKit completo (aprova compras/restore offline e persiste no INI)
//   AdvDir          — matemática de direção/distância
//   iOS*, GameCenter*, RateMe — substitutos: condições falsas, ações sem efeito.
//     (Ex.: com o iOSGetDevice falso, o Zorbié escolhe a qualidade gráfica máxima.)
#include <cmath>
#include <fstream>
#include <map>
#include <set>
#include <sstream>

#include "runtime/ext_ios_store.hpp"
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
            if (!line.empty() && line.back() == '\\r') line.pop_back();
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
            f << '[' << g << "]\\n";
            for (auto& [k, v] : items) f << k << '=' << v << '\\n';
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
        if (ch == '/' || ch == '\\\\' || ch == ':') ch = '_';
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
    if (is_ios_store_ext(n)) return false;  // tratado pelo emulador StoreKit em ext_ios_store.hpp
    return n.rfind("iOS", 0) == 0 || n.rfind("GameCenter", 0) == 0 || n == "RateMe" ||
           n == "iOSTwitter";
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
    if (is_ios_store_ext(n)) {
        // Emulador StoreKit completo: aprova compras e restaurações offline
        // sem travar em "Please wait" e sem disparar condições de falha/cancelamento.
        handled = true;
        const int idx = -it.num - 81;
        const std::string filter_id = it.params.empty() ? std::string() : arg(c, it, 0).str();
        return ios_store().check_condition(idx, c.f.loop, filter_id);
    }
    if (is_ios_stub(n)) { handled = true; return false; }
    if (n == "AdvDir") { handled = true; return false; }
    (void)o;
    return false;
}

void ext_action(EvalContext& c, const EventItem& it, Obj* o) {
    std::string n = ext_name(c, it.type);
    int idx = it.num - 80;
    if (is_ios_store_ext(n)) {
        using namespace ios_store_ace;
        auto& st = ios_store();
        const std::string p0 = it.params.empty() ? std::string() : arg(c, it, 0).str();
        SDL_Log("[PortBridge][iOSStore] ext_action raw=%d local=%d param0='%s'",
                it.num, idx, p0.c_str());
        switch (idx) {
            case ACT_REQUEST_PAYMENT:
                st.on_request_payment(p0, 1);
                return;
            case ACT_REQUEST_PRODUCT_INFO:
                st.on_request_info(p0);
                return;
            case ACT_RESTORE_TRANSACTIONS:
                st.on_restore_transactions();
                return;
            case ACT_REQUEST_PAYMENT_QTY: {
                const int qty = it.params.size() > 1 ? arg(c, it, 1).as_int() : 1;
                st.on_request_payment(p0, qty);
                return;
            }
            default:
                if (!p0.empty()) st.on_request_payment(p0, 1);
                return;
        }
    }
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
    if (is_ios_store_ext(n)) {
        // Todas as expressões da extensão iOSStore (ProductName$, Price, Identifier$, etc.) têm aridade 0.
        return 0;
    }
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
    if (is_ios_store_ext(n)) {
        using namespace ios_store_ace;
        handled = true;
        const auto& st = ios_store();
        switch (idx) {
            case EXP_PRODUCT_NAME:         return Value(st.current_id().empty() ? std::string("Unlocked Pack") : st.current_id());
            case EXP_PRODUCT_DESCRIPTION:  return Value(std::string("Unlocked locally by PortBridge"));
            case EXP_PRODUCT_PRICE:        return Value(0.0);
            case EXP_PRODUCT_PRICE_LOCALE: return Value(std::string("USD"));
            case EXP_PRODUCT_IDENTIFIER:   return Value(st.current_id());
            case EXP_PRODUCT_FORMATTED:    return Value(std::string("FREE"));
            case EXP_PRODUCT_QUANTITY:     return Value(int64_t(st.current_qty()));
            case EXP_RECEIPT_DATA:         return Value(std::string("PORTBRIDGE_OFFLINE_RECEIPT_OK"));
            case EXP_ERROR_CODE:           return Value(int64_t(0));
            case EXP_ERROR_STRING:         return Value(std::string());
            default:                       return Value(std::string());
        }
    }
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
`;

export const PATCHED_TWEAKS_CPP = `#include "runtime/tweaks.hpp"

#include <cmath>
#include <map>

#include "runtime/ext_ios_store.hpp"

namespace pb {

namespace {

// Descobre e pré-registra todos os ProductIdentifiers literais usados pelo objeto iOSStore
// no Application.cci, permitindo que o botão "Restore Purchases" restaure todas as DLCs
// logo na primeira execução sem depender de servidores da Apple.
int register_ios_store_products(const Game& game) {
    int registered = 0;
    auto scan_item = [&](const EventItem& item) {
        const std::string ext = game.extension_name(item.type);
        if (!is_ios_store_ext(ext)) return;
        for (const auto& p : item.params) {
            if (!p.str.empty()) {
                ios_store().register_product(p.str);
                ++registered;
            }
            for (const auto& e : p.expr) {
                if (e.type == -1 && e.num == 3 && !e.sval.empty()) {
                    ios_store().register_product(e.sval);
                    ++registered;
                }
            }
        }
    };
    for (const auto& frame : game.frames) {
        for (const auto& g : frame.events.groups) {
            for (const auto& c : g.conditions) scan_item(c);
            for (const auto& a : g.actions) scan_item(a);
        }
    }
    return registered;
}

// Zorbié (com.gameatelier.zorbie): o personagem anda até o dedo um número fixo
// de pixels por passo do jogo (grupos "spd 0/1/2": 5, 7 e 10 px; 60 passos/s)
// e a carga do machado sobe um nível a cada 80 ms (60 ms com a melhoria da
// loja). No celular o dedo anda bem mais rápido que isso. O ajuste deixa o
// personagem 1,6x mais rápido atrás do dedo e a carga ~1,6x mais rápida, sem
// mexer no resto (inimigos, machado, tempo da partida).
// O "spd 3" (2 px, andar lento durante a recarga) fica como está.
std::vector<std::string> tweak_zorbie(Game& game) {
    std::vector<std::string> log;
    int player_col = -1;
    for (const auto& [handle, def] : game.objects)
        if (def.name == "player_col") player_col = handle;
    if (player_col < 0) return log;

    const std::map<int32_t, int32_t> speed{{5, 8}, {7, 11}, {10, 16}};
    const std::map<int32_t, int32_t> charge{{80, 50}, {60, 40}};
    int speeds = 0, timers = 0;
    for (auto& frame : game.frames) {
        std::string group;
        for (auto& g : frame.events.groups) {
            for (const auto& c : g.conditions) {
                if (c.type == -1 && c.num == -10 && !c.params.empty()) group = c.params[0].str;  // NewGroup
                if (c.type == -1 && c.num == -11) group.clear();                                     // GroupEnd
            }
            const bool spd = group == "spd 0" || group == "spd 1" || group == "spd 2" ||
                             group == "spd 0 - lo" || group == "spd 1 - lo" || group == "spd 2 - lo";
            if (spd) {
                for (auto& a : g.actions) {
                    if (a.type != 2 || a.num != 2 || a.oi != uint16_t(player_col)) continue;  // SetX player_col
                    for (auto& p : a.params)
                        for (auto& e : p.expr)
                            if (e.type == -1 && e.num == 0) {
                                auto it = speed.find(e.ival);
                                if (it != speed.end()) {
                                    e.ival = it->second;
                                    ++speeds;
                                }
                            }
                }
            }
            if (group == "charge") {
                for (auto& c : g.conditions) {
                    if (c.type != -4 || (c.num != -4 && c.num != -8) || c.params.empty()) continue;  // Every
                    Param& p = c.params[0];
                    if (!p.expr.empty()) continue;
                    auto it = charge.find(p.i0);
                    if (it != charge.end()) {
                        p.i0 = it->second;
                        ++timers;
                    }
                }
            }
        }
    }
    if (speeds) log.push_back("Zorbié: personagem segue o dedo 1,6x mais rápido (" + std::to_string(speeds) + " ações)");
    if (timers) log.push_back("Zorbié: carga do machado 1,6x mais rápida (" + std::to_string(timers) + " temporizadores)");
    return log;
}

}  // namespace

std::vector<std::string> apply_game_tweaks(Game& game, const std::string& bundle_id) {
    ios_store().reset();
    std::vector<std::string> log;
    if (const int products = register_ios_store_products(game); products > 0) {
        log.push_back("iOSStore: emulador StoreKit ativo (" + std::to_string(products) +
                      " referências de produtos DLC registradas para compra/restore offline)");
    }
    if (bundle_id == "com.gameatelier.zorbie") {
        auto z = tweak_zorbie(game);
        log.insert(log.end(), z.begin(), z.end());
    }
    return log;
}

}  // namespace pb
`;

export const RUNTIME_CPP_PATCH_SNIPPET = `// Em player/src/runtime/runtime.cpp:
// 1) No topo do arquivo, adicione:
#include "runtime/ext_ios_store.hpp"

// 2) Dentro de App::step(), substitua:
//    store_failed = std::move(store_pending);
//    store_pending.clear();
// por:
    ios_store().begin_step();  // promove pedidos de compra/restore para disparo no passo atual
`;

export const GITHUB_ACTIONS_NATIVE_YML = `name: Build PortBridge Native (libmain.so + Converter APK)

on:
  push:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build-portbridge-android:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'

      - name: Setup Android SDK & NDK r28
        uses: android-actions/setup-android@v3

      - name: Install CMake & NDK
        run: |
          sdkmanager "ndk;28.0.13004108" "cmake;3.22.1" "platforms;android-35" "build-tools;35.0.0"

      - name: Fetch SDL2, miniz, dr_libs, stb & Liberation fonts
        run: |
          mkdir -p player/third_party/miniz player/third_party/dr_libs player/third_party/stb player/third_party/fonts
          git clone --depth 1 --branch release-2.30.11 https://github.com/libsdl-org/SDL.git player/third_party/SDL
          curl -sSL https://raw.githubusercontent.com/richgel999/miniz/3.0.2/miniz.c -o player/third_party/miniz/miniz.c
          curl -sSL https://raw.githubusercontent.com/richgel999/miniz/3.0.2/miniz.h -o player/third_party/miniz/miniz.h
          curl -sSL https://raw.githubusercontent.com/richgel999/miniz/3.0.2/miniz_common.h -o player/third_party/miniz/miniz_common.h
          curl -sSL https://raw.githubusercontent.com/richgel999/miniz/3.0.2/miniz_tdef.c -o player/third_party/miniz/miniz_tdef.c
          curl -sSL https://raw.githubusercontent.com/richgel999/miniz/3.0.2/miniz_tdef.h -o player/third_party/miniz/miniz_tdef.h
          curl -sSL https://raw.githubusercontent.com/richgel999/miniz/3.0.2/miniz_tinfl.c -o player/third_party/miniz/miniz_tinfl.c
          curl -sSL https://raw.githubusercontent.com/richgel999/miniz/3.0.2/miniz_tinfl.h -o player/third_party/miniz/miniz_tinfl.h
          curl -sSL https://raw.githubusercontent.com/richgel999/miniz/3.0.2/miniz_zip.c -o player/third_party/miniz/miniz_zip.c
          curl -sSL https://raw.githubusercontent.com/richgel999/miniz/3.0.2/miniz_zip.h -o player/third_party/miniz/miniz_zip.h
          curl -sSL https://raw.githubusercontent.com/mackron/dr_libs/master/dr_mp3.h -o player/third_party/dr_libs/dr_mp3.h
          curl -sSL https://raw.githubusercontent.com/mackron/dr_libs/master/dr_wav.h -o player/third_party/dr_libs/dr_wav.h
          curl -sSL https://raw.githubusercontent.com/nothings/stb/master/stb_truetype.h -o player/third_party/stb/stb_truetype.h
          curl -sSL https://github.com/liberationfonts/liberation-fonts/raw/main/src/LiberationSans-Regular.ttf -o player/third_party/fonts/LiberationSans-Regular.ttf
          curl -sSL https://github.com/liberationfonts/liberation-fonts/raw/main/src/LiberationSans-Bold.ttf -o player/third_party/fonts/LiberationSans-Bold.ttf

      - name: Compile libmain.so (with iOSStore Emulator) + PortBridge App APK
        working-directory: android
        run: |
          gradle :app:assembleRelease --no-daemon

      - name: Upload Compiled PortBridge APK
        uses: actions/upload-artifact@v4
        with:
          name: portbridge-native-iosstore-apk
          path: |
            android/app/build/outputs/apk/**/*.apk
            android/runtime/build/outputs/apk/**/*.apk
`;

export const PATCHED_NATIVE_FILES: PatchedNativeFile[] = [
  {
    path: 'player/src/runtime/ext_ios_store.hpp',
    title: 'ext_ios_store.hpp (Novo)',
    language: 'cpp',
    summary:
      'Emulador StoreKit autocontido adaptado às structs do PortBridge (c.f.loop, it.num - 80, -it.num - 81, filtro por product_id e filas assíncronas).',
    content: EXT_IOS_STORE_HPP,
  },
  {
    path: 'player/src/runtime/extensions.cpp',
    title: 'extensions.cpp (Patchado)',
    language: 'cpp',
    summary:
      'Acopla pb::ios_store() aos 4 ganchos (ext_action, ext_condition, ext_expression_arity, ext_expression) antes de is_ios_stub(), mantendo kcini e flush_ini_files().',
    content: PATCHED_EXTENSIONS_CPP,
  },
  {
    path: 'player/src/runtime/tweaks.cpp',
    title: 'tweaks.cpp (Patchado)',
    language: 'cpp',
    summary:
      'Escaneia o Application.cci e pré-registra os ProductIdentifiers da loja para que Restore Purchases funcione imediatamente, preservando os ajustes 1,6x do Zorbié.',
    content: PATCHED_TWEAKS_CPP,
  },
  {
    path: 'player/src/runtime/runtime.cpp (patch)',
    title: 'runtime.cpp (1 linha)',
    language: 'cpp',
    summary:
      'Adiciona #include "runtime/ext_ios_store.hpp" e chama ios_store().begin_step() dentro de App::step().',
    content: RUNTIME_CPP_PATCH_SNIPPET,
  },
  {
    path: '.github/workflows/build-portbridge-native.yml',
    title: 'build-portbridge-native.yml',
    language: 'yaml',
    summary:
      'Workflow GitHub Actions para compilar a libmain.so (NDK r28 + SDL2) e empacotar o PortBridge APK na nuvem.',
    content: GITHUB_ACTIONS_NATIVE_YML,
  },
];

/**
 * Parses all file sections (`## path/to/file` followed by fenced code block)
 * from the attached PortBridge-codigo-apk markdown bundle.
 */
export function parsePortBridgeMarkdownBundle(markdown: string): Record<string, string> {
  const files: Record<string, string> = {};
  const lines = markdown.split(/\r?\n/);
  let currentPath: string | null = null;
  let inFence = false;
  let buffer: string[] = [];

  const isFileHeading = (heading: string): boolean => {
    const trimmed = heading.trim();
    return (
      trimmed.startsWith('player/') ||
      trimmed.startsWith('android/') ||
      trimmed.startsWith('third_party/')
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inFence && line.startsWith('## ')) {
      const candidate = line.slice(3).trim();
      if (isFileHeading(candidate)) {
        currentPath = candidate;
        buffer = [];
      } else {
        currentPath = null;
      }
      continue;
    }

    if (currentPath) {
      if (!inFence && line.startsWith('```')) {
        inFence = true;
        buffer = [];
        continue;
      }
      if (inFence && line.trim() === '```') {
        files[currentPath] = buffer.join('\n') + '\n';
        inFence = false;
        currentPath = null;
        buffer = [];
        continue;
      }
      if (inFence) {
        buffer.push(line);
      }
    }
  }

  return files;
}

/**
 * Applies the iOSStore StoreKit emulator patches cleanly to runtime.cpp content.
 */
function patchRuntimeCpp(original: string): string {
  let out = original;
  if (!out.includes('ext_ios_store.hpp')) {
    out = out.replace(
      '#include "runtime/runtime.hpp"',
      '#include "runtime/runtime.hpp"\n#include "runtime/ext_ios_store.hpp"'
    );
  }
  out = out.replace(
    /store_failed\s*=\s*std::move\(store_pending\);[^\n]*\n\s*store_pending\.clear\(\);/,
    'ios_store().begin_step();  // promove pedidos da extensão iOSStore para o passo atual\n    store_failed.clear();\n    store_pending.clear();'
  );
  return out;
}

export interface NativeZipBuildResult {
  blob: Blob;
  fileName: string;
  fileCount: number;
  patchedFiles: string[];
}

export async function buildPatchedPortBridgeNativeZip(): Promise<NativeZipBuildResult> {
  const resp = await fetch('/assets/aistudio/PortBridge-codigo-apk_a5c6450a.md');
  if (!resp.ok) {
    throw new Error('Não foi possível carregar o código-fonte base do PortBridge.');
  }
  const markdown = await resp.text();
  const parsedFiles = parsePortBridgeMarkdownBundle(markdown);

  // Inject the exact StoreKit iOSStore patches into the parsed repository tree
  parsedFiles['player/src/runtime/ext_ios_store.hpp'] = EXT_IOS_STORE_HPP;
  parsedFiles['player/src/runtime/extensions.cpp'] = PATCHED_EXTENSIONS_CPP;
  parsedFiles['player/src/runtime/tweaks.cpp'] = PATCHED_TWEAKS_CPP;
  if (parsedFiles['player/src/runtime/runtime.cpp']) {
    parsedFiles['player/src/runtime/runtime.cpp'] = patchRuntimeCpp(
      parsedFiles['player/src/runtime/runtime.cpp']
    );
  }
  parsedFiles['.github/workflows/build-portbridge-native.yml'] = GITHUB_ACTIONS_NATIVE_YML;
  parsedFiles['README_IOS_STORE_PATCH.md'] = `# PortBridge Native (C++ libmain.so + Android APK + Emulador iOSStore)

Este pacote contém todo o código-fonte nativo do PortBridge (\`player/\`, \`android/\`, \`third_party/patches/touchHLE/\`) já atualizado com o emulador completo de StoreKit (\`iOSStore\`).

## Arquivos Alterados / Adicionados
- \`player/src/runtime/ext_ios_store.hpp\` — Emulador StoreKit one-shot com suporte a filtro de \`ProductIdentifier\`, filas assíncronas (\`begin_step\`) e \`RestoreTransactions\`.
- \`player/src/runtime/extensions.cpp\` — Integração nos 4 ganchos (\`ext_action\`, \`ext_condition\`, \`ext_expression_arity\`, \`ext_expression\`) antes de \`is_ios_stub()\`.
- \`player/src/runtime/tweaks.cpp\` — Descoberta automática de ProductIdentifiers no \`Application.cci\` + preservação do ajuste 1,6x do Zorbié.
- \`player/src/runtime/runtime.cpp\` — Chamada de \`ios_store().begin_step()\` em \`App::step()\`.
- \`.github/workflows/build-portbridge-native.yml\` — Pipeline CI para compilar a \`libmain.so\` e gerar o APK no GitHub Actions.

## Como compilar no GitHub Actions (sem configurar NDK localmente)
1. Extraia este ZIP em um repositório GitHub.
2. Acesse a aba **Actions** e execute **Build PortBridge Native (libmain.so + Converter APK)**.
3. Baixe o artefato \`portbridge-native-iosstore-apk\`.
`;

  const zip = new JSZip();
  const entries = Object.entries(parsedFiles);
  for (const [filePath, content] of entries) {
    zip.file(filePath, content);
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    blob,
    fileName: 'PortBridge-Native-iOSStore-Patched.zip',
    fileCount: entries.length,
    patchedFiles: [
      'player/src/runtime/ext_ios_store.hpp',
      'player/src/runtime/extensions.cpp',
      'player/src/runtime/tweaks.cpp',
      'player/src/runtime/runtime.cpp',
      '.github/workflows/build-portbridge-native.yml',
    ],
  };
}

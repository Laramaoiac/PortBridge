#include "runtime/tweaks.hpp"

#include <cmath>
#include <map>

namespace pb {

namespace {

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
    if (bundle_id == "com.gameatelier.zorbie") return tweak_zorbie(game);
    return {};
}

}  // namespace pb

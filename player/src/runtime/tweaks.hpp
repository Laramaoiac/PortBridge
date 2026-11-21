// Ajustes por jogo, aplicados aos eventos logo depois de carregar o .cci.
//
// Mudam o jogo de propósito (não são correções do runtime): cada ajuste é
// identificado pelo bundle id e confere o que vai alterar antes de mexer.
#pragma once

#include <string>
#include <vector>

#include "core/game.hpp"

namespace pb {

// Devolve uma linha por ajuste aplicado (para o log).
std::vector<std::string> apply_game_tweaks(Game& game, const std::string& bundle_id);

}  // namespace pb

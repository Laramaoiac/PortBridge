// Texto dos jogos Clickteam (objetos Text e contadores do tipo "texto").
//
// As fontes dos jogos são descritas só pelo nome (ex.: "Arial", 13 px, negrito):
// o runtime original usa a fonte do sistema. Aqui o texto é rasterizado com
// stb_truetype usando a Liberation Sans embutida (mesmas métricas do Arial), na
// escala real em que o jogo é desenhado, para ficar nítido.
#pragma once

#include <SDL.h>

#include <memory>
#include <string>

#include "core/game.hpp"

namespace pb {

struct TextStyle {
    const FontInfo* font = nullptr;  // nullptr: Arial 13 px
    uint32_t rgb = 0xFFFFFF;         // 0xRRGGBB
    uint16_t flags = 0;              // 1 centro, 2 direita, 4 centro vertical, 8 embaixo
    int alpha = 0;                   // coeficiente Clickteam: 0 opaco, 255 invisível
};

// Desenha `text` (UTF-8) dentro de `box` (unidades do jogo; largura 0 = sem
// quebra). `cache` guarda a textura entre quadros (refeita se algo mudar).
void draw_text(SDL_Renderer* r, std::shared_ptr<void>& cache, const std::string& text, const TextStyle& st,
               const SDL_FRect& box);

}  // namespace pb

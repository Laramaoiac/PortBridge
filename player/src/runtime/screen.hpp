// Composição do jogo na tela do aparelho.
//
// O jogo é desenhado numa textura em escala inteira (sem moiré em linhas finas),
// reduzido para o tamanho que ocupa na tela e colocado no centro, sem deformar.
// As sobras (faixas em cima/embaixo ou dos lados, quando o formato da tela não
// bate com o do jogo) não ficam pretas: continuam as cores da borda do jogo,
// escurecendo aos poucos até a beira da tela.
// Os toques são convertidos para coordenadas do jogo, inclusive nas faixas.
#pragma once

#include <SDL.h>

#include <vector>

namespace pb {

class Screen {
public:
    explicit Screen(SDL_Renderer* r) : r_(r) {}
    ~Screen() { release(); }
    Screen(const Screen&) = delete;
    Screen& operator=(const Screen&) = delete;

    // Área visível do jogo (unidades do jogo); refaz o cálculo pelo tamanho atual da saída.
    void configure(int view_w, int view_h);
    void begin();   // passa a desenhar o jogo (unidades do jogo)
    void end();     // compõe na janela (faixas + jogo)
    // Ponto da janela (coordenadas de evento do SDL) -> unidades do jogo.
    void to_game(int wx, int wy, SDL_Window* win, int& gx, int& gy) const;
    void release(); // destrói as texturas (contexto gráfico perdido)

    bool ambient = true;      // false: faixas pretas
    SDL_Rect game_rect{};     // onde o jogo fica na saída (pixels)

private:
    struct Chain {           // reduções sucessivas pela metade = desfoque barato e estável
        std::vector<SDL_Texture*> tex;
        std::vector<SDL_Point> size;
    };
    void band(const SDL_Rect& src, const SDL_Rect& dst, bool along_x, Chain& chain);
    static void free_chain(Chain& c);

    SDL_Renderer* r_;
    SDL_Texture* game_ = nullptr;
    int tex_w_ = 0, tex_h_ = 0, view_w_ = 0, view_h_ = 0, out_w_ = 0, out_h_ = 0;
    Chain chains_[4];   // cima, baixo, esquerda, direita
};

}  // namespace pb

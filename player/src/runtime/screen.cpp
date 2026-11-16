#include "runtime/screen.hpp"

#include <algorithm>
#include <cmath>

namespace pb {

namespace {

SDL_Texture* make_target(SDL_Renderer* r, int w, int h) {
    SDL_Texture* t = SDL_CreateTexture(r, SDL_PIXELFORMAT_RGBA8888, SDL_TEXTUREACCESS_TARGET, w, h);
    if (t) {
        SDL_SetTextureScaleMode(t, SDL_ScaleModeLinear);
        SDL_SetTextureBlendMode(t, SDL_BLENDMODE_NONE);
    }
    return t;
}

}  // namespace

void Screen::free_chain(Chain& c) {
    for (SDL_Texture* t : c.tex)
        if (t) SDL_DestroyTexture(t);
    c.tex.clear();
    c.size.clear();
}

void Screen::release() {
    if (game_) SDL_DestroyTexture(game_);
    game_ = nullptr;
    tex_w_ = tex_h_ = 0;
    for (Chain& c : chains_) free_chain(c);
}

void Screen::configure(int view_w, int view_h) {
    view_w_ = std::max(1, view_w);
    view_h_ = std::max(1, view_h);
    SDL_GetRendererOutputSize(r_, &out_w_, &out_h_);
    if (out_w_ <= 0 || out_h_ <= 0) {
        out_w_ = view_w_;
        out_h_ = view_h_;
    }
    double s = std::min(double(out_w_) / view_w_, double(out_h_) / view_h_);
    int gw = std::max(1, int(std::lround(view_w_ * s)));
    int gh = std::max(1, int(std::lround(view_h_ * s)));
    game_rect = {(out_w_ - gw) / 2, (out_h_ - gh) / 2, gw, gh};
    // O jogo é desenhado numa escala INTEIRA (ex.: 4x) e depois reduzido para o
    // tamanho da tela. Escalar direto por um fator quebrado (3,375x) deixa linhas
    // de 1 pixel com espessuras alternadas (moiré nas listras da introdução do
    // Zorbié); com escala inteira toda linha fica igual e a redução final é suave.
    int k = std::max(1, int(std::ceil(s - 1e-6)));
    k = std::min(k, 8);
    int tw = view_w_ * k, th = view_h_ * k;
    if (!game_ || tw != tex_w_ || th != tex_h_) {
        release();
        game_ = make_target(r_, tw, th);
        tex_w_ = tw;
        tex_h_ = th;
    }
}

void Screen::begin() {
    if (!game_) configure(view_w_, view_h_);
    SDL_SetRenderTarget(r_, game_);
    SDL_RenderSetScale(r_, float(tex_w_) / view_w_, float(tex_h_) / view_h_);
}

// Faixa de preenchimento: pega uma tira fina encostada na borda do jogo,
// desfoca só ao longo da borda (reduções pela metade) e estica até a faixa,
// de modo que as cores da borda continuem até a beira da tela.
void Screen::band(const SDL_Rect& src, const SDL_Rect& dst, bool along_x, Chain& chain) {
    if (src.w <= 0 || src.h <= 0 || dst.w <= 0 || dst.h <= 0) return;
    std::vector<SDL_Point> sizes;
    int w = src.w, h = src.h;
    do {
        if (along_x) w = std::max(1, w / 2);
        else h = std::max(1, h / 2);
        sizes.push_back({w, h});
    } while ((along_x ? w : h) > 24 && sizes.size() < 10);
    bool same = sizes.size() == chain.size.size();
    for (size_t i = 0; same && i < sizes.size(); ++i)
        same = sizes[i].x == chain.size[i].x && sizes[i].y == chain.size[i].y;
    if (!same) {
        free_chain(chain);
        for (const SDL_Point& p : sizes) chain.tex.push_back(make_target(r_, p.x, p.y));
        chain.size = sizes;
    }
    for (SDL_Texture* t : chain.tex)
        if (!t) return;
    SDL_SetRenderTarget(r_, chain.tex[0]);
    SDL_RenderCopy(r_, game_, &src, nullptr);
    for (size_t i = 1; i < chain.tex.size(); ++i) {
        SDL_SetRenderTarget(r_, chain.tex[i]);
        SDL_RenderCopy(r_, chain.tex[i - 1], nullptr, nullptr);
    }
    SDL_SetRenderTarget(r_, nullptr);
    SDL_RenderCopy(r_, chain.tex.back(), nullptr, &dst);
}

// Escurece a faixa aos poucos: transparente junto do jogo, mais escura na beira.
static void fade(SDL_Renderer* r, const SDL_Rect& bar, int edge /*0 cima 1 baixo 2 esq 3 dir*/) {
    const int steps = 24;
    bool vertical = edge < 2;
    int len = vertical ? bar.h : bar.w;
    for (int i = 0; i < steps; ++i) {
        int a0 = len * i / steps, a1 = len * (i + 1) / steps;
        if (a1 <= a0) continue;
        // i = 0 encosta no jogo
        Uint8 alpha = Uint8(20 + 170 * i / (steps - 1));
        SDL_Rect s;
        switch (edge) {
            case 0: s = {bar.x, bar.y + bar.h - a1, bar.w, a1 - a0}; break;
            case 1: s = {bar.x, bar.y + a0, bar.w, a1 - a0}; break;
            case 2: s = {bar.x + bar.w - a1, bar.y, a1 - a0, bar.h}; break;
            default: s = {bar.x + a0, bar.y, a1 - a0, bar.h}; break;
        }
        SDL_SetRenderDrawColor(r, 0, 0, 0, alpha);
        SDL_RenderFillRect(r, &s);
    }
}

void Screen::end() {
    SDL_SetRenderTarget(r_, nullptr);
    SDL_RenderSetScale(r_, 1, 1);
    SDL_SetRenderDrawBlendMode(r_, SDL_BLENDMODE_NONE);
    SDL_SetRenderDrawColor(r_, 0, 0, 0, 255);
    SDL_RenderClear(r_);
    if (!game_) return;

    // sobras de 1-2 px (arredondamento) não viram faixa
    if (game_rect.y <= 2 && out_h_ - (game_rect.y + game_rect.h) <= 2) { game_rect.y = 0; game_rect.h = out_h_; }
    if (game_rect.x <= 2 && out_w_ - (game_rect.x + game_rect.w) <= 2) { game_rect.x = 0; game_rect.w = out_w_; }
    const SDL_Rect& g = game_rect;
    if (ambient) {
        // tira de ~2 linhas do jogo junto de cada borda
        int th = std::max(1, tex_h_ / 200), tw = std::max(1, tex_w_ / 200);
        int below = out_h_ - (g.y + g.h), right = out_w_ - (g.x + g.w);
        SDL_Rect bars[4] = {{0, 0, out_w_, g.y},
                            {0, g.y + g.h, out_w_, below},
                            {0, 0, g.x, out_h_},
                            {g.x + g.w, 0, right, out_h_}};
        if (g.y > 0) band({0, 0, tex_w_, th}, bars[0], true, chains_[0]);
        if (below > 0) band({0, tex_h_ - th, tex_w_, th}, bars[1], true, chains_[1]);
        if (g.x > 0) band({0, 0, tw, tex_h_}, bars[2], false, chains_[2]);
        if (right > 0) band({tex_w_ - tw, 0, tw, tex_h_}, bars[3], false, chains_[3]);
        SDL_SetRenderDrawBlendMode(r_, SDL_BLENDMODE_BLEND);
        if (g.y > 0) fade(r_, bars[0], 0);
        if (below > 0) fade(r_, bars[1], 1);
        if (g.x > 0) fade(r_, bars[2], 2);
        if (right > 0) fade(r_, bars[3], 3);
        SDL_SetRenderDrawBlendMode(r_, SDL_BLENDMODE_NONE);
    }
    SDL_RenderCopy(r_, game_, nullptr, &game_rect);
}

void Screen::to_game(int wx, int wy, SDL_Window* win, int& gx, int& gy) const {
    int ww = 0, wh = 0;
    SDL_GetWindowSize(win, &ww, &wh);
    double px = ww > 0 ? double(wx) * out_w_ / ww : wx;   // pontos -> pixels (telas HiDPI)
    double py = wh > 0 ? double(wy) * out_h_ / wh : wy;
    if (game_rect.w <= 0 || game_rect.h <= 0) {
        gx = int(px);
        gy = int(py);
        return;
    }
    gx = int(std::floor((px - game_rect.x) * view_w_ / game_rect.w));
    gy = int(std::floor((py - game_rect.y) * view_h_ / game_rect.h));
}

}  // namespace pb

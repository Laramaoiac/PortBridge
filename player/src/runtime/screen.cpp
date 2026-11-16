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
    if (!game_ || gw != tex_w_ || gh != tex_h_) {
        release();
        game_ = make_target(r_, gw, gh);
        tex_w_ = gw;
        tex_h_ = gh;
    }
}

void Screen::begin() {
    if (!game_) configure(view_w_, view_h_);
    SDL_SetRenderTarget(r_, game_);
    SDL_RenderSetScale(r_, float(tex_w_) / view_w_, float(tex_h_) / view_h_);
}

void Screen::band(const SDL_Rect& src, const SDL_Rect& dst, bool flip_v, bool flip_h, Chain& chain) {
    if (src.w <= 0 || src.h <= 0 || dst.w <= 0 || dst.h <= 0) return;
    // tamanhos: metade, metade da metade... até ~16 px (desfoque forte)
    std::vector<SDL_Point> sizes;
    int w = src.w, h = src.h;
    do {
        w = std::max(1, w / 2);
        h = std::max(1, h / 2);
        sizes.push_back({w, h});
    } while ((w > 16 || h > 16) && sizes.size() < 9);
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
    int flip = (flip_v ? SDL_FLIP_VERTICAL : 0) | (flip_h ? SDL_FLIP_HORIZONTAL : 0);
    SDL_RenderCopyEx(r_, chain.tex.back(), nullptr, &dst, 0, nullptr, SDL_RendererFlip(flip));
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
    std::vector<SDL_Rect> bars;
    if (ambient) {
        // Amostra ~1/6 do jogo junto de cada borda, espelhada para a linha encostada
        // no jogo continuar a borda dele.
        int sh = std::max(1, tex_h_ / 6), sw = std::max(1, tex_w_ / 6);
        if (g.y > 0) {
            SDL_Rect top{0, 0, out_w_, g.y};
            band({0, 0, tex_w_, sh}, top, true, false, chains_[0]);
            bars.push_back(top);
        }
        int below = out_h_ - (g.y + g.h);
        if (below > 0) {
            SDL_Rect bottom{0, g.y + g.h, out_w_, below};
            band({0, tex_h_ - sh, tex_w_, sh}, bottom, true, false, chains_[1]);
            bars.push_back(bottom);
        }
        if (g.x > 0) {
            SDL_Rect left{0, 0, g.x, out_h_};
            band({0, 0, sw, tex_h_}, left, false, true, chains_[2]);
            bars.push_back(left);
        }
        int right = out_w_ - (g.x + g.w);
        if (right > 0) {
            SDL_Rect r{g.x + g.w, 0, right, out_h_};
            band({tex_w_ - sw, 0, sw, tex_h_}, r, false, true, chains_[3]);
            bars.push_back(r);
        }
        // escurece as faixas e faz uma sombra suave encostada no jogo
        SDL_SetRenderDrawBlendMode(r_, SDL_BLENDMODE_BLEND);
        SDL_SetRenderDrawColor(r_, 0, 0, 0, 150);
        for (const SDL_Rect& b : bars) SDL_RenderFillRect(r_, &b);
        int depth = std::max(2, std::min(out_w_, out_h_) / 40), steps = 8;
        for (int i = 0; i < steps; ++i) {
            Uint8 a = Uint8(110 * (steps - i) / steps);
            int t = std::max(1, depth / steps), off = i * t;
            SDL_SetRenderDrawColor(r_, 0, 0, 0, a);
            if (g.y > 0) {
                SDL_Rect s1{0, g.y - off - t, out_w_, t};
                SDL_RenderFillRect(r_, &s1);
            }
            if (below > 0) {
                SDL_Rect s2{0, g.y + g.h + off, out_w_, t};
                SDL_RenderFillRect(r_, &s2);
            }
            if (g.x > 0) {
                SDL_Rect s3{g.x - off - t, 0, t, out_h_};
                SDL_RenderFillRect(r_, &s3);
            }
            if (right > 0) {
                SDL_Rect s4{g.x + g.w + off, 0, t, out_h_};
                SDL_RenderFillRect(r_, &s4);
            }
        }
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

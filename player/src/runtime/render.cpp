// Desenho de um frame com SDL_Renderer (OpenGL ES no Android, Metal/D3D/GL no desktop).
#include <algorithm>
#include <cmath>
#include <string>
#include <vector>
#include <cstdlib>

#include "runtime/runtime.hpp"

namespace pb {
namespace {

void draw_image(App& app, SDL_Renderer* r, int handle, double x, double y, float sx, float sy,
                float angle, int alpha, uint32_t rgb, uint32_t ink) {
    SDL_Texture* tex = app.texture(handle);
    const ImageInfo* im = app.image(handle);
    if (!tex || !im) return;
    float ax = std::fabs(sx), ay = std::fabs(sy);
    SDL_FRect dst{float(x - im->hot_x * ax), float(y - im->hot_y * ay), im->width * ax, im->height * ay};
    SDL_FPoint center{im->hot_x * ax, im->hot_y * ay};
    int flip = (sx < 0 ? SDL_FLIP_HORIZONTAL : 0) | (sy < 0 ? SDL_FLIP_VERTICAL : 0);
    SDL_SetTextureAlphaMod(tex, Uint8(255 - std::clamp(alpha, 0, 255)));
    SDL_SetTextureColorMod(tex, Uint8(rgb >> 16), Uint8(rgb >> 8), Uint8(rgb));
    SDL_SetTextureBlendMode(tex, (ink & 0xFFFF) == 9 ? SDL_BLENDMODE_ADD : SDL_BLENDMODE_BLEND);
    SDL_RenderCopyExF(r, tex, nullptr, &dst, -double(angle), &center, SDL_RendererFlip(flip));
}

// PB_HIDE="116,554": não desenha esses objetos (depuração de camadas/sobreposição).
bool hidden_for_debug(int oi) {
    static const std::vector<int> list = [] {
        std::vector<int> v;
        if (const char* t = std::getenv("PB_HIDE"))
            for (const char* p = t; *p;) {
                v.push_back(std::atoi(p));
                while (*p && *p != ',') ++p;
                if (*p) ++p;
            }
        return v;
    }();
    return !list.empty() && std::find(list.begin(), list.end(), oi) != list.end();
}

void draw_counter(App& app, SDL_Renderer* r, const Obj& o, double ox, double oy) {
    const auto& frames = o.def->counter_frames;
    if (frames.empty()) return;
    double v = o.counter;
    std::string s;
    if (std::floor(v) == v) s = std::to_string(int64_t(v));
    else {
        char buf[64];
        std::snprintf(buf, sizeof buf, "%g", v);
        s = buf;
    }
    double cx = o.x - ox;  // âncora no canto inferior direito
    for (auto it = s.rbegin(); it != s.rend(); ++it) {
        char ch = *it;
        int idx = ch >= '0' && ch <= '9' ? ch - '0' : ch == '-' ? 10 : ch == '+' ? 11 : ch == '.' ? 12 : ch == 'e' ? 13 : -1;
        if (idx < 0 || size_t(idx) >= frames.size() || frames[size_t(idx)] == 0xFFFF) continue;
        const ImageInfo* im = app.image(frames[size_t(idx)]);
        if (!im) continue;
        cx -= im->width;
        // desenha a partir do canto superior esquerdo (ignora o hotspot do dígito)
        draw_image(app, r, frames[size_t(idx)], cx + im->hot_x, o.y - oy - im->height + im->hot_y, 1, 1, 0,
                   o.alpha, o.rgb, o.def->ink_effect);
    }
}

}  // namespace

void Frame::draw(SDL_Renderer* r) {
    // fora do frame (e nas faixas do letterbox): preto; dentro: cor de fundo do frame
    SDL_SetRenderDrawColor(r, 0, 0, 0, 255);
    SDL_RenderClear(r);
    SDL_SetRenderDrawColor(r, Uint8(background >> 16), Uint8(background >> 8), Uint8(background), 255);
    SDL_FRect area{float(-scroll_x), float(-scroll_y), float(width), float(height)};
    SDL_RenderFillRectF(r, &area);
    std::vector<Obj*> list;
    for (int layer = 0; layer < int(def.layers.size()); ++layer) {
        const Layer& L = def.layers[size_t(layer)];
        if (!(L.flags & 0x10)) continue;  // camada oculta
        double ox = 0, oy = 0;
        layer_offset(layer, ox, oy);
        (void)L;
        list.clear();
        for (auto& o : objects) {
            if (o->layer != layer || !o->visible) continue;
            if (hidden_for_debug(o->oi)) continue;
            if (o->destroyed && !o->dying) continue;
            list.push_back(o.get());
        }
        std::stable_sort(list.begin(), list.end(), [](Obj* a, Obj* b) { return a->z < b->z; });
        for (Obj* o : list) {
            if (o->type == OBJ_ACTIVE) {
                if (o->image >= 0)
                    draw_image(app, r, o->image, o->x - ox, o->y - oy, o->scale_x, o->scale_y, o->angle,
                               o->alpha, o->rgb, o->def->ink_effect);
            } else if (o->type == OBJ_COUNTER || o->type == OBJ_SCORE || o->type == OBJ_LIVES) {
                draw_counter(app, r, *o, ox, oy);
            }
        }
    }
}

}  // namespace pb

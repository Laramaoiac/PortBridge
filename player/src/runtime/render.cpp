// Desenho de um frame com SDL_Renderer (OpenGL ES no Android, Metal/D3D/GL no desktop).
#include <algorithm>
#include <cmath>
#include <string>
#include <vector>
#include <cstdlib>

#include "runtime/runtime.hpp"
#include "runtime/text.hpp"

namespace pb {
namespace {

void draw_image(App& app, SDL_Renderer* r, int handle, double x, double y, float sx, float sy,
                float angle, int alpha, uint32_t rgb, uint32_t ink) {
    SDL_Texture* tex = app.texture(handle);
    const ImageInfo* im = app.image(handle);
    if (!tex || !im) return;
    float ax = std::fabs(sx), ay = std::fabs(sy);
    SDL_FRect dst{float(x - im->hot_x * ax), float(y - im->hot_y * ay), im->width * ax, im->height * ay};
    // Renderizador por software (testes sem tela): uma imagem ampliada centenas de
    // vezes (efeitos do Zorbié) com rotação faz o SDL alocar uma superfície do
    // tamanho do destino (GBs). Na GPU isso é só recortado; aqui é pulado.
    static int software = -1;
    if (software < 0) {
        SDL_RendererInfo info{};
        software = SDL_GetRendererInfo(r, &info) == 0 && (info.flags & SDL_RENDERER_SOFTWARE) ? 1 : 0;
    }
    if (software && double(dst.w) * dst.h > 4.0e7) return;
    SDL_FPoint center{im->hot_x * ax, im->hot_y * ay};
    int flip = (sx < 0 ? SDL_FLIP_HORIZONTAL : 0) | (sy < 0 ? SDL_FLIP_VERTICAL : 0);
    SDL_SetTextureAlphaMod(tex, Uint8(255 - std::clamp(alpha, 0, 255)));
    SDL_SetTextureColorMod(tex, Uint8(rgb >> 16), Uint8(rgb >> 8), Uint8(rgb));
    SDL_SetTextureBlendMode(tex, (ink & 0xFFF) == 9 ? SDL_BLENDMODE_ADD : SDL_BLENDMODE_BLEND);  // 0x1000: filtro RGBA
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

const FontInfo* font_by_handle(App& app, int handle) {
    for (const FontInfo& f : app.game().fonts)
        if (f.handle == handle) return &f;
    return app.game().fonts.empty() ? nullptr : &app.game().fonts.front();
}

std::string counter_text(double v) {
    if (std::floor(v) == v) return std::to_string(int64_t(v));
    char buf[64];
    std::snprintf(buf, sizeof buf, "%g", v);
    return buf;
}

// Barra vertical (cresce de baixo para cima) ou horizontal (da esquerda), na cor
// 1 ou em degradê da cor 1 para a 2. Flag 0x100: cresce ao contrário. Ex.: a
// barra de super do Zorbié (5x100, 0..100).
void draw_bar(SDL_Renderer* r, const Obj& o, double ox, double oy) {
    const ObjectDef& d = *o.def;
    double range = o.counter_max - o.counter_min;
    double frac = range > 0 ? std::clamp((o.counter - o.counter_min) / range, 0.0, 1.0) : 0.0;
    float x = float(o.x - ox), y = float(o.y - oy), w = float(d.counter_w), h = float(d.counter_h);
    bool inverse = (d.counter_flags & 0x100) != 0;
    SDL_FRect bar = d.counter_display == 2
        ? SDL_FRect{x, inverse ? y : y + h * float(1 - frac), w, h * float(frac)}
        : SDL_FRect{inverse ? x + w * float(1 - frac) : x, y, w * float(frac), h};
    if (bar.w <= 0 || bar.h <= 0) return;
    Uint8 a = Uint8(255 - std::clamp(o.alpha, 0, 255));
    auto col = [&](uint32_t rgb) { return SDL_Color{Uint8(rgb >> 16), Uint8(rgb >> 8), Uint8(rgb), a}; };
    SDL_SetRenderDrawBlendMode(r, SDL_BLENDMODE_BLEND);
    if (!d.fill_is_gradient() || o.bar_color1 == o.bar_color2) {
        SDL_Color c = col(o.bar_color1);
        SDL_SetRenderDrawColor(r, c.r, c.g, c.b, c.a);
        SDL_RenderFillRectF(r, &bar);
        return;
    }
    // degradê: 1 -> 2 na horizontal ou na vertical
    SDL_Color c1 = col(o.bar_color1), c2 = col(o.bar_color2);
    bool vert = d.counter_vgradient;
    SDL_Vertex v[4] = {
        {{bar.x, bar.y}, c1, {0, 0}},
        {{bar.x + bar.w, bar.y}, vert ? c1 : c2, {0, 0}},
        {{bar.x + bar.w, bar.y + bar.h}, c2, {0, 0}},
        {{bar.x, bar.y + bar.h}, vert ? c2 : c1, {0, 0}},
    };
    const int idx[6] = {0, 1, 2, 0, 2, 3};
    SDL_RenderGeometry(r, nullptr, v, 4, idx, 6);
}

void draw_counter(App& app, SDL_Renderer* r, Obj& o, double ox, double oy) {
    if (o.def->counter_display == 2 || o.def->counter_display == 3) {
        draw_bar(r, o, ox, oy);
        return;
    }
    if (o.def->counter_display == 5) {  // número escrito com fonte, alinhado à direita no retângulo
        TextStyle st;
        st.font = font_by_handle(app, o.def->counter_font);
        st.rgb = o.bar_color1;
        st.flags = 2;
        st.alpha = o.alpha;
        SDL_FRect box{float(o.x - ox), float(o.y - oy), float(o.def->counter_w), float(o.def->counter_h)};
        draw_text(r, o.text_cache, counter_text(o.counter), st, box);
        return;
    }
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
            // Objeto inteiro fora da área do frame não aparece: no aparelho
            // original a tela nunca passa da borda do frame, e os jogos estacionam
            // ali contadores de controle (o "unlock" do Zorbié fica em y = -16 na
            // introdução, que tem 568 px de altura; na área visível de 600 px ele
            // aparecia como um "0" vermelho no canto).
            const Rect rr = obj_rect(app, *o);
            if (rr.x2 - ox <= area.x || rr.x1 - ox >= area.x + area.w || rr.y2 - oy <= area.y ||
                rr.y1 - oy >= area.y + area.h)
                continue;
            if (o->type == OBJ_ACTIVE) {
                if (o->image >= 0)
                    draw_image(app, r, o->image, o->x - ox, o->y - oy, o->scale_x, o->scale_y, o->angle,
                               o->alpha, o->rgb, o->def->ink_effect);
            } else if (o->type == OBJ_COUNTER || o->type == OBJ_SCORE || o->type == OBJ_LIVES) {
                draw_counter(app, r, *o, ox, oy);
            } else if (o->type == OBJ_TEXT && o->def) {
                // Fala do Zorbié ("String"): fonte, cor e alinhamento do parágrafo,
                // quebrando linha na largura do retângulo do objeto.
                TextStyle st;
                const auto& paras = o->def->paragraphs;
                st.font = font_by_handle(app, paras.empty() ? 0 : paras[0].font);
                st.flags = paras.empty() ? 0 : paras[0].flags;
                st.rgb = o->text_color;
                st.alpha = o->alpha;
                SDL_FRect box{float(o->x - ox), float(o->y - oy), float(o->def->text_w), float(o->def->text_h)};
                draw_text(r, o->text_cache, o->text, st, box);
            }
        }
    }
}

}  // namespace pb

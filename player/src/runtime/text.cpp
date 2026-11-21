#include "runtime/text.hpp"

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <vector>

#define STB_TRUETYPE_IMPLEMENTATION
#define STBTT_STATIC
#include "stb_truetype.h"

// Gerados pelo CMake a partir de third_party/fonts (Liberation Sans, licença OFL).
extern const unsigned char pb_font_regular[];
extern const unsigned char pb_font_bold[];

namespace pb {
namespace {

struct Face {
    stbtt_fontinfo info{};
    bool ok = false;
};

Face& face(bool bold) {
    static Face faces[2];
    static bool init = false;
    if (!init) {
        init = true;
        faces[0].ok = stbtt_InitFont(&faces[0].info, pb_font_regular, 0) != 0;
        faces[1].ok = stbtt_InitFont(&faces[1].info, pb_font_bold, 0) != 0;
    }
    return faces[bold ? 1 : 0].ok ? faces[bold ? 1 : 0] : faces[0];
}

std::vector<uint32_t> utf8(const std::string& s) {
    std::vector<uint32_t> out;
    for (size_t i = 0; i < s.size();) {
        unsigned char c = static_cast<unsigned char>(s[i]);
        uint32_t cp = c;
        int n = 0;
        if (c >= 0xF0) { cp = c & 0x07; n = 3; }
        else if (c >= 0xE0) { cp = c & 0x0F; n = 2; }
        else if (c >= 0xC0) { cp = c & 0x1F; n = 1; }
        bool bad = false;
        for (int k = 1; k <= n; ++k) {
            if (i + size_t(k) >= s.size() || (static_cast<unsigned char>(s[i + size_t(k)]) & 0xC0) != 0x80) {
                bad = true;
                break;
            }
            cp = (cp << 6) | (static_cast<unsigned char>(s[i + size_t(k)]) & 0x3F);
        }
        if (bad) { cp = c; n = 0; }  // Latin-1 solto
        out.push_back(cp);
        i += size_t(n) + 1;
    }
    return out;
}

struct Cached {
    SDL_Texture* tex = nullptr;
    std::string key;
    int w = 0, h = 0;
    float k = 1;
    ~Cached() {
        if (tex) SDL_DestroyTexture(tex);
    }
};

struct Line {
    std::vector<uint32_t> cps;
    float width = 0;
};

}  // namespace

void draw_text(SDL_Renderer* r, std::shared_ptr<void>& cache, const std::string& text, const TextStyle& st,
               const SDL_FRect& box) {
    if (text.empty()) return;
    float sx = 1, sy = 1;
    SDL_RenderGetScale(r, &sx, &sy);
    const float k = std::max(1.0f, std::max(sx, sy));  // pixels por unidade do jogo
    const bool bold = st.font && st.font->weight >= 600;
    const float em = st.font && st.font->height ? float(std::abs(st.font->height)) : 13.0f;

    char hdr[96];
    std::snprintf(hdr, sizeof hdr, "%d|%.2f|%.2f|%.1f|%.1f|%u|", int(bold), em, k, box.w, box.h, unsigned(st.flags));
    std::string key = std::string(hdr) + text;
    if (!cache) cache = std::make_shared<Cached>();
    Cached& c = *static_cast<Cached*>(cache.get());

    if (c.key != key || !c.tex) {
        if (c.tex) SDL_DestroyTexture(c.tex);
        c.tex = nullptr;
        c.key = key;
        c.k = k;
        Face& F = face(bold);
        if (!F.ok) return;
        const float scale = stbtt_ScaleForMappingEmToPixels(&F.info, em * k);
        int ascent = 0, descent = 0, gap = 0;
        stbtt_GetFontVMetrics(&F.info, &ascent, &descent, &gap);
        const float line_h = std::ceil((ascent - descent + gap) * scale);
        const float base = std::ceil(ascent * scale);
        const float wrap = box.w > 0 ? box.w * k : 1e9f;

        auto advance = [&](uint32_t a, uint32_t b) {
            int adv = 0, lsb = 0;
            stbtt_GetCodepointHMetrics(&F.info, int(a), &adv, &lsb);
            float w = adv * scale;
            if (b) w += stbtt_GetCodepointKernAdvance(&F.info, int(a), int(b)) * scale;
            return w;
        };
        auto measure = [&](const std::vector<uint32_t>& cps) {
            float w = 0;
            for (size_t i = 0; i < cps.size(); ++i) w += advance(cps[i], i + 1 < cps.size() ? cps[i + 1] : 0);
            return w;
        };

        // Quebra de linha por palavras (e nos \n do texto).
        std::vector<Line> lines;
        std::vector<uint32_t> all = utf8(text);
        Line cur;
        std::vector<uint32_t> word;
        auto flush_word = [&]() {
            if (word.empty()) return;
            std::vector<uint32_t> trial = cur.cps;
            if (!trial.empty()) trial.push_back(' ');
            trial.insert(trial.end(), word.begin(), word.end());
            float w = measure(trial);
            if (w > wrap && !cur.cps.empty()) {
                lines.push_back(cur);
                cur = Line{};
                cur.cps = word;
                cur.width = measure(word);
            } else {
                cur.cps = trial;
                cur.width = w;
            }
            word.clear();
        };
        for (uint32_t cp : all) {
            if (cp == '\r') continue;
            if (cp == '\n') {
                flush_word();
                lines.push_back(cur);
                cur = Line{};
            } else if (cp == ' ') {
                flush_word();
            } else {
                word.push_back(cp);
            }
        }
        flush_word();
        lines.push_back(cur);
        while (lines.size() > 1 && lines.back().cps.empty()) lines.pop_back();

        float maxw = 0;
        for (auto& l : lines) maxw = std::max(maxw, l.width);
        int tw = std::max(1, int(std::ceil(box.w > 0 ? std::max(box.w * k, maxw) : maxw)) + 2);
        int th = std::max(1, int(line_h * float(lines.size())) + 2);
        std::vector<uint8_t> alpha(size_t(tw) * size_t(th), 0);

        for (size_t li = 0; li < lines.size(); ++li) {
            const Line& l = lines[li];
            float x = 1;
            if (st.flags & 1) x = (float(tw) - l.width) / 2;
            else if (st.flags & 2) x = float(tw) - l.width - 1;
            float y = 1 + base + line_h * float(li);
            for (size_t i = 0; i < l.cps.size(); ++i) {
                uint32_t cp = l.cps[i];
                float xs = x - std::floor(x);
                int x0, y0, x1, y1;
                stbtt_GetCodepointBitmapBoxSubpixel(&F.info, int(cp), scale, scale, xs, 0, &x0, &y0, &x1, &y1);
                int gw = x1 - x0, gh = y1 - y0;
                if (gw > 0 && gh > 0) {
                    std::vector<uint8_t> g(size_t(gw) * size_t(gh));
                    stbtt_MakeCodepointBitmapSubpixel(&F.info, g.data(), gw, gh, gw, scale, scale, xs, 0, int(cp));
                    int ox = int(std::floor(x)) + x0, oy = int(y) + y0;
                    for (int yy = 0; yy < gh; ++yy) {
                        int ty = oy + yy;
                        if (ty < 0 || ty >= th) continue;
                        for (int xx = 0; xx < gw; ++xx) {
                            int tx = ox + xx;
                            if (tx < 0 || tx >= tw) continue;
                            uint8_t& d = alpha[size_t(ty) * size_t(tw) + size_t(tx)];
                            d = uint8_t(std::min(255, d + g[size_t(yy) * size_t(gw) + size_t(xx)]));
                        }
                    }
                }
                x += advance(cp, i + 1 < l.cps.size() ? l.cps[i + 1] : 0);
            }
        }

        SDL_Texture* tex = SDL_CreateTexture(r, SDL_PIXELFORMAT_RGBA32, SDL_TEXTUREACCESS_STATIC, tw, th);
        if (!tex) return;
        std::vector<uint8_t> rgba(size_t(tw) * size_t(th) * 4);
        for (size_t i = 0; i < alpha.size(); ++i) {
            rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = 255;  // cor entra pelo ColorMod
            rgba[i * 4 + 3] = alpha[i];
        }
        SDL_UpdateTexture(tex, nullptr, rgba.data(), tw * 4);
        SDL_SetTextureBlendMode(tex, SDL_BLENDMODE_BLEND);
        SDL_SetTextureScaleMode(tex, SDL_ScaleModeLinear);
        c.tex = tex;
        c.w = tw;
        c.h = th;
    }

    // Posição: o tamanho da textura está em pixels reais; divide por k.
    float w = float(c.w) / c.k, h = float(c.h) / c.k;
    float x = box.x - 1.0f / c.k, y = box.y - 1.0f / c.k;
    if (box.h > 0) {
        if (st.flags & 4) y += (box.h - h) / 2;
        else if (st.flags & 8) y += box.h - h;
    }
    SDL_Rect src{0, 0, c.w, c.h};
    if (box.h > 0 && h > box.h + 2.0f / c.k && !(st.flags & (4 | 8))) {  // o Text do Clickteam corta no retângulo
        src.h = int(std::ceil((box.h + 2.0f / c.k) * c.k));
        h = float(src.h) / c.k;
    }
    SDL_FRect dst{x, y, w, h};
    SDL_SetTextureColorMod(c.tex, Uint8(st.rgb >> 16), Uint8(st.rgb >> 8), Uint8(st.rgb));
    SDL_SetTextureAlphaMod(c.tex, Uint8(255 - std::clamp(st.alpha, 0, 255)));
    SDL_RenderCopyF(r, c.tex, &src, &dst);
}

}  // namespace pb

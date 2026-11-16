// PortBridge Player: roda jogos Clickteam de IPAs de iOS em Android, Linux, Windows e macOS.
//
//   portbridge-player jogo.ipa [--scale N] [--mute]
//   portbridge-player jogo.ipa --headless --frames 600 --click 160,240@120 --screenshot out.png
//
// No Android o caminho do jogo chega como argumento pelo PlayerActivity (SDLActivity).
#include <SDL.h>

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <memory>
#include <string>
#include <vector>

#include "core/game.hpp"
#include "core/package.hpp"
#include "miniz.h"
#include "runtime/audio.hpp"
#include "runtime/diag.hpp"
#include "runtime/runtime.hpp"

namespace {

struct Options {
    std::string path, screenshot, save_dir, log, device;
    bool headless = false, mute = false;
    int frames = 0, scale = 2;
    std::vector<std::pair<int, std::pair<int, int>>> clicks;  // (frame, (x, y))
    std::vector<int> shots;                                    // frames extras para capturar
};

bool parse_args(int argc, char** argv, Options& o) {
    for (int i = 1; i < argc; ++i) {
        std::string a = argv[i];
        auto next = [&]() -> std::string { return i + 1 < argc ? argv[++i] : ""; };
        if (a == "--headless") o.headless = true;
        else if (a == "--mute") o.mute = true;
        else if (a == "--frames") o.frames = std::atoi(next().c_str());
        else if (a == "--scale") o.scale = std::max(1, std::atoi(next().c_str()));
        else if (a == "--screenshot") o.screenshot = next();
        else if (a == "--save-dir") o.save_dir = next();
        else if (a == "--log") o.log = next();
        else if (a == "--device") o.device = next();
        else if (a == "--shot-at") o.shots.push_back(std::atoi(next().c_str()));
        else if (a == "--click") {
            int x = 0, y = 0, f = 0;
            if (std::sscanf(next().c_str(), "%d,%d@%d", &x, &y, &f) == 3) o.clicks.push_back({f, {x, y}});
        } else if (!a.empty() && a[0] != '-' && o.path.empty()) o.path = a;
    }
    return !o.path.empty();
}

bool save_png(SDL_Renderer* r, int w, int h, const std::string& path) {
    std::vector<uint8_t> px(size_t(w) * h * 4);
    if (SDL_RenderReadPixels(r, nullptr, SDL_PIXELFORMAT_RGBA32, px.data(), w * 4) != 0) return false;
    size_t len = 0;
    void* png = tdefl_write_image_to_png_file_in_memory(px.data(), w, h, 4, &len);
    if (!png) return false;
    FILE* f = std::fopen(path.c_str(), "wb");
    if (f) {
        std::fwrite(png, 1, len, f);
        std::fclose(f);
    }
    mz_free(png);
    return f != nullptr;
}

}  // namespace

int main(int argc, char** argv) {
    Options opt;
    if (!parse_args(argc, argv, opt)) {
        std::fprintf(stderr, "uso: portbridge-player <jogo.ipa | Application.cci> [--headless --frames N --screenshot out.png]\n");
        return 2;
    }
    if (opt.headless) {
        SDL_SetHint(SDL_HINT_VIDEODRIVER, "offscreen");
        SDL_setenv("SDL_AUDIODRIVER", "dummy", 1);
    }
    SDL_SetHint(SDL_HINT_RENDER_SCALE_QUALITY, "1");
    if (SDL_Init(SDL_INIT_VIDEO | SDL_INIT_EVENTS | SDL_INIT_TIMER) != 0) {
        std::fprintf(stderr, "SDL_Init: %s\n", SDL_GetError());
        return 1;
    }

    pb::diag_open(opt.log, opt.device);
    pb::g_diag.stage = "carregando o jogo";
    pb::PackageInfo pkg;
    std::unique_ptr<pb::Game> game;
    try {
        if (opt.path.rfind("asset:", 0) == 0) {
            // APK gerado pelo PortBridge: o jogo está em assets/ (o SDL lê direto do APK)
            std::string name = opt.path.substr(6);
            SDL_RWops* rw = SDL_RWFromFile(name.c_str(), "rb");
            if (!rw) throw std::runtime_error("jogo não encontrado no APK: " + name + " (" + SDL_GetError() + ")");
            Sint64 size = SDL_RWsize(rw);
            std::vector<uint8_t> data(size > 0 ? size_t(size) : 0);
            size_t got = data.empty() ? 0 : SDL_RWread(rw, data.data(), 1, data.size());
            SDL_RWclose(rw);
            if (got != data.size()) throw std::runtime_error("falha ao ler " + name + " do APK");
            SDL_Log("jogo embutido: %s (%zu bytes)", name.c_str(), data.size());
            pkg = pb::open_package_data(std::move(data), name);
        } else {
            pkg = pb::open_package(opt.path);
        }
        game = pb::load_game(std::move(pkg.game_data));
        SDL_Log("jogo: %s %s (%s) %dx%d %d fps, %zu frames, %zu objetos, %zu avisos",
                pkg.display_name.c_str(), pkg.version.c_str(), pkg.bundle_id.c_str(), game->width,
                game->height, game->frame_rate, game->frames.size(), game->objects.size(),
                game->warnings.size());
        for (size_t i = 0; i < game->warnings.size() && i < 20; ++i) SDL_Log("aviso: %s", game->warnings[i].c_str());
    } catch (const std::exception& e) {
        pb::diag_fatal(std::string("Não foi possível abrir o jogo: ") + e.what());
        std::fprintf(stderr, "erro: %s\n", e.what());
        return 1;
    }
    int gw = game->width, gh = game->height;
    // Orientação pelo formato do jogo (o Zorbié é retrato 320x480).
    SDL_SetHint(SDL_HINT_ORIENTATIONS, gw <= gh ? "Portrait PortraitUpsideDown" : "LandscapeLeft LandscapeRight");
    std::string title = pkg.display_name.empty() ? "PortBridge" : pkg.display_name;

    Uint32 wflags = SDL_WINDOW_RESIZABLE | SDL_WINDOW_ALLOW_HIGHDPI;
#ifdef __ANDROID__
    wflags |= SDL_WINDOW_FULLSCREEN;
#endif
    if (opt.headless) wflags = SDL_WINDOW_HIDDEN;
    int scale = opt.headless ? 1 : opt.scale;
    SDL_Window* win = SDL_CreateWindow(title.c_str(), SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED,
                                       gw * scale, gh * scale, wflags);
    if (!win) {
        pb::diag_fatal(std::string("Falha ao criar a janela: ") + SDL_GetError());
        return 1;
    }
    Uint32 rflags = opt.headless ? SDL_RENDERER_SOFTWARE : (SDL_RENDERER_ACCELERATED | SDL_RENDERER_PRESENTVSYNC);
    SDL_Renderer* ren = SDL_CreateRenderer(win, -1, rflags);
    if (!ren) ren = SDL_CreateRenderer(win, -1, SDL_RENDERER_SOFTWARE);
    if (!ren) {
        pb::diag_fatal(std::string("Falha ao iniciar os gráficos: ") + SDL_GetError());
        return 1;
    }
    SDL_RenderSetLogicalSize(ren, gw, gh);
    {
        SDL_RendererInfo ri{};
        SDL_GetRendererInfo(ren, &ri);
        int ow = 0, oh = 0;
        SDL_GetRendererOutputSize(ren, &ow, &oh);
        SDL_Log("vídeo: %s, renderizador %s, saída %dx%d, lógico %dx%d", SDL_GetCurrentVideoDriver(),
                ri.name ? ri.name : "?", ow, oh, gw, gh);
    }

    std::string save = opt.save_dir;
    if (save.empty()) {
        std::string id = pkg.bundle_id.empty() ? title : pkg.bundle_id;
        if (char* p = SDL_GetPrefPath("PortBridge", id.c_str())) {
            save = p;
            SDL_free(p);
            if (!save.empty() && (save.back() == '/' || save.back() == '\\')) save.pop_back();
        } else {
            save = ".";
        }
    }

    pb::Audio audio(*game);
    audio.set_muted(opt.mute || opt.headless);
    pb::App app(std::move(game), ren, &audio, save);

    auto step = [&]() -> bool {
        try {
            app.step();
            return true;
        } catch (const std::exception& e) {
            pb::diag_fatal(std::string("Erro ao executar o jogo: ") + e.what());
            return false;
        }
    };
    const double tick_ms = 1000.0 / std::max(1, app.frame_rate);
    double acc = 0;
    Uint64 last = SDL_GetPerformanceCounter();
    int loops = 0;
    bool running = true;
    while (running && !app.finished()) {
        SDL_Event ev;
        while (SDL_PollEvent(&ev)) {
            switch (ev.type) {
                case SDL_QUIT: running = false; break;
                case SDL_MOUSEMOTION: app.input.mouse_x = ev.motion.x; app.input.mouse_y = ev.motion.y; break;
                case SDL_MOUSEBUTTONDOWN:
                case SDL_MOUSEBUTTONUP: {
                    int b = ev.button.button == SDL_BUTTON_RIGHT ? 2 : ev.button.button == SDL_BUTTON_MIDDLE ? 1 : 0;
                    app.input.mouse_x = ev.button.x;
                    app.input.mouse_y = ev.button.y;
                    bool down = ev.type == SDL_MOUSEBUTTONDOWN;
                    if (down) {
                        app.input.clicked[b] = true;
                        app.input.dbl[b] = ev.button.clicks >= 2;
                    }
                    app.input.down[b] = down;
                    break;
                }
                case SDL_KEYDOWN:
                    if (ev.key.keysym.sym == SDLK_AC_BACK || ev.key.keysym.sym == SDLK_ESCAPE) running = false;
                    break;
                case SDL_APP_WILLENTERBACKGROUND: audio.pause_all(true); break;
                case SDL_APP_DIDENTERFOREGROUND: audio.pause_all(false); app.resumed_flag = true; break;
                case SDL_RENDER_DEVICE_RESET:
                case SDL_RENDER_TARGETS_RESET:
                    SDL_Log("contexto gráfico recriado: recarregando texturas");
                    app.reset_textures();
                    break;
                default: break;
            }
        }
        if (opt.headless) {
            for (auto& [f, xy] : opt.clicks) {
                if (f == loops) {
                    app.input.mouse_x = xy.first;
                    app.input.mouse_y = xy.second;
                    app.input.clicked[0] = true;
                    app.input.down[0] = true;
                } else if (f + 3 == loops) {
                    app.input.down[0] = false;
                }
            }
            if (!step()) { running = false; break; }
            ++loops;
            for (int s : opt.shots) {
                if (s == loops) {
                    app.draw();
                    std::string name = opt.screenshot.empty() ? "shot.png" : opt.screenshot;
                    auto dot = name.rfind('.');
                    std::string path = name.substr(0, dot) + "_" + std::to_string(s) + name.substr(dot);
                    save_png(ren, gw, gh, path);
                }
            }
            for (int b = 0; b < 3; ++b) app.input.clicked[b] = app.input.dbl[b] = false;
            if (opt.frames && loops >= opt.frames) break;
            continue;
        }
        Uint64 now = SDL_GetPerformanceCounter();
        acc += double(now - last) * 1000.0 / double(SDL_GetPerformanceFrequency());
        last = now;
        if (acc > 250) acc = 250;
        int steps = 0;
        while (acc >= tick_ms && steps < 4) {
            if (!step()) { running = false; break; }
            for (int b = 0; b < 3; ++b) app.input.clicked[b] = app.input.dbl[b] = false;
            acc -= tick_ms;
            ++steps;
        }
        app.draw();
        SDL_RenderPresent(ren);
        if (opt.frames && ++loops >= opt.frames) break;
    }

    if (opt.headless) {
        app.draw();
        if (!opt.screenshot.empty() && !save_png(ren, gw, gh, opt.screenshot))
            std::fprintf(stderr, "falha ao salvar %s\n", opt.screenshot.c_str());
        pb::Frame* fr = app.frame();
        std::printf("loops %d  frame %d '%s'  objetos %zu  tempo %ums\n", loops, fr ? fr->index : -1,
                    fr ? fr->def.name.c_str() : "", fr ? fr->objects.size() : 0, fr ? fr->timer_ms : 0);
        std::printf("não implementados (%zu):\n", app.unimplemented.size());
        for (auto& [k, v] : app.unimplemented) std::printf("  %-40s %d\n", k.c_str(), v);
    }
    pb::diag_close();
    SDL_DestroyRenderer(ren);
    SDL_DestroyWindow(win);
    SDL_Quit();
    return 0;
}

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
#include "runtime/screen.hpp"
#include "runtime/tweaks.hpp"
#include "runtime/text.hpp"

namespace {

struct Options {
    std::string path, screenshot, save_dir, log, device;
    bool headless = false, mute = false, no_tweaks = false;
    int frames = 0, scale = 2;
    std::vector<std::pair<int, std::pair<int, int>>> clicks;  // (frame, (x, y))
    std::vector<std::pair<std::pair<int, int>, std::pair<int, int>>> holds;  // ((de, até), (x, y))
    std::vector<int> shots;                                    // frames extras para capturar
    std::vector<int> dumps;                                    // frames para listar o estado
    std::vector<int> resumes;                                  // simula a volta do segundo plano
    int screen_w = 0, screen_h = 0;                            // --screen: simula uma tela (pixels)
    int monkey = -1;                                           // a partir deste loop: toques aleatórios
    bool monkey_all = false;                                   // toques na tela inteira (menus, loja)
    unsigned seed = 12345u;
    int start_frame = -1;                                      // começa direto neste frame (testes)
    std::string audit;                                         // relatório de auditoria (arquivo)
    std::string text_test;                                     // desenha textos de exemplo neste PNG e sai
    int shot_every = 0;                                        // captura a cada N loops
};

bool parse_args(int argc, char** argv, Options& o) {
    for (int i = 1; i < argc; ++i) {
        std::string a = argv[i];
        auto next = [&]() -> std::string { return i + 1 < argc ? argv[++i] : ""; };
        if (a == "--headless") o.headless = true;
        else if (a == "--mute") o.mute = true;
        else if (a == "--no-tweaks") o.no_tweaks = true;  // jogo exatamente como o original
        else if (a == "--monkey-all") o.monkey_all = true;
        else if (a == "--seed") o.seed = unsigned(std::strtoul(next().c_str(), nullptr, 10));
        else if (a == "--start-frame") o.start_frame = std::atoi(next().c_str());
        else if (a == "--audit") o.audit = next();
        else if (a == "--text-test") o.text_test = next();
        else if (a == "--frames") o.frames = std::atoi(next().c_str());
        else if (a == "--scale") o.scale = std::max(1, std::atoi(next().c_str()));
        else if (a == "--screenshot") o.screenshot = next();
        else if (a == "--save-dir") o.save_dir = next();
        else if (a == "--log") o.log = next();
        else if (a == "--device") o.device = next();
        else if (a == "--shot-at") o.shots.push_back(std::atoi(next().c_str()));
        else if (a == "--dump-at") o.dumps.push_back(std::atoi(next().c_str()));
        else if (a == "--resume-at") o.resumes.push_back(std::atoi(next().c_str()));
        else if (a == "--monkey") o.monkey = std::atoi(next().c_str());
        else if (a == "--screen") std::sscanf(next().c_str(), "%dx%d", &o.screen_w, &o.screen_h);
        else if (a == "--hold") {
            int x = 0, y = 0, f = 0, g = 0;
            if (std::sscanf(next().c_str(), "%d,%d@%d-%d", &x, &y, &f, &g) == 4) o.holds.push_back({{f, g}, {x, y}});
        }
        else if (a == "--shot-every") o.shot_every = std::atoi(next().c_str());
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

// Estado do jogo num loop (modo de teste): globais e objetos visíveis.
void dump_state(pb::App& app, int loop) {
    pb::Frame* f = app.frame();
    if (!f) return;
    std::printf("=== loop %d  frame %d '%s'  scroll %.0f,%.0f  tamanho %dx%d  tempo %ums\n", loop, f->index,
                f->def.name.c_str(), f->scroll_x, f->scroll_y, f->width, f->height, f->timer_ms);
    std::printf("globais:");
    for (size_t i = 0; i < app.global_values.size() && i < 80; ++i) {
        const pb::Value& v = app.global_values[i];
        if (!v.is_num()) std::printf(" g%zu=\"%s\"", i, v.str().c_str());
        else if (v.num() != 0) std::printf(" g%zu=%g", i, v.num());
    }
    std::printf("\n");
    for (auto& o : f->objects) {
        if (o->destroyed && !o->dying) continue;
        std::printf("  %-22s oi=%-4d (%6.1f,%6.1f) camada %d %s anim %d dir %d fr %d img %d esc %.2f",
                    o->def ? o->def->name.c_str() : "?", o->oi, o->x, o->y, o->layer,
                    o->visible ? "vis" : "oculto", o->anim, o->dir, o->frame, o->image, o->scale_x);
        for (size_t i = 0; i < o->values.size() && i < 26; ++i)
            if (o->values[i].num() != 0) std::printf(" v%zu=%g", i, o->values[i].num());
        std::printf("\n");
    }
}

}  // namespace

int main(int argc, char** argv) {
    Options opt;
    if (!parse_args(argc, argv, opt)) {
        std::fprintf(stderr, "uso: portbridge-player <jogo.ipa | Application.cci> [--headless --frames N --screenshot out.png]\n");
        return 2;
    }
    if (opt.shot_every > 0) opt.shots.push_back(-1);
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
        if (!opt.no_tweaks)
            for (const std::string& t : pb::apply_game_tweaks(*game, pkg.bundle_id)) SDL_Log("ajuste: %s", t.c_str());
    } catch (const std::exception& e) {
        pb::diag_fatal(std::string("Não foi possível abrir o jogo: ") + e.what());
        std::fprintf(stderr, "erro: %s\n", e.what());
        return 1;
    }
    int gw = game->width, gh = game->height;
    // Orientação pelo formato do jogo (o Zorbié é retrato 320x480).
    SDL_SetHint(SDL_HINT_ORIENTATIONS, gw <= gh ? "Portrait PortraitUpsideDown" : "LandscapeLeft LandscapeRight");
    // Área visível: no desktop, o tamanho do jogo (ou a tela simulada com --screen);
    // no Android, recalculada abaixo pelo tamanho real da tela.
    int vw = gw, vh = gh;
    if (opt.screen_w > 0 && opt.screen_h > 0) pb::choose_view(*game, opt.screen_w, opt.screen_h, vw, vh);
    std::string title = pkg.display_name.empty() ? "PortBridge" : pkg.display_name;

    Uint32 wflags = SDL_WINDOW_RESIZABLE | SDL_WINDOW_ALLOW_HIGHDPI;
#ifdef __ANDROID__
    wflags |= SDL_WINDOW_FULLSCREEN;
#endif
    if (opt.headless) wflags = SDL_WINDOW_HIDDEN;
    int scale = opt.headless ? 1 : opt.scale;
    int win_w = vw * scale, win_h = vh * scale;
    if (opt.headless && opt.screen_w > 0 && opt.screen_h > 0) {
        // testes: a janela invisível tem o formato da tela simulada (reduzida),
        // para as capturas mostrarem a composição completa (faixas incluídas)
        int f = std::max(1, (opt.screen_h + 1199) / 1200);
        win_w = opt.screen_w / f;
        win_h = opt.screen_h / f;
    }
    SDL_Window* win = SDL_CreateWindow(title.c_str(), SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED,
                                       win_w, win_h, wflags);
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
#ifdef __ANDROID__
    {
        int ow = 0, oh = 0;
        SDL_GetRendererOutputSize(ren, &ow, &oh);
        pb::choose_view(*game, ow, oh, vw, vh);
    }
#endif
    pb::Screen screen(ren);
    if (!opt.text_test.empty()) {
        // Teste do texto: frases do Zorbié no estilo do objeto "String" (Arial 13 negrito, branco).
        screen.configure(vw, vh);
        screen.begin();
        SDL_SetRenderDrawColor(ren, 40, 60, 120, 255);
        SDL_RenderClear(ren);
        const pb::FontInfo* bold = nullptr;
        for (const auto& f : game->fonts) if (f.weight >= 600) bold = &f;
        const char* lines[] = {"Zorbiéééé!!!", "I've been in prizon 12 times.", "Gordolex is hiding something...",
                               "You're an arcade game löver.", "No, it's not the end, pleaze wait for futures updates. ;)"};
        std::vector<std::shared_ptr<void>> caches(5);
        for (int i = 0; i < 5; ++i) {
            pb::TextStyle st;
            st.font = bold;
            SDL_FRect box{20, 40.0f + 60.0f * i, 216, 32};
            SDL_SetRenderDrawColor(ren, 255, 255, 255, 60);
            SDL_SetRenderDrawBlendMode(ren, SDL_BLENDMODE_BLEND);
            SDL_RenderDrawRectF(ren, &box);
            pb::draw_text(ren, caches[size_t(i)], lines[i], st, box);
        }
        screen.end();
        int ow = 0, oh = 0;
        SDL_GetRendererOutputSize(ren, &ow, &oh);
        save_png(ren, ow, oh, opt.text_test);
        return 0;
    }
    screen.configure(vw, vh);
    {
        SDL_RendererInfo ri{};
        SDL_GetRendererInfo(ren, &ri);
        int ow = 0, oh = 0;
        SDL_GetRendererOutputSize(ren, &ow, &oh);
        SDL_Log("vídeo: %s, renderizador %s, saída %dx%d, jogo %dx%d, área visível %dx%d em %dx%d+%d+%d",
                SDL_GetCurrentVideoDriver(), ri.name ? ri.name : "?", ow, oh, gw, gh, vw, vh,
                screen.game_rect.w, screen.game_rect.h, screen.game_rect.x, screen.game_rect.y);
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
    app.view_w = vw;
    app.view_h = vh;
    app.audit.on = !opt.audit.empty();
    if (opt.start_frame >= 0) app.request_frame(opt.start_frame);

    auto render = [&]() {
        screen.begin();
        app.draw();
        screen.end();
    };
    auto output_size = [&](int& w, int& h) { SDL_GetRendererOutputSize(ren, &w, &h); };

    auto step = [&]() -> bool {
        try {
            app.step();
            return true;
        } catch (const std::exception& e) {
            pb::diag_fatal(std::string("Erro ao executar o jogo: ") + e.what());
            return false;
        }
    };
    // O jogo pode mudar a taxa (Zorbié: 40 ou 45 quadros/s na qualidade baixa).
    double tick_ms = 1000.0 / std::max(1, app.frame_rate);
    double acc = 0;
    Uint64 last = SDL_GetPerformanceCounter();
    int loops = 0;
    bool running = true;
    // Só redesenha quando o jogo avançou: numa tela de 120 Hz o vsync pediria
    // 120 quadros por segundo para um jogo de 60, o dobro de trabalho da GPU
    // (e de calor) para mostrar a mesma imagem duas vezes.
    bool redraw = true;
    // Toque curto entre dois passos do jogo: o "apertado" vale por pelo menos um passo.
    bool press_seen[3] = {true, true, true}, release_pending[3] = {false, false, false};
    // Folga no ritmo: com a tela a 60 Hz, cada v-sync chega ~16,7 ms depois do
    // anterior, praticamente igual ao passo do jogo. Exigir o passo inteiro fazia
    // um v-sync "adiantado" por décimos de ms ficar sem passo, e o quadro seguinte
    // esperava mais uma volta da tela (tremida, menos de 60 quadros/s).
    double slack = tick_ms * 0.25;
    Uint64 stat_t0 = last;
    int stat_frames = 0, stat_steps = 0;
    while (running && !app.finished()) {
        SDL_Event ev;
        while (SDL_PollEvent(&ev)) {
            switch (ev.type) {
                case SDL_QUIT: running = false; break;
                // toques/mouse em pixels da janela -> unidades do jogo (também nas faixas)
                case SDL_MOUSEMOTION:
                    screen.to_game(ev.motion.x, ev.motion.y, win, app.input.mouse_x, app.input.mouse_y);
                    break;
                case SDL_MOUSEBUTTONDOWN:
                case SDL_MOUSEBUTTONUP: {
                    int b = ev.button.button == SDL_BUTTON_RIGHT ? 2 : ev.button.button == SDL_BUTTON_MIDDLE ? 1 : 0;
                    screen.to_game(ev.button.x, ev.button.y, win, app.input.mouse_x, app.input.mouse_y);
                    bool down = ev.type == SDL_MOUSEBUTTONDOWN;
                    if (down) {
                        app.input.clicked[b] = true;
                        app.input.dbl[b] = ev.button.clicks >= 2;
                        app.input.down[b] = true;
                        press_seen[b] = false;
                        release_pending[b] = false;
                    } else if (!press_seen[b]) {
                        // toque rápido: soltou antes de o jogo ver o dedo apertado.
                        // Segura o "apertado" até o próximo passo, senão o toque se perde.
                        release_pending[b] = true;
                    } else {
                        app.input.down[b] = false;
                    }
                    break;
                }
                case SDL_KEYDOWN:
                    if (ev.key.keysym.sym == SDLK_AC_BACK || ev.key.keysym.sym == SDLK_ESCAPE) running = false;
                    break;
                case SDL_APP_WILLENTERBACKGROUND: audio.pause_all(true); pb::flush_ini_files(); break;
                case SDL_APP_DIDENTERFOREGROUND:
                    audio.pause_all(false);
                    app.interrupted_flag = true;
                    app.resume_pending = true;
                    break;
                case SDL_WINDOWEVENT:
                    if (ev.window.event == SDL_WINDOWEVENT_SIZE_CHANGED) {
                        int ow = 0, oh = 0;
                        output_size(ow, oh);
#ifdef __ANDROID__
                        // ex.: o aparelho estava deitado e girou para retrato
                        pb::choose_view(app.game(), ow, oh, app.view_w, app.view_h);
#endif
                        screen.configure(app.view_w, app.view_h);
                        SDL_Log("tela %dx%d: área visível %dx%d", ow, oh, app.view_w, app.view_h);
                    }
                    redraw = true;
                    break;
                case SDL_RENDER_DEVICE_RESET:
                case SDL_RENDER_TARGETS_RESET:
                    SDL_Log("contexto gráfico recriado: recarregando texturas");
                    app.reset_textures();
                    if (ev.type == SDL_RENDER_DEVICE_RESET) screen.release();
                    screen.configure(app.view_w, app.view_h);
                    redraw = true;
                    break;
                default: break;
            }
        }
        if (opt.headless) {
            // "Jogador automático" para testes longos: segura e arrasta na metade
            // de baixo da tela (zona de controle do Zorbié), com pausas.
            static uint32_t seed = opt.seed;
            static int hold = 0, rest = 0;
            static double tx = 160, ty = 400;
            auto rnd = [&](int n) { seed = seed * 1103515245u + 12345u; return int((seed >> 16) % uint32_t(n)); };
            if (opt.monkey >= 0 && loops >= opt.monkey) {
                if (hold > 0) {
                    app.input.mouse_x += int((tx - app.input.mouse_x) * 0.2);
                    app.input.mouse_y += int((ty - app.input.mouse_y) * 0.2);
                    if (--hold == 0) app.input.down[0] = false;
                } else if (rest > 0) {
                    --rest;
                } else {
                    int VW = app.view_w, VH = app.view_h;
                    app.input.mouse_x = rnd(VW);
                    app.input.mouse_y = opt.monkey_all ? rnd(VH) : VH / 2 + 40 + rnd(VH / 2 - 40);
                    tx = rnd(VW);
                    ty = opt.monkey_all ? rnd(VH) : VH / 2 + 40 + rnd(VH / 2 - 40);
                    app.input.clicked[0] = true;
                    app.input.down[0] = true;
                    hold = 5 + rnd(60);
                    rest = rnd(30);
                }
            }
            for (auto& [fg, xy] : opt.holds) {
                if (loops == fg.first) { app.input.clicked[0] = true; app.input.down[0] = true; }
                if (loops >= fg.first && loops <= fg.second) {
                    app.input.mouse_x = xy.first;
                    app.input.mouse_y = xy.second;
                }
                if (loops == fg.second + 1) app.input.down[0] = false;
            }
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
            for (int r : opt.resumes)
                if (r == loops) {
                    app.interrupted_flag = true;
                    app.resume_pending = true;
                }
            if (!step()) { running = false; break; }
            ++loops;
            for (int d : opt.dumps)
                if (d == loops) dump_state(app, loops);
            for (int s : opt.shots) {
                if (s == loops || (opt.shot_every > 0 && s == -1 && loops % opt.shot_every == 0)) {
                    render();
                    std::string name = opt.screenshot.empty() ? "shot.png" : opt.screenshot;
                    auto dot = name.rfind('.');
                    std::string path = name.substr(0, dot) + "_" + std::to_string(loops) + name.substr(dot);
                    int ow = 0, oh = 0;
                    output_size(ow, oh);
                    save_png(ren, ow, oh, path);
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
        tick_ms = 1000.0 / std::max(1, app.frame_rate);
        slack = tick_ms * 0.25;
        while (acc >= tick_ms - slack && steps < 4) {
            if (!step()) { running = false; break; }
            for (int b = 0; b < 3; ++b) {
                app.input.clicked[b] = app.input.dbl[b] = false;
                if (app.input.down[b]) press_seen[b] = true;
                if (release_pending[b]) {
                    app.input.down[b] = false;
                    release_pending[b] = false;
                }
            }
            acc -= tick_ms;
            ++steps;
        }
        if (steps == 0 && !redraw) {
            // nada novo para mostrar: dorme até perto do próximo passo do jogo
            double wait = tick_ms - slack - acc;
            SDL_Delay(wait > 2.0 ? Uint32(wait - 1.0) : 1);
            continue;
        }
        redraw = false;
        render();
        SDL_RenderPresent(ren);
        app.prefetch(3.0);  // depois de mostrar o quadro: usa a folga até o próximo
        stat_steps += steps;
        ++stat_frames;
        if (double(now - stat_t0) >= 30.0 * double(SDL_GetPerformanceFrequency())) {
            double secs = double(now - stat_t0) / double(SDL_GetPerformanceFrequency());
            SDL_Log("desempenho: %.1f quadros/s, %.1f passos do jogo/s", stat_frames / secs, stat_steps / secs);
            stat_t0 = now;
            stat_frames = stat_steps = 0;
        }
        if (opt.frames && ++loops >= opt.frames) break;
    }

    if (opt.headless) {
        render();
        int ow = 0, oh = 0;
        output_size(ow, oh);
        if (!opt.screenshot.empty() && !save_png(ren, ow, oh, opt.screenshot))
            std::fprintf(stderr, "falha ao salvar %s\n", opt.screenshot.c_str());
        pb::Frame* fr = app.frame();
        std::printf("loops %d  frame %d '%s'  objetos %zu  tempo %ums\n", loops, fr ? fr->index : -1,
                    fr ? fr->def.name.c_str() : "", fr ? fr->objects.size() : 0, fr ? fr->timer_ms : 0);
        std::printf("não implementados (%zu):\n", app.unimplemented.size());
        for (auto& [k, v] : app.unimplemented) std::printf("  %-40s %d\n", k.c_str(), v);
        if (app.audit.on) {
            if (FILE* af = std::fopen(opt.audit.c_str(), "w")) {
                auto& A = app.audit;
                std::fprintf(af, "decodificacoes %d, total %.1f ms, pior %.1f ms (imagem %d)\n", A.decodes,
                             A.decode_ms, A.worst_decode_ms, A.worst_decode);
                std::fprintf(af, "sons decodificados no passo do jogo %d, total %.1f ms, pior %.1f ms (som %d)\n",
                             audio.decodes, audio.decode_ms, audio.worst_decode_ms, audio.worst_decode);
                std::fprintf(af, "sons decodificados em segundo plano %d, total %.1f ms, pior %.1f ms (som %d)\n",
                             audio.bg_decodes, audio.bg_decode_ms, audio.bg_worst_ms, audio.bg_worst);
                for (auto& [fi, n] : A.loops)
                    std::fprintf(af, "frame %d: %llu passos, pico de %zu objetos\n", fi, (unsigned long long)n,
                                 A.max_objects[fi]);
                for (auto& s : A.slow) std::fprintf(af, "lento: %s\n", s.c_str());
                for (auto& [fi, v] : A.fired) {
                    std::fprintf(af, "disparos frame %d:", fi);
                    for (size_t g = 0; g < v.size(); ++g)
                        if (v[g]) std::fprintf(af, " %zu:%u", g, v[g]);
                    std::fprintf(af, "\n");
                }
                for (auto& [k, v] : app.unimplemented) std::fprintf(af, "nao implementado: %s %d\n", k.c_str(), v);
                if (pb::Frame* fr = app.frame()) {
                    std::map<std::string, int> count;
                    for (auto& o : fr->objects) count[o->def ? o->def->name : "?"]++;
                    std::vector<std::pair<int, std::string>> top;
                    for (auto& [n, k] : count) top.push_back({k, n});
                    std::sort(top.rbegin(), top.rend());
                    for (size_t i = 0; i < top.size() && i < 12; ++i)
                        std::fprintf(af, "objetos no fim: %s %d\n", top[i].second.c_str(), top[i].first);
                }
                std::fclose(af);
            }
        }
    }
    pb::flush_ini_files();
    pb::diag_close();
    screen.release();
    SDL_DestroyRenderer(ren);
    SDL_DestroyWindow(win);
    SDL_Quit();
    return 0;
}

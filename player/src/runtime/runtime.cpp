#include "runtime/runtime.hpp"
#include "runtime/diag.hpp"

#include <algorithm>
#include <cmath>

namespace pb {
namespace {

constexpr double kPi = 3.14159265358979323846;
int g_uid = 0;

uint32_t colorref_to_rgb(uint32_t c) {
    return ((c & 0xFF) << 16) | (c & 0xFF00) | ((c >> 16) & 0xFF);
}

const std::vector<Obj*> kEmpty;

}  // namespace

// ================================================================== App
App::App(std::unique_ptr<Game> game, SDL_Renderer* renderer, Audio* audio, std::string save)
    : save_dir(std::move(save)), game_(std::move(game)), renderer_(renderer), audio_(audio) {
    for (int32_t v : game_->global_values) global_values.emplace_back(int64_t(v));
    global_strings = game_->global_strings;
    score = game_->initial_score;
    lives = game_->initial_lives;
    frame_rate = game_->frame_rate;
    view_w = game_->width;
    view_h = game_->height;
}

void choose_view(const Game& g, int screen_w, int screen_h, int& view_w, int& view_h) {
    view_w = g.width;
    view_h = g.height;
    if (screen_w <= 0 || screen_h <= 0 || g.width <= 0 || g.height <= 0) return;
    int max_w = g.width, max_h = g.height;
    for (const FrameDef& f : g.frames) {
        max_w = std::max(max_w, int(f.width));
        max_h = std::max(max_h, int(f.height));
    }
    double screen = double(screen_h) / screen_w, game = double(g.height) / g.width;
    if (screen > game) {   // tela mais alta que o jogo: mostra mais em cima/embaixo
        view_h = std::clamp(int(std::lround(g.width * screen)), g.height, max_h);
    } else {               // tela mais larga: mostra mais dos lados
        view_w = std::clamp(int(std::lround(g.height / screen)), g.width, max_w);
    }
}

App::~App() {
    frame_.reset();
    for (auto& [h, t] : textures_)
        if (t) SDL_DestroyTexture(t);
}

void App::queue_prefetch(const FrameDef& fd) {
    prefetch_.clear();
    std::unordered_set<int> seen;
    for (const Instance& in : fd.instances) {
        const ObjectDef* od = game_->object(in.oi);
        if (!od) continue;
        for (const Animation& a : od->anims)
            for (const AnimDir& d : a.dirs)
                for (uint16_t h : d.frames)
                    if (seen.insert(h).second && !textures_.count(h)) prefetch_.push_back(h);
        for (uint16_t h : od->counter_frames)
            if (h != 0xFFFF && seen.insert(h).second && !textures_.count(h)) prefetch_.push_back(h);
    }
    std::reverse(prefetch_.begin(), prefetch_.end());  // consumida do fim
}

void App::prefetch(double budget_ms) {
    if (prefetch_.empty() || !renderer_) return;
    Uint64 t0 = SDL_GetPerformanceCounter();
    const double freq = double(SDL_GetPerformanceFrequency());
    while (!prefetch_.empty()) {
        int h = prefetch_.back();
        prefetch_.pop_back();
        if (!textures_.count(h)) texture(h);
        if (double(SDL_GetPerformanceCounter() - t0) * 1000.0 / freq >= budget_ms) break;
    }
}

void App::reset_textures() {
    for (auto& [h, t] : textures_)
        if (t) SDL_DestroyTexture(t);
    textures_.clear();
    if (frame_) queue_prefetch(frame_->def);  // contexto gráfico recriado: recarrega aos poucos
}

const ImageInfo* App::image(int handle) const {
    auto it = game_->images.find(handle);
    return it == game_->images.end() ? nullptr : &it->second;
}

SDL_Texture* App::texture(int handle) {
    auto it = textures_.find(handle);
    if (it != textures_.end()) return it->second;
    SDL_Texture* tex = nullptr;
    if (const ImageInfo* im = image(handle); im && renderer_) {
        std::vector<uint8_t> rgba;
        Uint64 t0 = SDL_GetPerformanceCounter();
        bool ok = game_->decode_image(*im, rgba);
        if (audit.on) {
            double ms = double(SDL_GetPerformanceCounter() - t0) * 1000.0 / double(SDL_GetPerformanceFrequency());
            audit.decode_ms += ms;
            ++audit.decodes;
            if (ms > audit.worst_decode_ms) { audit.worst_decode_ms = ms; audit.worst_decode = handle; }
        }
        if (ok && im->width && im->height) {
            tex = SDL_CreateTexture(renderer_, SDL_PIXELFORMAT_RGBA32, SDL_TEXTUREACCESS_STATIC,
                                    im->width, im->height);
            if (tex) {
                SDL_UpdateTexture(tex, nullptr, rgba.data(), im->width * 4);
                SDL_SetTextureBlendMode(tex, SDL_BLENDMODE_BLEND);
            }
        }
    }
    textures_[handle] = tex;
    return tex;
}

const std::vector<uint8_t>* App::mask(int handle) {
    auto it = masks_.find(handle);
    if (it != masks_.end()) return &it->second;
    std::vector<uint8_t> m;
    if (const ImageInfo* im = image(handle)) {
        std::vector<uint8_t> rgba;
        if (game_->decode_image(*im, rgba)) {
            m.resize(size_t(im->width) * im->height);
            for (size_t i = 0; i < m.size(); ++i) m[i] = rgba[i * 4 + 3] > 0;
        }
    }
    return &(masks_[handle] = std::move(m));
}

void App::step() {
    if (!frame_ || next_frame_ >= 0) {
        int idx = next_frame_ >= 0 ? next_frame_ : 0;
        next_frame_ = -1;
        if (idx < 0 || idx >= int(game_->frames.size())) {
            quit_ = true;
            return;
        }
        frame_.reset();
        g_diag.stage = "iniciando frame";
        g_diag.frame = idx;
        frame_ = std::make_unique<Frame>(*this, idx);
        frame_->start();
        queue_prefetch(game_->frames[size_t(idx)]);
        SDL_Log("PortBridge: frame %d '%s'", idx, game_->frames[size_t(idx)].name.c_str());
    }
    if (paused) {
        // "Pausar aplicação" espera um toque. O passo que sai da pausa vê
        // "Aplicação retomada" (o Zorbié tira ali o painel de pausa e trata o
        // botão de voltar ao título); o toque que tira da pausa não vale como
        // clique no jogo.
        interrupted_flag = false;
        if (!input.clicked[0]) return;
        paused = false;
        resumed_flag = true;
        resume_pending = false;
        input.clicked[0] = false;
        input.dbl[0] = false;
    } else if (resume_pending && !interrupted_flag) {
        // Volta do segundo plano: no 1º passo o jogo vê só "interrompido" (o
        // Zorbié abre a pausa); "retomado" vem no passo seguinte ou, se o jogo
        // pausou, depois do toque. Juntos, o Zorbié abria e fechava o painel
        // de pausa no mesmo passo.
        resumed_flag = true;
        resume_pending = false;
    }
    if (audit.on) {
        Uint64 t0 = SDL_GetPerformanceCounter();
        frame_->step();
        double ms = double(SDL_GetPerformanceCounter() - t0) * 1000.0 / double(SDL_GetPerformanceFrequency());
        if (frame_) {
            ++audit.loops[frame_->index];
            size_t& mo = audit.max_objects[frame_->index];
            mo = std::max(mo, frame_->objects.size());
            if (ms > 8.0 && audit.slow.size() < 200) {
                char buf[128];
                std::snprintf(buf, sizeof buf, "frame %d passo %lld: %.1f ms (%zu objetos)", frame_->index,
                              (long long)frame_->loop, ms, frame_->objects.size());
                audit.slow.push_back(buf);
            }
        }
    } else {
        frame_->step();
    }
    resumed_flag = false;
    interrupted_flag = false;
    flush_ini_files();
}

void App::draw() {
    if (frame_) frame_->draw(renderer_);
}

// ================================================================== Frame
Frame::Frame(App& a, int idx)
    : app(a), index(idx), def(a.game().frames[size_t(idx)]), width(def.width), height(def.height),
      background(colorref_to_rgb(def.background)) {}

void Frame::build_group_tree() {
    const auto& gs = def.events.groups;
    groups.assign(gs.size(), GroupInfo{});
    event_state.assign(gs.size(), EventState{});
    std::vector<int> stack;
    for (int i = 0; i < int(gs.size()); ++i) {
        if (gs[size_t(i)].conditions.empty()) continue;
        const EventItem& c0 = gs[size_t(i)].conditions[0];
        if (c0.type != OBJ_SYSTEM) continue;
        if (c0.num == -10) {
            GroupInfo& g = groups[size_t(i)];
            if (!c0.params.empty()) {
                g.id = c0.params[0].i1;
                g.active = !(c0.params[0].i0 & 1);  // "inativo no início"
            }
            g.parent = stack.empty() ? -1 : stack.back();
            g.end = int(gs.size()) - 1;
            group_by_id.emplace(g.id, i);
            group_by_offset.emplace(gs[size_t(i)].offset, i);
            stack.push_back(i);
        } else if (c0.num == -11 && !stack.empty()) {
            groups[size_t(stack.back())].end = i;
            stack.pop_back();
        }
    }
}

// Frame menor que a área visível fica centralizado (rolagem negativa).
static double clamp_scroll(double want, int frame, int view) {
    if (frame <= view) return (frame - view) / 2.0;
    return std::clamp(want, 0.0, double(frame - view));
}

void Frame::start() {
    build_group_tree();
    scroll_x = clamp_scroll(0, width, app.view_w);
    scroll_y = clamp_scroll(0, height, app.view_h);
    for (auto& [h, o] : app.game().objects) {
        for (int16_t q : o.qualifiers)
            if (q >= 0) qualifier_members[q].push_back(h);
    }
    for (const Instance& in : def.instances) {
        // tipo_pai != 0: modelo guardado pelo editor para "Criar objeto", não nasce no início.
        if (in.parent_type != 0) continue;
        const ObjectDef* od = app.game().object(in.oi);
        if (!od || !od->create_at_start()) continue;
        create(in.oi, in.x, in.y, in.layer);
    }
}

const std::vector<Obj*>& Frame::instances(int oi) {
    auto it = by_oi.find(oi);
    return it == by_oi.end() ? kEmpty : it->second;
}

std::vector<int> Frame::expand_oi(int oi) {
    if (oi & 0x8000) {
        auto it = qualifier_members.find(oi & 0x7FFF);
        return it == qualifier_members.end() ? std::vector<int>{} : it->second;
    }
    return {oi};
}

int dir_from_mask(App& app, uint32_t mask) {
    if (!mask) return 0;
    int bits[32], n = 0;
    for (int i = 0; i < 32; ++i)
        if (mask >> i & 1) bits[n++] = i;
    return n == 1 ? bits[0] : bits[app.rng()() % uint32_t(n)];
}

Obj* Frame::create(int oi, double x, double y, int layer) {
    const ObjectDef* od = app.game().object(oi);
    if (!od) return nullptr;
    auto o = std::make_unique<Obj>();
    o->uid = ++g_uid;
    o->oi = oi;
    o->def = od;
    o->type = od->type;
    o->x = x;
    o->y = y;
    o->layer = std::clamp(layer, 0, std::max(0, int(def.layers.size()) - 1));
    o->visible = od->is_extension() ? false : od->visible_at_start();
    o->values.assign(26, Value(0));
    for (size_t i = 0; i < od->values.size() && i < 26; ++i) o->values[i] = Value(int64_t(od->values[i]));
    o->strings.assign(10, std::string());
    for (size_t i = 0; i < od->strings.size() && i < 10; ++i) o->strings[i] = od->strings[i];
    if ((od->ink_effect & 0xFFFF) == 1) o->alpha = std::clamp(int(od->ink_param) * 2, 0, 255);
    o->counter = od->counter_init;
    o->counter_min = od->counter_min;
    o->counter_max = od->counter_max;
    o->bar_color1 = colorref_to_rgb(od->counter_color1);
    o->bar_color2 = colorref_to_rgb(od->fill_is_gradient() ? od->counter_color2 : od->counter_color1);
    if (!od->paragraphs.empty()) {
        o->text = od->paragraphs[0].text;
        o->text_color = colorref_to_rgb(od->paragraphs[0].color);
    }
    if (!od->movements.empty()) o->dir = dir_from_mask(app, od->movements[0].dirs_at_start);
    Obj* raw = o.get();
    for (const MovementDef& md : od->movements) o->movements.push_back(make_movement(raw, md));
    if (!od->movements.empty() && od->movements[0].move_at_start) o->movements[0]->start();
    o->appearing = od->anims.size() > ANIM_APPEARING && od->anims[ANIM_APPEARING].present;
    o->z = next_z++;
    o->prev_x = x;
    o->prev_y = y;
    set_obj_image(app, *o);
    by_oi[oi].push_back(raw);
    objects.push_back(std::move(o));
    return raw;
}

void Frame::destroy(Obj* o) {
    if (o->destroyed) return;
    o->destroyed = true;
    auto& v = by_oi[o->oi];
    v.erase(std::remove(v.begin(), v.end(), o), v.end());
    const ObjectDef* od = o->def;
    if (o->type == OBJ_ACTIVE && o->visible && od && od->anims.size() > ANIM_DISAPPEARING &&
        od->anims[ANIM_DISAPPEARING].present) {
        o->dying = true;
        o->movements.clear();
    }
}

void Frame::layer_offset(int layer, double& ox, double& oy) const {
    ox = scroll_x;
    oy = scroll_y;
    if (layer < 0 || size_t(layer) >= def.layers.size()) return;
    const Layer& L = def.layers[size_t(layer)];
    double bx = base_set ? base_x : scroll_x, by = base_set ? base_y : scroll_y;
    ox = bx + (scroll_x - bx) * L.x_coef;
    oy = by + (scroll_y - by) * L.y_coef;
}

void Frame::center_display_x(double x) {
    scroll_x = clamp_scroll(x - app.view_w / 2.0, width, app.view_w);
}

void Frame::center_display_y(double y) {
    scroll_y = clamp_scroll(y - app.view_h / 2.0, height, app.view_h);
}

void Frame::update_objects() {
    int dt = 1000 / std::max(1, app.frame_rate);
    for (size_t i = 0; i < objects.size(); ++i) {
        Obj* o = objects[i].get();
        if (o->destroyed && !o->dying) continue;
        o->prev_x = o->x;
        o->prev_y = o->y;
        if (Movement* m = o->mv()) m->update();
        if (o->flash_period > 0) {
            o->flash_timer += dt;
            if (o->flash_timer >= o->flash_period) {
                o->flash_timer -= o->flash_period;
                o->visible = !o->visible;
            }
        }
        update_animation(app, *o);
    }
}

void Frame::cleanup() {
    objects.erase(std::remove_if(objects.begin(), objects.end(),
                                 [](const std::unique_ptr<Obj>& o) { return o->destroyed && !o->dying; }),
                  objects.end());
}

void Frame::step() {
    timer_acc += 1000.0 / std::max(1, app.frame_rate);
    timer_ms = uint32_t(timer_acc);
    ++loop;
    g_diag.loop = long(loop);
    g_diag.stage = "movimentos e animações";
    update_objects();
    g_diag.stage = "eventos";
    run_events(*this);
    if (!base_set) {
        base_x = scroll_x;
        base_y = scroll_y;
        base_set = true;
    }
    g_diag.stage = "limpeza";
    cleanup();
    g_diag.stage = "desenho";
}

// ================================================================== animação
static const AnimDir* pick_dir(const Animation& a, int want) {
    for (int k = 0; k <= 16; ++k) {
        const AnimDir& d1 = a.dirs[size_t((want + k) & 31)];
        if (d1.present && !d1.frames.empty()) return &d1;
        const AnimDir& d2 = a.dirs[size_t((want - k) & 31)];
        if (d2.present && !d2.frames.empty()) return &d2;
    }
    return nullptr;
}

static int pick_anim(const ObjectDef& od, int want) {
    auto has = [&](int i) { return i >= 0 && i < int(od.anims.size()) && od.anims[size_t(i)].present; };
    if (has(want)) return want;
    // equivalências do Clickteam: correndo -> andando -> parado
    if (want == ANIM_RUNNING && has(ANIM_WALKING)) return ANIM_WALKING;
    if (has(ANIM_STOPPED)) return ANIM_STOPPED;
    for (int i = 0; i < int(od.anims.size()); ++i)
        if (has(i)) return i;
    return -1;
}

void set_obj_image(App& app, Obj& o) {
    (void)app;
    if (o.type != OBJ_ACTIVE || !o.def) return;
    int a = pick_anim(*o.def, o.anim);
    if (a < 0) return;
    const AnimDir* d = pick_dir(o.def->anims[size_t(a)], o.forced_dir >= 0 ? o.forced_dir : o.dir);
    if (!d) return;
    int f = std::clamp(o.forced_frame >= 0 ? o.forced_frame : o.frame, 0, int(d->frames.size()) - 1);
    o.image = d->frames[size_t(f)];
}

void update_animation(App& app, Obj& o) {
    o.anim_finished = -1;
    if (o.type != OBJ_ACTIVE || !o.def || o.def->anims.empty()) return;
    const ObjectDef& od = *o.def;
    int want;
    if (o.dying) want = ANIM_DISAPPEARING;
    else if (o.forced_anim >= 0) want = o.forced_anim;
    else if (o.appearing) want = ANIM_APPEARING;
    else if (o.mv() && o.speed() > 0) want = ANIM_WALKING;
    else want = ANIM_STOPPED;
    int a = pick_anim(od, want);
    if (a < 0) return;
    if (a != o.anim) {
        o.anim = a;
        o.frame = 0;
        o.anim_counter = 0;
        o.anim_loops = 0;
        o.anim_done = false;
    }
    const AnimDir* d = pick_dir(od.anims[size_t(a)], o.forced_dir >= 0 ? o.forced_dir : o.dir);
    if (!d) return;
    int n = int(d->frames.size());
    if (o.forced_frame >= 0) {
        o.frame = std::min(o.forced_frame, n - 1);
    } else if (!o.anim_stopped && !o.anim_done) {
        int sp = d->max_speed;
        if (o.forced_speed >= 0) sp = o.forced_speed;
        else if (a == ANIM_WALKING || a == ANIM_RUNNING) {
            int mvs = std::clamp(o.speed(), 0, 100);
            sp = d->min_speed + (d->max_speed - d->min_speed) * mvs / 100;
        }
        o.anim_counter += sp;
        while (o.anim_counter >= 100) {
            o.anim_counter -= 100;
            if (++o.frame >= n) {
                if (d->repeat == 0) {
                    o.frame = d->back_to < n ? d->back_to : 0;
                } else if (++o.anim_loops >= d->repeat) {
                    o.frame = n - 1;
                    o.anim_done = true;
                    o.anim_finished = a;
                    break;
                } else {
                    o.frame = d->back_to < n ? d->back_to : 0;
                }
            }
        }
    }
    if (o.frame >= n) o.frame = n - 1;
    o.image = d->frames[size_t(o.frame)];
    if (o.anim_finished == ANIM_APPEARING) o.appearing = false;
    if (o.dying && o.anim_finished == ANIM_DISAPPEARING) o.dying = false;  // removido no cleanup
    (void)app;
}

// ================================================================== geometria
Rect obj_rect(App& app, const Obj& o) {
    if (o.type == OBJ_ACTIVE && o.image >= 0) {
        if (const ImageInfo* im = app.image(o.image)) {
            double sx = std::fabs(o.scale_x), sy = std::fabs(o.scale_y);
            double x1 = -im->hot_x * sx, y1 = -im->hot_y * sy;
            double x2 = x1 + im->width * sx, y2 = y1 + im->height * sy;
            if (o.angle != 0) {
                double a = -o.angle * kPi / 180.0, ca = std::cos(a), sa = std::sin(a);
                double xs[4] = {x1, x2, x2, x1}, ys[4] = {y1, y1, y2, y2};
                double mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
                for (int i = 0; i < 4; ++i) {
                    double rx = xs[i] * ca - ys[i] * sa, ry = xs[i] * sa + ys[i] * ca;
                    mnx = std::min(mnx, rx); mxx = std::max(mxx, rx);
                    mny = std::min(mny, ry); mxy = std::max(mxy, ry);
                }
                return {o.x + mnx, o.y + mny, o.x + mxx, o.y + mxy};
            }
            return {o.x + x1, o.y + y1, o.x + x2, o.y + y2};
        }
    }
    if ((o.type == OBJ_COUNTER || o.type == OBJ_SCORE || o.type == OBJ_LIVES) && o.def) {
        double w = o.def->counter_w, h = o.def->counter_h;
        // números/animação: ponto quente no canto inferior direito; barra e texto:
        // no canto superior esquerdo (a barra de super do Zorbié fica dentro da
        // moldura só assim).
        if (o.def->counter_display == 2 || o.def->counter_display == 3 || o.def->counter_display == 5)
            return {o.x, o.y, o.x + w, o.y + h};
        return {o.x - w, o.y - h, o.x, o.y};
    }
    if (o.type == OBJ_TEXT && o.def) return {o.x, o.y, o.x + o.def->text_w, o.y + o.def->text_h};
    return {o.x, o.y, o.x + 1, o.y + 1};
}

bool overlap(App& app, const Obj& a, const Obj& b) {
    Rect ra = obj_rect(app, a), rb = obj_rect(app, b);
    double x1 = std::max(ra.x1, rb.x1), y1 = std::max(ra.y1, rb.y1);
    double x2 = std::min(ra.x2, rb.x2), y2 = std::min(ra.y2, rb.y2);
    if (x1 >= x2 || y1 >= y2) return false;
    // Teste por pixel quando os dois estão sem rotação/escala.
    bool simple = a.type == OBJ_ACTIVE && b.type == OBJ_ACTIVE && a.angle == 0 && b.angle == 0 &&
                  a.scale_x == 1 && a.scale_y == 1 && b.scale_x == 1 && b.scale_y == 1 &&
                  a.image >= 0 && b.image >= 0;
    if (!simple) return true;
    const ImageInfo* ia = app.image(a.image);
    const ImageInfo* ib = app.image(b.image);
    const auto* ma = app.mask(a.image);
    const auto* mb = app.mask(b.image);
    if (!ia || !ib || ma->empty() || mb->empty()) return true;
    for (int y = int(std::floor(y1)); y < int(std::ceil(y2)); ++y) {
        int ay = y - int(std::floor(ra.y1)), by = y - int(std::floor(rb.y1));
        if (ay < 0 || by < 0 || ay >= ia->height || by >= ib->height) continue;
        for (int x = int(std::floor(x1)); x < int(std::ceil(x2)); ++x) {
            int ax = x - int(std::floor(ra.x1)), bx = x - int(std::floor(rb.x1));
            if (ax < 0 || bx < 0 || ax >= ia->width || bx >= ib->width) continue;
            if ((*ma)[size_t(ay) * ia->width + size_t(ax)] && (*mb)[size_t(by) * ib->width + size_t(bx)])
                return true;
        }
    }
    return false;
}

}  // namespace pb

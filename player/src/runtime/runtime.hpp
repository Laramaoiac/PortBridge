// Runtime que interpreta jogos Clickteam diretamente a partir dos dados (.cci/.ccn).
// Roda igual em Android, Linux, Windows e macOS: toda a parte de plataforma fica no SDL.
#pragma once
#include <SDL.h>

#include <functional>
#include <map>
#include <memory>
#include <random>
#include <set>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

#include "core/game.hpp"
#include "runtime/value.hpp"

namespace pb {

class App;
struct Obj;
class Audio;

// ---------------------------------------------------------------- movimentos
struct Movement {
    explicit Movement(Obj* o) : obj(o) {}
    virtual ~Movement() = default;
    virtual void update() {}
    virtual void start() { stopped = false; }
    virtual void stop() { stopped = true; }
    virtual void bounce() {}
    virtual void set_speed(int s) { speed = s; }
    virtual int get_speed() const { return stopped ? 0 : speed; }
    virtual void set_direction(int dir);
    virtual bool finished() const { return false; }
    virtual void set_deceleration(int) {}
    Obj* obj;
    int speed = 0;
    bool stopped = false;
};

std::unique_ptr<Movement> make_movement(Obj* o, const MovementDef& def);

// ---------------------------------------------------------------- objetos
enum AnimId { ANIM_STOPPED = 0, ANIM_WALKING = 1, ANIM_RUNNING = 2, ANIM_APPEARING = 3,
              ANIM_DISAPPEARING = 4 };

struct Obj {
    int uid = 0;
    int oi = 0;
    const ObjectDef* def = nullptr;
    int type = 0;
    double x = 0, y = 0;
    int layer = 0;
    bool visible = true;
    bool destroyed = false;   // remover no fim do loop
    bool dying = false;       // tocando a animação "Disappearing"
    int z = 0;                // ordem de desenho dentro da camada

    // animação
    int anim = 0, dir = 0, frame = 0;
    int anim_counter = 0, anim_loops = 0;
    bool anim_stopped = false;
    bool anim_done = false;    // animação sem repetição chegou ao fim
    bool appearing = false;    // tocando "Appearing" logo após a criação
    int anim_finished = -1;    // animação que terminou neste loop
    int forced_anim = -1, forced_frame = -1, forced_speed = -1, forced_dir = -1;
    int image = -1;

    // aparência
    float scale_x = 1, scale_y = 1, angle = 0;
    int alpha = 0;              // coeficiente alfa Clickteam: 0 = opaco, 255 = invisível
    uint32_t rgb = 0xFFFFFF;    // coeficiente RGB (0xRRGGBB)
    int flash_period = 0, flash_timer = 0;

    // dados
    std::vector<Value> values;
    std::vector<std::string> strings;
    uint32_t flags = 0;

    // movimento
    std::vector<std::unique_ptr<Movement>> movements;
    int mv_index = 0;
    Movement* mv() const { return movements.empty() ? nullptr : movements[size_t(mv_index)].get(); }
    double prev_x = 0, prev_y = 0;

    // contador
    double counter = 0, counter_min = 0, counter_max = 0;
    // texto
    std::string text;
    uint32_t text_color = 0;

    // estado por extensão (INI etc.)
    std::shared_ptr<void> ext;

    int speed() const { return mv() ? mv()->get_speed() : 0; }
    bool is_active() const { return type == OBJ_ACTIVE; }
};

// ---------------------------------------------------------------- frame
struct GroupInfo {
    int id = -1;
    int end = -1;          // índice do GroupEnd correspondente
    int parent = -1;       // índice do NewGroup pai
    bool active = true;
    bool just_activated = false;
};

struct EventState {
    int64_t not_always_stamp = -10;
    int64_t once_stamp = -10;
    bool once_done = false;
    int repeat_count = 0;
    uint32_t every_last = 0;
    bool timer_equals_done = false;
    uint32_t restrict_last = 0;
};

class Frame {
public:
    Frame(App& app, int index);
    void start();
    void step();                    // um loop de jogo
    void draw(SDL_Renderer* r);

    App& app;
    int index;
    const FrameDef& def;
    int width, height;
    uint32_t background;            // 0xRRGGBB
    double scroll_x = 0, scroll_y = 0;
    uint32_t timer_ms = 0;          // tempo desde o início do frame
    double timer_acc = 0;
    int64_t loop = 0;

    std::vector<std::unique_ptr<Obj>> objects;
    std::unordered_map<int, std::vector<Obj*>> by_oi;
    std::vector<GroupInfo> groups;          // por índice de grupo de evento (só marcadores)
    std::multimap<int, int> group_by_id;    // id -> índice do NewGroup
    std::vector<EventState> event_state;
    std::map<int, std::vector<int>> qualifier_members;  // qualificador -> lista de oi

    Obj* create(int oi, double x, double y, int layer);
    void destroy(Obj* o);
    const std::vector<Obj*>& instances(int oi);
    std::vector<int> expand_oi(int oi_or_qualifier);
    void center_display_x(double x);
    void center_display_y(double y);
    int next_z = 0;

private:
    void build_group_tree();
    void update_objects();
    void cleanup();
};

// ---------------------------------------------------------------- app
struct InputState {
    int mouse_x = 0, mouse_y = 0;   // coordenadas lógicas da janela
    bool down[3] = {false, false, false};
    bool clicked[3] = {false, false, false};    // clique neste loop
    bool dbl[3] = {false, false, false};
    bool back_pressed = false;
};

class App {
public:
    App(std::unique_ptr<Game> game, SDL_Renderer* renderer, Audio* audio, std::string save_dir);
    ~App();
    void step();
    void draw();
    bool finished() const { return quit_; }

    Game& game() { return *game_; }
    const Game& game() const { return *game_; }
    Frame* frame() { return frame_.get(); }
    SDL_Renderer* renderer() { return renderer_; }
    Audio* audio() { return audio_; }
    SDL_Texture* texture(int image_handle);
    const ImageInfo* image(int handle) const;
    const std::vector<uint8_t>* mask(int image_handle);  // alfa > 0, 1 byte por pixel

    void request_frame(int index) { next_frame_ = index; }
    void quit() { quit_ = true; }
    std::mt19937& rng() { return rng_; }

    std::vector<Value> global_values;
    std::vector<std::string> global_strings;
    int score = 0, lives = 3;
    InputState input;
    std::string save_dir;
    bool paused = false;
    bool resumed_flag = false;
    int frame_rate = 60;
    std::map<std::string, int> unimplemented;   // "Active.Foo" -> vezes (para relatório)
    void note_unimplemented(const std::string& what) { ++unimplemented[what]; }

private:
    std::unique_ptr<Game> game_;
    SDL_Renderer* renderer_;
    Audio* audio_;
    std::unique_ptr<Frame> frame_;
    int next_frame_ = -1;
    bool quit_ = false;
    std::unordered_map<int, SDL_Texture*> textures_;
    std::unordered_map<int, std::vector<uint8_t>> masks_;
    std::mt19937 rng_{1234567u};
};

// ---------------------------------------------------------------- eventos
void run_events(Frame& f);

// Seleção de instâncias durante a avaliação de um grupo de eventos.
struct Selection {
    std::unordered_map<int, std::vector<Obj*>> sel;  // por oi real
    std::unordered_set<int> touched;
};

struct EvalContext {
    Frame& f;
    Selection& s;
    Obj* current = nullptr;   // instância em foco (ação/condição por instância)
    int current_oi = -1;
};

Value eval_expr(EvalContext& c, const std::vector<Expr>& ex);
std::vector<Obj*> targets(EvalContext& c, int oi);           // seleção ou todas
Obj* first_target(EvalContext& c, int oi);

// Extensões (INI, AdvDir, stubs do iOS).
bool ext_condition(EvalContext& c, const EventItem& it, Obj* o, bool& handled);
void ext_action(EvalContext& c, const EventItem& it, Obj* o);
Value ext_expression(EvalContext& c, const Expr& e, const std::vector<Value>& args, bool& handled);
int ext_expression_arity(const Game& g, const Expr& e);

// Geometria / colisão
struct Rect { double x1, y1, x2, y2; };
Rect obj_rect(App& app, const Obj& o);
bool overlap(App& app, const Obj& a, const Obj& b);
void update_animation(App& app, Obj& o);
void set_obj_image(App& app, Obj& o);
int dir_from_mask(App& app, uint32_t mask);

}  // namespace pb

// Movimentos: estático, bola, trajetória, bala (tiro) e as extensões
// clickteam-vector, pinball e clickteam-simple_ellipse.
// Velocidades seguem a escala Clickteam: movimentos nativos andam speed/8 px por loop.
#include <cmath>

#include "runtime/runtime.hpp"

namespace pb {
namespace {

constexpr double kPi = 3.14159265358979323846;
inline double dir_rad(int d) { return d * kPi / 16.0; }
inline int angle_to_dir(double deg) {
    double a = std::fmod(deg, 360.0);
    if (a < 0) a += 360;
    return int(std::lround(a / 11.25)) & 31;
}

struct Static : Movement {
    using Movement::Movement;
};

struct Ball : Movement {
    int randomizer = 0, decel = 0;
    double dec_acc = 0;
    Ball(Obj* o, const MovementDef& d) : Movement(o) {
        speed = d.v.size() > 0 ? d.v[0] : 0;
        randomizer = d.v.size() > 1 ? d.v[1] : 0;
        decel = d.v.size() > 4 ? d.v[4] : 0;
    }
    void update() override {
        if (stopped || speed <= 0) return;
        double m = speed / 8.0;
        obj->x += std::cos(dir_rad(obj->dir)) * m;
        obj->y -= std::sin(dir_rad(obj->dir)) * m;
        if (decel > 0) {
            dec_acc += decel / 100.0;
            while (dec_acc >= 1 && speed > 0) { --speed; dec_acc -= 1; }
        }
    }
    void bounce() override {
        int d = (obj->dir + 16) & 31;
        if (randomizer > 0) d = (d + int(obj->uid * 7 % 5) - 2) & 31;
        obj->dir = d;
    }
};

struct Bullet : Movement {
    double angle;
    Bullet(Obj* o, const MovementDef& d) : Movement(o) {
        speed = d.v.size() > 0 ? d.v[0] : 50;
        angle = d.v.size() > 1 ? d.v[1] / 1000.0 : o->dir * 11.25;
    }
    void update() override {
        if (stopped) return;
        double m = speed / 8.0;
        obj->x += std::cos(angle * kPi / 180) * m;
        obj->y -= std::sin(angle * kPi / 180) * m;
    }
    void set_direction(int d) override {
        Movement::set_direction(d);
        angle = d * 11.25;
    }
};

struct Path : Movement {
    const MovementDef& def;
    int node = -1;  // -1 não iniciado, -2 terminado
    int step_dir = 1;
    double left = 0;
    bool just_finished = false;
    double sx = 0, sy = 0;  // erro acumulado (para fechar cada passo exatamente)
    Path(Obj* o, const MovementDef& d) : Movement(o), def(d) {}
    void set_node(int i) {
        node = i;
        const PathStep& s = def.steps[size_t(i)];
        left = s.length;
        speed = s.speed;
        int d = step_dir > 0 ? s.direction : (s.direction + 16) & 31;
        obj->dir = d & 31;
        sx = sy = 0;
    }
    void start() override {
        Movement::start();
        if (def.steps.empty()) return;
        if (node == -1) set_node(0);
    }
    bool finished() const override { return just_finished; }
    void update() override {
        just_finished = false;
        if (stopped || node < 0 || def.steps.empty()) return;
        const PathStep& s = def.steps[size_t(node)];
        if (s.length <= 0) { advance(); return; }
        double m = std::min(speed / 8.0, left);
        double ux = double(s.dx) / s.length, uy = double(s.dy) / s.length;
        obj->x += ux * m * step_dir;
        obj->y += uy * m * step_dir;
        sx += ux * m * step_dir;
        sy += uy * m * step_dir;
        left -= m;
        if (left <= 0) {
            // corrige para o destino exato do passo
            obj->x += s.dx * step_dir - sx;
            obj->y += s.dy * step_dir - sy;
            advance();
        }
    }
    void advance() {
        int next = node + step_dir;
        int n = int(def.steps.size());
        if (next >= 0 && next < n) { set_node(next); return; }
        if (def.reverse && step_dir == 1) { step_dir = -1; set_node(node); return; }
        if (!def.loop) { node = -2; speed = 0; just_finished = true; return; }
        if (def.reverse) { step_dir = 1; set_node(0); return; }
        if (def.reposition) {
            // volta ao início
            double tx = 0, ty = 0;
            for (auto& st : def.steps) { tx += st.dx; ty += st.dy; }
            obj->x -= tx;
            obj->y -= ty;
        }
        set_node(0);
    }
    void bounce() override {
        step_dir = -step_dir;
        if (node >= 0) {
            left = def.steps[size_t(node)].length - left;
            obj->dir = (obj->dir + 16) & 31;
        }
    }
};

struct Vector : Movement {
    double vx = 0, vy = 0;  // em unidades de velocidade (x0,01 px por loop)
    double gx = 0, gy = 0;
    bool handle_dir = false;
    Vector(Obj* o, const MovementDef& d) : Movement(o) {
        uint32_t flags = d.v.size() > 0 ? uint32_t(d.v[0]) : 0;
        handle_dir = flags & 2;
        int sp = d.v.size() > 1 ? d.v[1] : 0;
        double ang = d.v.size() > 2 ? d.v[2] : 0;
        double g = d.v.size() > 3 ? d.v[3] : 0;
        double ga = d.v.size() > 4 ? d.v[4] : 270;
        vx = sp * std::cos(ang * kPi / 180);
        vy = -sp * std::sin(ang * kPi / 180);
        gx = g * std::cos(ga * kPi / 180);
        gy = -g * std::sin(ga * kPi / 180);
        speed = sp;
        stopped = !(flags & 1);
    }
    void update() override {
        if (stopped) return;
        vx += gx * 0.01;
        vy += gy * 0.01;
        obj->x += vx * 0.01;
        obj->y += vy * 0.01;
        speed = int(std::hypot(vx, vy));
        if (handle_dir && (vx != 0 || vy != 0))
            obj->dir = angle_to_dir(std::atan2(-vy, vx) * 180 / kPi);
    }
    void set_speed(int s) override {
        double len = std::hypot(vx, vy);
        double a = len > 0 ? std::atan2(vy, vx) : -dir_rad(obj->dir);
        vx = s * std::cos(a);
        vy = s * std::sin(a);
        speed = s;
    }
    int get_speed() const override { return stopped ? 0 : int(std::hypot(vx, vy)); }
    void set_direction(int d) override {
        Movement::set_direction(d);
        double len = std::hypot(vx, vy);
        vx = len * std::cos(dir_rad(d));
        vy = -len * std::sin(dir_rad(d));
    }
    void bounce() override { vx = -vx; vy = -vy; }
};

struct Pinball : Movement {
    double xs = 0, ys = 0, gravity = 0, decel = 0;
    int start_speed = 0;
    Pinball(Obj* o, const MovementDef& d) : Movement(o) {
        start_speed = speed = d.v.size() > 0 ? d.v[0] : 0;
        decel = d.v.size() > 1 ? d.v[1] : 0;
        gravity = d.v.size() > 2 ? d.v[2] : 0;
        stopped = true;
    }
    void start() override {
        if (!stopped) return;
        stopped = false;
        xs = std::cos(dir_rad(obj->dir)) * speed;
        ys = -std::sin(dir_rad(obj->dir)) * speed;
    }
    void update() override {
        if (stopped) return;
        ys += gravity / 10.0;
        double ang = std::atan2(-ys, xs);
        double dist = std::hypot(xs, ys) - decel / 50.0;
        if (dist < 0) dist = 0;
        xs = dist * std::cos(ang);
        ys = -dist * std::sin(ang);
        speed = std::min(int(dist), 100);
        obj->dir = angle_to_dir(ang * 180 / kPi);
        obj->x += xs / 10.0;
        obj->y += ys / 10.0;
    }
    void set_direction(int d) override {
        Movement::set_direction(d);
        double dist = std::hypot(xs, ys);
        xs = std::cos(dir_rad(d)) * dist;
        ys = -std::sin(dir_rad(d)) * dist;
    }
    void set_speed(int s) override {
        double ang = std::atan2(-ys, xs);
        if (xs == 0 && ys == 0) ang = dir_rad(obj->dir);
        xs = s * std::cos(ang);
        ys = -s * std::sin(ang);
        speed = s;
    }
    void bounce() override { xs = -xs; ys = -ys; }
};

struct Ellipse : Movement {
    // campos (ver docs/FORMATO_CLICKTEAM_IOS.md): centro, raios, ângulo inicial?, ?, velocidade, ?
    double cx, cy, rx, ry, theta, deg_per_s;
    Ellipse(Obj* o, const MovementDef& d) : Movement(o) {
        auto V = [&](size_t i) { return i < d.v.size() ? double(d.v[i]) : 0.0; };
        cx = V(0); cy = V(1); rx = V(2); ry = V(3); theta = V(4);
        deg_per_s = V(6);  // calibração provisória: velocidade = graus por segundo
        speed = int(V(6));
        place();
    }
    void place() {
        obj->x = cx + rx * std::cos(theta * kPi / 180);
        obj->y = cy - ry * std::sin(theta * kPi / 180);
    }
    void update() override {
        if (stopped) return;
        int fps = 60;
        theta = std::fmod(theta + deg_per_s / fps, 360.0);
        place();
    }
};

}  // namespace

void Movement::set_direction(int dir) { obj->dir = dir & 31; }

std::unique_ptr<Movement> make_movement(Obj* o, const MovementDef& d) {
    switch (d.type) {
        case MV_BALL: return std::make_unique<Ball>(o, d);
        case MV_PATH: return std::make_unique<Path>(o, d);
        case 13: return std::make_unique<Bullet>(o, d);
        case MV_EXTENSION:
            if (d.module == "clickteam-vector") return std::make_unique<Vector>(o, d);
            if (d.module == "pinball") return std::make_unique<Pinball>(o, d);
            if (d.module == "clickteam-simple_ellipse") return std::make_unique<Ellipse>(o, d);
            break;
        default: break;
    }
    return std::make_unique<Static>(o);
}

}  // namespace pb

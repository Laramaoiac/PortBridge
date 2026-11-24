#include "runtime/devcheck.hpp"

#include <algorithm>
#include <cmath>

#include "runtime/runtime.hpp"

namespace pb {

void DevCheck::report(App& app, const char* category, const std::string& detail) {
    if (!on) return;
    std::string key = std::string(category) + "|" + detail;
    DevIssue& d = issues_[key];
    if (d.count++ == 0) {
        d.category = category;
        d.detail = detail;
        if (Frame* f = app.frame()) {
            d.frame = f->index;
            d.loop = f->loop;
        }
        SDL_Log("dev: %s: %s", category, detail.c_str());
    }
}

namespace {
std::string obj_name(const Obj& o) { return o.def ? o.def->name : "oi " + std::to_string(o.oi); }
}  // namespace

void DevCheck::after_step(App& app) {
    if (!on) return;
    Frame* f = app.frame();
    if (!f) return;
    ++steps_;
    const double fw = f->width, fh = f->height;
    for (auto& up : f->objects) {
        Obj& o = *up;
        if (o.destroyed) continue;
        const std::string name = obj_name(o);
        if (!std::isfinite(o.x) || !std::isfinite(o.y) || !std::isfinite(o.scale_x) || !std::isfinite(o.scale_y) ||
            !std::isfinite(o.angle))
            report(app, "posição ou escala inválida (NaN/inf)", name);
        if (o.type == OBJ_ACTIVE && o.def && o.visible && !o.def->anims.empty()) {
            if (o.image < 0) report(app, "objeto visível sem imagem", name + " anim " + std::to_string(o.anim));
            else if (!app.image(o.image)) report(app, "imagem inexistente", name + " imagem " + std::to_string(o.image));
            const uint32_t ink = o.def->ink_effect & 0xFFF;  // 0x1000 = filtro RGBA, não é um efeito
            if (ink != 0 && ink != 1 && ink != 9)
                report(app, "efeito de tinta não suportado (desenhado como normal)", name + " efeito " + std::to_string(ink));
            if (std::fabs(o.scale_x) > 60 || std::fabs(o.scale_y) > 60)
                report(app, "escala exagerada", name);
        }
        if (o.type == OBJ_COUNTER && !std::isfinite(o.counter)) report(app, "contador inválido (NaN/inf)", name);
        // Longe do frame (mais de 2 telas além da borda) por mais de 10 s: o objeto
        // se perdeu (todos os objetos do Zorbié têm "não destruir longe").
        const bool far = o.x < -2 * fw || o.x > 3 * fw || o.y < -2 * fh || o.y > 3 * fh;
        if (far) {
            auto [it, fresh] = far_since_.try_emplace(&o, f->loop);
            if (!fresh && f->loop - it->second == 600)
                report(app, "objeto perdido longe do frame (mais de 10 s)", name);
        } else {
            far_since_.erase(&o);
        }
    }
    if (steps_ % 600 == 0) {  // a cada 10 s de jogo
        std::map<std::string, int> n;
        for (auto& up : f->objects)
            if (!up->destroyed) ++n[obj_name(*up)];
        auto& per = counts_[f->index];
        for (auto& [k, v] : per) v.push_back(n.count(k) ? n[k] : 0);
        for (auto& [k, c] : n)
            if (!per.count(k)) per[k] = std::vector<int>{c};
        // ponteiros de objetos destruídos não valem mais
        for (auto it = far_since_.begin(); it != far_since_.end();) {
            bool alive = false;
            for (auto& up : f->objects) if (up.get() == it->first) { alive = true; break; }
            it = alive ? std::next(it) : far_since_.erase(it);
        }
    }
}

void DevCheck::write(App& app, FILE* out) const {
    std::vector<const DevIssue*> list;
    for (auto& [k, d] : issues_) list.push_back(&d);
    std::sort(list.begin(), list.end(), [](const DevIssue* a, const DevIssue* b) {
        return a->category != b->category ? a->category < b->category : a->count > b->count;
    });
    // Avisos: comportamentos que o runtime original também tem (o jogo depende
    // deles) e que só valem atenção se algo parecer errado na tela.
    auto is_warning = [](const std::string& cat) {
        return cat.find("objeto sem instância") != std::string::npos || cat.find("por zero") != std::string::npos ||
               cat == "movimento inexistente" || cat == "grupo achado só pelo id";
    };
    int fails = 0;
    for (const DevIssue* d : list) fails += !is_warning(d->category);
    std::fprintf(out, "modo desenvolvedor: %d falhas e %zu avisos distintos\n", fails, list.size() - size_t(fails));
    for (int pass = 0; pass < 2; ++pass)
        for (const DevIssue* d : list)
            if (is_warning(d->category) == (pass == 1))
                std::fprintf(out, "  %s [%s] %s  (x%lld, primeira: frame %d passo %lld)\n", pass ? "aviso" : "FALHA",
                             d->category.c_str(), d->detail.c_str(), d->count, d->frame, d->loop);
    // Objetos que só crescem: a contagem subiu em quase todas as amostras.
    for (auto& [fi, per] : counts_) {
        for (auto& [name, v] : per) {
            if (v.size() < 6) continue;
            int ups = 0;
            for (size_t i = 1; i < v.size(); ++i) ups += v[i] > v[i - 1];
            if (ups * 10 >= int(v.size() - 1) * 8 && v.back() >= 40)
                std::fprintf(out, "  FALHA [objetos que se acumulam] frame %d %s: %d -> %d\n", fi, name.c_str(), v.front(),
                             v.back());
        }
    }
    // Cobertura: grupos com ações que nunca dispararam (mecanismos que o teste não alcançou).
    for (auto& [fi, fired] : app.audit.fired) {
        if (fi < 0 || fi >= int(app.game().frames.size())) continue;
        const auto& groups = app.game().frames[size_t(fi)].events.groups;
        int with_actions = 0, ran = 0;
        for (size_t gi = 0; gi < groups.size(); ++gi) {
            if (groups[gi].actions.empty()) continue;
            bool marker = !groups[gi].conditions.empty() && groups[gi].conditions[0].type == -1 &&
                          (groups[gi].conditions[0].num == -10 || groups[gi].conditions[0].num == -11);
            if (marker) continue;
            ++with_actions;
            if (gi < fired.size() && fired[gi] > 0) ++ran;
        }
        std::fprintf(out, "  info [cobertura] frame %d: %d de %d eventos com ações rodaram (%.0f%%)\n", fi, ran, with_actions,
                     with_actions ? 100.0 * ran / with_actions : 0.0);
    }
}

}  // namespace pb

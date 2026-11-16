// Funções nativas chamadas pela biblioteca de jogos do app Android (NativeBridge.java).
#include <jni.h>

#include <cstdio>
#include <string>

#include "core/game.hpp"
#include "core/package.hpp"

namespace {

std::string jstr(JNIEnv* env, jstring s) {
    const char* c = env->GetStringUTFChars(s, nullptr);
    std::string out(c ? c : "");
    if (c) env->ReleaseStringUTFChars(s, c);
    return out;
}

std::string json_escape(const std::string& s) {
    std::string o;
    for (unsigned char ch : s) {
        if (ch == '"' || ch == '\\') { o += '\\'; o += char(ch); }
        else if (ch < 0x20) { char b[8]; std::snprintf(b, sizeof b, "\\u%04x", ch); o += b; }
        else o += char(ch);
    }
    return o;
}

}  // namespace

extern "C" {

// Valida o pacote e devolve um JSON com os metadados (ou {"error": "..."}).
// Se icon_out não for vazio, grava ali o ícone do jogo.
JNIEXPORT jstring JNICALL Java_com_portbridge_app_NativeBridge_inspect(JNIEnv* env, jclass,
                                                                       jstring jpath, jstring jicon) {
    std::string out;
    try {
        pb::PackageInfo pkg = pb::open_package(jstr(env, jpath));
        std::string icon_path = jstr(env, jicon);
        bool icon_ok = false;
        if (!icon_path.empty() && !pkg.icon.empty()) {
            if (FILE* f = std::fopen(icon_path.c_str(), "wb")) {
                icon_ok = std::fwrite(pkg.icon.data(), 1, pkg.icon.size(), f) == pkg.icon.size();
                std::fclose(f);
            }
        }
        auto g = pb::load_game(std::move(pkg.game_data));
        size_t groups = 0;
        for (auto& fr : g->frames) groups += fr.events.groups.size();
        out = "{\"name\":\"" + json_escape(pkg.display_name) + "\",\"bundle\":\"" +
              json_escape(pkg.bundle_id) + "\",\"version\":\"" + json_escape(pkg.version) +
              "\",\"engine\":\"Clickteam Fusion\",\"width\":" + std::to_string(g->width) +
              ",\"height\":" + std::to_string(g->height) + ",\"frames\":" +
              std::to_string(g->frames.size()) + ",\"objects\":" + std::to_string(g->objects.size()) +
              ",\"events\":" + std::to_string(groups) + ",\"icon\":" + (icon_ok ? "true" : "false") + "}";
    } catch (const std::exception& e) {
        out = std::string("{\"error\":\"") + json_escape(e.what()) + "\"}";
    }
    return env->NewStringUTF(out.c_str());
}

}  // extern "C"

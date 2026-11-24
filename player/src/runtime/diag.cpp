#include "runtime/diag.hpp"

#include <SDL.h>

#include <csignal>
#include <cstdio>
#include <cstring>
#include <ctime>

#if !defined(_WIN32)
#include <fcntl.h>
#include <unistd.h>
#endif

namespace pb {

DiagContext g_diag;

namespace {

FILE* g_log = nullptr;
int g_fd = -1;
SDL_LogOutputFunction g_prev_out = nullptr;
void* g_prev_data = nullptr;

void log_out(void* userdata, int category, SDL_LogPriority prio, const char* msg) {
    if (g_log) {
        std::fprintf(g_log, "[%6u] %s\n", unsigned(SDL_GetTicks()), msg);
        std::fflush(g_log);
    }
    if (g_prev_out) g_prev_out(g_prev_data, category, prio, msg);
    (void)userdata;
}

#if !defined(_WIN32)
struct sigaction g_old[32];

void put(const char* s) {
    if (g_fd >= 0) {
        ssize_t r = write(g_fd, s, std::strlen(s));
        (void)r;
    }
}

void put_int(long v) {
    char b[24];
    int i = 23;
    b[i] = 0;
    bool neg = v < 0;
    unsigned long u = neg ? 0UL - (unsigned long)v : (unsigned long)v;
    do { b[--i] = char('0' + u % 10); u /= 10; } while (u && i > 1);
    if (neg) b[--i] = '-';
    put(b + i);
}

void on_signal(int sig, siginfo_t* info, void* ctx) {
    const char* name = sig == SIGSEGV ? "SIGSEGV" : sig == SIGBUS ? "SIGBUS" : sig == SIGFPE ? "SIGFPE"
                       : sig == SIGILL ? "SIGILL" : sig == SIGABRT ? "SIGABRT" : "sinal";
    put("TRAVAMENTO: ");
    put(name);
    put(" durante '");
    put(g_diag.stage);
    put("' frame=");
    put_int(g_diag.frame);
    put(" loop=");
    put_int(g_diag.loop);
    put(" grupo=");
    put_int(g_diag.group);
    put("\n");
    // devolve ao tratador anterior (no Android, o debuggerd gera o tombstone)
    struct sigaction& old = g_old[sig];
    sigaction(sig, &old, nullptr);
    if (old.sa_flags & SA_SIGINFO) {
        if (old.sa_sigaction) old.sa_sigaction(sig, info, ctx);
    } else if (old.sa_handler != SIG_DFL && old.sa_handler != SIG_IGN && old.sa_handler) {
        old.sa_handler(sig);
    } else {
        raise(sig);
    }
}
#endif

}  // namespace

void diag_open(const std::string& path, const std::string& device) {
    if (!path.empty()) {
        g_log = std::fopen(path.c_str(), "w");
#if !defined(_WIN32)
        if (g_log) g_fd = fileno(g_log);
#endif
    }
    SDL_LogGetOutputFunction(&g_prev_out, &g_prev_data);
    SDL_LogSetOutputFunction(log_out, nullptr);
    SDL_version v;
    SDL_GetVersion(&v);
    std::time_t t = std::time(nullptr);
    char when[64];
    std::strftime(when, sizeof when, "%Y-%m-%d %H:%M:%S", std::localtime(&t));
    SDL_Log("PortBridge runtime 0.2 | SDL %d.%d.%d | %s | %s", v.major, v.minor, v.patch,
            SDL_GetPlatform(), when);
    if (!device.empty()) SDL_Log("aparelho: %s", device.c_str());
#if !defined(_WIN32)
    for (int sig : {SIGSEGV, SIGBUS, SIGFPE, SIGILL, SIGABRT}) {
        struct sigaction sa {};
        sa.sa_sigaction = on_signal;
        sa.sa_flags = SA_SIGINFO | SA_ONSTACK;
        sigemptyset(&sa.sa_mask);
        sigaction(sig, &sa, &g_old[sig]);
    }
#endif
}

void diag_fatal(const std::string& msg) {
    SDL_Log("ERRO: %s", msg.c_str());
    SDL_ShowSimpleMessageBox(SDL_MESSAGEBOX_ERROR, "PortBridge", msg.c_str(), nullptr);
}

void diag_close() {
    SDL_Log("SAIDA NORMAL");
    if (g_log) {
        std::fclose(g_log);
        g_log = nullptr;
        g_fd = -1;
    }
}

}  // namespace pb

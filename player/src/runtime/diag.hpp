// Diagnóstico: log em arquivo e registro de travamentos (para depurar em aparelhos reais).
#pragma once
#include <string>

namespace pb {

// Onde o runtime estava (atualizado a cada loop; lido pelo tratador de sinais).
struct DiagContext {
    volatile int frame = -1;
    volatile long loop = 0;
    volatile int group = -1;
    const char* volatile stage = "início";
};
extern DiagContext g_diag;

// Abre o log (sobrescreve) e instala os tratadores de travamento.
void diag_open(const std::string& path, const std::string& device);
// Registra um erro fatal ("ERRO: ...") e mostra uma mensagem na tela.
void diag_fatal(const std::string& msg);
void diag_close();

}  // namespace pb

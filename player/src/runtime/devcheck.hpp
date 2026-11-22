// Modo desenvolvedor (--dev / PB_DEV=1): confere o jogo a cada passo e anota
// falhas visíveis (objeto sem imagem, animação ou quadro inexistente, posição
// inválida, imagem ou som que não decodifica) e invisíveis (expressão sobre
// objeto que não existe, divisão por zero, valor alterável fora do limite,
// movimento ou frame inválido, ponteiro de grupo sem alvo, objetos que se
// acumulam ou se perdem longe do frame, grupos que nunca rodaram).
#pragma once

#include <cstdio>
#include <map>
#include <string>
#include <vector>

namespace pb {

class App;
struct Obj;

struct DevIssue {
    std::string category, detail;
    int frame = -1;
    long long loop = -1;
    long long count = 0;
};

class DevCheck {
public:
    bool on = false;

    // Anota uma ocorrência (agrupa por categoria + detalhe; guarda a primeira).
    void report(App& app, const char* category, const std::string& detail);
    // Conferências por passo (chamado depois de cada passo do frame).
    void after_step(App& app);
    // Relatório final.
    void write(App& app, FILE* out) const;

private:
    std::map<std::string, DevIssue> issues_;
    // contagem de instâncias por objeto, amostrada a cada 10 s de jogo
    std::map<int, std::map<std::string, std::vector<int>>> counts_;
    std::map<const Obj*, long long> far_since_;  // objetos longe do frame desde o passo N
    long long steps_ = 0;
};

}  // namespace pb

package com.portbridge.app;

/** Ponte para o núcleo C++ (o mesmo código que lê o jogo no player). */
final class NativeBridge {
    static {
        System.loadLibrary("c++_shared");
        System.loadLibrary("SDL2");
        System.loadLibrary("main");
    }

    private NativeBridge() {}

    /**
     * Abre o IPA, valida o jogo e devolve JSON com nome, id, versão, frames...
     * ou {"error": "..."}. Se iconOut não for vazio, grava ali o ícone do jogo.
     */
    static native String inspect(String path, String iconOut);
}

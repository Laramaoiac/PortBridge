package com.portbridge.app;

import android.content.Intent;
import android.os.Bundle;

import org.libsdl.app.SDLActivity;

import java.io.File;

/** Roda um jogo convertido com o runtime nativo (libmain.so) sobre o SDL. */
public class PlayerActivity extends SDLActivity {
    static final String EXTRA_GAME = "game";
    static final String EXTRA_SAVE = "save";

    @Override
    protected String[] getLibraries() {
        return new String[] {"c++_shared", "SDL2", "main"};
    }

    @Override
    protected String[] getArguments() {
        Intent i = getIntent();
        String game = i.getStringExtra(EXTRA_GAME);
        String save = i.getStringExtra(EXTRA_SAVE);
        if (save == null) save = new File(getFilesDir(), "saves").getAbsolutePath();
        new File(save).mkdirs();
        return new String[] {game == null ? "" : game, "--save-dir", save};
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        // O SDL não foi feito para reiniciar o main() no mesmo processo: encerra o processo
        // do player (a biblioteca roda em outro processo e não é afetada).
        if (isFinishing()) android.os.Process.killProcess(android.os.Process.myPid());
    }
}

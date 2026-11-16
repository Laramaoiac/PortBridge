package com.portbridge.hle;

import android.app.Activity;
import android.os.Bundle;

/** Aberta pelo atalho "Relatório": mostra o log da última execução do jogo. */
public class ReportActivity extends Activity {
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        String log = Report.readTail(Report.logFile(this));
        Report.show(this, "Relatório da última execução", log, this::finish);
    }
}

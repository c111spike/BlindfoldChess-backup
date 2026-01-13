package com.blindfoldchess.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BlindfoldPlugin.class);  // Must be BEFORE super.onCreate()
        super.onCreate(savedInstanceState);
    }
}

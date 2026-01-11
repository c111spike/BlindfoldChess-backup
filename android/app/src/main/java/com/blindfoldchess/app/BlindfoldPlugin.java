package com.blindfoldchess.app;

import android.Manifest;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.Build;
import android.os.IBinder;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;

@CapacitorPlugin(
    name = "BlindfoldNative",
    permissions = {
        @Permission(strings = {Manifest.permission.RECORD_AUDIO}, alias = "mic"),
        @Permission(strings = {Manifest.permission.POST_NOTIFICATIONS}, alias = "notify")
    }
)
public class BlindfoldPlugin extends Plugin {
    private BlindfoldVoiceService voiceService;
    private boolean isBound = false;

    private final ServiceConnection connection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName className, IBinder service) {
            BlindfoldVoiceService.LocalBinder binder = (BlindfoldVoiceService.LocalBinder) service;
            voiceService = binder.getService();
            isBound = true;

            voiceService.setCallback(new BlindfoldVoiceService.VoiceCallback() {
                @Override
                public void onSpeechResult(String text) {
                    JSObject ret = new JSObject();
                    ret.put("text", text);
                    notifyListeners("onSpeechResult", ret);
                }

                @Override
                public void onGameLog(String message) {
                    JSObject ret = new JSObject();
                    ret.put("message", message);
                    notifyListeners("onGameLog", ret);
                }
            });

            // Execute any pending startSession call
            onServiceBound();
        }

        @Override
        public void onServiceDisconnected(ComponentName arg0) {
            isBound = false;
        }
    };

    @Override
    public void load() {
        // Only bind the service - don't start foreground yet
        // startSession() will trigger the foreground notification when a voice game starts
        Intent intent = new Intent(getContext(), BlindfoldVoiceService.class);
        getContext().bindService(intent, connection, Context.BIND_AUTO_CREATE);
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject permissionsResultJSON = new JSObject();
        permissionsResultJSON.put("mic", getPermissionState("mic").toString().toLowerCase());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissionsResultJSON.put("notify", getPermissionState("notify").toString().toLowerCase());
        } else {
            permissionsResultJSON.put("notify", "granted");
        }
        call.resolve(permissionsResultJSON);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        // Only request POST_NOTIFICATIONS on API 33+ (TIRAMISU)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissionForAliases(new String[]{"mic", "notify"}, call, "permissionsCallback");
        } else {
            // On older APIs, just request mic - notifications don't need runtime permission
            requestPermissionForAliases(new String[]{"mic"}, call, "permissionsCallback");
        }
    }

    @Override
    protected void handleOnDestroy() {
        // Cleanup: stop service and unbind when plugin is destroyed
        if (isBound) {
            try {
                voiceService.stopSession();
                getContext().unbindService(connection);
                // Stop the service completely so it can't restart unattended
                Intent intent = new Intent(getContext(), BlindfoldVoiceService.class);
                getContext().stopService(intent);
            } catch (Exception e) {
                // Ignore cleanup errors
            }
            isBound = false;
        }
        super.handleOnDestroy();
    }

    @PermissionCallback
    private void permissionsCallback(PluginCall call) {
        JSObject permissionsResultJSON = new JSObject();
        permissionsResultJSON.put("mic", getPermissionState("mic").toString().toLowerCase());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissionsResultJSON.put("notify", getPermissionState("notify").toString().toLowerCase());
        } else {
            permissionsResultJSON.put("notify", "granted");
        }
        call.resolve(permissionsResultJSON);
    }

    private PluginCall pendingStartSession = null;

    @PluginMethod
    public void startSession(PluginCall call) {
        if (isBound) {
            // Re-establish callback for this session (fixes callback lifecycle after stopSession)
            setupServiceCallback();
            voiceService.startForegroundSession();
            voiceService.startListening();
            call.resolve();
        } else {
            // Queue the call and retry when service binds
            pendingStartSession = call;
            // Set a timeout to reject if binding takes too long
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                if (pendingStartSession == call && !isBound) {
                    pendingStartSession = null;
                    call.reject("Service bind timeout");
                }
            }, 5000);
        }
    }

    private void setupServiceCallback() {
        if (voiceService == null) return;
        voiceService.setCallback(new BlindfoldVoiceService.VoiceCallback() {
            @Override
            public void onSpeechResult(String text) {
                JSObject ret = new JSObject();
                ret.put("text", text);
                notifyListeners("onSpeechResult", ret);
            }

            @Override
            public void onGameLog(String message) {
                JSObject ret = new JSObject();
                ret.put("message", message);
                notifyListeners("onGameLog", ret);
            }
        });
    }

    private void onServiceBound() {
        // Execute pending startSession if any
        if (pendingStartSession != null && isBound) {
            PluginCall call = pendingStartSession;
            pendingStartSession = null;
            setupServiceCallback();
            voiceService.startForegroundSession();
            voiceService.startListening();
            call.resolve();
        }
    }

    @PluginMethod
    public void speakAndListen(PluginCall call) {
        if (isBound) {
            String text = call.getString("text");
            voiceService.speakAndListen(text);
            call.resolve();
        } else {
            call.reject("Service not bound");
        }
    }

    @PluginMethod
    public void speakOnly(PluginCall call) {
        if (isBound) {
            String text = call.getString("text");
            voiceService.speakOnly(text);
            call.resolve();
        } else {
            call.reject("Service not bound");
        }
    }

    @PluginMethod
    public void stopSession(PluginCall call) {
        if (isBound) {
            voiceService.stopSession();
            call.resolve();
        } else {
            call.resolve();
        }
    }

    @PluginMethod
    public void startListening(PluginCall call) {
        if (isBound) {
            voiceService.startListening();
            call.resolve();
        } else {
            call.reject("Service not bound");
        }
    }
}

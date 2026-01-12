package com.blindfoldchess.app;

import android.Manifest;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(
    name = "BlindfoldNative",
    permissions = {
        @Permission(strings = {Manifest.permission.RECORD_AUDIO}, alias = "mic"),
        @Permission(strings = {Manifest.permission.POST_NOTIFICATIONS}, alias = "notify")
    }
)
public class BlindfoldPlugin extends Plugin {
    private static final String TAG = "BlindfoldPlugin";
    private VoskVoiceService voiceService;
    private boolean isBound = false;
    
    // Queue for waitUntilReady calls waiting for service bind
    private final List<PluginCall> waitingCalls = new ArrayList<>();

    private final ServiceConnection connection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName className, IBinder service) {
            VoskVoiceService.LocalBinder binder = (VoskVoiceService.LocalBinder) service;
            voiceService = binder.getService();
            isBound = true;
            isBindingInProgress = false;
            
            Log.d(TAG, "Service connected! Flushing " + waitingCalls.size() + " waiting calls.");

            voiceService.setCallback(new VoskVoiceService.VoiceCallback() {
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

            // Resolve all waiting calls
            for (PluginCall call : waitingCalls) {
                call.resolve();
            }
            waitingCalls.clear();

            onServiceBound();
        }

        @Override
        public void onServiceDisconnected(ComponentName arg0) {
            isBound = false;
            isBindingInProgress = false;
        }
    };

    @Override
    public void load() {
        // Don't bind service here - wait until mic permission is granted
        // Service binding requires RECORD_AUDIO permission
        Log.d(TAG, "Plugin loaded - service binding deferred until permission granted");
    }
    
    private void bindServiceIfNeeded() {
        if (isBound || isBindingInProgress) {
            return;
        }
        isBindingInProgress = true;
        Log.d(TAG, "Binding to VoskVoiceService...");
        Intent intent = new Intent(getContext(), VoskVoiceService.class);
        getContext().bindService(intent, connection, Context.BIND_AUTO_CREATE);
    }
    
    private boolean isBindingInProgress = false;

    @PluginMethod
    public void waitUntilReady(PluginCall call) {
        if (isBound) {
            // Already ready - resolve immediately
            Log.d(TAG, "waitUntilReady: already bound, resolving immediately");
            call.resolve();
        } else {
            // Not ready - queue the call to be resolved when service connects
            Log.d(TAG, "waitUntilReady: service not bound, queueing request");
            call.setKeepAlive(true);
            waitingCalls.add(call);
            
            // If permission is already granted (app relaunch), trigger service binding
            if (getPermissionState("mic") == PermissionState.GRANTED) {
                Log.d(TAG, "waitUntilReady: mic already granted, binding service");
                bindServiceIfNeeded();
            }
        }
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
        if (isBound) {
            try {
                voiceService.stopSession();
                getContext().unbindService(connection);
                Intent intent = new Intent(getContext(), VoskVoiceService.class);
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
        PermissionState micState = getPermissionState("mic");
        JSObject permissionsResultJSON = new JSObject();
        permissionsResultJSON.put("mic", micState.toString().toLowerCase());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissionsResultJSON.put("notify", getPermissionState("notify").toString().toLowerCase());
        } else {
            permissionsResultJSON.put("notify", "granted");
        }
        
        // Bind service now that we have permission
        if (micState == PermissionState.GRANTED) {
            Log.d(TAG, "Mic permission granted - binding service");
            bindServiceIfNeeded();
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
        voiceService.setCallback(new VoskVoiceService.VoiceCallback() {
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
            // Check if session is active before starting
            if (!voiceService.isSessionActive()) {
                call.reject("Session not active");
                return;
            }
            voiceService.startListening();
            call.resolve();
        } else {
            call.reject("Service not bound");
        }
    }
}

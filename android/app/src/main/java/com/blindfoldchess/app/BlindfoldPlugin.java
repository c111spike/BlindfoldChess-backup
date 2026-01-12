package com.blindfoldchess.app;

import android.Manifest;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

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
    private static final int BIND_TIMEOUT_MS = 5000;
    
    private VoskVoiceService voiceService;
    private boolean isBound = false;
    private boolean isBindingInProgress = false;
    
    private final List<PluginCall> waitingCalls = new ArrayList<>();

    private boolean hasMicPermission() {
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) 
               == PackageManager.PERMISSION_GRANTED;
    }

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

            for (PluginCall call : waitingCalls) {
                call.resolve();
            }
            waitingCalls.clear();

            // Process pending startSession call if service connected after startSession was requested
            if (pendingStartSession != null) {
                Log.d(TAG, "Processing pendingStartSession after service connected");
                setupServiceCallback();
                voiceService.startForegroundSession();
                voiceService.startListening();
                pendingStartSession.resolve();
                pendingStartSession = null;
            }

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
        Log.d(TAG, "Plugin loaded - checking mic permission...");
        if (hasMicPermission()) {
            Log.d(TAG, "Mic permission already granted on load, binding service");
            bindServiceIfNeeded();
        } else {
            Log.d(TAG, "Mic permission not granted, deferring service bind");
        }
    }
    
    private void bindServiceIfNeeded() {
        if (isBound || isBindingInProgress) {
            Log.d(TAG, "bindServiceIfNeeded: already bound or binding in progress");
            return;
        }
        if (!hasMicPermission()) {
            Log.w(TAG, "bindServiceIfNeeded: mic permission not granted, skipping bind");
            return;
        }
        isBindingInProgress = true;
        Log.d(TAG, "Binding to VoskVoiceService...");
        Intent intent = new Intent(getContext(), VoskVoiceService.class);
        getContext().bindService(intent, connection, Context.BIND_AUTO_CREATE);
    }

    @PluginMethod
    public void waitUntilReady(PluginCall call) {
        Log.d(TAG, "waitUntilReady called, isBound=" + isBound + ", hasMicPermission=" + hasMicPermission());
        
        if (isBound) {
            Log.d(TAG, "waitUntilReady: already bound, resolving immediately");
            call.resolve();
            return;
        }
        
        call.setKeepAlive(true);
        waitingCalls.add(call);
        
        if (hasMicPermission()) {
            Log.d(TAG, "waitUntilReady: mic permission granted (native check), binding service");
            bindServiceIfNeeded();
        } else {
            Log.d(TAG, "waitUntilReady: mic permission NOT granted (native check)");
        }
        
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (waitingCalls.contains(call) && !isBound) {
                Log.e(TAG, "waitUntilReady: TIMEOUT after " + BIND_TIMEOUT_MS + "ms, service never bound");
                waitingCalls.remove(call);
                call.reject("Voice service bind timeout - mic permission may be denied");
            }
        }, BIND_TIMEOUT_MS);
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject result = new JSObject();
        result.put("mic", hasMicPermission() ? "granted" : "prompt");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            boolean hasNotify = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) 
                               == PackageManager.PERMISSION_GRANTED;
            result.put("notify", hasNotify ? "granted" : "prompt");
        } else {
            result.put("notify", "granted");
        }
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        Log.d(TAG, "requestPermissions called, current mic state: " + (hasMicPermission() ? "granted" : "not granted"));
        
        if (hasMicPermission()) {
            Log.d(TAG, "requestPermissions: mic already granted (native check), binding service");
            bindServiceIfNeeded();
            JSObject result = new JSObject();
            result.put("mic", "granted");
            result.put("notify", "granted");
            call.resolve(result);
            return;
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissionForAliases(new String[]{"mic", "notify"}, call, "permissionsCallback");
        } else {
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
                Log.e(TAG, "Error during cleanup: " + e.getMessage());
            }
            isBound = false;
        }
        super.handleOnDestroy();
    }

    @PermissionCallback
    private void permissionsCallback(PluginCall call) {
        boolean micGranted = hasMicPermission();
        Log.d(TAG, "permissionsCallback: mic granted (native check) = " + micGranted);
        
        JSObject result = new JSObject();
        result.put("mic", micGranted ? "granted" : "denied");
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            boolean hasNotify = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) 
                               == PackageManager.PERMISSION_GRANTED;
            result.put("notify", hasNotify ? "granted" : "denied");
        } else {
            result.put("notify", "granted");
        }
        
        if (micGranted) {
            Log.d(TAG, "permissionsCallback: binding service after permission granted");
            bindServiceIfNeeded();
        }
        
        call.resolve(result);
    }

    private PluginCall pendingStartSession = null;

    @PluginMethod
    public void startSession(PluginCall call) {
        Log.d(TAG, "startSession called, isBound=" + isBound);
        
        if (isBound) {
            setupServiceCallback();
            voiceService.startForegroundSession();
            voiceService.startListening();
            call.resolve();
        } else {
            pendingStartSession = call;
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                if (pendingStartSession == call && !isBound) {
                    pendingStartSession = null;
                    Log.e(TAG, "startSession: TIMEOUT waiting for service bind");
                    call.reject("Service bind timeout");
                }
            }, BIND_TIMEOUT_MS);
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
        }
        call.resolve();
    }

    @PluginMethod
    public void startListening(PluginCall call) {
        if (isBound) {
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

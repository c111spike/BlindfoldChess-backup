package com.blindfoldchess.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Binder;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Log;
import androidx.core.app.NotificationCompat;

import org.vosk.Model;
import org.vosk.Recognizer;
import org.vosk.android.StorageService;

import org.json.JSONObject;
import java.io.IOException;
import java.util.Locale;

public class VoskVoiceService extends Service {
    private static final String TAG = "VoskVoiceService";
    private static final String CHANNEL_ID = "BlindfoldGameChannel";
    private static final int NOTIFICATION_ID = 12345;
    private static final int SAMPLE_RATE = 16000;

    private Model model;
    private Recognizer recognizer;
    private AudioRecord audioRecord;
    private Thread recordingThread;
    private TextToSpeech tts;
    private Handler mainHandler;

    private volatile boolean isListening = false;
    private volatile boolean isSessionActive = false;
    private volatile boolean isTtsReady = false;
    private volatile boolean isTtsSpeaking = false;
    private volatile boolean modelLoaded = false;
    private volatile boolean pendingListeningRequest = false;

    public interface VoiceCallback {
        void onSpeechResult(String text);
        void onGameLog(String message);
    }
    private VoiceCallback callback;
    private final IBinder binder = new LocalBinder();
    
    // Buffer logs until callback is set, and keep all logs for polling
    private java.util.List<String> logBuffer = new java.util.ArrayList<>();
    private java.util.List<String> allLogs = new java.util.ArrayList<>();

    public class LocalBinder extends Binder {
        VoskVoiceService getService() { return VoskVoiceService.this; }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        mainHandler = new Handler(Looper.getMainLooper());
        createNotificationChannel();
        initTTS();
        initVoskModel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_NOT_STICKY;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Blindfold Chess Voice", NotificationManager.IMPORTANCE_LOW
            );
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    private void initTTS() {
        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                tts.setLanguage(Locale.US);
                isTtsReady = true;
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override
                    public void onStart(String utteranceId) {
                        isTtsSpeaking = true;
                        stopListeningInternal();
                    }
                    @Override
                    public void onDone(String utteranceId) {
                        isTtsSpeaking = false;
                        // CRITICAL: Always restart mic after TTS unless explicitly told to stop
                        // This fixes the "mic pauses after first move" bug
                        if (!"STOP_LISTENING".equals(utteranceId) && isSessionActive) {
                            Log.d(TAG, "TTS finished (" + utteranceId + "). Restarting mic.");
                            mainHandler.postDelayed(() -> startListeningInternal(), 100);
                        }
                    }
                    @Override
                    public void onError(String utteranceId) {
                        isTtsSpeaking = false;
                        // Always restart on error too, to recover gracefully
                        if (isSessionActive) {
                            mainHandler.post(() -> startListeningInternal());
                        }
                    }
                });
            }
        });
    }

    private void initVoskModel() {
        logToCallback("Loading Vosk model...");
        try {
            // Log the expected extraction path
            java.io.File modelDir = new java.io.File(getFilesDir(), "model");
            logToCallback("Model path: " + modelDir.getAbsolutePath());
            
            StorageService.unpack(this, "vosk-model", "model",
                (model) -> {
                    try {
                        this.model = model;
                        this.modelLoaded = true;
                        Log.i(TAG, "Vosk model loaded successfully");
                        logToCallback("Vosk model LOADED!");
                        
                        // Verify model directory exists
                        java.io.File verifyDir = new java.io.File(getFilesDir(), "model");
                        logToCallback("Model exists: " + verifyDir.exists());
                        
                        // Check if we have a queued listening request
                        if (pendingListeningRequest && isSessionActive) {
                            Log.d(TAG, "Model loaded. Executing queued listening request.");
                            pendingListeningRequest = false;
                            mainHandler.post(() -> startListeningInternal());
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Exception in model success callback: " + e.getMessage());
                        logToCallback("Model callback error: " + e.getMessage());
                    }
                },
                (exception) -> {
                    Log.e(TAG, "Failed to load Vosk model: " + exception.getMessage());
                    logToCallback("Model FAILED: " + exception.getMessage());
                    if (exception.getCause() != null) {
                        logToCallback("Cause: " + exception.getCause().getMessage());
                    }
                }
            );
        } catch (Exception e) {
            Log.e(TAG, "Exception during model init: " + e.getMessage());
            logToCallback("Model init exception: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    private void logToCallback(String message) {
        Log.d(TAG, message);
        // Always store in allLogs for polling
        synchronized(allLogs) {
            allLogs.add(message);
            // Keep max 50 logs
            if (allLogs.size() > 50) {
                allLogs.remove(0);
            }
        }
        if (callback != null) {
            mainHandler.post(() -> callback.onGameLog(message));
        } else {
            // Buffer logs until callback is set
            synchronized(logBuffer) {
                logBuffer.add(message);
            }
        }
    }

    public void setCallback(VoiceCallback cb) { 
        this.callback = cb;
        // Flush buffered logs
        if (cb != null) {
            synchronized(logBuffer) {
                for (String msg : logBuffer) {
                    final String m = msg;
                    mainHandler.post(() -> cb.onGameLog(m));
                }
                logBuffer.clear();
            }
        }
    }
    
    public String[] getLogs() {
        synchronized(allLogs) {
            return allLogs.toArray(new String[0]);
        }
    }

    public void startForegroundSession() {
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Blindfold Chess Active")
            .setContentText("Voice engine ready (offline)")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build();
        try {
            startForeground(NOTIFICATION_ID, notification);
            isSessionActive = true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to start foreground: " + e.getMessage());
        }
    }

    public void stopSession() {
        isSessionActive = false;
        stopListeningInternal();
        stopForeground(true);
    }

    public void speakAndListen(String text) {
        if (!isTtsReady) return;
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "KEEP_LISTENING");
    }

    public void speakOnly(String text) {
        if (!isTtsReady) return;
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "JUST_SPEAK");
    }

    public void startListening() {
        if (isSessionActive && !isTtsSpeaking) {
            startListeningInternal();
        }
    }

    public void stopListening() {
        stopListeningInternal();
    }

    public boolean isSessionActive() { return isSessionActive; }
    
    public boolean isModelReady() { return modelLoaded; }

    private void startListeningInternal() {
        if (!isSessionActive) return;
        
        if (!modelLoaded) {
            Log.d(TAG, "Model not ready yet. Queuing start request.");
            pendingListeningRequest = true;
            return;
        }
        
        if (isListening) return;
        isListening = true;
        
        // CRITICAL FIX: Create EVERYTHING inside the thread for thread affinity
        // Vosk native code may require thread-local initialization
        final Model localModel = model;
        
        recordingThread = new Thread(() -> {
            Recognizer threadRecognizer = null;
            AudioRecord threadAudioRecord = null;
            
            try {
                logToCallback("Thread started. Creating Recognizer...");
                threadRecognizer = new Recognizer(localModel, SAMPLE_RATE);
                logToCallback("Recognizer created OK in thread");
                
                int bufferSize = AudioRecord.getMinBufferSize(
                    SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT
                );
                bufferSize = Math.max(bufferSize, 4096);
                logToCallback("Buffer size: " + bufferSize);

                threadAudioRecord = new AudioRecord(
                    MediaRecorder.AudioSource.VOICE_RECOGNITION,
                    SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    bufferSize
                );

                if (threadAudioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                    logToCallback("ERROR: AudioRecord failed to initialize");
                    isListening = false;
                    return;
                }
                
                logToCallback("AudioRecord initialized. Starting recording...");
                threadAudioRecord.startRecording();
                logToCallback("Mic recording STARTED");
                
                byte[] buffer = new byte[4096];
                long silenceStart = 0;
                boolean hasSpeech = false;
                int loopCount = 0;
                
                logToCallback("Starting audio read loop...");

                while (isListening && isSessionActive) {
                    int read = threadAudioRecord.read(buffer, 0, buffer.length);
                    loopCount++;
                    if (loopCount == 1) {
                        logToCallback("First audio read: " + read + " bytes");
                    }
                    if (read > 0) {
                        if (loopCount == 1) {
                            logToCallback("Calling acceptWaveForm...");
                        }
                        boolean hasResult = threadRecognizer.acceptWaveForm(buffer, read);
                        if (loopCount == 1) {
                            logToCallback("acceptWaveForm OK, hasResult=" + hasResult);
                        }
                        
                        if (hasResult) {
                            String result = threadRecognizer.getResult();
                            String text = parseVoskResult(result);
                            if (text != null && !text.isEmpty()) {
                                hasSpeech = true;
                                final String finalText = text;
                                Log.d(TAG, "Speech result: " + finalText);
                                logToCallback("Heard: " + finalText);
                                mainHandler.post(() -> {
                                    if (callback != null) callback.onSpeechResult(finalText);
                                });
                                hasSpeech = false;
                                silenceStart = 0;
                            }
                        } else {
                            String partial = threadRecognizer.getPartialResult();
                            if (partial.contains("\"partial\" : \"\"")) {
                                if (hasSpeech && silenceStart == 0) {
                                    silenceStart = System.currentTimeMillis();
                                }
                            } else {
                                hasSpeech = true;
                                silenceStart = 0;
                            }
                        }

                        if (silenceStart > 0 && System.currentTimeMillis() - silenceStart > 1500) {
                            String finalResult = threadRecognizer.getFinalResult();
                            String text2 = parseVoskResult(finalResult);
                            if (text2 != null && !text2.isEmpty()) {
                                final String finalText = text2;
                                mainHandler.post(() -> {
                                    if (callback != null) callback.onSpeechResult(finalText);
                                });
                            }
                            hasSpeech = false;
                            silenceStart = 0;
                        }
                    } else if (read < 0) {
                        logToCallback("Audio read error: " + read);
                    }
                }

                logToCallback("Audio loop ended. Loops: " + loopCount);
                if (threadRecognizer != null) {
                    String finalResult = threadRecognizer.getFinalResult();
                    String text = parseVoskResult(finalResult);
                    if (text != null && !text.isEmpty()) {
                        final String finalText = text;
                        mainHandler.post(() -> {
                            if (callback != null) callback.onSpeechResult(finalText);
                        });
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "AUDIO THREAD CRASH: " + e.getClass().getName() + ": " + e.getMessage());
                logToCallback("CRASH: " + e.getClass().getSimpleName() + ": " + e.getMessage());
                if (e.getCause() != null) {
                    logToCallback("Cause: " + e.getCause().getMessage());
                }
                java.io.StringWriter sw = new java.io.StringWriter();
                e.printStackTrace(new java.io.PrintWriter(sw));
                String[] lines = sw.toString().split("\n");
                for (int i = 0; i < Math.min(5, lines.length); i++) {
                    logToCallback("  " + lines[i].trim());
                }
            } catch (Error e) {
                Log.e(TAG, "AUDIO THREAD ERROR: " + e.getClass().getName() + ": " + e.getMessage());
                logToCallback("ERROR: " + e.getClass().getSimpleName() + ": " + e.getMessage());
                throw e;
            } finally {
                // Clean up in thread
                if (threadAudioRecord != null) {
                    try {
                        if (threadAudioRecord.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) {
                            threadAudioRecord.stop();
                        }
                        threadAudioRecord.release();
                    } catch (Exception e) {
                        Log.e(TAG, "Error releasing AudioRecord: " + e.getMessage());
                    }
                }
                if (threadRecognizer != null) {
                    try {
                        threadRecognizer.close();
                    } catch (Exception e) {
                        Log.e(TAG, "Error closing Recognizer: " + e.getMessage());
                    }
                }
                isListening = false;
                logToCallback("Thread cleanup complete");
            }
        }, "VoskRecordingThread");

        recordingThread.start();
        Log.i(TAG, "Started Vosk recording thread");
    }

    private void stopListeningInternal() {
        // Cancel any pending start request
        pendingListeningRequest = false;
        
        // Signal thread to stop - cleanup happens in thread's finally block
        isListening = false;

        if (recordingThread != null) {
            recordingThread.interrupt();
            recordingThread = null;
        }
    }

    private String parseVoskResult(String json) {
        try {
            JSONObject obj = new JSONObject(json);
            return obj.optString("text", "").trim();
        } catch (Exception e) {
            return "";
        }
    }

    @Override
    public void onDestroy() {
        stopSession();
        if (model != null) {
            model.close();
        }
        if (tts != null) {
            tts.shutdown();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return binder; }
}

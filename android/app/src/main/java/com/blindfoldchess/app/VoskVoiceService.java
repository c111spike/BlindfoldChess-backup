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

    public interface VoiceCallback {
        void onSpeechResult(String text);
        void onGameLog(String message);
    }
    private VoiceCallback callback;
    private final IBinder binder = new LocalBinder();

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
                        if ("KEEP_LISTENING".equals(utteranceId) && isSessionActive) {
                            mainHandler.postDelayed(() -> startListeningInternal(), 100);
                        }
                    }
                    @Override
                    public void onError(String utteranceId) {
                        isTtsSpeaking = false;
                    }
                });
            }
        });
    }

    private void initVoskModel() {
        StorageService.unpack(this, "vosk-model", "model",
            (model) -> {
                this.model = model;
                this.modelLoaded = true;
                Log.i(TAG, "Vosk model loaded successfully");
            },
            (exception) -> {
                Log.e(TAG, "Failed to load Vosk model: " + exception.getMessage());
            }
        );
    }

    public void setCallback(VoiceCallback cb) { this.callback = cb; }

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

    private void startListeningInternal() {
        if (isListening || !modelLoaded || !isSessionActive) return;

        try {
            recognizer = new Recognizer(model, SAMPLE_RATE);
            
            int bufferSize = AudioRecord.getMinBufferSize(
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            );
            bufferSize = Math.max(bufferSize, 4096);

            audioRecord = new AudioRecord(
                MediaRecorder.AudioSource.VOICE_RECOGNITION,
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufferSize
            );

            if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                Log.e(TAG, "AudioRecord failed to initialize");
                return;
            }

            isListening = true;
            audioRecord.startRecording();

            recordingThread = new Thread(() -> {
                byte[] buffer = new byte[4096];
                long silenceStart = 0;
                boolean hasSpeech = false;

                while (isListening && isSessionActive) {
                    int read = audioRecord.read(buffer, 0, buffer.length);
                    if (read > 0) {
                        boolean hasResult = recognizer.acceptWaveForm(buffer, read);
                        
                        if (hasResult) {
                            String result = recognizer.getResult();
                            String text = parseVoskResult(result);
                            if (text != null && !text.isEmpty()) {
                                hasSpeech = true;
                                final String finalText = text;
                                mainHandler.post(() -> {
                                    if (callback != null) callback.onSpeechResult(finalText);
                                });
                                stopListeningInternal();
                                return;
                            }
                        } else {
                            String partial = recognizer.getPartialResult();
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
                            String finalResult = recognizer.getFinalResult();
                            String text2 = parseVoskResult(finalResult);
                            if (text2 != null && !text2.isEmpty()) {
                                final String finalText = text2;
                                mainHandler.post(() -> {
                                    if (callback != null) callback.onSpeechResult(finalText);
                                });
                            }
                            stopListeningInternal();
                            if (isSessionActive && !isTtsSpeaking) {
                                mainHandler.postDelayed(() -> startListeningInternal(), 200);
                            }
                            return;
                        }
                    }
                }

                String finalResult = recognizer.getFinalResult();
                String text = parseVoskResult(finalResult);
                if (text != null && !text.isEmpty()) {
                    final String finalText = text;
                    mainHandler.post(() -> {
                        if (callback != null) callback.onSpeechResult(finalText);
                    });
                }
            }, "VoskRecordingThread");

            recordingThread.start();
            Log.i(TAG, "Started Vosk listening");

        } catch (IOException e) {
            Log.e(TAG, "Failed to start listening: " + e.getMessage());
            isListening = false;
        }
    }

    private void stopListeningInternal() {
        isListening = false;
        
        if (audioRecord != null) {
            try {
                if (audioRecord.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) {
                    audioRecord.stop();
                }
                audioRecord.release();
            } catch (Exception e) {
                Log.e(TAG, "Error stopping AudioRecord: " + e.getMessage());
            }
            audioRecord = null;
        }

        if (recognizer != null) {
            try {
                recognizer.close();
            } catch (Exception e) {
                Log.e(TAG, "Error closing recognizer: " + e.getMessage());
            }
            recognizer = null;
        }

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

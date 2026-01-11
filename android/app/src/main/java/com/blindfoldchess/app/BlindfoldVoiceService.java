package com.blindfoldchess.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Binder;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import java.util.ArrayList;
import java.util.Locale;

public class BlindfoldVoiceService extends Service implements RecognitionListener, AudioManager.OnAudioFocusChangeListener {
    private static final String TAG = "BlindfoldVoiceService";
    private static final String CHANNEL_ID = "BlindfoldGameChannel";
    private static final int NOTIFICATION_ID = 12345;

    private SpeechRecognizer speechRecognizer;
    private TextToSpeech tts;
    private Intent recognizerIntent;
    private AudioManager audioManager;
    private AudioFocusRequest focusRequest;

    private boolean isListening = false;
    private boolean isTtsReady = false;
    private boolean isSessionActive = false;
    private boolean wasListeningBeforeInterrupt = false;

    public interface VoiceCallback {
        void onSpeechResult(String text);
        void onGameLog(String message);
    }
    private VoiceCallback callback;
    private final IBinder binder = new LocalBinder();

    public class LocalBinder extends Binder {
        BlindfoldVoiceService getService() { return BlindfoldVoiceService.this; }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        createNotificationChannel();
        initTTS();
        initSpeechRecognizer();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Don't start foreground immediately - wait for startSession() call from JS
        // This prevents the notification from appearing until a voice game actually starts
        return START_NOT_STICKY; // Don't restart if killed - requires JS client to restart
    }

    private boolean requestAudioFocus() {
        if (audioManager == null) return false;

        int result;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes playbackAttributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_GAME)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build();

            focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
                    .setAudioAttributes(playbackAttributes)
                    .setAcceptsDelayedFocusGain(true)
                    .setOnAudioFocusChangeListener(this)
                    .build();

            result = audioManager.requestAudioFocus(focusRequest);
        } else {
            result = audioManager.requestAudioFocus(this,
                    AudioManager.STREAM_MUSIC,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE);
        }
        return result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
    }

    private void abandonAudioFocus() {
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && focusRequest != null) {
            audioManager.abandonAudioFocusRequest(focusRequest);
        } else {
            audioManager.abandonAudioFocus(this);
        }
    }

    @Override
    public void onAudioFocusChange(int focusChange) {
        switch (focusChange) {
            case AudioManager.AUDIOFOCUS_GAIN:
                Log.d(TAG, "Audio Focus GAINED");
                if (isSessionActive && wasListeningBeforeInterrupt) {
                    startListeningInternal();
                }
                break;
            case AudioManager.AUDIOFOCUS_LOSS:
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                Log.d(TAG, "Audio Focus LOST");
                wasListeningBeforeInterrupt = isListening;
                stopListeningInternal();
                if (tts != null && tts.isSpeaking()) {
                    tts.stop();
                }
                break;
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Blindfold Chess Voice", NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Keeps the chess voice engine running in the background");
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    public void startForegroundSession() {
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Blindfold Chess Active")
            .setContentText("Listening for moves...")
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
        abandonAudioFocus();
        // NOTE: Don't null callback here - it will be re-established by startSession
        // Don't call stopSelf() - service stays bound for quick restart
    }

    @Override
    public void onDestroy() {
        stopSession();
        if (speechRecognizer != null) speechRecognizer.destroy();
        if (tts != null) tts.shutdown();
        super.onDestroy();
    }

    private void initTTS() {
        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                tts.setLanguage(Locale.US);
                isTtsReady = true;
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override
                    public void onStart(String utteranceId) {
                        stopListeningInternal();
                    }

                    @Override
                    public void onDone(String utteranceId) {
                        if ("KEEP_LISTENING".equals(utteranceId) && isSessionActive) {
                            new Handler(Looper.getMainLooper()).post(() -> startListeningInternal());
                        }
                    }

                    @Override
                    public void onError(String utteranceId) {
                        Log.e(TAG, "TTS Error");
                    }
                });
            }
        });
    }

    private void initSpeechRecognizer() {
        if (speechRecognizer != null) speechRecognizer.destroy();
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
        speechRecognizer.setRecognitionListener(this);

        recognizerIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.US);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
    }

    public void setCallback(VoiceCallback cb) { this.callback = cb; }

    public void speakAndListen(String text) {
        if (!isTtsReady || !isSessionActive) {
            if (callback != null) callback.onGameLog("TTS Not Ready or Session Inactive");
            return;
        }
        requestAudioFocus();
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "KEEP_LISTENING");
    }

    public void speakOnly(String text) {
        if (!isTtsReady) {
            if (callback != null) callback.onGameLog("TTS Not Ready");
            return;
        }
        requestAudioFocus();
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "JUST_SPEAK");
    }

    public void startListening() {
        if (isSessionActive) {
            requestAudioFocus();
            startListeningInternal();
        }
    }

    public void stopListening() { stopListeningInternal(); }

    private void startListeningInternal() {
        new Handler(Looper.getMainLooper()).post(() -> {
            if (!isListening && speechRecognizer != null && isSessionActive) {
                try {
                    speechRecognizer.startListening(recognizerIntent);
                    isListening = true;
                    if (callback != null) callback.onGameLog("Mic Started");
                } catch (Exception e) {
                    Log.e(TAG, "Start listening failed", e);
                    initSpeechRecognizer();
                }
            }
        });
    }

    private void stopListeningInternal() {
        new Handler(Looper.getMainLooper()).post(() -> {
            if (isListening && speechRecognizer != null) {
                speechRecognizer.stopListening();
                isListening = false;
            }
        });
    }

    @Override
    public void onResults(Bundle results) {
        isListening = false;
        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (matches != null && !matches.isEmpty()) {
            if (callback != null) callback.onSpeechResult(matches.get(0));
        }
        // AUTO-RESTART: Keep listening after processing results
        if (isSessionActive) {
            startListeningInternal();
        }
    }

    @Override
    public void onError(int error) {
        isListening = false;
        String errorMsg = "Mic Error: " + error;

        if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
            if (isSessionActive) startListeningInternal();
        } else {
            Log.w(TAG, errorMsg);
            if (callback != null) callback.onGameLog(errorMsg);

            if (error == SpeechRecognizer.ERROR_CLIENT || error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY) {
                new Handler(Looper.getMainLooper()).postDelayed(this::startListeningInternal, 500);
            }
        }
    }

    @Override public void onReadyForSpeech(Bundle params) {}
    @Override public void onBeginningOfSpeech() {}
    @Override public void onRmsChanged(float rmsdB) {}
    @Override public void onBufferReceived(byte[] buffer) {}
    @Override public void onEndOfSpeech() {}
    @Override public void onPartialResults(Bundle partialResults) {}
    @Override public void onEvent(int eventType, Bundle params) {}

    @Override
    public IBinder onBind(Intent intent) { return binder; }
}

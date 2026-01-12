import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export interface PermissionStatus {
  mic: 'granted' | 'denied' | 'prompt';
  notify: 'granted' | 'denied' | 'prompt';
}

export interface BlindfoldNativePlugin {
  waitUntilReady(): Promise<void>;
  checkPermissions(): Promise<PermissionStatus>;
  requestPermissions(): Promise<PermissionStatus>;
  startSession(): Promise<void>;
  stopSession(): Promise<void>;
  startListening(): Promise<void>;
  speakAndListen(options: { text: string }): Promise<void>;
  speakOnly(options: { text: string }): Promise<void>;
  addListener(
    eventName: 'onSpeechResult',
    listenerFunc: (data: { text: string }) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'onGameLog',
    listenerFunc: (data: { message: string }) => void
  ): Promise<PluginListenerHandle>;
}

const BlindfoldNative = registerPlugin<BlindfoldNativePlugin>('BlindfoldNative');

// Global voice readiness tracking - voice modes await this before starting sessions
let voiceReadyResolve: (() => void) | null = null;
let voiceReadyReject: ((err: Error) => void) | null = null;
const voiceReadyPromise = new Promise<void>((resolve, reject) => {
  voiceReadyResolve = resolve;
  voiceReadyReject = reject;
});

let voiceReadyCompleted = false;
let voicePermissionGranted = false;

export function markVoiceReady(granted: boolean) {
  voicePermissionGranted = granted;
  voiceReadyCompleted = true;
  if (granted && voiceReadyResolve) {
    voiceReadyResolve();
  } else if (!granted && voiceReadyReject) {
    voiceReadyReject(new Error('Mic permission denied'));
  }
}

export function isVoicePermissionGranted(): boolean {
  return voicePermissionGranted;
}

export async function waitForVoiceReady(): Promise<boolean> {
  if (voiceReadyCompleted) {
    return voicePermissionGranted;
  }
  try {
    await voiceReadyPromise;
    return true;
  } catch {
    return false;
  }
}

export default BlindfoldNative;

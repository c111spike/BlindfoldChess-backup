import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export interface PermissionStatus {
  mic: 'granted' | 'denied' | 'prompt';
  notify: 'granted' | 'denied' | 'prompt';
}

// Debug state for voice system diagnostics
export interface VoiceDebugState {
  permissionStatus: string;
  modelReady: boolean;
  sessionActive: boolean;
  micListening: boolean;
  lastResult: string;
  lastError: string;
  timestamp: number;
}

const debugState: VoiceDebugState = {
  permissionStatus: 'unknown',
  modelReady: false,
  sessionActive: false,
  micListening: false,
  lastResult: '',
  lastError: '',
  timestamp: Date.now(),
};

type DebugListener = (state: VoiceDebugState) => void;
const debugListeners: Set<DebugListener> = new Set();

export function getVoiceDebugState(): VoiceDebugState {
  return { ...debugState };
}

export function subscribeToVoiceDebug(listener: DebugListener): () => void {
  debugListeners.add(listener);
  listener({ ...debugState });
  return () => debugListeners.delete(listener);
}

function updateDebugState(updates: Partial<VoiceDebugState>) {
  Object.assign(debugState, updates, { timestamp: Date.now() });
  debugListeners.forEach(l => l({ ...debugState }));
}

export function debugSetPermission(status: string) {
  updateDebugState({ permissionStatus: status });
}

export function debugSetModelReady(ready: boolean) {
  updateDebugState({ modelReady: ready });
}

export function debugSetSessionActive(active: boolean) {
  updateDebugState({ sessionActive: active });
}

export function debugSetMicListening(listening: boolean) {
  updateDebugState({ micListening: listening });
}

export function debugSetLastResult(result: string) {
  updateDebugState({ lastResult: result });
}

export function debugSetLastError(error: string) {
  updateDebugState({ lastError: error });
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

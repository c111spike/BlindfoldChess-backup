import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export interface PermissionStatus {
  mic: 'granted' | 'denied' | 'prompt';
  notify: 'granted' | 'denied' | 'prompt';
}

export interface BlindfoldNativePlugin {
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

export default BlindfoldNative;

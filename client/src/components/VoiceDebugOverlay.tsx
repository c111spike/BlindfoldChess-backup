import { useState, useEffect } from 'react';
import { subscribeToVoiceDebug, type VoiceDebugState } from '@/lib/nativeVoice';
import { Mic, MicOff, Check, X, AlertCircle } from 'lucide-react';

export function VoiceDebugOverlay() {
  const [state, setState] = useState<VoiceDebugState | null>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    return subscribeToVoiceDebug(setState);
  }, []);

  if (!state) return null;

  const StatusIcon = ({ ok }: { ok: boolean }) => 
    ok ? <Check className="w-3 h-3 text-green-400" /> : <X className="w-3 h-3 text-red-400" />;

  return (
    <div 
      className="fixed bottom-4 left-4 z-50 bg-black/90 text-white text-xs rounded-lg shadow-lg max-w-[280px]"
      onClick={() => setExpanded(!expanded)}
      data-testid="voice-debug-overlay"
    >
      <div className="flex items-center gap-2 p-2 border-b border-white/20">
        {state.micListening ? (
          <Mic className="w-4 h-4 text-green-400 animate-pulse" />
        ) : (
          <MicOff className="w-4 h-4 text-red-400" />
        )}
        <span className="font-bold">Voice Debug</span>
        <span className="text-white/50 ml-auto">{expanded ? '▼' : '▲'}</span>
      </div>
      
      {expanded && (
        <div className="p-2 space-y-1">
          <div className="flex items-center gap-2">
            <StatusIcon ok={state.permissionStatus === 'granted'} />
            <span>Permission: {state.permissionStatus}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <StatusIcon ok={state.modelReady} />
            <span>Model Ready: {state.modelReady ? 'Yes' : 'No'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <StatusIcon ok={state.sessionActive} />
            <span>Session Active: {state.sessionActive ? 'Yes' : 'No'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <StatusIcon ok={state.micListening} />
            <span>Mic Listening: {state.micListening ? 'Yes' : 'No'}</span>
          </div>
          
          {state.lastResult && (
            <div className="mt-2 p-1 bg-green-900/50 rounded">
              <span className="text-green-300">Last: "{state.lastResult}"</span>
            </div>
          )}
          
          {state.lastError && (
            <div className="mt-2 p-1 bg-red-900/50 rounded flex items-start gap-1">
              <AlertCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
              <span className="text-red-300 break-all">{state.lastError}</span>
            </div>
          )}
          
          <div className="text-white/30 mt-1">
            Updated: {new Date(state.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}

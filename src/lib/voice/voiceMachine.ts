/**
 * Máquina de estados de la conversación por voz (función pura, fácil de probar).
 *
 *  off ──START──▶ idle ──(escuchar)──▶ listening ──HEARD_FINAL──▶ processing
 *                                         ▲                           │
 *                                         │                    REPLY_READY(speak)
 *                                    SPEAK_END / INTERRUPT            ▼
 *                                         └──────────────────────  speaking
 *
 * Estados de aviso: muted (micrófono apagado por el usuario), denied (sin permiso),
 * no-device, network (el servicio de voz no responde) y unsupported (el navegador no
 * puede). En todos ellos el chat de texto sigue funcionando.
 */
export type VoicePhase = 'off' | 'idle' | 'listening' | 'processing' | 'speaking' | 'muted' | 'denied' | 'no-device' | 'network' | 'unsupported'

export interface VoiceState {
  phase: VoicePhase
  /** Texto parcial mientras el usuario habla. */
  interim: string
  /** Última frase completa que se entendió. */
  heard: string
  micOn: boolean
  audioOn: boolean
  /** Silencios seguidos sin oír nada (evita reabrir el micrófono para siempre). */
  silences: number
  /** Avisos no bloqueantes. */
  notice: null | 'no-voice' | 'no-recognition' | 'no-speech'
}

export type VoiceEvent =
  | { type: 'START'; supported: boolean }
  | { type: 'STOP' }
  | { type: 'LISTEN' }
  | { type: 'HEARD_INTERIM'; text: string }
  | { type: 'HEARD_FINAL'; text: string }
  | { type: 'REPLY_READY'; speak: boolean; noVoice?: boolean }
  | { type: 'SPEAK_END' }
  | { type: 'INTERRUPT' }
  | { type: 'TOGGLE_MIC' }
  | { type: 'TOGGLE_AUDIO' }
  | { type: 'NO_SPEECH' }
  | { type: 'ISSUE'; issue: 'denied' | 'no-device' | 'network' | 'language' | 'other' }
  | { type: 'RETRY' }

export const MAX_SILENCES = 3

export const initialVoiceState: VoiceState = { phase: 'off', interim: '', heard: '', micOn: true, audioOn: true, silences: 0, notice: null }

export function voiceReducer(state: VoiceState, event: VoiceEvent): VoiceState {
  switch (event.type) {
    case 'START':
      return event.supported ? { ...initialVoiceState, phase: 'idle', audioOn: state.audioOn } : { ...initialVoiceState, phase: 'unsupported' }
    case 'STOP':
      return { ...initialVoiceState, audioOn: state.audioOn }
    case 'LISTEN':
      if (state.phase === 'off' || state.phase === 'unsupported') return state
      return state.micOn ? { ...state, phase: 'listening', interim: '', notice: state.notice === 'no-speech' ? null : state.notice } : { ...state, phase: 'muted' }
    case 'HEARD_INTERIM':
      return state.phase === 'listening' ? { ...state, interim: event.text, silences: 0 } : state
    case 'HEARD_FINAL': {
      const text = event.text.trim()
      if (!text || (state.phase !== 'listening' && state.phase !== 'idle')) return state
      return { ...state, phase: 'processing', interim: '', heard: text, silences: 0, notice: null }
    }
    case 'REPLY_READY':
      if (state.phase !== 'processing') return state
      if (event.speak && state.audioOn) return { ...state, phase: 'speaking' }
      return { ...state, phase: state.micOn ? 'listening' : 'muted', notice: event.noVoice ? 'no-voice' : state.notice }
    case 'SPEAK_END':
      return state.phase === 'speaking' ? { ...state, phase: state.micOn ? 'listening' : 'muted' } : state
    case 'INTERRUPT':
      return state.phase === 'speaking' ? { ...state, phase: state.micOn ? 'listening' : 'muted' } : state
    case 'TOGGLE_MIC': {
      const micOn = !state.micOn
      if (state.phase === 'off' || state.phase === 'unsupported') return { ...state, micOn }
      if (!micOn && (state.phase === 'listening' || state.phase === 'idle')) return { ...state, micOn, phase: 'muted', interim: '' }
      if (micOn && state.phase === 'muted') return { ...state, micOn, phase: 'listening' }
      return { ...state, micOn }
    }
    case 'TOGGLE_AUDIO':
      return { ...state, audioOn: !state.audioOn, notice: state.notice === 'no-voice' ? null : state.notice }
    case 'NO_SPEECH': {
      if (state.phase !== 'listening') return state
      const silences = state.silences + 1
      return silences >= MAX_SILENCES ? { ...state, phase: 'idle', interim: '', silences: 0, notice: 'no-speech' } : { ...state, silences }
    }
    case 'ISSUE':
      if (event.issue === 'denied') return { ...state, phase: 'denied', interim: '' }
      if (event.issue === 'no-device') return { ...state, phase: 'no-device', interim: '' }
      if (event.issue === 'network') return { ...state, phase: 'network', interim: '' }
      if (event.issue === 'language') return { ...state, phase: 'idle', interim: '', notice: 'no-recognition' }
      return { ...state, phase: 'idle', interim: '' }
    case 'RETRY':
      return state.phase === 'denied' || state.phase === 'no-device' || state.phase === 'network' ? { ...state, phase: 'idle', silences: 0, notice: null } : state
  }
}

/** ¿Debe estar abierto el reconocimiento de voz en este estado? */
export const shouldListen = (state: VoiceState): boolean => state.phase === 'listening' && state.micOn

/** El micrófono está capturando (indicador visible y permanente mientras sea true). */
export const micIsActive = (state: VoiceState): boolean => shouldListen(state)

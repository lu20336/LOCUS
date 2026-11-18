/**
 * Conversación por voz con el agente de LOCUS (navegador: Web Speech API).
 *
 * Responsabilidades de este hook (la lógica de estados vive en voiceMachine.ts):
 *  - Abrir/cerrar el reconocimiento de voz SOLO mientras se escucha (nada de micrófono
 *    abierto en reposo, mientras piensa o mientras LOCUS habla).
 *  - Pedir el permiso del micrófono únicamente cuando el usuario activa la voz.
 *  - Hablar las respuestas con la voz instalada para el idioma (si no hay, lo dice: no se simula).
 *  - Medir el nivel del micrófono SOLO para animar la esfera; el audio nunca se graba ni se envía a LOCUS.
 *
 * La entrega de la respuesta es responsabilidad del llamador: llama a `deliver(texto, idioma)`
 * cuando el agente responde (o `deliver(null)` si falló) para que LOCUS hable y vuelva a escuchar.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type MutableRefObject } from 'react'
import { LOCALE_META, type Locale } from '../i18n/locales'
import { logAgentEvent } from '../agent/telemetry'
import { cleanForSpeech, getRecognitionCtor, isRecognitionSupported, isSynthesisSupported, mapRecognitionError, pickVoice, splitForSpeech, type RecognitionLike } from './speech'
import { initialVoiceState, micIsActive, shouldListen, voiceReducer, type VoiceState } from './voiceMachine'

export interface UseVoiceOptions {
  /** Idioma de la conversación (reconocimiento y, por defecto, voz). */
  language: Locale
  /** Frase completa entendida: el llamador la envía al agente. */
  onFinal: (text: string) => void
}

export interface VoiceApi {
  state: VoiceState
  supported: { recognition: boolean; synthesis: boolean }
  /** Nivel 0..1 del micrófono o de la voz (se lee en un bucle de animación, sin re-renderizar). */
  levelRef: MutableRefObject<number>
  start: () => void
  stop: () => void
  listen: () => void
  interrupt: () => void
  toggleMic: () => void
  toggleAudio: () => void
  retry: () => void
  /** Entrega la respuesta del agente: la habla (si procede) y vuelve a escuchar. `null` = no hay nada que decir (falló). */
  deliver: (text: string | null, language?: Locale) => void
}

export function useVoiceConversation({ language, onFinal }: UseVoiceOptions): VoiceApi {
  const [state, dispatch] = useReducer(voiceReducer, initialVoiceState)
  const stateRef = useRef(state)
  stateRef.current = state
  const onFinalRef = useRef(onFinal)
  onFinalRef.current = onFinal
  const levelRef = useRef(0)
  const recRef = useRef<RecognitionLike | null>(null)
  const restartTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const utterances = useRef<SpeechSynthesisUtterance[]>([])
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])
  const [voicesVersion, setVoicesVersion] = useState(0)

  const supported = useMemo(() => ({ recognition: isRecognitionSupported(), synthesis: isSynthesisSupported() }), [])

  /* ── Voces del sistema (cargan de forma asíncrona) ── */
  useEffect(() => {
    if (!supported.synthesis) return
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices()
      setVoicesVersion((v) => v + 1)
    }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [supported.synthesis])

  /* ── Reconocimiento: abierto solo mientras se escucha ── */
  const stopRecognition = useCallback(() => {
    clearTimeout(restartTimer.current)
    const rec = recRef.current
    recRef.current = null
    if (!rec) return
    rec.onresult = rec.onerror = rec.onend = rec.onstart = null
    try {
      rec.abort()
    } catch {
      // ya estaba detenido
    }
  }, [])

  const startRecognition = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor || recRef.current) return
    const rec = new Ctor()
    rec.lang = LOCALE_META[language].speech
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1
    const startedAt = performance.now()
    rec.onresult = (event) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const piece = result[0]?.transcript ?? ''
        if (result.isFinal) final += piece
        else interim += piece
      }
      if (final.trim()) {
        dispatch({ type: 'HEARD_FINAL', text: final })
        stopRecognition()
        logAgentEvent({ provider: 'speech', kind: 'voice', name: 'recognition', durationMs: Math.round(performance.now() - startedAt), status: 'ok', retries: 0 })
        onFinalRef.current(final.trim())
      } else if (interim) dispatch({ type: 'HEARD_INTERIM', text: interim })
    }
    rec.onerror = (event) => {
      const issue = mapRecognitionError(event.error)
      if (issue === 'aborted') return
      if (issue === 'no-speech') return dispatch({ type: 'NO_SPEECH' })
      logAgentEvent({ provider: 'speech', kind: 'voice', name: 'recognition', durationMs: Math.round(performance.now() - startedAt), status: 'error', errorCode: event.error, retries: 0, cause: issue === 'language' ? 'unsupported' : undefined })
      stopRecognition()
      dispatch({ type: 'ISSUE', issue: issue === 'other' ? 'other' : issue })
    }
    rec.onend = () => {
      recRef.current = null
      // El reconocimiento termina solo tras un silencio: si seguimos escuchando, se reabre (conversación fluida).
      if (shouldListen(stateRef.current)) restartTimer.current = setTimeout(startRecognition, 250)
    }
    recRef.current = rec
    try {
      rec.start()
    } catch {
      recRef.current = null
    }
  }, [language, stopRecognition])

  const listening = shouldListen(state)
  useEffect(() => {
    if (listening) startRecognition()
    else stopRecognition()
    return stopRecognition
    // Cambiar de idioma reabre el reconocimiento con el nuevo idioma.
  }, [listening, language, startRecognition, stopRecognition])

  /* ── Nivel del micrófono (solo para animar la esfera; no se graba nada) ── */
  const micActive = micIsActive(state)
  useEffect(() => {
    if (!micActive) return
    let cancelled = false
    let stream: MediaStream | null = null
    let ctx: AudioContext | null = null
    let raf = 0
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
        if (cancelled) return stream.getTracks().forEach((t) => t.stop())
        ctx = new AudioContext()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        ctx.createMediaStreamSource(stream).connect(analyser)
        const data = new Uint8Array(analyser.fftSize)
        const tick = () => {
          analyser.getByteTimeDomainData(data)
          let sum = 0
          for (const v of data) sum += ((v - 128) / 128) ** 2
          const rms = Math.sqrt(sum / data.length)
          levelRef.current = Math.min(1, rms * 5)
          raf = requestAnimationFrame(tick)
        }
        tick()
      } catch {
        // Sin medidor la esfera usa una animación suave; el reconocimiento informa de los permisos.
      }
    })()
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
      void ctx?.close().catch(() => undefined)
      levelRef.current = 0
    }
  }, [micActive])

  /* ── Hablar ── */
  const cancelSpeech = useCallback(() => {
    if (supported.synthesis) window.speechSynthesis.cancel()
    utterances.current = []
  }, [supported.synthesis])

  const deliver = useCallback(
    (text: string | null, lang: Locale = language) => {
      const cleaned = text ? cleanForSpeech(text).slice(0, 1400) : ''
      if (!cleaned || !stateRef.current.audioOn) return dispatch({ type: 'REPLY_READY', speak: false })
      if (!supported.synthesis) return dispatch({ type: 'REPLY_READY', speak: false, noVoice: true })
      const voice = pickVoice(voicesRef.current, lang)
      if (!voice) return dispatch({ type: 'REPLY_READY', speak: false, noVoice: true })

      cancelSpeech()
      dispatch({ type: 'REPLY_READY', speak: true })
      const chunks = splitForSpeech(cleaned)
      const started = performance.now()
      utterances.current = chunks.map((chunk, index) => {
        const u = new SpeechSynthesisUtterance(chunk)
        u.voice = voice
        u.lang = voice.lang
        u.rate = 1
        u.pitch = 1
        u.onboundary = () => {
          levelRef.current = 0.55 + Math.random() * 0.4
        }
        const finish = () => {
          if (index === chunks.length - 1) {
            levelRef.current = 0
            logAgentEvent({ provider: 'speech', kind: 'voice', name: 'synthesis', durationMs: Math.round(performance.now() - started), status: 'ok', retries: 0 })
            dispatch({ type: 'SPEAK_END' })
          }
        }
        u.onend = finish
        u.onerror = (e) => {
          // "interrupted"/"canceled": el usuario interrumpió; ya se gestionó.
          if (e.error !== 'interrupted' && e.error !== 'canceled') finish()
        }
        return u
      })
      for (const u of utterances.current) window.speechSynthesis.speak(u)
    },
    // voicesVersion: al llegar nuevas voces se vuelve a elegir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language, supported.synthesis, cancelSpeech, voicesVersion],
  )

  // Mientras LOCUS habla, el nivel late de forma natural entre palabras.
  const speaking = state.phase === 'speaking'
  useEffect(() => {
    if (!speaking) return
    const id = setInterval(() => {
      levelRef.current = Math.max(levelRef.current * 0.7, 0.25 + Math.random() * 0.25)
    }, 140)
    return () => clearInterval(id)
  }, [speaking])

  /* ── Acciones ── */
  const start = useCallback(() => {
    dispatch({ type: 'START', supported: isRecognitionSupported() })
    dispatch({ type: 'LISTEN' })
  }, [])
  const stop = useCallback(() => {
    stopRecognition()
    cancelSpeech()
    dispatch({ type: 'STOP' })
  }, [stopRecognition, cancelSpeech])
  const interrupt = useCallback(() => {
    cancelSpeech()
    dispatch({ type: 'INTERRUPT' })
  }, [cancelSpeech])
  const listen = useCallback(() => dispatch({ type: 'LISTEN' }), [])
  const toggleMic = useCallback(() => dispatch({ type: 'TOGGLE_MIC' }), [])
  const toggleAudio = useCallback(() => {
    if (stateRef.current.audioOn) cancelSpeech()
    dispatch({ type: 'TOGGLE_AUDIO' })
    if (stateRef.current.phase === 'speaking' && stateRef.current.audioOn) dispatch({ type: 'SPEAK_END' })
  }, [cancelSpeech])
  const retry = useCallback(() => {
    dispatch({ type: 'RETRY' })
    dispatch({ type: 'LISTEN' })
  }, [])

  // Al salir (cierre del panel, cambio de página) se libera todo.
  useEffect(() => () => {
    stopRecognition()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [stopRecognition])

  return { state, supported, levelRef, start, stop, listen, interrupt, toggleMic, toggleAudio, retry, deliver }
}

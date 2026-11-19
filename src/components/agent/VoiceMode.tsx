/**
 * Contenedor del modo de voz. Solo se monta mientras el usuario está en una
 * conversación por voz: cuando no está, no hay micrófono, reconocimiento ni
 * escuchas de eventos (cero consumo en reposo).
 */
import { useEffect, useImperativeHandle, useState, type ReactNode, type Ref } from 'react'
import type { Locale } from '../../lib/i18n/locales'
import { primeSpeech } from '../../lib/voice/speech'
import { useVoiceConversation, type VoiceApi } from '../../lib/voice/useVoiceConversation'
import { VoicePanel } from './VoicePanel'

const CONSENT_KEY = 'locus:voice:consent:v1'

const hasConsent = () => {
  try {
    return localStorage.getItem(CONSENT_KEY) === '1'
  } catch {
    return false
  }
}

/** Lo que el agente necesita del modo de voz. */
export interface VoiceHandle {
  deliver: VoiceApi['deliver']
}

export function VoiceMode({
  language,
  onLanguage,
  onFinal,
  onEnd,
  agentStatus,
  transcript,
  handle,
}: {
  language: Locale
  onLanguage: (language: Locale) => void
  /** Frase completa entendida: se envía al agente. */
  onFinal: (text: string) => void
  onEnd: () => void
  agentStatus: string | null
  transcript: ReactNode
  handle: Ref<VoiceHandle>
}) {
  const [consent, setConsent] = useState(hasConsent)
  const voice = useVoiceConversation({ language, onFinal })
  useImperativeHandle(handle, () => ({ deliver: voice.deliver }), [voice.deliver])

  // El permiso del micrófono se pide únicamente al empezar a escuchar, y solo tras el consentimiento.
  useEffect(() => {
    if (consent) voice.start()
    // start es estable; se ejecuta una vez al aceptar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consent])

  const accept = () => {
    primeSpeech()
    try {
      localStorage.setItem(CONSENT_KEY, '1')
    } catch {
      // sin almacenamiento: se pedirá de nuevo la próxima vez
    }
    setConsent(true)
  }

  return (
    <VoicePanel
      voice={voice}
      language={language}
      onLanguage={onLanguage}
      agentStatus={agentStatus}
      consentGiven={consent}
      onConsent={accept}
      onEnd={() => {
        voice.stop()
        onEnd()
      }}
      transcript={transcript}
    />
  )
}

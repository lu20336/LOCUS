/**
 * Modo de voz del compañero LOCUS: esfera animada, estados claros, controles de
 * audio y la conversación escrita siempre a un toque. Es otra MODALIDAD del mismo
 * agente (no un asistente aparte): lo que se dice y lo que se responde se escribe
 * en el mismo chat.
 */
import { MessageSquareText, Mic, MicOff, PhoneOff, Square, Volume2, VolumeX } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { LOCALES, LOCALE_META, type Locale } from '../../lib/i18n/locales'
import type { VoiceApi } from '../../lib/voice/useVoiceConversation'
import { micIsActive } from '../../lib/voice/voiceMachine'
import { VoiceOrb, type OrbState } from './VoiceOrb'

const ORB: Record<string, OrbState> = {
  off: 'idle',
  idle: 'idle',
  listening: 'listening',
  processing: 'processing',
  speaking: 'speaking',
  muted: 'muted',
  denied: 'error',
  'no-device': 'error',
  network: 'error',
  unsupported: 'unsupported',
}

export function VoicePanel({
  voice,
  language,
  onLanguage,
  agentStatus,
  consentGiven,
  onConsent,
  onEnd,
  transcript,
}: {
  voice: VoiceApi
  language: Locale
  onLanguage: (language: Locale) => void
  /** Texto de lo que hace el agente ahora (herramienta, reintento…), si lo hay. */
  agentStatus: string | null
  consentGiven: boolean
  onConsent: () => void
  onEnd: () => void
  /** Conversación escrita (misma lista del chat). */
  transcript: ReactNode
}) {
  const { t } = useI18n()
  const [showText, setShowText] = useState(false)
  const { state } = voice
  const phase = state.phase

  const caption =
    phase === 'listening' ? t('voice.state.listening')
    : phase === 'processing' ? agentStatus ?? t('voice.state.processing')
    : phase === 'speaking' ? t('voice.state.speaking')
    : phase === 'muted' ? t('voice.state.muted')
    : phase === 'denied' ? t('voice.state.denied')
    : phase === 'no-device' ? t('voice.state.noDevice')
    : phase === 'network' ? t('voice.state.network')
    : phase === 'unsupported' ? t('voice.state.unsupported')
    : t('voice.state.idle')

  const hint =
    phase === 'denied' ? t('voice.hint.denied')
    : phase === 'no-device' ? t('voice.hint.noDevice')
    : phase === 'network' ? t('voice.hint.network')
    : phase === 'unsupported' ? t('voice.hint.unsupported')
    : state.notice === 'no-voice' ? t('voice.hint.noVoice')
    : state.notice === 'no-recognition' ? t('voice.hint.noRecognition', { language: LOCALE_META[language].nativeName })
    : state.notice === 'no-speech' ? t('voice.noSpeech')
    : null

  const orbLabel =
    phase === 'speaking' ? t('voice.interrupt')
    : phase === 'listening' ? t('voice.mic.disable')
    : phase === 'muted' ? t('voice.mic.enable')
    : phase === 'denied' || phase === 'no-device' || phase === 'network' ? t('voice.retry')
    : caption

  function onOrb() {
    if (phase === 'speaking') voice.interrupt()
    else if (phase === 'listening' || phase === 'muted') voice.toggleMic()
    else if (phase === 'denied' || phase === 'no-device' || phase === 'network') voice.retry()
    else if (phase === 'idle') voice.listen()
  }

  const control = 'grid size-12 place-items-center rounded-full border border-line bg-surface text-ink transition hover:bg-surface-2 focus-visible:outline-offset-4'

  if (!consentGiven) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="orb-wrap"><VoiceOrb state="idle" levelRef={voice.levelRef} label={t('voice.consent.title')} onClick={() => undefined} size="8rem" /></div>
        <h3 className="font-serif text-xl font-semibold text-navy">{t('voice.consent.title')}</h3>
        <p className="max-w-sm text-sm text-muted">{t('voice.consent.body')}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={onConsent} className="rounded-xl bg-coral px-5 py-2.5 font-bold text-on-coral transition hover:brightness-105">{t('voice.consent.accept')}</button>
          <button type="button" onClick={onEnd} className="rounded-xl border border-line px-5 py-2.5 font-semibold text-ink transition hover:bg-surface-2">{t('voice.consent.cancel')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <label className="flex items-center gap-2 text-xs font-semibold text-muted">
          <span className="sr-only">{t('voice.language')}</span>
          <select
            value={language}
            onChange={(e) => onLanguage(e.target.value as Locale)}
            aria-label={t('voice.language')}
            className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm font-semibold text-ink focus:border-teal focus:outline-none"
          >
            {LOCALES.map((l) => <option key={l} value={l} lang={l}>{LOCALE_META[l].flag} {LOCALE_META[l].nativeName}</option>)}
          </select>
        </label>
        <p role="status" className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${micIsActive(state) ? 'bg-danger/10 text-danger' : 'bg-surface-2 text-muted'}`}>
          <span aria-hidden="true" className={`size-2 rounded-full ${micIsActive(state) ? 'animate-pulse bg-danger' : 'bg-muted'}`} />
          {micIsActive(state) ? t('voice.micIndicator') : t('voice.mic.off')}
        </p>
      </div>

      {showText ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{transcript}</div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <VoiceOrb state={ORB[phase] ?? 'idle'} levelRef={voice.levelRef} label={orbLabel} onClick={onOrb} size="min(52vw, 13rem)" />
          <p role="status" aria-live="polite" className="font-serif text-xl font-semibold text-navy">{caption}</p>
          {state.interim && <p className="max-w-sm text-sm italic text-muted">“{state.interim}”</p>}
          {!state.interim && state.heard && phase !== 'idle' && <p className="max-w-sm text-sm text-muted"><span className="font-semibold">{t('voice.youSaid')}:</span> “{state.heard}”</p>}
          {hint && <p className="max-w-sm rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink">{hint}</p>}
          {(phase === 'denied' || phase === 'no-device' || phase === 'network' || phase === 'unsupported') && (
            <div className="flex flex-wrap justify-center gap-2">
              {phase !== 'unsupported' && <button type="button" onClick={voice.retry} className="rounded-xl bg-coral px-4 py-2 text-sm font-bold text-on-coral">{t('voice.retry')}</button>}
              <button type="button" onClick={onEnd} className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-2">{t('voice.useText')}</button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-center gap-3 border-t border-line px-4 py-3">
        <button type="button" onClick={voice.toggleMic} aria-pressed={state.micOn} aria-label={state.micOn ? t('voice.mic.disable') : t('voice.mic.enable')} className={control}>
          {state.micOn ? <Mic aria-hidden="true" className="size-5" /> : <MicOff aria-hidden="true" className="size-5 text-danger" />}
        </button>
        <button type="button" onClick={voice.toggleAudio} aria-pressed={state.audioOn} aria-label={state.audioOn ? t('voice.audio.mute') : t('voice.audio.unmute')} className={control}>
          {state.audioOn ? <Volume2 aria-hidden="true" className="size-5" /> : <VolumeX aria-hidden="true" className="size-5 text-danger" />}
        </button>
        {phase === 'speaking' && (
          <button type="button" onClick={voice.interrupt} aria-label={t('voice.interrupt')} className={`${control} border-coral/60 text-coral`}>
            <Square aria-hidden="true" className="size-4 fill-current" />
          </button>
        )}
        <button type="button" onClick={() => setShowText((v) => !v)} aria-pressed={showText} aria-label={showText ? t('voice.hideText') : t('voice.showText')} className={control}>
          <MessageSquareText aria-hidden="true" className="size-5" />
        </button>
        <button type="button" onClick={onEnd} aria-label={t('voice.end')} className="grid size-12 place-items-center rounded-full bg-danger text-white transition hover:brightness-110 focus-visible:outline-offset-4">
          <PhoneOff aria-hidden="true" className="size-5" />
        </button>
      </div>
      <p className="px-4 pb-2 text-center text-[11px] leading-tight text-muted">{t('voice.autoLang')}</p>
    </div>
  )
}

/**
 * "Tu compañero LOCUS": botón flotante disponible en todas las pantallas que
 * abre una conversación con el agente de IA, por texto o por voz (misma
 * inteligencia, mismo contexto, otra modalidad). Conserva el contexto de la
 * conversación, usa el perfil del viajero solo si el usuario lo autorizó y, si
 * la IA no está activada todavía, ofrece un modo guiado que sigue siendo útil.
 *
 * Fiabilidad: un mensaje a la vez (sin duplicados), tiempos máximos, reintentos
 * automáticos con espera progresiva, botón "Detener" y "Reintentar" que reenvía
 * el MISMO mensaje; ver src/lib/agent/agent.ts y docs/AGENTE_IA_AUDITORIA.md.
 */
import { Mic, Square } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router'
import { AgentSession, AgentUnavailableError, describeAiError, toHistory } from '../../lib/agent/agent'
import { UsageLimitError, appendMessage, countMessage, createChat, deleteChat, listChats, loadMessages, type ChatSummary } from '../../lib/agent/chatStore'
import { AGENT_OPEN_EVENT } from '../../lib/agent/openAgent'
import { diagnosticReport } from '../../lib/agent/telemetry'
import { runTool } from '../../lib/agent/tools'
import type { ChatMessage, ToolContext } from '../../lib/agent/types'
import { useAuth } from '../../lib/auth/authContext'
import { db } from '../../lib/firebase/client'
import { todayISO } from '../../lib/format'
import { useI18n } from '../../lib/i18n/I18nProvider'
import type { Locale } from '../../lib/i18n/locales'
import { loadProfile } from '../../lib/profile/profileService'
import { summarize } from '../../lib/profile/survey'
import { detectLanguage, isRecognitionSupported } from '../../lib/voice/speech'
import { useToast } from '../Toast'
import { AgentCardView } from './AgentCards'
import { VoiceMode, type VoiceHandle } from './VoiceMode'

/** Si algo se queda colgado más allá del tiempo máximo del turno, la interfaz se libera sola. */
const WATCHDOG_MS = 115_000

/** Texto simple con negritas **así** y saltos de línea; no interpreta HTML. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <p key={i} className={line.trim() === '' ? 'h-2' : 'leading-relaxed'}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => (part.startsWith('**') && part.endsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : <span key={j}>{part}</span>))}
        </p>
      ))}
    </>
  )
}

export default function AgentWidget() {
  const { t, locale } = useI18n()
  const { user, profile } = useAuth()
  const toast = useToast()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState<AgentUnavailableError | null>(null)
  const [chats, setChats] = useState<ChatSummary[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [voiceMode, setVoiceMode] = useState(false)
  const [voiceLanguage, setVoiceLanguage] = useState<Locale>(locale)
  const sessionRef = useRef<AgentSession | null>(null)
  const chatIdRef = useRef<string | null>(null)
  const profileSummary = useRef<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const busyRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const voiceRef = useRef<VoiceHandle | null>(null)
  const voiceModeRef = useRef(false)
  voiceModeRef.current = voiceMode

  const uid = user?.uid ?? null
  const aiConsent = Boolean(uid && profile?.aiPersonalization)
  const ctx = useMemo<ToolContext>(() => ({ uid, aiConsent, today: todayISO(), locale }), [uid, aiConsent, locale])
  /** Idioma por defecto del agente: el de la voz si se está hablando; si no, el de la interfaz. */
  const agentLanguage: Locale = voiceMode ? voiceLanguage : locale

  // Al cambiar de usuario o de autorización, se empieza una conversación limpia.
  useEffect(() => {
    sessionRef.current = null
    chatIdRef.current = null
    profileSummary.current = null
    setMessages([])
    setChats([])
  }, [uid, aiConsent])

  // El idioma de la interfaz manda salvo que el usuario elija otro para hablar; la conversación se conserva.
  useEffect(() => {
    if (!voiceMode) setVoiceLanguage(locale)
  }, [locale, voiceMode])
  useEffect(() => {
    void sessionRef.current?.setLanguage(agentLanguage)
  }, [agentLanguage])

  // Otras pantallas pueden abrir el compañero (opcionalmente con una pregunta lista).
  useEffect(() => {
    const onOpen = (e: Event) => {
      setOpen(true)
      const prompt = (e as CustomEvent<{ prompt?: string }>).detail?.prompt
      if (prompt) setInput(prompt)
    }
    window.addEventListener(AGENT_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(AGENT_OPEN_EVENT, onOpen)
  }, [])

  useEffect(() => {
    if (!open) return
    if (!voiceMode) inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closePanel()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, voiceMode])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, status, busy, voiceMode])

  // Recuperación de estados bloqueados: si un turno no termina, se corta y se libera la interfaz.
  useEffect(() => {
    if (!busy) return
    const id = setTimeout(() => {
      abortRef.current?.abort()
      busyRef.current = false
      setBusy(false)
      setStatus(null)
    }, WATCHDOG_MS)
    return () => clearTimeout(id)
  }, [busy])

  function closePanel() {
    abortRef.current?.abort()
    setVoiceMode(false)
    setOpen(false)
  }

  /** Pista invisible sobre la pantalla actual (ej. el alojamiento que está viendo). */
  const screenHint = useCallback(() => {
    const listing = location.pathname.match(/^\/hospedajes\/([^/]+)/)
    if (listing) return `[Contexto de pantalla: el usuario está viendo el alojamiento con id ${listing[1]}. Usa get_listing_details si necesitas sus datos.]\n`
    const exp = location.pathname.match(/^\/experiencias\/([^/]+)/)
    if (exp) return `[Contexto de pantalla: el usuario está viendo la experiencia con id ${exp[1]}.]\n`
    const dest = location.pathname.match(/^\/destinos\/([^/]+)/)
    if (dest) return `[Contexto de pantalla: el usuario está viendo la ficha del destino "${dest[1].replaceAll('-', ' ')}".]\n`
    const trip = location.pathname.match(/^\/mis-viajes\/([^/]+)/)
    if (trip) return `[Contexto de pantalla: el usuario está viendo uno de sus viajes guardados.]\n`
    return ''
  }, [location.pathname])

  async function ensureSession(): Promise<AgentSession> {
    if (sessionRef.current) return sessionRef.current
    if (aiConsent && uid && profileSummary.current === null) {
      const p = await loadProfile(db, uid).catch(() => null)
      profileSummary.current = p ? [...summarize(p.declared).map((s) => `- ${s.label}: ${s.answer}`), ...Object.values(p.inferred).map((i) => `- (inferido) ${i.text}`)].join('\n') : ''
    }
    sessionRef.current = new AgentSession(ctx, profileSummary.current || null, toHistory(messages), agentLanguage)
    return sessionRef.current
  }

  /**
   * Envía un mensaje. Un solo mensaje a la vez: `busyRef` es síncrono (el estado de React tarda un
   * render y dos Enter seguidos colaban dos envíos). `retryText` reenvía un mensaje fallido sin
   * duplicarlo en la conversación ni volver a contarlo en el tope diario.
   */
  async function send(raw: string, options: { fromVoice?: boolean; retryText?: string } = {}) {
    const text = (options.retryText ?? raw).trim()
    if (!text || busyRef.current) return
    busyRef.current = true
    const isRetry = options.retryText !== undefined
    const requestId = crypto.randomUUID()
    const controller = new AbortController()
    abortRef.current = controller
    const fromVoice = options.fromVoice || voiceModeRef.current
    if (!isRetry) {
      setMessages((m) => [...m, { id: requestId, role: 'user', text }])
      setInput('')
    } else {
      // El mensaje de error anterior se reemplaza por el nuevo intento.
      setMessages((m) => m.filter((x) => !(x.error && x.retryText === text)))
    }
    setBusy(true)
    setStatus(t('agent.thinking'))
    let spoken: string | null = null
    try {
      if (!isRetry) await countMessage(db, uid, ctx.today)
      const session = await ensureSession()
      if (uid && !chatIdRef.current) chatIdRef.current = await createChat(db, uid, text)
      if (uid && chatIdRef.current && !isRetry) void appendMessage(db, uid, chatIdRef.current, { role: 'user', text }).catch(() => undefined)
      const reply = await session.send(screenHint() + text, {
        requestId,
        signal: controller.signal,
        onTool: (tool) => setStatus(t(`agent.tool.${tool}`) === `agent.tool.${tool}` ? t('agent.tool.default') : t(`agent.tool.${tool}`)),
        onRetry: ({ nextAttempt, maxAttempts }) => setStatus(t('agent.retrying', { attempt: nextAttempt, max: maxAttempts })),
      })
      const modelMsg: ChatMessage = { id: crypto.randomUUID(), role: 'model', text: reply.text, cards: reply.cards }
      setMessages((m) => [...m, modelMsg])
      setUnavailable(null)
      if (uid && chatIdRef.current) void appendMessage(db, uid, chatIdRef.current, modelMsg).catch(() => undefined)
      spoken = reply.text
    } catch (e) {
      const err = e instanceof UsageLimitError ? e : describeAiError(e)
      const reason = err instanceof AgentUnavailableError ? err.reason : null
      if (reason === 'not-enabled' || reason === 'app-check') setUnavailable(err as AgentUnavailableError)
      const retryable = err instanceof AgentUnavailableError ? err.retryable && reason !== 'cancelled' : false
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'model', text: err.message, error: true, retryText: retryable ? text : undefined, retryable }])
      if (fromVoice && reason !== 'cancelled') spoken = err.message
    } finally {
      busyRef.current = false
      abortRef.current = null
      setBusy(false)
      setStatus(null)
      if (!voiceModeRef.current) inputRef.current?.focus()
      // En voz, la respuesta (o el aviso de error) se dice en el idioma en que está escrita y se vuelve a escuchar.
      if (voiceModeRef.current) voiceRef.current?.deliver(spoken, spoken ? detectLanguage(spoken, voiceLanguage) : undefined)
    }
  }

  /** Modo guiado: ejecuta una herramienta directamente, sin IA. */
  async function guided(kind: 'recommend' | 'listings' | 'experiences') {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      const name = kind === 'recommend' ? 'recommend_destinations' : kind === 'listings' ? 'search_listings' : 'search_experiences'
      const outcome = await runTool(name, {}, ctx)
      const empty = (outcome.cards ?? []).length === 0
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'model', text: empty ? t('agent.guided.empty') : t('agent.guided.found'), cards: outcome.cards, guided: true }])
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  async function openHistory() {
    if (!uid) return
    setShowHistory((v) => !v)
    setChats(await listChats(db, uid).catch(() => []))
  }

  async function restore(id: string) {
    if (!uid) return
    const loaded = await loadMessages(db, uid, id).catch(() => [])
    chatIdRef.current = id
    sessionRef.current = null
    setMessages(loaded)
    setShowHistory(false)
  }

  function reset() {
    abortRef.current?.abort()
    sessionRef.current = null
    chatIdRef.current = null
    setMessages([])
    setShowHistory(false)
  }

  async function copyDiagnostics() {
    try {
      await navigator.clipboard.writeText(diagnosticReport())
      toast(t('agent.diagnosticsCopied'), { tone: 'info' })
    } catch {
      toast(t('common.error.generic'), { tone: 'error' })
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    void send(input)
  }

  const suggestions = [t('agent.suggest1'), t('agent.suggest2'), t('agent.suggest3'), t('agent.suggest4'), t('agent.suggest5')]
  const firstName = profile?.displayName?.split(' ')[0]

  const messagesView = (
    <div role="log" aria-live="polite" className="space-y-3">
      {messages.length === 0 && (
        <div className="flex flex-col gap-3">
          <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-ink">{firstName ? t('agent.greetingNamed', { name: firstName }) : t('agent.greeting')}</p>
          {!voiceMode && (
            <ul className="flex flex-wrap gap-2">
              {suggestions.map((s) => <li key={s}><button type="button" onClick={() => send(s)} disabled={busy} className="rounded-full border border-line px-3 py-1.5 text-left text-xs font-semibold text-ink hover:bg-surface-2 disabled:opacity-60">{s}</button></li>)}
            </ul>
          )}
        </div>
      )}

      {messages.map((m) => (
        <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex flex-col gap-2'}>
          <div className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm ${m.role === 'user' ? 'rounded-tr-sm bg-navy text-surface' : m.error ? 'rounded-tl-sm border border-danger/40 bg-danger/10 text-danger' : 'rounded-tl-sm bg-surface-2 text-ink'}`}>
            <RichText text={m.text} />
            {m.error && (
              <div className="mt-2 flex flex-wrap gap-2">
                {m.retryText && (
                  <button type="button" onClick={() => send('', { retryText: m.retryText })} disabled={busy} className="rounded-lg bg-coral px-3 py-1 text-xs font-bold text-on-coral disabled:opacity-60">{t('agent.retry')}</button>
                )}
                <button type="button" onClick={copyDiagnostics} className="rounded-lg border border-danger/40 px-3 py-1 text-xs font-semibold text-danger hover:bg-danger/10">{t('agent.copyDiagnostics')}</button>
              </div>
            )}
          </div>
          {m.cards?.map((c, i) => <AgentCardView key={i} card={c} />)}
          {m.role === 'model' && !m.error && !m.guided && m.cards && m.cards.length > 0 && <p className="text-[11px] text-muted">{t('agent.cardsDisclaimer')}</p>}
        </div>
      ))}

      {busy && (
        <div role="status" className="flex items-center gap-2 text-sm text-muted">
          <span aria-hidden="true" className="inline-flex gap-1">
            <i className="size-1.5 animate-bounce rounded-full bg-teal [animation-delay:-0.3s]" />
            <i className="size-1.5 animate-bounce rounded-full bg-teal [animation-delay:-0.15s]" />
            <i className="size-1.5 animate-bounce rounded-full bg-teal" />
          </span>
          <span>{status ?? t('agent.thinking')}</span>
          <button type="button" onClick={() => abortRef.current?.abort()} className="ml-1 inline-flex items-center gap-1 rounded-lg border border-line px-2 py-0.5 text-xs font-semibold text-ink hover:bg-surface-2">
            <Square aria-hidden="true" className="size-3 fill-current" />
            {t('agent.stop')}
          </button>
        </div>
      )}
      <div ref={endRef} />
    </div>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => (open ? closePanel() : setOpen(true))}
        aria-expanded={open}
        aria-controls="agent-panel"
        className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full bg-navy px-4 py-3 font-semibold text-surface shadow-xl transition hover:scale-105 focus-visible:outline-offset-4 lg:bottom-6 lg:right-6"
      >
        <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-teal font-serif text-base font-bold text-on-coral">L</span>
        <span className={open ? 'hidden' : 'hidden sm:inline'}>{t('agent.title')}</span>
        <span className={open ? 'inline' : 'sr-only sm:hidden'}>{open ? t('common.close') : t('agent.title')}</span>
      </button>

      {open && (
        <section
          id="agent-panel"
          role="dialog"
          aria-label={t('agent.title')}
          className="anim-sheet fixed inset-x-0 bottom-0 z-40 flex h-[85dvh] flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-2xl sm:inset-x-auto sm:bottom-24 sm:right-6 sm:h-[36rem] sm:w-[26rem] sm:rounded-3xl"
        >
          <header className="flex items-center justify-between gap-2 border-b border-line bg-surface-2 px-4 py-3">
            <div className="min-w-0">
              <h2 className="truncate font-serif text-lg font-semibold text-navy">{voiceMode ? t('voice.title') : t('agent.title')}</h2>
              <p className="truncate text-xs text-muted">{aiConsent ? t('agent.subtitlePersonal') : t('agent.subtitleAnon')}</p>
            </div>
            <div className="flex items-center gap-1">
              {!voiceMode && (
                <button
                  type="button"
                  onClick={() => setVoiceMode(true)}
                  aria-label={t('voice.start')}
                  title={isRecognitionSupported() ? t('voice.start') : t('voice.hint.unsupported')}
                  className="grid size-8 place-items-center rounded-full text-teal-soft hover:bg-surface"
                >
                  <Mic aria-hidden="true" className="size-4" />
                </button>
              )}
              {uid && !voiceMode && <button type="button" onClick={openHistory} className="rounded-lg px-2 py-1 text-xs font-semibold text-ink hover:bg-surface">{t('agent.history')}</button>}
              {!voiceMode && <button type="button" onClick={reset} className="rounded-lg px-2 py-1 text-xs font-semibold text-ink hover:bg-surface">{t('agent.new')}</button>}
              <button type="button" onClick={closePanel} aria-label={t('agent.close')} className="grid size-8 place-items-center rounded-full hover:bg-surface">✕</button>
            </div>
          </header>

          {voiceMode ? (
            <div className="min-h-0 flex-1">
              <VoiceMode
                handle={voiceRef}
                language={voiceLanguage}
                onLanguage={setVoiceLanguage}
                onFinal={(text) => void send(text, { fromVoice: true })}
                onEnd={() => {
                  abortRef.current?.abort()
                  setVoiceMode(false)
                }}
                agentStatus={busy ? status : null}
                transcript={messagesView}
              />
            </div>
          ) : (
            <>
              {showHistory && (
                <div className="max-h-48 overflow-y-auto border-b border-line bg-surface p-2">
                  {chats.length === 0 ? <p className="p-2 text-sm text-muted">{t('agent.noChats')}</p> : (
                    <ul>
                      {chats.map((c) => (
                        <li key={c.id} className="flex items-center gap-1">
                          <button type="button" onClick={() => restore(c.id)} className="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2">{c.title}</button>
                          <button type="button" aria-label={t('agent.deleteChat', { title: c.title })} onClick={async () => { await deleteChat(db, uid!, c.id); setChats((l) => l.filter((x) => x.id !== c.id)) }} className="rounded-lg px-2 py-1 text-xs text-danger hover:bg-surface-2">{t('agent.delete')}</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-4 py-4">{messagesView}</div>

              {unavailable && (
                <div className="border-t border-line bg-surface-2 px-4 py-2">
                  <p className="text-xs text-muted">{t('agent.guidedIntro')}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <button type="button" onClick={() => guided('recommend')} className="rounded-full border border-line px-3 py-1 text-xs font-semibold hover:bg-surface">{t('agent.guided.recommend')}</button>
                    <button type="button" onClick={() => guided('listings')} className="rounded-full border border-line px-3 py-1 text-xs font-semibold hover:bg-surface">{t('agent.guided.listings')}</button>
                    <button type="button" onClick={() => guided('experiences')} className="rounded-full border border-line px-3 py-1 text-xs font-semibold hover:bg-surface">{t('agent.guided.experiences')}</button>
                  </div>
                </div>
              )}

              <form onSubmit={submit} className="border-t border-line bg-surface p-3">
                <div className="flex items-end gap-2">
                  <label htmlFor="agent-input" className="sr-only">{t('agent.inputLabel')}</label>
                  <textarea
                    id="agent-input"
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input) } }}
                    rows={1}
                    maxLength={1000}
                    placeholder={t('agent.placeholder')}
                    className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                  />
                  <button type="submit" disabled={busy || input.trim() === ''} className="h-11 rounded-xl bg-coral px-4 font-bold text-on-coral disabled:opacity-50">{t('agent.send')}</button>
                </div>
                <p className="mt-1.5 text-[11px] leading-tight text-muted">{t('agent.privacy')}</p>
              </form>
            </>
          )}
        </section>
      )}
    </>
  )
}

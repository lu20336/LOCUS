/**
 * "Tu compañero LOCUS": botón flotante disponible en todas las pantallas que
 * abre una conversación con el agente de IA. Conserva el contexto de la
 * conversación, usa el perfil del viajero solo si el usuario lo autorizó y, si
 * la IA no está activada todavía, ofrece un modo guiado que sigue siendo útil.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router'
import { AgentSession, AgentUnavailableError, describeAiError, toHistory } from '../../lib/agent/agent'
import { UsageLimitError, appendMessage, countMessage, createChat, deleteChat, listChats, loadMessages, type ChatSummary } from '../../lib/agent/chatStore'
import { runTool } from '../../lib/agent/tools'
import type { ChatMessage, ToolContext } from '../../lib/agent/types'
import { useAuth } from '../../lib/auth/authContext'
import { db } from '../../lib/firebase/client'
import { todayISO } from '../../lib/format'
import { loadProfile } from '../../lib/profile/profileService'
import { summarize } from '../../lib/profile/survey'
import { AgentCardView } from './AgentCards'

const SUGGESTIONS = [
  '¿A dónde me recomiendas viajar este fin de semana?',
  'Quiero conocer lugares fríos en Colombia',
  'Organízame 3 días en Medellín',
  'Recomiéndame hospedajes en el Eje Cafetero',
  '¿Qué puedo hacer en San Andrés si llueve?',
]

const TOOL_LABELS: Record<string, string> = {
  search_listings: 'Buscando alojamientos en LOCUS…',
  get_listing_details: 'Revisando el alojamiento…',
  search_experiences: 'Buscando experiencias…',
  get_destination_info: 'Consultando el destino…',
  get_weather: 'Consultando el clima…',
  find_places: 'Buscando lugares en OpenStreetMap…',
  plan_itinerary: 'Armando tu itinerario…',
  recommend_destinations: 'Pensando destinos para ti…',
  flight_search_links: 'Preparando la búsqueda de vuelos…',
  get_traveler_profile: 'Revisando tus preferencias…',
  save_inference: 'Anotando tu preferencia…',
}

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
  const { user, profile } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState<AgentUnavailableError | null>(null)
  const [chats, setChats] = useState<ChatSummary[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const sessionRef = useRef<AgentSession | null>(null)
  const chatIdRef = useRef<string | null>(null)
  const profileSummary = useRef<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  const uid = user?.uid ?? null
  const aiConsent = Boolean(uid && profile?.aiPersonalization)
  const ctx = useMemo<ToolContext>(() => ({ uid, aiConsent, today: todayISO() }), [uid, aiConsent])

  // Al cambiar de usuario o de autorización, se empieza una conversación limpia.
  useEffect(() => {
    sessionRef.current = null
    chatIdRef.current = null
    profileSummary.current = null
    setMessages([])
    setChats([])
  }, [uid, aiConsent])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, status, busy])

  /** Pista invisible sobre la pantalla actual (ej. el alojamiento que está viendo). */
  const screenHint = useCallback(() => {
    const listing = location.pathname.match(/^\/hospedajes\/([^/]+)/)
    if (listing) return `[Contexto de pantalla: el usuario está viendo el alojamiento con id ${listing[1]}. Usa get_listing_details si necesitas sus datos.]\n`
    const exp = location.pathname.match(/^\/experiencias\/([^/]+)/)
    if (exp) return `[Contexto de pantalla: el usuario está viendo la experiencia con id ${exp[1]}.]\n`
    const dest = location.pathname.match(/^\/destinos\/([^/]+)/)
    if (dest) return `[Contexto de pantalla: el usuario está viendo la ficha del destino "${dest[1].replaceAll('-', ' ')}".]\n`
    return ''
  }, [location.pathname])

  async function ensureSession(): Promise<AgentSession> {
    if (sessionRef.current) return sessionRef.current
    if (aiConsent && uid && profileSummary.current === null) {
      const p = await loadProfile(db, uid).catch(() => null)
      profileSummary.current = p ? [...summarize(p.declared).map((s) => `- ${s.label}: ${s.answer}`), ...Object.values(p.inferred).map((i) => `- (inferido) ${i.text}`)].join('\n') : ''
    }
    sessionRef.current = new AgentSession(ctx, profileSummary.current || null, toHistory(messages))
    return sessionRef.current
  }

  async function send(raw: string) {
    const text = raw.trim()
    if (!text || busy) return
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', text }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setBusy(true)
    setStatus('Pensando…')
    try {
      await countMessage(db, uid, ctx.today)
      const session = await ensureSession()
      if (uid && !chatIdRef.current) chatIdRef.current = await createChat(db, uid, text)
      if (uid && chatIdRef.current) void appendMessage(db, uid, chatIdRef.current, userMsg).catch(() => undefined)
      const reply = await session.send(screenHint() + text, (tool) => setStatus(TOOL_LABELS[tool] ?? 'Consultando…'))
      const modelMsg: ChatMessage = { id: crypto.randomUUID(), role: 'model', text: reply.text, cards: reply.cards }
      setMessages((m) => [...m, modelMsg])
      setUnavailable(null)
      if (uid && chatIdRef.current) void appendMessage(db, uid, chatIdRef.current, modelMsg).catch(() => undefined)
    } catch (e) {
      const err = e instanceof UsageLimitError ? e : describeAiError(e)
      if (err instanceof AgentUnavailableError) {
        if (err.reason === 'not-enabled') setUnavailable(err)
        sessionRef.current = err.reason === 'network' || err.reason === 'quota' ? sessionRef.current : null
      }
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'model', text: err.message, error: true }])
    } finally {
      setBusy(false)
      setStatus(null)
      inputRef.current?.focus()
    }
  }

  /** Modo guiado: ejecuta una herramienta directamente, sin IA. */
  async function guided(kind: 'recommend' | 'listings' | 'experiences') {
    if (busy) return
    setBusy(true)
    try {
      const name = kind === 'recommend' ? 'recommend_destinations' : kind === 'listings' ? 'search_listings' : 'search_experiences'
      const outcome = await runTool(name, {}, ctx)
      const empty = (outcome.cards ?? []).length === 0
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'model', text: empty ? 'Todavía no hay resultados para mostrar. Cuando más anfitriones publiquen, aparecerán aquí.' : 'Esto es lo que encontré en LOCUS:', cards: outcome.cards, guided: true }])
    } finally {
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
    sessionRef.current = null
    chatIdRef.current = null
    setMessages([])
    setShowHistory(false)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    void send(input)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="agent-panel"
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-navy px-4 py-3 font-semibold text-surface shadow-xl transition hover:scale-105 focus-visible:outline-offset-4 sm:bottom-6 sm:right-6"
      >
        <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-teal font-serif text-base font-bold text-on-coral">L</span>
        <span className={open ? 'hidden' : 'hidden sm:inline'}>Tu compañero LOCUS</span>
        <span className={open ? 'inline' : 'sr-only sm:hidden'}>{open ? 'Cerrar' : 'Tu compañero LOCUS'}</span>
      </button>

      {open && (
        <section
          id="agent-panel"
          role="dialog"
          aria-label="Tu compañero LOCUS: asistente de viajes"
          className="fixed inset-x-0 bottom-0 z-40 flex h-[85dvh] flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-2xl sm:inset-x-auto sm:bottom-24 sm:right-6 sm:h-[36rem] sm:w-[26rem] sm:rounded-3xl"
        >
          <header className="flex items-center justify-between gap-2 border-b border-line bg-surface-2 px-4 py-3">
            <div>
              <h2 className="font-serif text-lg font-semibold text-navy">Tu compañero LOCUS</h2>
              <p className="text-xs text-muted">{aiConsent ? 'Personalizado con tus preferencias' : 'Asistente de viajes por Colombia'}</p>
            </div>
            <div className="flex items-center gap-1">
              {uid && <button type="button" onClick={openHistory} className="rounded-lg px-2 py-1 text-xs font-semibold text-ink hover:bg-surface">Historial</button>}
              <button type="button" onClick={reset} className="rounded-lg px-2 py-1 text-xs font-semibold text-ink hover:bg-surface">Nueva</button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar el asistente" className="grid size-8 place-items-center rounded-full hover:bg-surface">✕</button>
            </div>
          </header>

          {showHistory && (
            <div className="max-h-48 overflow-y-auto border-b border-line bg-surface p-2">
              {chats.length === 0 ? <p className="p-2 text-sm text-muted">Aún no tienes conversaciones guardadas.</p> : (
                <ul>
                  {chats.map((c) => (
                    <li key={c.id} className="flex items-center gap-1">
                      <button type="button" onClick={() => restore(c.id)} className="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2">{c.title}</button>
                      <button type="button" aria-label={`Borrar la conversación ${c.title}`} onClick={async () => { await deleteChat(db, uid!, c.id); setChats((l) => l.filter((x) => x.id !== c.id)) }} className="rounded-lg px-2 py-1 text-xs text-danger hover:bg-surface-2">Borrar</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="flex flex-col gap-3">
                <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-ink">
                  ¡Hola{profile?.displayName ? `, ${profile.displayName.split(' ')[0]}` : ''}! Soy tu compañero LOCUS. Te ayudo a elegir destino, encontrar hospedajes y experiencias reales, ver el clima y armar tu itinerario por Colombia.
                </p>
                <ul className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => <li key={s}><button type="button" onClick={() => send(s)} className="rounded-full border border-line px-3 py-1.5 text-left text-xs font-semibold text-ink hover:bg-surface-2">{s}</button></li>)}
                </ul>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex flex-col gap-2'}>
                <div className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm ${m.role === 'user' ? 'rounded-tr-sm bg-navy text-surface' : m.error ? 'rounded-tl-sm border border-danger/40 bg-danger/10 text-danger' : 'rounded-tl-sm bg-surface-2 text-ink'}`}>
                  <RichText text={m.text} />
                </div>
                {m.cards?.map((c, i) => <AgentCardView key={i} card={c} />)}
                {m.role === 'model' && !m.error && !m.guided && m.cards && m.cards.length > 0 && <p className="text-[11px] text-muted">Las tarjetas muestran datos verificados de LOCUS o de fuentes abiertas; el texto es una respuesta de IA y puede contener errores.</p>}
              </div>
            ))}

            {busy && <p role="status" className="text-sm text-muted">{status ?? 'Pensando…'}</p>}
            <div ref={endRef} />
          </div>

          {unavailable && (
            <div className="border-t border-line bg-surface-2 px-4 py-2">
              <p className="text-xs text-muted">Mientras se activa la IA, puedes usar el modo guiado:</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <button type="button" onClick={() => guided('recommend')} className="rounded-full border border-line px-3 py-1 text-xs font-semibold hover:bg-surface">Recomiéndame destinos</button>
                <button type="button" onClick={() => guided('listings')} className="rounded-full border border-line px-3 py-1 text-xs font-semibold hover:bg-surface">Ver hospedajes</button>
                <button type="button" onClick={() => guided('experiences')} className="rounded-full border border-line px-3 py-1 text-xs font-semibold hover:bg-surface">Ver experiencias</button>
              </div>
            </div>
          )}

          <form onSubmit={submit} className="border-t border-line bg-surface p-3">
            <div className="flex items-end gap-2">
              <label htmlFor="agent-input" className="sr-only">Escribe tu mensaje</label>
              <textarea
                id="agent-input"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input) } }}
                rows={1}
                maxLength={1000}
                placeholder="Pregúntame sobre tu viaje…"
                className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
              <button type="submit" disabled={busy || input.trim() === ''} className="h-11 rounded-xl bg-coral px-4 font-bold text-on-coral disabled:opacity-50">Enviar</button>
            </div>
            <p className="mt-1.5 text-[11px] leading-tight text-muted">La IA puede equivocarse: verifica en las fichas. No compartas datos sensibles; tus mensajes se procesan con Google Gemini (nivel gratuito).</p>
          </form>
        </section>
      )}
    </>
  )
}


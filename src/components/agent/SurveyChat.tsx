/**
 * Encuesta de preferencias en formato conversación: el compañero LOCUS pregunta
 * una cosa a la vez, con opciones visuales. Todo es omitible y adaptativo.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button } from '../ui'
import {
  QUESTIONS, describeAnswer, isAnswered, nextQuestion, normalizeAnswer, summarize, visibleQuestions,
  type Answers, type Question, type QuestionId,
} from '../../lib/profile/survey'

function Avatar() {
  return <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-teal font-serif text-lg font-bold text-on-coral">L</span>
}

function AgentBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Avatar />
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-surface-2 px-4 py-3 text-ink">{children}</div>
    </div>
  )
}
const UserBubble = ({ children }: { children: React.ReactNode }) => (
  <div className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-navy px-4 py-3 text-surface">{children}</div></div>
)

export function SurveyChat({
  name,
  initial = {},
  editing = false,
  onFinish,
  onLater,
}: {
  name: string
  initial?: Answers
  editing?: boolean
  onFinish: (answers: Answers, aiConsent: boolean) => Promise<void>
  onLater?: () => void
}) {
  const [answers, setAnswers] = useState<Answers>(initial)
  const [history, setHistory] = useState<{ id: QuestionId; skipped: boolean }[]>([])
  const [current, setCurrent] = useState<Question | null>(() => nextQuestion(initial))
  const [selection, setSelection] = useState<string[]>([])
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(true)
  const [consent, setConsent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  const total = visibleQuestions(answers).length
  const position = history.length + (current ? 1 : 0)

  // Efecto de "escribiendo…" breve antes de cada pregunta.
  useEffect(() => {
    setTyping(true)
    const timer = setTimeout(() => setTyping(false), 450)
    return () => clearTimeout(timer)
  }, [current?.id])

  // Al llegar a una pregunta, se precarga la respuesta existente (modo edición).
  useEffect(() => {
    if (!current) return
    const existing = answers[current.id]
    if (current.kind === 'text') setText(typeof existing === 'string' ? existing : '')
    else setSelection(Array.isArray(existing) ? existing : typeof existing === 'string' && existing ? [existing] : [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [history.length, typing, current?.id])

  function advance(next: Answers, entry: { id: QuestionId; skipped: boolean }) {
    setAnswers(next)
    setHistory((h) => [...h, entry])
    setCurrent(nextQuestion(next, entry.id))
    setError(null)
  }

  function submit(raw: string | string[]) {
    if (!current) return
    const value = normalizeAnswer(current, raw)
    if (value === null) return setError(current.kind === 'text' ? 'Escribe algo o pulsa «Omitir».' : 'Elige al menos una opción o pulsa «Omitir».')
    advance({ ...answers, [current.id]: value }, { id: current.id, skipped: false })
  }

  function skip() {
    if (!current) return
    const next = { ...answers }
    delete next[current.id]
    advance(next, { id: current.id, skipped: true })
  }

  function back() {
    const last = history[history.length - 1]
    if (!last) return
    setHistory((h) => h.slice(0, -1))
    setCurrent(QUESTIONS.find((q) => q.id === last.id) ?? null)
    setError(null)
  }

  async function finish() {
    setSaving(true)
    setError(null)
    try {
      await onFinish(answers, consent)
    } catch {
      setError('No pudimos guardar tus preferencias. Revisa tu conexión e inténtalo de nuevo.')
      setSaving(false)
    }
  }

  const summary = useMemo(() => summarize(answers), [answers])
  const questionOf = (id: QuestionId) => QUESTIONS.find((q) => q.id === id)!

  return (
    <div className="flex flex-col gap-4">
      <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-teal transition-all duration-500" style={{ width: `${current ? Math.round((history.length / Math.max(total, 1)) * 100) : 100}%` }} />
      </div>
      <p className="text-xs text-muted" aria-live="polite">{current ? `Pregunta ${Math.min(position, total)} de ${total} · todas son opcionales` : 'Listo'}</p>

      <div role="log" aria-label="Conversación con tu compañero LOCUS" className="flex flex-col gap-4">
        {history.map(({ id, skipped }) => {
          const q = questionOf(id)
          return (
            <div key={id} className="flex flex-col gap-3">
              <AgentBubble>{q.prompt(name)}</AgentBubble>
              <UserBubble>{skipped || !isAnswered(answers[id]) ? <em>Prefiero omitirla</em> : describeAnswer(q, answers[id])}</UserBubble>
            </div>
          )
        })}

        {current && (
          <div className="flex flex-col gap-3">
            <AgentBubble>
              {typing ? <span role="status" aria-label="Tu compañero está escribiendo" className="inline-flex gap-1" aria-live="polite">{[0, 1, 2].map((i) => <span key={i} className="size-2 animate-pulse rounded-full bg-muted" style={{ animationDelay: `${i * 150}ms` }} />)}</span> : current.prompt(name)}
            </AgentBubble>

            {!typing && (
              <form onSubmit={(e) => { e.preventDefault(); submit(current.kind === 'text' ? text : selection) }} className="ml-12 flex flex-col gap-3">
                {current.kind === 'text' ? (
                  <textarea aria-label={current.prompt(name)} value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={300} placeholder={current.placeholder} className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30" />
                ) : (
                  <fieldset>
                    <legend className="sr-only">{current.prompt(name)}</legend>
                    <div className="flex flex-wrap gap-2">
                      {current.options!.map((opt) => {
                        const checked = selection.includes(opt.value)
                        return (
                          <label key={opt.value} className="flex cursor-pointer items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-2.5 text-sm text-ink transition-colors hover:bg-surface-2 has-checked:border-teal has-checked:bg-teal/15 has-checked:font-semibold has-focus-visible:ring-2 has-focus-visible:ring-teal-soft">
                            <input
                              type={current.kind === 'single' ? 'radio' : 'checkbox'}
                              name={current.id}
                              value={opt.value}
                              checked={checked}
                              onChange={() => {
                                if (current.kind === 'single') submit(opt.value)
                                else setSelection((s) => (s.includes(opt.value) ? s.filter((v) => v !== opt.value) : s.length >= (current.max ?? 8) ? s : [...s, opt.value]))
                              }}
                              className="sr-only"
                            />
                            {opt.emoji && <span aria-hidden="true">{opt.emoji}</span>}
                            <span className="flex flex-col leading-tight">{opt.label}{opt.hint && <span className="text-xs font-normal text-muted">{opt.hint}</span>}</span>
                          </label>
                        )
                      })}
                    </div>
                    {current.kind === 'multi' && <p className="mt-2 text-xs text-muted">Puedes elegir hasta {current.max}.</p>}
                  </fieldset>
                )}
                {error && <Alert>{error}</Alert>}
                <div className="flex flex-wrap items-center gap-2">
                  {(current.kind !== 'single' || (editing && selection.length > 0)) && <Button type="submit">{current.kind === 'single' ? 'Mantener' : 'Continuar'}</Button>}
                  <Button variant="ghost" className="border border-line" onClick={skip}>Omitir</Button>
                  {history.length > 0 && <Button variant="ghost" onClick={back}>← Anterior</Button>}
                  {onLater && history.length === 0 && <Button variant="ghost" onClick={onLater}>Más tarde</Button>}
                </div>
              </form>
            )}
          </div>
        )}

        {!current && (
          <div className="flex flex-col gap-4">
            <AgentBubble>
              <p className="font-semibold">¡Listo{name ? `, ${name}` : ''}! Esto es lo que entendí de ti:</p>
              {summary.length === 0 ? <p className="mt-2 text-sm text-muted">No respondiste ninguna pregunta; puedes completar tu perfil cuando quieras desde «Mi perfil».</p> : (
                <ul className="mt-2 flex flex-col gap-1 text-sm">
                  {summary.map((s) => <li key={s.id}><span className="text-muted">{s.label}:</span> {s.answer}</li>)}
                </ul>
              )}
            </AgentBubble>
            <div className="ml-12 flex flex-col gap-3">
              <label className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-sm">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4 accent-[var(--primary)]" />
                <span>
                  <strong>Permitir que mi compañero use estas preferencias</strong> para personalizar las recomendaciones. Cuando chateas, el agente envía a Google (Gemini) tus mensajes y, si lo permites, un resumen de estas preferencias; <strong>no envía tu nombre ni tu correo</strong>. Puedes cambiarlo cuando quieras en tu perfil.
                </span>
              </label>
              {error && <Alert>{error}</Alert>}
              <div className="flex flex-wrap gap-2">
                <Button onClick={finish} disabled={saving}>{saving ? 'Guardando…' : 'Guardar mis preferencias'}</Button>
                {history.length > 0 && <Button variant="ghost" onClick={back} disabled={saving}>← Revisar respuestas</Button>}
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  )
}

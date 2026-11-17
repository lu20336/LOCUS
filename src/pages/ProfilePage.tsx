/** Mi perfil: cuenta, preferencias de viaje (declaradas vs. inferidas), privacidad del agente y modo anfitrión. */
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { FormField, inputClassName } from '../components/FormField'
import { Recommendations } from '../components/Recommendations'
import { Alert, Badge, Button, ButtonLink, Card, Container, PageHeader, Spinner } from '../components/ui'
import { deleteAllChats } from '../lib/agent/chatStore'
import { useAuth } from '../lib/auth/authContext'
import { db } from '../lib/firebase/client'
import { deleteProfile, dismissInference, loadProfile } from '../lib/profile/profileService'
import { summarize } from '../lib/profile/survey'
import { useAsync } from '../lib/useAsync'

export default function ProfilePage() {
  const { user, profile, updateProfile } = useAuth()
  const traveler = useAsync(() => loadProfile(db, user!.uid), [user?.uid])
  const [name, setName] = useState(profile?.displayName ?? user?.displayName ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  if (!profile) return <Container><Spinner /></Container>

  async function saveAccount(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await updateProfile({ displayName: name.trim().slice(0, 80), phone: phone.trim().slice(0, 30) })
      setMessage({ tone: 'success', text: 'Guardamos tus datos.' })
    } catch {
      setMessage({ tone: 'error', text: 'No pudimos guardar tus datos.' })
    } finally {
      setBusy(false)
    }
  }

  async function toggleConsent(next: boolean) {
    try {
      await updateProfile({ aiPersonalization: next })
    } catch {
      setMessage({ tone: 'error', text: 'No pudimos cambiar esa preferencia.' })
    }
  }

  const declared = traveler.data?.declared ?? {}
  const rows = summarize(declared)
  const inferred = Object.entries(traveler.data?.inferred ?? {})

  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <PageHeader eyebrow="Tu cuenta" title="Mi perfil y preferencias">Aquí controlas tus datos, cómo te conoce tu compañero LOCUS y tu modo de uso.</PageHeader>
      {message && <div className="mb-5"><Alert tone={message.tone === 'success' ? 'success' : 'error'}>{message.text}</Alert></div>}

      <div className="flex flex-col gap-6">
        <Card>
          <h2 className="mb-4 text-xl font-semibold text-navy">Mi cuenta</h2>
          <form onSubmit={saveAccount} className="flex flex-col gap-4">
            <p className="text-sm text-muted">Correo: <strong className="text-ink">{user?.email}</strong></p>
            <FormField id="p-name" label="Nombre">{(c) => <input {...c} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={inputClassName} />}</FormField>
            <FormField id="p-phone" label="Teléfono (opcional)">{(c) => <input {...c} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} className={inputClassName} />}</FormField>
            <Button type="submit" disabled={busy} className="self-start">Guardar</Button>
          </form>
        </Card>

        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-navy">Mis preferencias de viaje</h2>
              <p className="mt-1 text-sm text-muted">{traveler.data?.completedAt ? `Última actualización: ${new Date(traveler.data.updatedAt ?? traveler.data.completedAt).toLocaleDateString('es-CO')}` : 'Aún no completas la encuesta.'}</p>
            </div>
            <ButtonLink to="/bienvenida?editar=1" variant="secondary">Actualizar mis preferencias de viaje</ButtonLink>
          </div>

          {traveler.loading ? <Spinner /> : rows.length === 0 ? (
            <p className="mt-4 text-muted">Cuéntale a tu compañero cómo te gusta viajar para recibir mejores recomendaciones.</p>
          ) : (
            <>
              <div className="mt-4 flex items-center gap-2"><h3 className="font-semibold text-ink">Lo que tú me dijiste</h3><Badge tone="teal">Declarado por ti</Badge></div>
              <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {rows.map((r) => <div key={r.id}><dt className="text-xs text-muted">{r.label}</dt><dd className="text-sm text-ink">{r.answer}</dd></div>)}
              </dl>
            </>
          )}

          {inferred.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-2"><h3 className="font-semibold text-ink">Lo que deduje de nuestras conversaciones</h3><Badge tone="warn">Inferido por la IA</Badge></div>
              <p className="mt-1 text-sm text-muted">Son suposiciones: no reemplazan tus respuestas y puedes borrarlas.</p>
              <ul className="mt-2 flex flex-col gap-2">
                {inferred.map(([key, item]) => (
                  <li key={key} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                    <span>{item.text}</span>
                    <button type="button" className="text-danger underline" onClick={async () => { await dismissInference(db, user!.uid, key); traveler.reload() }}>Quitar</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {rows.length > 0 && (
          <Card>
            <h2 className="mb-4 text-xl font-semibold text-navy">Destinos para ti</h2>
            <Recommendations answers={declared} />
          </Card>
        )}

        <Card>
          <h2 className="mb-2 text-xl font-semibold text-navy">Privacidad del asistente</h2>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={profile.aiPersonalization} onChange={(e) => void toggleConsent(e.target.checked)} className="mt-1 size-4 accent-[var(--primary)]" />
            <span>Permitir que mi compañero use mis preferencias para personalizar sus respuestas. Se envía a Google Gemini un resumen de tus preferencias (sin tu nombre ni correo) junto con tus mensajes. En el nivel gratuito de Gemini, Google puede usar estas conversaciones para mejorar sus productos.</span>
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="danger" onClick={async () => {
              if (!window.confirm('¿Borrar todas tus conversaciones con el asistente? No se puede deshacer.')) return
              const n = await deleteAllChats(db, user!.uid)
              setMessage({ tone: 'success', text: `Borramos ${n} ${n === 1 ? 'conversación' : 'conversaciones'}.` })
            }}>Borrar mis conversaciones</Button>
            <Button variant="danger" onClick={async () => {
              if (!window.confirm('¿Borrar tu perfil de viajero (respuestas e inferencias)? No se puede deshacer.')) return
              await deleteProfile(db, user!.uid)
              traveler.reload()
              setMessage({ tone: 'success', text: 'Borramos tu perfil de viajero.' })
            }}>Borrar mi perfil de viajero</Button>
          </div>
          <p className="mt-3 text-xs text-muted">Tratamiento de datos personales conforme a la Ley 1581 de 2012 (Colombia). Tienes derecho a conocer, actualizar y suprimir tus datos.</p>
        </Card>

        <Card>
          <h2 className="mb-2 text-xl font-semibold text-navy">Modo de uso</h2>
          <p className="text-muted">Usas LOCUS como <strong className="text-ink">huésped</strong>{profile.isHost ? <> y como <strong className="text-ink">anfitrión</strong></> : ''}. Es la misma cuenta.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <ButtonLink to="/reservas" variant="ghost" className="border border-line">Mis reservas</ButtonLink>
            <ButtonLink to="/anfitrion" variant="secondary">{profile.isHost ? 'Ir a mi panel de anfitrión' : 'Quiero publicar mi alojamiento'}</ButtonLink>
          </div>
          <p className="mt-3 text-sm text-muted"><Link to="/favoritos" className="underline">Ver mis favoritos</Link></p>
        </Card>
      </div>
    </Container>
  )
}

/**
 * Moderación: revisión de publicaciones pendientes. Solo accede quien tenga un
 * documento admins/{uid} (se crea a mano en la consola de Firebase). Las reglas
 * de Firestore son las que realmente restringen la acción; esta pantalla solo
 * oculta lo que no corresponde.
 */
import { useState } from 'react'
import { Link } from 'react-router'
import { Alert, Badge, Button, Card, Container, EmptyState, PageHeader, Spinner } from '../components/ui'
import { useAuth } from '../lib/auth/authContext'
import { fetchByStatus, fetchPublished, setItemStatus, type CatalogKind } from '../lib/catalog/repo'
import type { Experience, Listing } from '../lib/domain/types'
import { db } from '../lib/firebase/client'
import { formatCOP } from '../lib/format'
import { useAsync } from '../lib/useAsync'

function ReviewRow({ kind, item, onDone, mode }: { kind: CatalogKind; item: Listing | Experience; onDone: () => void; mode: 'pending' | 'published' }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const link = kind === 'listings' ? `/hospedajes/${item.id}` : `/experiencias/${item.id}`

  async function run(status: string) {
    if ((status === 'rejected' || status === 'suspended') && reason.trim().length < 5) return setError('Escribe el motivo (mín. 5 caracteres): se le muestra al anfitrión.')
    setBusy(true)
    setError(null)
    try {
      await setItemStatus(db, kind, item.id, status, status === 'published' ? '' : reason.trim())
      onDone()
    } catch {
      setError('No se pudo aplicar la acción (¿tu cuenta es administradora?).')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start gap-3">
        {item.cover && item.photoCount > 0 && <img src={item.cover} alt="" className="size-20 rounded-xl object-cover" />}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink"><Link to={link} className="hover:underline">{item.title}</Link></p>
          <p className="text-sm text-muted">{item.municipality}, {item.department} · {kind === 'listings' ? `${formatCOP((item as Listing).pricePerNight)}/noche` : `${formatCOP((item as Experience).pricePerPerson)}/persona`} · {item.photoCount} fotos</p>
          {item.isTestData && <Badge tone="warn">Dato de prueba</Badge>}
        </div>
      </div>
      <label className="mt-3 block text-sm font-semibold text-ink">
        Motivo (para rechazar o suspender)
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm font-normal" />
      </label>
      {error && <div className="mt-2"><Alert>{error}</Alert></div>}
      <div className="mt-3 flex flex-wrap gap-2">
        {mode === 'pending' ? (
          <>
            <Button disabled={busy} onClick={() => run('published')}>Aprobar y publicar</Button>
            <Button variant="danger" disabled={busy} onClick={() => run('rejected')}>Rechazar</Button>
          </>
        ) : (
          <Button variant="danger" disabled={busy} onClick={() => run('suspended')}>Suspender</Button>
        )}
      </div>
    </Card>
  )
}

export default function AdminPage() {
  const { isAdmin, loading } = useAuth()
  const pendingL = useAsync(() => (isAdmin ? fetchByStatus<Listing>(db, 'listings', 'pending') : Promise.resolve([])), [isAdmin])
  const pendingE = useAsync(() => (isAdmin ? fetchByStatus<Experience>(db, 'experiences', 'pending') : Promise.resolve([])), [isAdmin])
  const liveL = useAsync(() => (isAdmin ? fetchPublished<Listing>(db, 'listings') : Promise.resolve([])), [isAdmin])
  const liveE = useAsync(() => (isAdmin ? fetchPublished<Experience>(db, 'experiences') : Promise.resolve([])), [isAdmin])

  if (loading) return <Container><Spinner /></Container>
  if (!isAdmin) return <Container className="py-10"><Alert>Esta sección es solo para el equipo de LOCUS.</Alert></Container>

  const reloadAll = () => { pendingL.reload(); pendingE.reload(); liveL.reload(); liveE.reload() }
  const pending = [...(pendingL.data ?? []).map((i) => ({ kind: 'listings' as const, item: i })), ...(pendingE.data ?? []).map((i) => ({ kind: 'experiences' as const, item: i }))]
  const live = [...(liveL.data ?? []).map((i) => ({ kind: 'listings' as const, item: i })), ...(liveE.data ?? []).map((i) => ({ kind: 'experiences' as const, item: i }))]

  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <PageHeader eyebrow="Equipo LOCUS" title="Moderación de publicaciones">Revisa que cada publicación sea real, tenga fotos propias y cumpla las normas antes de aprobarla.</PageHeader>
      <h2 className="mb-3 text-2xl font-semibold text-navy">Pendientes de revisión ({pending.length})</h2>
      {pendingL.loading ? <Spinner /> : pending.length === 0 ? <EmptyState title="No hay nada pendiente" /> : (
        <div className="flex flex-col gap-4">{pending.map(({ kind, item }) => <ReviewRow key={item.id} kind={kind} item={item} mode="pending" onDone={reloadAll} />)}</div>
      )}
      <h2 className="mb-3 mt-10 text-2xl font-semibold text-navy">Publicadas ({live.length})</h2>
      <div className="flex flex-col gap-4">{live.map(({ kind, item }) => <ReviewRow key={item.id} kind={kind} item={item} mode="published" onDone={reloadAll} />)}</div>
    </Container>
  )
}

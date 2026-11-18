/** Mi perfil: cuenta, preferencias de viaje (declaradas vs. inferidas), privacidad del agente y modo anfitrión. */
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { FormField, inputClassName } from '../components/FormField'
import { Recommendations } from '../components/Recommendations'
import { Alert, Badge, Button, ButtonLink, Card, Container, PageHeader, Spinner } from '../components/ui'
import { deleteAllChats } from '../lib/agent/chatStore'
import { useAuth } from '../lib/auth/authContext'
import { db } from '../lib/firebase/client'
import { useI18n } from '../lib/i18n/I18nProvider'
import { deleteProfile, dismissInference, loadProfile } from '../lib/profile/profileService'
import { summarize } from '../lib/profile/survey'
import { useAsync } from '../lib/useAsync'

export default function ProfilePage() {
  const { t, meta } = useI18n()
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
      setMessage({ tone: 'success', text: t('pf.saved') })
    } catch {
      setMessage({ tone: 'error', text: t('pf.saveError') })
    } finally {
      setBusy(false)
    }
  }

  async function toggleConsent(next: boolean) {
    try {
      await updateProfile({ aiPersonalization: next })
    } catch {
      setMessage({ tone: 'error', text: t('pf.prefError') })
    }
  }

  const declared = traveler.data?.declared ?? {}
  const rows = summarize(declared)
  const inferred = Object.entries(traveler.data?.inferred ?? {})

  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <PageHeader eyebrow={t('pf.eyebrow')} title={t('pf.title')}>{t('pf.intro')}</PageHeader>
      {message && <div className="mb-5"><Alert tone={message.tone === 'success' ? 'success' : 'error'}>{message.text}</Alert></div>}

      <div className="flex flex-col gap-6">
        <Card>
          <h2 className="mb-4 text-xl font-semibold text-navy">{t('pf.myAccount')}</h2>
          <form onSubmit={saveAccount} className="flex flex-col gap-4">
            <p className="text-sm text-muted">{t('pf.email')} <strong className="text-ink">{user?.email}</strong></p>
            <FormField id="p-name" label={t('pf.name')}>{(c) => <input {...c} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={inputClassName} />}</FormField>
            <FormField id="p-phone" label={t('pf.phone')}>{(c) => <input {...c} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} className={inputClassName} />}</FormField>
            <Button type="submit" disabled={busy} className="self-start">{t('common.save')}</Button>
          </form>
        </Card>

        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-navy">{t('pf.travelPrefs')}</h2>
              <p className="mt-1 text-sm text-muted">{traveler.data?.completedAt ? t('pf.lastUpdate', { date: new Date(traveler.data.updatedAt ?? traveler.data.completedAt).toLocaleDateString(meta.bcp47) }) : t('pf.surveyPending')}</p>
            </div>
            <ButtonLink to="/bienvenida?editar=1" variant="secondary">{t('pf.updatePrefs')}</ButtonLink>
          </div>

          {traveler.loading ? <Spinner /> : rows.length === 0 ? (
            <p className="mt-4 text-muted">{t('pf.tellCompanion')}</p>
          ) : (
            <>
              <div className="mt-4 flex items-center gap-2"><h3 className="font-semibold text-ink">{t('pf.declaredTitle')}</h3><Badge tone="teal">{t('pf.declaredBadge')}</Badge></div>
              <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {rows.map((r) => <div key={r.id}><dt className="text-xs text-muted">{r.label}</dt><dd className="text-sm text-ink">{r.answer}</dd></div>)}
              </dl>
            </>
          )}

          {inferred.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-2"><h3 className="font-semibold text-ink">{t('pf.inferredTitle')}</h3><Badge tone="warn">{t('pf.inferredBadge')}</Badge></div>
              <p className="mt-1 text-sm text-muted">{t('pf.inferredNote')}</p>
              <ul className="mt-2 flex flex-col gap-2">
                {inferred.map(([key, item]) => (
                  <li key={key} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                    <span>{item.text}</span>
                    <button type="button" className="text-danger underline" onClick={async () => { await dismissInference(db, user!.uid, key); traveler.reload() }}>{t('pf.remove')}</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {rows.length > 0 && (
          <Card>
            <h2 className="mb-4 text-xl font-semibold text-navy">{t('pf.destinationsForYou')}</h2>
            <Recommendations answers={declared} />
          </Card>
        )}

        <Card>
          <h2 className="mb-2 text-xl font-semibold text-navy">{t('pf.privacyTitle')}</h2>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={profile.aiPersonalization} onChange={(e) => void toggleConsent(e.target.checked)} className="mt-1 size-4 accent-[var(--primary)]" />
            <span>{t('pf.consent')}</span>
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="danger" onClick={async () => {
              if (!window.confirm(t('pf.confirmDeleteChats'))) return
              const n = await deleteAllChats(db, user!.uid)
              setMessage({ tone: 'success', text: t('pf.deletedChats', { count: n }) })
            }}>{t('pf.deleteChats')}</Button>
            <Button variant="danger" onClick={async () => {
              if (!window.confirm(t('pf.confirmDeleteProfile'))) return
              await deleteProfile(db, user!.uid)
              traveler.reload()
              setMessage({ tone: 'success', text: t('pf.deletedProfile') })
            }}>{t('pf.deleteProfile')}</Button>
          </div>
          <p className="mt-3 text-xs text-muted">{t('pf.law')}</p>
        </Card>

        <Card>
          <h2 className="mb-2 text-xl font-semibold text-navy">{t('pf.useMode')}</h2>
          <p className="text-muted">{t('pf.usingAs')} <strong className="text-ink">{t('pf.asGuest')}</strong>{profile.isHost ? <> {t('pf.andAs')} <strong className="text-ink">{t('pf.asHost')}</strong></> : ''}. {t('pf.sameAccount')}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <ButtonLink to="/reservas" variant="ghost" className="border border-line">{t('nav.myBookings')}</ButtonLink>
            <ButtonLink to="/anfitrion" variant="secondary">{profile.isHost ? t('pf.goHostPanel') : t('pf.wantHost')}</ButtonLink>
          </div>
          <p className="mt-3 text-sm text-muted"><Link to="/favoritos" className="underline">{t('pf.seeFavorites')}</Link></p>
        </Card>
      </div>
    </Container>
  )
}

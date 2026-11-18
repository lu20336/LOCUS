/** Bienvenida: encuesta conversacional de preferencias (primer ingreso o «Actualizar mis preferencias»). */
import { useState } from 'react'
import { useI18n } from '../lib/i18n/I18nProvider'
import { useNavigate, useSearchParams } from 'react-router'
import { SurveyChat } from '../components/agent/SurveyChat'
import { Recommendations } from '../components/Recommendations'
import { ButtonLink, Card, Container, Spinner } from '../components/ui'
import { useAuth } from '../lib/auth/authContext'
import { db } from '../lib/firebase/client'
import { loadProfile, saveDeclared } from '../lib/profile/profileService'
import type { Answers } from '../lib/profile/survey'
import { useAsync } from '../lib/useAsync'

export default function OnboardingPage() {
  const { t } = useI18n()
  const { user, profile, updateProfile } = useAuth()
  const [params] = useSearchParams()
  const editing = params.get('editar') === '1'
  const navigate = useNavigate()
  const existing = useAsync(() => loadProfile(db, user!.uid), [user?.uid])
  const [result, setResult] = useState<Answers | null>(null)

  if (existing.loading || !profile) return <Container className="py-10"><Spinner label={t('ob.preparing')} /></Container>
  const firstName = (profile.displayName || user?.displayName || '').split(' ')[0]

  async function finish(answers: Answers, consent: boolean) {
    await saveDeclared(db, user!.uid, answers, true)
    await updateProfile({ onboardingCompleted: true, aiPersonalization: consent })
    setResult(answers)
  }

  if (result) {
    return (
      <Container className="max-w-4xl py-8 sm:py-12">
        <Card>
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-soft">{t('ob.readyEyebrow')}</p>
          <h1 id="page-title" tabIndex={-1} className="mt-1 text-3xl font-semibold text-navy focus:outline-none sm:text-4xl">{t('ob.readyTitle')}</h1>
          <p className="mt-2 text-muted">{t('ob.readyText')}</p>
          <div className="mt-6"><Recommendations answers={result} /></div>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink to="/">{t('trips.planTrip')}</ButtonLink>
            <ButtonLink to="/explorar" variant="secondary">{t('agent.guided.listings')}</ButtonLink>
            <ButtonLink to="/perfil" variant="ghost" className="border border-line">{t('ob.goProfile')}</ButtonLink>
          </div>
        </Card>
      </Container>
    )
  }

  return (
    <Container className="max-w-2xl py-8 sm:py-12">
      <h1 id="page-title" tabIndex={-1} className="mb-1 text-3xl font-semibold text-navy focus:outline-none sm:text-4xl">
        {editing ? t('ob.editTitle') : firstName ? t('ob.welcomeNamed', { name: firstName }) : t('ob.welcome')}
      </h1>
      <p className="mb-6 text-muted">{editing ? t('ob.editIntro') : t('ob.intro')}</p>
      <Card>
        <SurveyChat
          name={firstName}
          initial={editing ? (existing.data?.declared ?? {}) : {}}
          editing={editing}
          onFinish={finish}
          onLater={async () => {
            await updateProfile({ onboardingSkipped: true })
            navigate('/')
          }}
        />
      </Card>
    </Container>
  )
}

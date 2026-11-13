/** Bienvenida: encuesta conversacional de preferencias (primer ingreso o «Actualizar mis preferencias»). */
import { useState } from 'react'
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
  const { user, profile, updateProfile } = useAuth()
  const [params] = useSearchParams()
  const editing = params.get('editar') === '1'
  const navigate = useNavigate()
  const existing = useAsync(() => loadProfile(db, user!.uid), [user?.uid])
  const [result, setResult] = useState<Answers | null>(null)

  if (existing.loading || !profile) return <Container className="py-10"><Spinner label="Preparando tu bienvenida…" /></Container>
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
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-soft">Tu perfil de viajero está listo</p>
          <h1 id="page-title" tabIndex={-1} className="mt-1 text-3xl font-semibold text-navy focus:outline-none sm:text-4xl">Esto creemos que te va a gustar</h1>
          <p className="mt-2 text-muted">Recomendaciones basadas en lo que me contaste. Puedes cambiar tus respuestas cuando quieras desde tu perfil.</p>
          <div className="mt-6"><Recommendations answers={result} /></div>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink to="/">Planear un viaje</ButtonLink>
            <ButtonLink to="/explorar" variant="secondary">Ver hospedajes</ButtonLink>
            <ButtonLink to="/perfil" variant="ghost" className="border border-line">Ir a mi perfil</ButtonLink>
          </div>
        </Card>
      </Container>
    )
  }

  return (
    <Container className="max-w-2xl py-8 sm:py-12">
      <h1 id="page-title" tabIndex={-1} className="mb-1 text-3xl font-semibold text-navy focus:outline-none sm:text-4xl">
        {editing ? 'Actualiza tus preferencias' : `Bienvenido${firstName ? `, ${firstName}` : ''}`}
      </h1>
      <p className="mb-6 text-muted">{editing ? 'Repasa tus respuestas: mantén las que siguen igual y cambia las demás.' : 'Cuéntame cómo te gusta viajar y te recomiendo mejor. Son pocas preguntas y puedes omitir las que quieras.'}</p>
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

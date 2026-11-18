import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { FormField, inputClassName } from '../components/FormField'
import { Alert, Button, Card, Container } from '../components/ui'
import { authErrorMessage, useAuth } from '../lib/auth/authContext'
import { useEmulators } from '../lib/firebase/client'
import { useI18n } from '../lib/i18n/I18nProvider'

type Mode = 'signin' | 'signup' | 'reset'

/** Solo se permite volver a rutas internas (evita redirecciones a otros sitios). */
const safeNext = (value: string | null) => (value && value.startsWith('/') && !value.startsWith('//') ? value : '/')

export default function LoginPage() {
  const { t } = useI18n()
  const { user, loading, signIn, signUp, signInWithGoogle, resetPassword } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const next = safeNext(params.get('next'))
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && user) navigate(next, { replace: true })
  }, [loading, user, next, navigate])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (mode === 'signup' && name.trim().length < 2) return setError(t('auth.validation.name'))
    if (!email.includes('@')) return setError(t('auth.validation.email'))
    if (mode !== 'reset' && password.length < 6) return setError(t('auth.validation.password'))
    setBusy(true)
    try {
      if (mode === 'signin') await signIn(email.trim(), password)
      else if (mode === 'signup') await signUp(email.trim(), password, name.trim())
      else {
        await resetPassword(email.trim())
        setInfo(t('auth.resetSent'))
      }
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    setError(null)
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const title = t(`auth.title.${mode}`)
  return (
    <Container className="py-10 sm:py-16">
      <div className="mx-auto max-w-md">
        <Card>
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-soft">{t('auth.eyebrow')}</p>
          <h1 id="page-title" tabIndex={-1} className="mt-1 text-3xl font-semibold text-navy focus:outline-none">{title}</h1>
          {mode === 'signup' && <p className="mt-2 text-sm text-muted">{t('auth.signupIntro')}</p>}
          {useEmulators && <div className="mt-3"><Alert tone="info">{t('auth.emulatorNotice')}</Alert></div>}

          <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-4">
            {mode === 'signup' && (
              <FormField id="name" label={t('auth.name')}>
                {(c) => <input {...c} type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClassName} />}
              </FormField>
            )}
            <FormField id="email" label={t('auth.email')}>
              {(c) => <input {...c} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClassName} />}
            </FormField>
            {mode !== 'reset' && (
              <FormField id="password" label={t('auth.password')}>
                {(c) => (
                  <input {...c} type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClassName} />
                )}
              </FormField>
            )}
            {error && <Alert>{error}</Alert>}
            {info && <Alert tone="success">{info}</Alert>}
            <Button type="submit" disabled={busy}>
              {busy ? t('auth.busy') : t(`auth.submit.${mode}`)}
            </Button>
          </form>

          {mode !== 'reset' && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs text-muted" aria-hidden="true">
                <span className="h-px flex-1 bg-line" /> {t('common.or')} <span className="h-px flex-1 bg-line" />
              </div>
              <Button variant="secondary" onClick={google} disabled={busy} className="w-full">{t('auth.google')}</Button>
            </>
          )}

          <div className="mt-6 flex flex-col gap-2 text-sm">
            {mode === 'signin' && (
              <>
                <button type="button" className="text-left font-semibold text-ink underline underline-offset-2" onClick={() => { setMode('signup'); setError(null) }}>{t('auth.firstTime')}</button>
                <button type="button" className="text-left text-muted underline underline-offset-2" onClick={() => { setMode('reset'); setError(null) }}>{t('auth.forgot')}</button>
              </>
            )}
            {mode !== 'signin' && (
              <button type="button" className="text-left font-semibold text-ink underline underline-offset-2" onClick={() => { setMode('signin'); setError(null); setInfo(null) }}>
                {t('auth.haveAccount')}
              </button>
            )}
          </div>
        </Card>
      </div>
    </Container>
  )
}

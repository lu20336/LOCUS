/**
 * PLANES Y SUSCRIPCIONES (DEMOSTRATIVO).
 * Muestra la propuesta comercial de LOCUS para viajeros y anfitriones: planes,
 * precio mensual/anual, comparación, promociones y la simulación del cambio de
 * plan. NO cobra nada ni guarda datos de pago; la pasarela real se conecta
 * después en lib/plans/payments.ts. Detalle y supuestos: docs/NEGOCIO.md.
 */
import { Copy, Gift, Rocket, Tag } from 'lucide-react'
import { useMemo, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ComparisonTable } from '../components/plans/ComparisonTable'
import { PlanCard, type PlanAction } from '../components/plans/PlanCard'
import { useToast } from '../components/Toast'
import { Alert, Badge, Button, Card, Container, PageHeader } from '../components/ui'
import { useAuth } from '../lib/auth/authContext'
import { formatCOP, formatDate } from '../lib/format'
import { usePlans } from '../lib/plans/planContext'
import {
  COUPONS,
  COUPON_ERRORS,
  STATUS_LABEL,
  firstChargeCOP,
  plansFor,
  priceFor,
  referralCode,
  validateCoupon,
  type Audience,
  type Interval,
  type Plan,
} from '../lib/plans/plans'

const FAQ = [
  { q: '¿Se cobra algo hoy?', a: 'No. Esta es una demostración: los planes y precios son de prueba, no se pide ninguna tarjeta y no se hace ningún cobro.' },
  { q: '¿Qué pasará cuando haya pagos reales?', a: 'Te avisaremos antes y tendrás que aceptar el cambio. Tu plan demostrativo no generará deudas ni cobros automáticos.' },
  { q: '¿Puedo cambiar o cancelar cuando quiera?', a: 'Sí. Puedes pasar a otro plan o volver a Free en cualquier momento desde esta página.' },
  { q: '¿Se limitan las funciones esenciales en Free?', a: 'No. Explorar, comparar, guardar favoritos y gestionar tus reservas están siempre disponibles, con seguridad y privacidad iguales en todos los planes.' },
]

export default function PlansPage() {
  const { user, profile } = useAuth()
  const { planFor, subscriptionFor, choose, cancel } = usePlans()
  const toast = useToast()
  const navigate = useNavigate()
  const [audience, setAudience] = useState<Audience>(profile?.isHost ? 'host' : 'guest')
  const [interval, setInterval] = useState<Interval>('annual')
  const [selected, setSelected] = useState<Plan | null>(null)
  const [coupon, setCoupon] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const plans = plansFor(audience)
  const current = planFor(audience)
  const sub = subscriptionFor(audience)
  const code = user ? referralCode(user.uid) : null

  const trial = Boolean(selected && selected.trialDays > 0 && current.monthlyCOP === 0)
  const couponCheck = useMemo(() => (selected && coupon.trim() ? validateCoupon(coupon, selected) : null), [selected, coupon])
  const appliedCoupon = couponCheck?.ok ? couponCheck.coupon : undefined
  const periodPrice = selected ? priceFor(selected, interval) : null
  const firstCharge = selected ? (trial ? 0 : firstChargeCOP(selected, interval, appliedCoupon)) : 0

  function actionFor(plan: Plan): PlanAction {
    if (!user) return 'login'
    if (plan.id === current.id) return 'current'
    if (plan.monthlyCOP === 0) return 'downgrade'
    return current.monthlyCOP === 0 && plan.trialDays > 0 ? 'trial' : 'choose'
  }

  function select(plan: Plan) {
    if (!user) {
      navigate('/ingresar?next=/planes')
      return
    }
    setCoupon('')
    setSelected(plan)
  }

  async function confirm() {
    if (!selected) return
    setBusy(true)
    try {
      await choose(selected, interval, { couponCode: appliedCoupon?.code, trial })
      toast(selected.monthlyCOP === 0 ? 'Volviste al plan Free (demostración)' : `Ahora tienes ${selected.name} (demostración, sin cobro)`)
      setSelected(null)
    } finally {
      setBusy(false)
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast('Código copiado', { tone: 'info' })
    } catch {
      toast(`Tu código: ${text}`, { tone: 'info' })
    }
  }

  const tabClass = (on: boolean) => `rounded-full px-5 py-2 text-sm font-semibold transition-colors ${on ? 'bg-navy text-surface' : 'text-ink hover:bg-surface-2'}`

  return (
    <Container className="max-w-6xl py-8 sm:py-12">
      <PageHeader eyebrow="Planes" title="Elige cómo quieres viajar con LOCUS">
        Empieza gratis y mejora cuando lo necesites. Hay un plan para quien viaja y otro para quien recibe viajeros.
      </PageHeader>

      <Alert tone="info">
        <strong>Demostración:</strong> los planes, precios y promociones son de prueba. No se cobra nada ni se pide ninguna tarjeta; sirven para validar la propuesta antes de activar pagos reales.
      </Alert>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div role="group" aria-label="Tipo de plan" className="inline-flex rounded-full border border-line bg-surface p-1">
          <button type="button" aria-pressed={audience === 'guest'} onClick={() => setAudience('guest')} className={tabClass(audience === 'guest')}>Para viajeros</button>
          <button type="button" aria-pressed={audience === 'host'} onClick={() => setAudience('host')} className={tabClass(audience === 'host')}>Para anfitriones</button>
        </div>
        <div role="group" aria-label="Periodo de cobro" className="inline-flex items-center rounded-full border border-line bg-surface p-1">
          <button type="button" aria-pressed={interval === 'monthly'} onClick={() => setInterval('monthly')} className={tabClass(interval === 'monthly')}>Mensual</button>
          <button type="button" aria-pressed={interval === 'annual'} onClick={() => setInterval('annual')} className={tabClass(interval === 'annual')}>
            Anual <span className={`ml-1 text-xs font-bold ${interval === 'annual' ? 'text-surface' : 'text-teal-soft'}`}>−17 %</span>
          </button>
        </div>
      </div>

      {user && sub && (
        <Card className="anim-rise mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-soft">Tu suscripción</p>
              <p className="font-serif text-xl font-semibold text-navy">{current.name} <Badge tone={sub.status === 'trialing' ? 'warn' : 'teal'}>{STATUS_LABEL[sub.status]}</Badge></p>
              <p className="text-sm text-muted">
                {sub.status === 'trialing' && sub.trialEndsAt ? `Tu prueba gratuita termina el ${formatDate(sub.trialEndsAt)}. ` : ''}
                Facturación {sub.interval === 'annual' ? 'anual' : 'mensual'} · desde {formatDate(sub.startedAt)}
                {sub.couponCode ? ` · cupón ${sub.couponCode}` : ''} · demostración
              </p>
            </div>
            <Button variant="danger" className="!py-2" onClick={() => setConfirmCancel(true)}>Cancelar suscripción</Button>
          </div>
        </Card>
      )}

      <ul className={`anim-stagger mt-8 grid gap-6 ${audience === 'guest' || plans.length === 3 ? 'lg:grid-cols-3' : ''}`}>
        {plans.map((plan, i) => (
          <li key={plan.id} style={{ '--i': i } as CSSProperties}>
            <PlanCard plan={plan} interval={interval} action={actionFor(plan)} featured={plan.badge === 'popular' || plan.badge === 'recommended'} onSelect={() => select(plan)} />
          </li>
        ))}
      </ul>

      <section aria-label="Promociones" className="mt-12">
        <h2 className="text-2xl font-semibold text-navy">Promociones de lanzamiento</h2>
        <p className="mt-1 text-sm text-muted">Valores demostrativos: úsalos al elegir un plan.</p>
        <ul className="mt-4 grid gap-4 md:grid-cols-3">
          <li className="rounded-3xl border border-line bg-surface p-5">
            <Rocket aria-hidden="true" className="size-6 text-teal-soft" />
            <p className="mt-2 font-semibold text-ink">Lanzamiento · 30 % menos</p>
            <p className="text-sm text-muted">Los primeros 3 meses de cualquier plan de pago.</p>
            <button type="button" onClick={() => void copy('LANZAMIENTO30')} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-teal px-3 py-1.5 font-mono text-sm font-bold text-ink hover:bg-teal/10"><Copy aria-hidden="true" className="size-4" />LANZAMIENTO30</button>
          </li>
          <li className="rounded-3xl border border-line bg-surface p-5">
            <Gift aria-hidden="true" className="size-6 text-teal-soft" />
            <p className="mt-2 font-semibold text-ink">Invita a un amigo</p>
            <p className="text-sm text-muted">Tu amigo recibe 20 % el primer mes (código AMIGO20) y tú sumas beneficios cuando existan.</p>
            {code ? (
              <button type="button" onClick={() => void copy(code)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-teal px-3 py-1.5 font-mono text-sm font-bold text-ink hover:bg-teal/10"><Copy aria-hidden="true" className="size-4" />{code}</button>
            ) : (
              <Link to="/ingresar?next=/planes" className="mt-3 inline-block text-sm font-semibold text-teal-soft underline">Ingresa para obtener tu código</Link>
            )}
          </li>
          <li className="rounded-3xl border border-line bg-surface p-5">
            <Tag aria-hidden="true" className="size-6 text-teal-soft" />
            <p className="mt-2 font-semibold text-ink">Anfitriones Fundadores</p>
            <p className="text-sm text-muted">Host Pro gratis los primeros 3 meses para quienes publican primero.</p>
            <button type="button" onClick={() => void copy('FUNDADOR')} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-teal px-3 py-1.5 font-mono text-sm font-bold text-ink hover:bg-teal/10"><Copy aria-hidden="true" className="size-4" />FUNDADOR</button>
          </li>
        </ul>
      </section>

      <section aria-label="Comparación de planes" className="mt-12">
        <h2 className="mb-4 text-2xl font-semibold text-navy">Compara los planes</h2>
        <ComparisonTable audience={audience} currentPlanId={current.id} />
        <p className="mt-3 text-xs text-muted">
          Las funciones marcadas «Próximamente» todavía no existen en LOCUS. Los límites son de referencia y hoy no restringen reservas, seguridad ni privacidad.
          {audience === 'host' && ' Modelo para anfitriones: suscripción + comisión por reserva que baja a mayor plan (ver docs/NEGOCIO.md).'}
        </p>
      </section>

      <section aria-label="Preguntas frecuentes" className="mt-12 max-w-3xl">
        <h2 className="mb-3 text-2xl font-semibold text-navy">Preguntas frecuentes</h2>
        <div className="flex flex-col gap-2">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-2xl border border-line bg-surface px-4 py-3">
              <summary className="cursor-pointer list-none font-semibold text-ink marker:hidden">{f.q}</summary>
              <p className="mt-2 text-sm text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(selected)}
        title={selected?.monthlyCOP === 0 ? 'Volver al plan Free' : `Elegir ${selected?.name ?? ''}`}
        confirmLabel={selected?.monthlyCOP === 0 ? 'Volver a Free' : trial ? `Empezar prueba de ${selected?.trialDays} días` : 'Confirmar (simulado)'}
        busy={busy}
        onConfirm={() => void confirm()}
        onCancel={() => setSelected(null)}
      >
        {selected && periodPrice && (
          <div className="flex flex-col gap-3">
            {selected.monthlyCOP > 0 ? (
              <>
                <dl className="grid grid-cols-2 gap-y-1">
                  <dt className="text-muted">Plan</dt><dd className="text-right font-semibold text-ink">{selected.name}</dd>
                  <dt className="text-muted">Periodo</dt><dd className="text-right font-semibold text-ink">{interval === 'annual' ? 'Anual' : 'Mensual'}</dd>
                  <dt className="text-muted">Precio</dt><dd className="text-right font-semibold text-ink">{formatCOP(periodPrice.periodCOP)} / {interval === 'annual' ? 'año' : 'mes'}</dd>
                  {trial && <><dt className="text-muted">Prueba gratuita</dt><dd className="text-right font-semibold text-ink">{selected.trialDays} días</dd></>}
                  <dt className="text-muted">Se cobraría hoy</dt><dd className="text-right text-lg font-bold text-navy">{formatCOP(firstCharge)}</dd>
                </dl>
                <div>
                  <label htmlFor="plan-coupon" className="font-semibold text-ink">¿Tienes un código?</label>
                  <input
                    id="plan-coupon"
                    value={coupon}
                    onChange={(e) => setCoupon(e.target.value)}
                    placeholder="Ej. LANZAMIENTO30"
                    autoComplete="off"
                    className="mt-1 w-full rounded-xl border border-line bg-surface px-4 py-2.5 font-mono text-base uppercase text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
                  />
                  <p aria-live="polite" className={`mt-1 min-h-5 text-sm ${couponCheck && !couponCheck.ok ? 'text-danger' : 'text-teal-soft'}`}>
                    {couponCheck ? (couponCheck.ok ? couponCheck.coupon.label : COUPON_ERRORS[couponCheck.reason]) : ''}
                  </p>
                  {!coupon && <p className="text-xs text-muted">Códigos de ejemplo: {COUPONS.map((c) => c.code).join(', ')}.</p>}
                </div>
              </>
            ) : (
              <p>Perderás las funciones de pago de tu plan actual al terminar el periodo demostrativo.</p>
            )}
            <p className="rounded-xl bg-surface-2 p-3 text-xs text-muted">Demostración: no se realizará ningún cobro ni se guardarán datos de pago.</p>
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmCancel}
        title="¿Cancelar tu suscripción?"
        confirmLabel="Cancelar suscripción"
        danger
        busy={busy}
        onConfirm={async () => {
          setBusy(true)
          await cancel(audience)
          setBusy(false)
          setConfirmCancel(false)
          toast('Suscripción cancelada (demostración)', { tone: 'info' })
        }}
        onCancel={() => setConfirmCancel(false)}
      >
        <p>Volverás al plan Free. Tus viajes, favoritos y reservas no se tocan.</p>
      </ConfirmDialog>
    </Container>
  )
}

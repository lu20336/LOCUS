/**
 * Páginas informativas y legales: cómo gana dinero LOCUS (transparencia con los
 * afiliados), privacidad y términos.
 *
 * ⚠ BORRADOR: antes de lanzar en serio deben revisarlas un abogado y, para
 * privacidad, alinearse con la Ley 1581 de 2012 (habeas data) y la SIC. Ver
 * docs/NEGOCIO.md → "Pendientes legales".
 */
import { useLocation } from 'react-router'
import { Alert, Container, PageHeader } from '../components/ui'
import { useI18n } from '../lib/i18n/I18nProvider'

interface Doc {
  eyebrow: string
  title: string
  intro: string
  sections: { heading: string; body: string[] }[]
}

const DOCS: Record<string, Doc> = {
  '/como-ganamos-dinero': {
    eyebrow: 'Transparencia',
    title: 'Cómo ganamos dinero',
    intro: 'LOCUS es gratis para quien viaja. Preferimos decirte cómo se financia para que puedas confiar en lo que te recomendamos.',
    sections: [
      {
        heading: 'Enlaces de afiliado',
        body: [
          'Cuando comparas en LOCUS y abres una plataforma (por ejemplo, un buscador de hoteles o de vuelos), algunos enlaces llevan un identificador de LOCUS. Si reservas allí, la plataforma puede pagarnos una comisión. A ti no te cuesta nada más: el precio es el mismo que verías entrando directo.',
          'Esos enlaces están marcados para los lectores de pantalla y para los buscadores como "patrocinados" (rel="sponsored"), y en el comparador lo avisamos.',
        ],
      },
      {
        heading: 'Reservas directas en LOCUS',
        body: [
          'Los alojamientos y experiencias de anfitriones de LOCUS se reservan en la plataforma. Hoy los pagos son simulados y no se cobra dinero. En el futuro, LOCUS cobrará una comisión al anfitrión por cada reserva confirmada; el huésped no paga cargos de servicio.',
        ],
      },
      {
        heading: 'Nuestro compromiso',
        body: [
          'No ordenamos los resultados según cuánto nos paga cada plataforma. Mostramos primero lo que LOCUS ofrece directo (con precio verificado) y luego las demás plataformas, siempre en el mismo orden.',
          'No mostramos precios de terceros que no podamos verificar. Los precios que anotas en la libreta de precios son tuyos y se guardan solo en tu navegador.',
          'LOCUS no es una agencia de viajes: la reserva y el pago de lo que no es de LOCUS se completan en la plataforma que elijas, bajo sus condiciones.',
        ],
      },
    ],
  },
  '/privacidad': {
    eyebrow: 'Privacidad',
    title: 'Política de privacidad (borrador)',
    intro: 'Qué datos usa LOCUS, para qué y con quién se comparten.',
    sections: [
      {
        heading: 'Qué guardamos',
        body: [
          'Cuenta (correo, nombre), preferencias de viaje, favoritos, itinerarios, reservas y, si lo usas, tus conversaciones con "Tu compañero LOCUS". Esa información se guarda en Firebase (Google Cloud) y solo tú puedes leerla; los anfitriones ven únicamente lo necesario para atender tu reserva.',
          'Lo que anotas en la libreta de precios del comparador se queda en tu navegador y no se envía a LOCUS.',
        ],
      },
      {
        heading: 'Con quién se comparte',
        body: [
          'Para funcionar consultamos servicios abiertos: OpenStreetMap/Nominatim (búsqueda de lugares), OpenFreeMap (mapas), Open-Meteo (clima) y Wikimedia (fotos). Reciben el lugar o las coordenadas que consultas, no tu identidad.',
          'El compañero usa la API de Gemini de Google. En el nivel gratuito Google puede usar las conversaciones para mejorar sus productos: no compartas datos sensibles (documentos, tarjetas, salud). LOCUS no envía tu nombre ni tu correo al modelo.',
          'Al abrir un enlace del comparador sales de LOCUS y aplica la política de esa plataforma.',
        ],
      },
      {
        heading: 'Tus derechos',
        body: [
          'Puedes conocer, actualizar, rectificar y pedir la eliminación de tus datos (Ley 1581 de 2012, habeas data). Mientras se define el canal oficial de contacto, puedes borrar tus favoritos, itinerarios y conversaciones desde la propia aplicación.',
        ],
      },
    ],
  },
  '/terminos': {
    eyebrow: 'Condiciones',
    title: 'Términos de uso (borrador)',
    intro: 'Reglas básicas para usar LOCUS mientras el proyecto está en desarrollo.',
    sections: [
      {
        heading: 'Qué es LOCUS',
        body: [
          'LOCUS ayuda a descubrir, planear y comparar viajes por Colombia. Algunos alojamientos y experiencias son publicados por anfitriones independientes; LOCUS facilita la reserva pero no es el prestador del servicio.',
          'Los pagos dentro de LOCUS son simulados durante esta etapa: no se cobra ni se devuelve dinero real.',
        ],
      },
      {
        heading: 'Información de terceros',
        body: [
          'Los datos de OpenStreetMap, el clima y los enlaces a otras plataformas se muestran como referencia. Los horarios, precios y disponibilidad pueden cambiar: confírmalos antes de viajar.',
        ],
      },
      {
        heading: 'Anfitriones',
        body: [
          'Quien publica un alojamiento o experiencia debe cumplir la normativa colombiana aplicable, incluido el Registro Nacional de Turismo (RNT) cuando corresponda, y es responsable de la veracidad de su publicación. LOCUS puede retirar publicaciones que incumplan estas reglas.',
        ],
      },
    ],
  },
}

export default function LegalPage() {
  const { t, locale } = useI18n()
  const { pathname } = useLocation()
  const doc = DOCS[pathname] ?? DOCS['/como-ganamos-dinero']
  return (
    <Container className="max-w-3xl py-8 sm:py-12">
      <PageHeader eyebrow={doc.eyebrow} title={doc.title}>
        {doc.intro}
      </PageHeader>
      {locale !== 'es' && <div className="mb-3"><Alert tone="info">{t('legal.onlySpanish')}</Alert></div>}
      {pathname !== '/como-ganamos-dinero' && (
        <Alert tone="info">Documento en borrador: será revisado por un abogado antes del lanzamiento comercial.</Alert>
      )}
      <div className="mt-6 flex flex-col gap-8">
        {doc.sections.map((s) => (
          <section key={s.heading} aria-label={s.heading}>
            <h2 className="text-xl font-semibold text-navy">{s.heading}</h2>
            <div className="mt-2 flex flex-col gap-3 text-ink">
              {s.body.map((p) => (
                <p key={p.slice(0, 30)}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Container>
  )
}

# LOCUS · Estrategia, modelo de negocio y hoja de ruta

> Documento de trabajo para presentar y escalar LOCUS. Mezcla **lo que ya existe en el código** (✅) con **hipótesis y
> planes** (🧪 por validar · 🔒 requiere autorización/cuenta de pago · ⚖️ requiere revisión legal). Las cifras de
> comisiones y de mercado son **órdenes de magnitud a verificar** con cada programa antes de usarlas en una proyección
> formal; no son compromisos.

## 1. Visión y posicionamiento

**Visión:** que planear un viaje por Colombia deje de requerir 20 pestañas. LOCUS es el lugar donde se **planea,
se compara y se reserva** todo: hospedaje, vuelos, experiencias, transporte y seguro.

**Una frase:** *"Todo tu viaje por Colombia, en un solo lugar."* · Lema corto: **Planea · Compara · Reserva.**

**Qué nos diferencia** (por qué no somos "otro Kayak"):

| Pilar | Qué lo hace distinto |
|---|---|
| **Planea** (✅) | Itinerario día a día con lugares reales (OpenStreetMap), ritmo, clima por día, excursiones a pueblos cercanos y un compañero de IA en español de Colombia que usa datos verificados. |
| **Compara** (✅ fase 1) | Un solo formulario (destino, fechas, viajeros) abre Booking, Airbnb, Expedia, Vrbo, vuelos, tours, bus, carro y seguro con la búsqueda ya puesta, más una *libreta de precios* que dice cuál conviene. |
| **Reserva directo** (✅ base) | Catálogo propio de anfitriones locales (fincas, cabañas, experiencias): precio real, sin cargos de servicio para el huésped, con reglas de disponibilidad a prueba de doble reserva. |
| **Foco Colombia** | Pesos, PSE/cuotas (futuro), municipios pequeños, fincas y turismo de naturaleza que las grandes plataformas cubren mal. |

**Competencia:** Booking/Airbnb/Despegar (venden), Google Travel/Kayak/Skyscanner/trivago (comparan, sin foco local ni
planeación), TripAdvisor (contenido). Nuestro espacio: **planeación + comparación + oferta local en un mismo flujo**.

## 2. Clientes

1. **Viajero nacional (25-45 años)**, planea fines de semana largos y vacaciones; compara mucho, desconfía de los precios.
2. **Grupos y familias** que buscan fincas/casas completas (Airbnb/Vrbo/locales) y necesitan coordinar.
3. **Extranjero/diáspora** que arma un viaje por varias ciudades y no conoce el país.
4. **Anfitrión pequeño** (finca, cabaña, apartamento, guía) sin presencia fuerte en las grandes OTAs: lado de la oferta.
5. (Futuro) **B2B:** alcaldías, gobernaciones, gremios y hoteles que quieren visibilidad y datos de demanda.

## 3. ¿"Intermediario de intermediarios"? Lo que es posible, y cómo llegar

Comparar **precios en vivo** de Booking vs Airbnb vs aerolíneas dentro de LOCUS exige datos que esas empresas **no
entregan gratis**, y **extraerlos de sus páginas (scraping) viola sus términos** y se rompe cada semana. Por eso el camino
es por fases, sin atajos ilegales:

| Fase | Qué ve el usuario | Cómo funciona | Estado |
|---|---|---|---|
| **1 · Comparador de búsquedas** | Un lugar, muchas plataformas, búsqueda ya puesta + libreta de precios + "el mismo alojamiento en otras plataformas". | Enlaces con parámetros públicos (`src/lib/compare`). Precio verificado solo del catálogo LOCUS. | ✅ **Hecho** |
| **2 · Precios de referencia / en vivo** | **Vuelos:** "desde $X" (caché de Aviasales) con botón a Aviasales. Hoteles y tours: cuando haya aprobación de socio. | Worker gratis de Cloudflare + API de datos de Travelpayouts (`workers/prices`, `docs/PRECIOS_EN_VIVO.md`). | 🟡 Código listo; falta activar cuentas |
| **3 · Reserva dentro de LOCUS** | Reservar y pagar sin salir. | Modelo agencia/OTA: pasarela real, RNT, facturación, seguros, soporte. | ⚖️🔒 Largo plazo |

La interfaz ya está lista para la Fase 2: el tipo `PriceQuote` (`providers.ts`) y la `PriceNotebook` aceptan cotizaciones
`source: 'api'` sin rehacer la pantalla.

### 3.1 Fuentes de precios reales (a evaluar; verificar disponibilidad y condiciones vigentes)

| Necesidad | Opciones | Nota |
|---|---|---|
| Vuelos | Travelpayouts/Aviasales (datos para afiliados), Duffel (venta real, pago por orden), Skyscanner Partner API, Kiwi | Amadeus Self-Service cerró en jul-2026 (ver `docs/PROVEEDORES.md`). Cada opción exige alta como socio. |
| Hoteles | Booking.com Affiliate/Demand API, Expedia Rapid, Hotellook (Travelpayouts) | Booking pide tráfico demostrable. |
| Casas/fincas | Programas de afiliados de Vrbo/Expedia; Airbnb **no** ofrece API pública de precios. | Para Airbnb se queda el enlace profundo. |
| Tours | GetYourGuide, Viator, Civitatis (afiliados + feeds) | Comisiones conocidas (~8 % orden de magnitud). |

### 3.2 Decisión pendiente: capa de servidor (🔒 necesita tu autorización)

Las claves de esas APIs **no pueden ir en el frontend**. Opciones:

1. **Cloudflare Workers (gratis hasta ~100 000 solicitudes/día):** sin tarjeta, ideal para empezar. *(Elegida: ya está implementado en `workers/prices`.)*
2. **Firebase Cloud Functions:** exige pasar el proyecto a **Blaze** (pago por uso, con cuota gratuita y tarjeta).

Mientras tanto la Fase 1 funciona 100 % en el frontend.

## 4. Modelo de ingresos

| Fuente | Mecánica | Cuándo | Observaciones |
|---|---|---|---|
| **Afiliados** | Comisión por reservas hechas tras un clic desde LOCUS (hoteles, tours, seguros; vuelos pagan poco). | Fase 1 (ya preparado: `VITE_AFF_*`) | Se activa al abrir cuentas de afiliado; enlaces con `rel="sponsored"` y aviso en `/como-ganamos-dinero`. |
| **Comisión al anfitrión** | % por reserva confirmada del catálogo propio. Huésped paga 0. | Con pagos reales | Referencia de mercado 8-15 %; ofrecer **0 % a "Anfitriones Fundadores"** los primeros meses para captar oferta. |
| **Destacados** | Anfitriones/destinos pagan por aparecer arriba (siempre etiquetado "Patrocinado"). | Con masa crítica | Nunca altera el orden de comparación orgánico. |
| **Suscripciones anfitrión (SaaS)** | Calendario, precios dinámicos, panel, canal sincronizado. | Después | Fuente recurrente. |
| **B2B / entes de turismo** | Paneles de demanda, campañas por destino. | Con datos | Requiere privacidad bien resuelta (⚖️). |
| **Premium viajero** | Alertas de precio, itinerarios ilimitados con IA, seguro integrado. | Después | Cuidar costo de IA (hoy: tope de 60 mensajes/día/usuario). |

### Ilustración (hipótesis, no proyección)

`ingresos = visitantes × %clic saliente × %reserva × ticket medio × comisión`

Ejemplo: 100 000 visitantes/mes × 30 % clic × 8 % reservan × COP 900 000 × 4 % ≈ **COP 86 millones/mes** (~US$ 20 mil).
Cada factor se mide en LOCUS y se mejora con producto (más clics útiles, mejor conversión, más categorías). Escalar a
decenas de millones de dólares exige **audiencia a gran escala + oferta propia + reserva integrada**; el plan de abajo
ordena esos pasos.

## 5. Marketing y crecimiento

**Marca:** cálida, clara, colombiana; teal = confianza, coral = acción. Tono: "tu compañero de viaje", sin jerga.
**Promesa medible:** "te ahorras tiempo y dinero comparando en un solo lugar".

**Canales (de menor a mayor costo):**
1. **SEO programático:** una página por destino (`/destinos/:id`, ya en `sitemap.xml`) + itinerarios sugeridos
   ("3 días en Salento") + "Booking vs Airbnb en {destino}". Es el motor de largo plazo de los metabuscadores.
2. **Contenido corto** (Reels/TikTok/Shorts): "el mismo hotel, 3 precios", "fin de semana en {pueblo} por $X".
3. **Compartir plan** (✅ botón en el Paso 4: WhatsApp / compartir del sistema): bucle viral sin pedir datos.
   Siguiente: **enlace público del itinerario** (aterriza en LOCUS con el plan y el comparador).
4. **Alianzas:** creadores de viajes, alcaldías/gobernaciones, ProColombia, comunidades de anfitriones.
5. **Oferta local:** campaña "Anfitriones Fundadores" (0 % comisión, verificación gratuita).

**Métricas (NSM):** *viajes planeados que terminan en clic saliente o reserva*. Embudo: visita → destino elegido → plan
generado → comparador abierto → clic saliente → (reserva). Retención: planes guardados, regreso en 30 días.

## 6. Hoja de ruta

| Ventana | Entregables | Dependencias |
|---|---|---|
| **Ya (hecho)** | Plataforma Guest+Host, catálogo, reservas con reglas, agente IA, planificador, **comparador fase 1**, libreta de precios, páginas de transparencia/privacidad/términos (borrador), SEO base. | — |
| **0-30 días** | Abrir cuentas de afiliado (Booking, GetYourGuide, Viator, Civitatis, Travelpayouts); poner `VITE_AFF_*`; analítica respetuosa (Plausible/Umami o GA4) + Search Console; dominio propio; primeras 20 páginas SEO; reclutar 10-20 anfitriones fundadores. | Cuentas y dominio (costo bajo). |
| **30-90 días** | Fase 2 con Cloudflare Worker: precios en vivo de vuelos/hoteles/tours donde haya API; alertas de precio por correo; enlace público de itinerario; reseñas verificadas. | 🔒 Autorizar el Worker y el alta como socio. |
| **90-180 días** | Pagos reales (pasarela colombiana: Wompi/PayU/Mercado Pago) con comisión al anfitrión; verificación de anfitriones (RNT); soporte y políticas de cancelación/reembolso. | ⚖️ Sociedad (SAS), RNT, términos revisados, facturación. |
| **6-12 meses** | App móvil/PWA, multi-destino, paquetes, B2B para entes de turismo, expansión (LATAM). | Tracción y financiación. |

## 7. Pendientes legales y administrativos (⚖️ con abogado/contador)

- Constituir la sociedad (p. ej. **SAS**), RUT, cuenta bancaria empresarial y **facturación electrónica**; IVA sobre comisiones.
- **Registro Nacional de Turismo (RNT):** la normativa de turismo (Ley 2068 de 2020) impone obligaciones a quienes prestan
  servicios turísticos y a las plataformas que los intermedian; definir qué exige LOCUS a anfitriones y qué le exige a LOCUS.
- **Protección de datos:** Ley 1581 de 2012 (habeas data), política y autorización, registro de bases de datos ante la SIC si aplica.
- **Estatuto del Consumidor (Ley 1480 de 2011):** información veraz y suficiente, derecho de retracto/reversión de pago según aplique.
- **Afiliados:** mantener el aviso de transparencia (ya publicado) y respetar los términos de cada programa (p. ej. prohibiciones de pujar por la marca del socio).
- **Marca:** registro de "LOCUS" ante la SIC (clases de turismo/software); verificar que no choque con marcas existentes.
- **Términos de las plataformas:** no hacer scraping; usar solo APIs/feeds autorizados.
- **Seguridad de pagos:** delegar en la pasarela (nunca guardar tarjetas); mantener Firestore Rules y App Check.

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Dependencia de pocos afiliados o cambios en sus condiciones | Diversificar categorías y programas; catálogo propio crece como ingreso directo. |
| Enlaces profundos que cambian de formato | Pruebas unitarias del formato (`compare.test.ts`) + revisión periódica; el peor caso es abrir el buscador sin datos. |
| Confianza (¿recomiendan por comisión?) | Orden fijo y público; página de transparencia; marcar patrocinados. |
| Costo de IA | Tope por usuario, App Check, modelo "flash", herramientas de solo lectura. |
| Cold start de oferta propia | Anfitriones Fundadores + alojamientos de referencia (OSM) mientras crece. |
| Competidores grandes | Foco Colombia, planeación + IA en español, oferta local, velocidad de ejecución. |

## 9. Qué hay que hacer ahora (lista corta)

1. Decidir la capa de servidor (Cloudflare Worker gratis vs Firebase Blaze) → habilita la Fase 2.
2. Abrir cuentas de afiliado y poner `VITE_AFF_*` (ver `.env.example` y `docs/CONFIGURACION_Y_DESPLIEGUE.md`).
3. Comprar dominio, configurar analítica y Search Console.
4. Hablar con un abogado: sociedad, RNT, datos personales y términos.
5. Reclutar 10-20 anfitriones y pedirles fotos reales para el catálogo.

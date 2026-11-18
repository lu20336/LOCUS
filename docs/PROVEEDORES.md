# Proveedores y APIs: investigación y decisiones

> Investigación hecha el **2026-11-12** con documentación oficial cuando fue accesible y, cuando no,
> con fuentes secundarias (marcadas **⚠ sin verificar en fuente oficial**). Los límites y precios
> cambian: antes de depender de un número, confírmalo en el enlace del proveedor.
> Regla del proyecto: **no se declara "gratis" algo solo porque permita crear una API key.**

## Clasificación usada

| Clase | Significado |
|---|---|
| 🟢 Gratuito y viable | Se puede implementar y operar dentro de condiciones razonables sin pagar. |
| 🟡 Gratuito con límites | Sirve para empezar; puede exigir migración o pago al crecer. |
| 🟠 Solo pruebas | Útil para desarrollo, no para servicio real. |
| 🔴 Requiere contrato/aprobación | No está disponible automáticamente. |
| ⚫ Pago | No cumple el requisito inicial. |

---

## 1. Resumen de decisiones

| Necesidad | Decisión | Estado en LOCUS |
|---|---|---|
| Inteligencia artificial | **Gemini vía Firebase AI Logic** (modelo `gemini-3.8-flash`) | ✅ Implementado. 🔧 Falta que **tú** habilites Firebase AI Logic (un clic). |
| Mapas (tiles) | **MapLibre GL JS + OpenFreeMap** | ✅ Operativo |
| Geocodificación | **Nominatim** (solo por acción del usuario) | ✅ Operativo |
| Lugares de interés | **Overpass (OSM)** + **Wikipedia REST** | ✅ Operativo (Overpass es inestable) |
| Fotos de calle | **Mapillary** | 🟡 Preparado; requiere tu token de cliente |
| Hospedajes reservables | **Catálogo propio (anfitriones de LOCUS)** | ✅ Operativo |
| Hospedajes de referencia | **OpenStreetMap** (no reservables) | ✅ Operativo |
| Experiencias | **Catálogo propio** + lugares OSM | ✅ Operativo |
| Vuelos | **Descubrimiento con enlaces** (sin precios) | ✅ Operativo |
| Clima | **Open-Meteo** | ✅ Operativo (⚠ solo uso no comercial) |
| Pagos | **Simulados**; adaptador preparado para Wompi/Mercado Pago | 🔧 Pendiente de cuenta comercial |
| Correo transaccional | Correos de Firebase Auth (verificación, recuperación) | 🔧 Pendiente (requiere backend) |

---

## 2. Inteligencia artificial

### Google Gemini (elegido)

| Aspecto | Hallazgo |
|---|---|
| Vía de acceso | **Firebase AI Logic** con el *Gemini Developer API*: la API key **vive en el proyecto de Firebase**, nunca en el código ni en el navegador. Protege con **App Check**. No necesita Cloud Functions ni plan Blaze. [Docs](https://firebase.google.com/docs/ai-logic/get-started) |
| Modelos con nivel gratuito | `gemini-4-hydrogen`, `gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite` ([precios](https://aistudio.google.com/docs/pricing)). `gemini-4-argon/carbon` y `3.1-pro-preview` **no** tienen nivel gratuito. |
| Modelo elegido | **`gemini-3.8-flash`**: estable, "no requiere facturación" según [Firebase](https://firebase.google.com/docs/ai-logic/models), con herramientas (function calling). Cambiable con `VITE_GEMINI_MODEL` (alternativa más económica: `gemini-3.5-flash-lite`). |
| Límites | **Google ya no publica cifras por modelo**: se ven por proyecto en AI Studio ([doc](https://aistudio.google.com/docs/rate-limits)). Fuentes secundarias reportan entre ~20 y ~1.500 solicitudes/día en modelos Flash (**⚠ contradictorias**). Firebase AI Logic añade un límite por usuario de **100 solicitudes/min** (configurable). Al excederlo: error 429. |
| ⚠ Privacidad | En el nivel gratuito, Google **puede usar los datos para mejorar sus productos** (pricing: "Used to improve our products: Yes"). Por eso LOCUS no envía nombre ni correo, avisa al usuario y exige su consentimiento para usar el perfil. |
| Qué pasa al agotarse la cuota | La interfaz muestra "Hay mucha demanda…" y el **modo guiado** (herramientas sin IA) sigue funcionando. Pasar a pago exige vincular facturación (plan Blaze): **no se hará sin tu autorización**. |
| Clasificación | 🟡 Gratuito con límites |
| Alternativas | No se evaluaron a fondo otras APIs gratuitas de LLM; Gemini cumple (herramientas, español, sin tarjeta). Si el límite resulta insuficiente, evaluar otro proveedor antes de pagar. |

**Control de costos implementado:** tope de 60 mensajes/día por usuario (12 por sesión sin cuenta), máx. 4 rondas y 8 llamadas de herramientas por mensaje, historial recortado a 12 turnos, respuestas de ≤1.500 tokens, caché de clima (30 min) y de Overpass (24 h).

---

## 3. Mapas, geocodificación y lugares

| Servicio | Info oficial | Clase | Uso en LOCUS |
|---|---|---|---|
| **OpenFreeMap** (teselas vectoriales) | Sin API key, registro ni límites de vistas; uso comercial permitido; atribución obligatoria (MapLibre la pone sola). Donaciones opcionales. [openfreemap.org](https://openfreemap.org) | 🟢 | Mapa de toda la app (`positron` claro / `dark` oscuro). |
| **MapLibre GL JS** | Código abierto (BSD). | 🟢 | Motor del mapa (carga perezosa, ~295 kB gzip). |
| Teselas de openstreetmap.org | Política: **no apto para uso intensivo**; exige User-Agent/Referer, caché ≥7 días, sin descargas masivas; sin SLA. [Política](https://operations.osmfoundation.org/policies/tiles/) | 🟠 | **No se usa.** |
| **Nominatim** (geocodificación y búsqueda por categoría) | Máx. 1 petición/s, identificar la app, **prohíbe autocompletar por tecla** y el uso masivo; sin SLA. Respondió de forma estable en todas las pruebas. | 🟡 | Geocodificación al pulsar "Continuar"/"Buscar". **También** búsqueda por categoría (`q=hotel`, `q=museum`…) dentro de un rectángulo: sirve de alternativa a Overpass y para generar **una sola vez** el catálogo de referencia (`npm run data:reference`, ~300 peticiones a 1/s). |
| Photon (komoot) público | El mantenedor lo describe como "solo demo y pruebas", sin garantías (lista de correo, 2023). **⚠ sin política oficial publicada.** | 🟠 | No se usa. |
| **Overpass API** | Servidores comunitarios gratuitos. En la prueba del 2026-11-12 desde el navegador **ningún servidor respondió** a tiempo. Rechaza `*.web.app`. | 🟡 (inestable) | Búsqueda de lugares y alojamientos de referencia; con caché y reintentos. **Riesgo de disponibilidad** (ver ARQUITECTURA §9). |
| **Wikipedia REST (es)** | Sin key, con CORS; texto CC BY-SA 4.0 (atribución obligatoria). | 🟢 | Descripción en la ficha de destino. |
| OpenTripMap | Requiere API key; el sitio `opentripmap.io/docs` **redirigió a un dominio no verificable** durante la investigación, y no hallé aviso de cierre ni política vigente. **⚠ estado no verificable.** | ⚪ no evaluado | **No integrado.** |
| Wikidata | Sin key; datos CC0. | 🟢 | Reservado como fuente futura de atractivos. |

### Rutas y tiempos de desplazamiento
- Hoy el itinerario usa **distancias en línea recta** (Haversine) y lo declara así.
- Para tiempos reales: **openrouteservice** ofrece plan gratuito con key (Directions ≈2.000/día, 40/min según su [página de planes](https://openrouteservice.org/plans/); **⚠ cifras de terceros difieren**) pero **la key quedaría expuesta en el navegador** sin backend; el servidor demo de **OSRM** es "best effort", sin garantías ni uso comercial. → **Pendiente** hasta tener un proxy (Cloud Functions/Blaze o un worker gratuito). Decisión de arquitectura D1.

---

## 4. Fotografías georreferenciadas: Mapillary

| Aspecto | Hallazgo ([docs](https://www.mapillary.com/developer/api-documentation)) |
|---|---|
| Autenticación | Token de **cliente** (gratis) desde `mapillary.com/dashboard/developers`. |
| Límites | Entity API 60.000/min, Search API 10.000/min, tiles 50.000/día, por app. |
| Consulta usada | `graph.mapillary.com/images?lat&lng&radius≤50&limit≤100` → `thumb_1024_url`. |
| Contenido | Fotos de **calle de colaboradores**, no fotografía turística profesional. Cobertura en Colombia irregular (no verificada: depende del token). |
| Términos de uso | La documentación consultada **no detalla** términos de visualización ni licencia; se asume CC BY-SA con atribución "© Mapillary" (**⚠ confirmar al crear la cuenta**). |
| Clasificación | 🟡 Gratuito con límites |
| Estado | Componente `StreetPhotos` listo; **no muestra nada sin `VITE_MAPILLARY_TOKEN`**. |

---

## 5. Hospedajes

| Proveedor | Información | Colombia | API gratuita | Reservas | Requisitos | Clase |
|---|---|---|---|---|---|---|
| **Amadeus Self-Service** | Hoteles, vuelos | Sí | **Cerrada**: el portal se desactivó el **17-jul-2026**; solo queda acceso Enterprise por contrato ([fuentes secundarias](https://www.phocuswire.com/amadeus-shut-down-self-service-apis-portal-developers)) ⚠ | — | Contrato comercial | 🔴 |
| **Booking.com Demand API** | Alojamientos | Sí | No | Solo con aprobación adicional | **Managed Affiliate Partner** + contrato firmado; Partner Centre ([docs](https://developers.booking.com/demand/docs/getting-started/prerequisites.md)) | 🔴 |
| **Expedia Rapid** | Alojamientos | Sí | No verificado | — | Normalmente aprobación comercial. **⚠ no pude verificarlo en fuente oficial.** | 🔴 (sin verificar) |
| **Hotelbeds (APItude)** | Alojamientos | Sí | **Llave de evaluación gratis** con endpoint de pruebas (no hay reservas reales ni cobros) | Sí, tras certificación | Acuerdo de distribución + certificación para producción; ⚠ un tercero menciona 50 solicitudes/día en pruebas | 🟠 |
| **Airbnb / Booking / Google Hotels (scraping)** | — | — | — | — | **Prohibido**: no se usa. | ⛔ |
| **OpenStreetMap (Overpass)** | Nombre, tipo, coordenadas, a veces web/teléfono. **Sin precios, fotos ni disponibilidad.** | Sí (cobertura variable) | Sí (ODbL, con atribución) | **No** | — | 🟡 |
| **Catálogo propio (anfitriones)** | Todo | Sí | Sí | **Sí, reservas propias** | Cumplir RNT y normativa | 🟢 |

**Conclusión:** no existe un proveedor gratuito que permita **reservas reales de terceros**. Estrategia: **catálogo propio** (con reservas propias) + **alojamientos de referencia de OSM** (claramente marcados "no reservables") para que ningún destino aparezca vacío. Cada elemento indica su procedencia; los de OSM llevan atribución ODbL.

---

## 6. Actividades y experiencias

| Proveedor | Cobertura / datos | Reservas | Costo / límites | Clase | Decisión |
|---|---|---|---|---|---|
| **Catálogo propio** | Lo que publiquen los anfitriones (con fotos, precio, cupos) | **Sí** | Gratis | 🟢 | ✅ Implementado |
| **Overpass / OSM** | Museos, parques, miradores, restaurantes, etc.; sin precios ni horarios fiables | No | Gratis (inestable) | 🟡 | ✅ Itinerarios y "lugares de interés" |
| **Wikipedia/Wikidata** | Descripciones y datos de atractivos | No | Gratis | 🟢 | ✅ (resumen); Wikidata reservado |
| **Viator Partner API** | Tours y actividades | **Basic Access** (afiliado, sin costo ni aprobación) = búsqueda y redirección; reservas propias requieren *Full access* con certificación ([docs](https://partnerresources.viator.com/travel-commerce/affiliate/)) | Sin costo; comisión por afiliación | 🟡 (descubrimiento/afiliación) | 🔧 **Futuro**: la API key es secreta → necesita backend. Cobertura en Colombia no verificada. |
| **GetYourGuide Partner API** | Tours | Requiere ser partner | **⚠ requisitos no verificados** | 🔴 | No integrado |
| **Google Places API (New)** | Muy buena cobertura | No | Cuotas gratuitas por SKU (10.000 *Essentials* / 5.000 *Pro* / 1.000 *Enterprise* al mes) pero **exige cuenta de facturación** ([fuente](https://developers.google.com/maps/billing-and-pricing/march-2025)) | ⚫ (por tarjeta obligatoria) | No usado |
| **Foursquare Places** | Lugares y fotos | No | **⚠ nivel gratuito poco claro** (500 vs 10.000 llamadas; créditos discrecionales según sus términos) | ⚪ no verificable | No usado |
| **OpenTripMap** | Atractivos | No | Requiere key; ⚠ estado no verificable | ⚪ | No usado |

---

## 7. Vuelos y transporte

| Proveedor | Hallazgo | Clase |
|---|---|---|
| **Amadeus Self-Service** | Cerrado desde jul-2026; solo Enterprise. | 🔴 |
| **Duffel** | Entorno de **pruebas gratuito** inmediato; producción exige completar su *go-live checklist* y es de pago por uso (⚠ precios no verificados). Permite reservar. | 🟠 |
| **Aviationstack** | Plan gratuito: **100 solicitudes/mes**, probablemente solo HTTP ([precios](https://aviationstack.com/pricing)); es de **datos** (estado de vuelos), no vende ni da tarifas. | 🟠 |
| **Skyscanner API** | Acceso para desarrolladores no verificado (normalmente por partner). | ⚪ |
| **Enlaces de búsqueda** (Google Flights, Skyscanner, sitios de aerolíneas) | Sin API ni costo; el usuario ve precios reales en el sitio del proveedor. | 🟢 |

**Decisión:** la sección de vuelos es de **descubrimiento**: sugiere aeropuertos (lista incluida de 28 aeropuertos colombianos, coordenadas aproximadas) y abre la búsqueda en el proveedor. **LOCUS no emite tiquetes ni muestra precios ni disponibilidad.**

---

## 8. Clima

| Proveedor | Hallazgo | Clase |
|---|---|---|
| **Open-Meteo** ([precios](https://open-meteo.com/en/pricing)) | Sin API key y con CORS. **Gratis solo para uso NO comercial**: 600/min, 5.000/h, 10.000/día, 300.000/mes. Datos CC BY 4.0 (atribución obligatoria incluso en uso comercial). Plan comercial de pago por cuota mensual (precio no publicado en la página). | 🟡 (⚠ no comercial) |
| Alternativas | No evaluadas a fondo (p. ej. servicios meteorológicos nacionales con API pública). | ⚪ |

**⚠ Importante:** LOCUS es hoy un proyecto académico (no comercial). **Si empieza a cobrar o monetizar, hay que pasar al plan comercial de Open-Meteo o cambiar de proveedor.** El código está aislado en `src/lib/weather/openMeteo.ts` para cambiarlo fácil.
Se muestra siempre como **pronóstico (estimación)**, distinguido de "ahora" (valor del modelo, no medición).

---

## 9. Pagos (Colombia)

| Proveedor | Sandbox / pruebas | Integración | Requisitos | Comisiones | Clase |
|---|---|---|---|---|---|
| **Wompi** | Llaves de pruebas (`pub_test_…`/`prv_test_…`) desde el panel de comerciante; eventos (webhooks) también en pruebas ([docs](https://docs.wompi.co)) | Widget/checkout web; **la firma de integridad se genera en servidor con un secreto** | Cuenta de comerciante (registro) | **⚠ no verificadas** (consultar tarifa oficial) | 🟠 |
| **Mercado Pago (Colombia)** | Cuentas de prueba vendedor/comprador en el panel; PSE y tarjetas de prueba ([docs](https://www.mercadopago.com.co/developers/es/docs)) | Checkout Pro / API | Cuenta | **⚠ no verificadas** | 🟠 |
| **PayU Latam** | **Sandbox público** con credenciales para Colombia; WebCheckout `sandbox.checkout.payulatam.com` ([docs](https://developers-payu-latam.github.io/latam/en/docs/getting-started/test-your-solution.html)) | WebCheckout / API | Cuenta | **⚠ no verificadas** | 🟠 |
| **ePayco** | Llaves de pruebas por panel (documentación oficial de sandbox **no verificada**) | Checkout | Cuenta | **⚠ no verificadas** | 🟠 |

Ninguno es "gratis": cobran comisión por transacción. **Requisito técnico común:** verificar firmas y recibir webhooks exige **servidor** (Cloud Functions/Blaze u otro backend). Por eso:
- Hoy los pagos son **simulados**: `payment.mode = 'simulado'`, las reglas de Firestore **rechazan** cualquier otro modo, y la interfaz lo dice en cada paso.
- Para activar pagos reales hacen falta **tu decisión, una cuenta comercial y un backend** (ver ARQUITECTURA §10 y decisión D1).

---

## 10. Correo y geolocalización

| Necesidad | Opción | Clase |
|---|---|---|
| Verificación y recuperación de contraseña | Plantillas de **Firebase Authentication** (gratis) | 🟢 (recuperación ✅; verificación pendiente) |
| Correos de reserva/notificación | Requiere backend + proveedor (Resend, Brevo, SendGrid…: **⚠ no evaluados a fondo**) | 🔴 pendiente |
| Geolocalización del usuario | API nativa del navegador (`navigator.geolocation`), gratis, con permiso del usuario | 🟢 |

---

## 11. Normativa colombiana a considerar (no es asesoría legal)

- **Ley 2068 de 2020, art. 38** y **Decreto 1836 de 2021**: las plataformas electrónicas de servicios turísticos deben **inscribirse en el Registro Nacional de Turismo (RNT)**, exhibir el RNT de cada prestador y retirar anuncios de prestadores sin RNT activo. El **Decreto 1338 de 2021** reglamenta la contribución parafiscal. El Ministerio publicó **proyectos de decreto en 2025–2026** para reglamentar el art. 38 de forma integral: **⚠ no confirmé si ya fue expedido**.
- **Ley 1581 de 2012** (protección de datos personales / *habeas data*): finalidad, consentimiento informado, derechos de conocer, actualizar y suprimir. LOCUS ya incluye consentimiento para el uso del perfil por la IA, borrado de conversaciones y de perfil. Faltan **política de privacidad y términos** redactados con asesoría legal.
- **Estatuto del consumidor (Ley 1480 de 2011)** y reglas de retracto/cancelación: relevantes cuando existan pagos reales.

**No habilites comercialmente** (cobros reales, publicidad masiva de anfitriones) hasta resolver el RNT de la plataforma, la política de datos y el contrato con la pasarela.

## Comparador (enlaces profundos de plataformas)

Implementado en `src/lib/compare/providers.ts` (alojamiento, vuelos, experiencias, transporte, seguro). **No consulta
precios de terceros**: arma el enlace de búsqueda de cada plataforma con destino, fechas y viajeros. Formatos usados:

| Plataforma | Formato (resumen) | Pre-llenado |
|---|---|---|
| Booking.com | `searchresults.es.html?ss=&checkin=&checkout=&group_adults=&no_rooms=` | completo |
| Airbnb | `/s/{Ciudad}--Colombia/homes?adults=&checkin=&checkout=` | completo |
| Expedia / Vrbo | `Hotel-Search?destination=&startDate=&endDate=&adults=` / `search?destination=…` | completo |
| KAYAK | `/hotels/{lugar}/{ida}/{vuelta}/{n}adults`, `/flights/{O}-{D}/{ida}/{vuelta}/{n}adults` | completo |
| Google Hoteles / Vuelos | `travel/search?q=` / `travel/flights?q=` | destino / ruta+fechas |
| Skyscanner | `/transporte/vuelos/{o}/{d}/{aammdd}/{aammdd}/?adultsv2=` | completo |
| Aviasales | `/search/{O}{ddmm}{D}{ddmm}{pasajeros}` | completo |
| Despegar, trivago, Busbud, aerolíneas | solo página principal | ninguno (se avisa al usuario) |

Los formatos son los públicos de cada buscador; **revísalos periódicamente** (si uno cambia, el peor caso es que abra el
buscador sin datos). Prohibido: extraer precios con scraping. Los afiliados se configuran con `VITE_AFF_*` (ver `.env.example`).

## Precios de referencia de vuelos (Travelpayouts · Aviasales Data API)

Vía el Worker `workers/prices` (token como secreto, caché 6 h). Datos en caché de búsquedas recientes de viajeros: **referencia, no tarifa reservable**.
Plan gratis para socios (límite por minuto) y Workers gratis (100 000 solicitudes/día). Guía: `docs/PRECIOS_EN_VIVO.md`.

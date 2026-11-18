# Seguimiento del desarrollo

> Estado a **2026-11-12**, rama `c.lamusg`. Verificado con: `npm run lint`, `tsc -b`, `npm run build`,
> 154 pruebas unitarias, 42 pruebas de reglas contra el emulador, y recorridos manuales en el navegador contra los emuladores.

## ✅ Completado y verificado

| Área | Qué hay |
|---|---|
| Cuentas | Registro/ingreso con correo y Google, recuperación de contraseña, perfil, cierre de sesión. |
| Encuesta del viajero | Conversacional, adaptativa y omitible; guardada en Firestore; repetible desde el perfil; recomendaciones explicables. |
| Perfil declarado vs. inferido | Estructura separada; el agente solo escribe `inferred` (visible y borrable); consentimiento para usarlo con la IA. |
| Agente "Tu compañero LOCUS" | Widget flotante en todas las pantallas, historial por usuario, 11 herramientas de datos reales, tarjetas verificadas, modo guiado sin IA, tope de uso. |
| Mapas | MapLibre + OpenFreeMap con tema claro/oscuro; lista↔mapa sincronizados; selector de ubicación; "Cerca de mí". |
| Hospedajes (huésped) | Explorar con filtros y mapa, ficha con galería/clima/calendario, reserva con confirmación, cancelación con política, favoritos, reseñas. |
| Reservas | Transacciones + reglas que impiden doble reserva, precios manipulados y cupos excedidos (pagos **simulados**). |
| Experiencias | Catálogo, ficha, reserva por sesión con cupos controlados. |
| Anfitrión | Registro, panel con estadísticas básicas, formularios completos de alojamientos y experiencias, fotos (subir/reordenar/principal/reemplazar/eliminar), calendario con bloqueos, solicitudes/reservas. |
| Administración | Moderación: aprobar, rechazar con motivo, suspender. |
| Planificador | Pasos 2–4 completados (antes: "en construcción"): actividades → itinerario con mapa y clima → guardar. Itinerarios editables. |
| Destinos | Fichas con foto, clima, mapa, Wikipedia, lugares, experiencias y alojamientos. |
| Alojamientos de referencia | OpenStreetMap, marcados "no reservables", con atribución. |
| Vuelos | Descubrimiento (aeropuertos + enlaces de búsqueda), sin precios. |
| Clima | Open-Meteo, pronóstico diferenciado de "ahora". |
| Seguridad | Reglas con esquema/tamaño, roles, moderación; cabeceras en Hosting; 42 pruebas de reglas. |
| Infra de desarrollo | Emuladores, semilla de datos, CI, workflow de despliegue (inactivo hasta configurar el secreto). |

## 🟡 Parcial

| Qué | Estado | Falta |
|---|---|---|
| Agente de IA | Código completo. Firebase AI Logic ya está habilitado, pero **App Check bloquea las consultas** (401 "App Check token is invalid") | Resolver App Check (§4.4 de CONFIGURACION: desactivar la exigencia o registrar reCAPTCHA v3). **Aún no se han visto respuestas reales de Gemini.** |
| Fotos de calle (Mapillary) | Componente listo | Tu token de cliente (`VITE_MAPILLARY_TOKEN`). |
| App Check | Código listo (activo con la variable) | reCAPTCHA v3 y activar "Enforce". |
| Rutas con tiempos reales | El itinerario usa línea recta y lo dice | Un proxy/backend para openrouteservice (key secreta) o similar. |
| Alojamientos de referencia (solo ver) | **Precalculados** para destinos destacados y ~30 ciudades (`src/data/referenceLodging.json`) + Nominatim en vivo para el resto; se muestran automáticamente al buscar un destino y los usa el agente | Refrescar con `npm run data:reference` cuando quieras (no es necesario con frecuencia). |
| Lugares del itinerario sin Overpass | Respaldo en cadena: Overpass → lugares precalculados (destinos destacados) → Nominatim en vivo | — |
| Notificaciones | La interfaz muestra estados | Correos/avisos requieren backend. |
| Verificación de anfitriones | Campo `verified` y distintivo; solo el admin lo puede cambiar | Pantalla para que el admin verifique (hoy desde la consola). |
| Reseñas | Crear y mostrar | Promedio persistido y moderación de reseñas. |

## ⏳ Pendiente / fuera de alcance por ahora

- **Pagos reales** (Wompi/Mercado Pago/PayU/ePayco): requieren cuenta comercial + backend. Hoy 100 % simulados y rotulados.
- **Backend** (Cloud Functions): requiere plan **Blaze** (no activado). Habilitaría: pagos reales, correos, proxy de APIs con llave, agregados.
- **Hospedajes/vuelos de terceros con reserva**: no existe API gratuita (ver PROVEEDORES.md).
- Política de privacidad, términos y RNT de la plataforma (asesoría legal).
- Chat huésped↔anfitrión, alertas de precio, viajes colaborativos, programa de fidelización (evaluados, no priorizados).
- CSP en Hosting, verificación de correo, pruebas E2E automatizadas de interfaz.

## 🔑 Lo que necesito de ti (y por qué)

| # | Acción | Desbloquea |
|---|---|---|
| 1 | Resolver **App Check** para Firebase AI Logic (desactivar la exigencia o registrar reCAPTCHA v3) | Respuestas reales del compañero |
| 2 | Habilitar **Auth: correo + Google** | Registro/ingreso en producción |
| 3 | Crear el documento **`admins/{tuUID}`** | Moderación |
| 4 | Crear el **secreto `FIREBASE_SERVICE_ACCOUNT`** en GitHub | Despliegue automático |
| 5 | *(Opcional)* reCAPTCHA v3 → `VITE_APPCHECK_SITE_KEY` | Proteger la cuota de IA |
| 6 | *(Opcional)* Token de cliente de Mapillary | Fotos de calle |
| 7 | **Decidir** sobre Blaze, pagos reales y RNT | Funciones de servidor y cobros |

## 🧪 Pruebas realizadas

- Unitarias (154): dominio (fechas, tarifas, reembolsos, validaciones), encuesta adaptativa, recomendaciones, búsqueda, OSM, clima, vuelos, fotos, edición de itinerarios, y las 101 originales del motor.
- Reglas (42, emulador): lectura pública/privada; publicación y moderación; reservas válidas; doble reserva (secuencial y concurrente); intentos de saltarse la validación del cliente; precio manipulado; cancelaciones; calendario del anfitrión; cupos de experiencias; reseñas; perfil, chats y tope de uso.
- Navegador (emulador): ingreso → encuesta completa (incluida la pregunta adaptativa) → recomendaciones → explorar con mapa → ficha → reserva confirmada → mis reservas; widget del agente (error real de AI Logic → mensaje + modo guiado con tarjetas); admin aprueba una publicación; panel del anfitrión.

## 🐞 Problemas encontrados

- **Overpass** (servidores públicos) no respondió en varias pruebas → riesgo de disponibilidad real. **Mitigado**: los alojamientos de referencia y el respaldo de lugares usan Nominatim (estable) y datos precalculados.
- El mensaje "Hay mucha demanda" del agente era un **error mío**: una expresión regular tomaba `generateContent` por "rate"; el error real era App Check. Corregido (ahora hay un mensaje específico).
- Las reglas de Firestore limitan accesos por lote → calendario como un documento por alojamiento (ver ARQUITECTURA §5).
- `@firebase/rules-unit-testing` 6 exige Firebase 13; se usa la v5 compatible con Firebase 12.
- `npm audit`: avisos altos en `firebase` (grpc-js/re2js, rutas de Node que no se empaquetan) y en `vite` (servidor de desarrollo). No se "arreglan" bajando a firebase 9; evaluar Firebase 13 y `vite ≥ 8.3.8`.
- No pude verificar visualmente cada pantalla en móvil/tablet tras los cambios (el panel del navegador tuvo fallos de captura); el diseño sigue las mismas utilidades responsivas de la portada original.


## Fusión con el Paso 3 de la compañera (PR #9)

- Se conservó su motor de itinerario (`planItinerary`: barrido por sectores, ritmo, actividades) y su pantalla del Paso 3 (`ItineraryStep`: pestañas por día, fotos, enlace a Google Maps).
- Se conservó de LOCUS: router, cuentas, favoritos, agente, catálogo propio, fallbacks de lugares (Overpass → Geoapify → datos estáticos → Nominatim), pronóstico por día, aviso de fuente alternativa y guardado del itinerario (Paso 4).
- El mapa por día (`DayMap`) se reescribió con MapLibre + OpenFreeMap: se eliminó Leaflet y los servidores de teselas de openstreetmap.org (su política limita el uso intensivo).
- El contexto del flujo expone acciones estables (`dispatch`) para evitar bucles de renderizado en efectos.

## Comparador y estrategia de negocio

- **Comparador** (`/comparar`, ✅): alojamiento (LOCUS con precio verificado + 8 plataformas), vuelos (4 metabuscadores + aerolíneas), experiencias, transporte y seguro; libreta de precios; "mismo alojamiento en otras plataformas"; `/vuelos` redirige aquí.
- **Paso 4 "Completa tu viaje"** con accesos al comparador y botón **Compartir mi plan**.
- **Transparencia y legal:** `/como-ganamos-dinero`, `/privacidad`, `/terminos` (borrador; requiere abogado). Enlaces de afiliado con `rel="sponsored"`.
- **SEO:** meta/OG, títulos por ruta, `robots.txt`, `sitemap.xml`.
- **Estrategia:** `docs/NEGOCIO.md` (posicionamiento, ingresos, marketing, fases, legal, riesgos).
- Pendiente (🔒): precios en vivo vía APIs de socios (requiere capa de servidor), analítica, dominio propio.

# 06 · Seguridad, rendimiento y calidad técnica

> Evidencia: lectura completa del código, `npm ci`, `npm test` (101/101 ✓), `npm run lint`
> (0 avisos), `npm run build` (✓), `npm audit`, `npm outdated`, inspección del bundle y cabeceras
> del sitio publicado, y prueba en navegador. No se corrigió nada.
>
> Criticidad: **Crítica** (explotable hoy con impacto grave) · **Alta** · **Media** · **Baja**.

---

## 1. Resumen de hallazgos

| ID | Hallazgo | Área | Criticidad |
|---|---|---|---|
| S1 | Reglas de Firestore sin validación de esquema/tamaño; escritura ilimitada por cualquier usuario anónimo, sin App Check | Seguridad | **Alta** (latente; depende de que Auth anónima esté activa — no verificable) |
| S2 | No existe backend: cualquier lógica futura de precios, disponibilidad o reservas en el cliente sería manipulable | Seguridad / arquitectura | **Alta** (para la visión del producto) |
| Q1 | Sin CI/CD: se fusiona a `main` y se despliega a mano sin correr pruebas, lint ni build | Calidad / operación | **Alta** |
| Q2 | TypeScript sin `strict` (sin `strictNullChecks`) | Calidad | Media |
| S3 | Producción compilada sin `VITE_NOMINATIM_EMAIL`: incumple parcialmente la política de Nominatim | Integraciones | Media |
| P1 | Dependencia crítica de servidores públicos de Overpass sin SLA; en la prueba no respondieron | Disponibilidad | Media |
| S4 | `npm audit`: 6 vulnerabilidades altas (vite dev server; firebase → grpc-js/re2js) | Dependencias | Media (impacto real bajo, ver §2.6) |
| S5 | Sin cabeceras de seguridad en Hosting (CSP, `X-Content-Type-Options`, `frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`) | Seguridad | Media |
| A1 | Animaciones forzadas aunque el usuario pida reducir movimiento; carrusel sin pausa en táctil | Accesibilidad | Media |
| Q3 | Código de Firebase y motor de itinerarios sin conectar; firma de `generateItinerary` incompatible con el flujo | Mantenibilidad | Media |
| Q4 | Sin pruebas de componentes ni E2E; sin `ErrorBoundary`; sin monitoreo de errores | Calidad | Media |
| P2 | Imágenes no responsivas (hero 1920 px / 528 kB en móvil), sin WebP/AVIF; 11 MB de fotos en el repo | Rendimiento | Media |
| P3 | `Cache-Control: max-age=3600` también para assets con hash (podrían ser `immutable` de 1 año) | Rendimiento | Baja |
| S6 | Configuración web de Firebase en el código; restricciones de la API key no verificables | Seguridad | Baja |
| S7 | Soft-404: cualquier ruta devuelve 200; redirección `.web.app` hecha con JavaScript | SEO / operación | Baja |
| Q5 | Comentarios desactualizados (botón "Pausar"), favicon de Vite, sin `engines`/`.nvmrc`/`.gitattributes` | Mantenibilidad | Baja |
| Q6 | Estado del viaje solo en memoria; sin router | UX / arquitectura | Media |

No se encontraron vulnerabilidades **críticas** explotables hoy: la app no maneja datos personales
sensibles, no tiene cuentas, pagos ni escrituras activas.

---

## 2. Seguridad

### 2.1 Autenticación y sesiones
- **Hoy no hay autenticación activa.** El código de Auth anónima existe pero no se ejecuta.
- Diseño previsto: identidad anónima persistida por el SDK en IndexedDB. Sin cuentas reales, sin
  vinculación (`linkWithCredential`), sin cierre de sesión ni recuperación.

### 2.2 Autorización y reglas (S1)
- Reglas de `itineraries`: aislamiento por `uid` correcto e inmutabilidad (`update: false`).
- Faltan: validación de claves/tipos (`request.resource.data.keys().hasOnly([...])`), límites de
  tamaño de arreglos, `createdAt == request.time`, y protección anti-abuso (App Check, cuotas).
- Mientras la app no escriba, la exposición depende del estado de la consola: si Auth anónima está
  activa y estas reglas están desplegadas, **hoy mismo** cualquiera puede escribir en `itineraries`
  usando la configuración pública. Verificarlo es prioritario (ver doc 07).

### 2.3 Validaciones
- Todas las validaciones (`validateTripDetails`, `tripDates`, rangos de contadores) están **solo en el
  cliente**. Es aceptable para un formulario que no persiste nada, pero no lo será al guardar datos.

### 2.4 Operaciones sensibles (S2)
- No hay reservas, tarifas, disponibilidad ni pagos. Con la arquitectura actual (solo cliente +
  Firestore directo), cualquier precio o disponibilidad calculado en el navegador sería
  manipulable. Antes de construir esos módulos se necesita lógica de servidor (Cloud Functions u
  otro backend) y transacciones.

### 2.5 Exposición de secretos (S6)
- `src/lib/firebase/client.ts:11-19`: configuración web de Firebase (API key web, appId,
  messagingSenderId, measurementId). **Tipo:** identificador público de proyecto; no es un secreto,
  pero debe acompañarse de restricciones de API key por dominio en Google Cloud y de App Check.
- `.env.example` solo contiene un correo de ejemplo. No hay `.env*` reales versionados (`*.local`
  está en `.gitignore`).
- No se encontraron claves privadas, cuentas de servicio, tokens de CLI ni contraseñas.

### 2.6 Dependencias vulnerables (S4)

| Paquete (vía) | Severidad | Afecta a | Impacto real |
|---|---|---|---|
| `vite` 8.3.2 (directo) | Alta | Servidor de desarrollo (`launch-editor`, `server.fs`, middleware) | Solo al ejecutar `npm run dev`; no al sitio publicado. Corrección: subir a ≥ 8.3.8 (dentro del rango `^8.3.0`). |
| `firebase` 12.19.0 → `@firebase/firestore` → `@grpc/grpc-js` 1.9.16 | Alta | Rutas de Node (gRPC) | El bundle del navegador no usa gRPC y hoy ni siquiera incluye Firebase. `npm audit` propone "arreglar" bajando a `firebase@9.14.0` (cambio mayor regresivo): **no aplicar a ciegas**; revisar `firebase@13.x` (disponible 13.3.0). |
| `re2js` 2.8.6 (vía firestore) | Alta | ReDoS en lookbehind | Mismo análisis que arriba. |

Otras desactualizaciones menores: `@vitejs/plugin-react` 6.3.0, `oxlint` 1.93.0, `react` 19.3.1,
`tailwindcss` 4.3.5, `vitest` 5.1.0; `typescript` 7.0.2 es un salto mayor.

### 2.7 Seguridad de APIs y privacidad
- Las APIs externas no usan credenciales. El texto del destino viaja a Nominatim junto con el
  `Referer` del sitio y la IP del visitante; Google Fonts también recibe IP/User-Agent. No hay
  política de privacidad ni aviso de cookies/almacenamiento (hoy solo se usa `localStorage` y
  `sessionStorage` funcionales).
- No se usan `dangerouslySetInnerHTML` ni `eval`; React escapa el contenido. Los datos de OSM se
  muestran como texto: riesgo XSS bajo.
- Cabeceras (S5): sin CSP ni `frame-ancestors`, el sitio podría embeberse en iframes de terceros
  (clickjacking, bajo impacto hoy por no haber acciones sensibles).

---

## 3. Rendimiento

| Métrica | Valor medido | Comentario |
|---|---|---|
| JS principal | 279,1 kB (88,1 kB gzip) | Razonable: React 19 + app. Firebase no está incluido. |
| CSS | 39,6 kB (7,7 kB gzip) | Tailwind v4 genera solo lo usado. |
| Chunk de municipios | 33,0 kB (9,0 kB gzip) | Carga diferida al escribir o usar Modo B. ✓ |
| Imágenes publicadas | 11 MB en total (hero 528 kB; destinos 1,6 MB; actividades 732 kB; lugares 7,3 MB) | Destinos/actividades con `loading="lazy"`; fotos de lugares solo al primer hover/visibilidad. ✓ |
| Hero en móvil | 1920×1280 px para un hueco de 375×650 | Sin `srcset`/`sizes`; descarga ~4× más de lo necesario. |
| Fuentes | CSS de Google Fonts bloqueante (con `preconnect` y `display=swap`) | Aceptable; podría autoalojarse. |
| Caché HTTP | `max-age=3600` para todo | Los assets con hash podrían cachearse 1 año. |
| Caché de datos | Overpass en `sessionStorage` 24 h; municipios memoizados en módulo | ✓ evita consultas repetidas. |
| Lecturas de Firestore | 0 | No hay uso. |
| Re-renderizados | `TripFlowProvider` memoiza el valor; `useTripDetailsForm` recalcula la validación en cada render (barato). `PhotoCard` usa un `setInterval` por tarjeta visible. | Sin problemas medibles. |
| Paginación | No aplica (no hay listados de datos). | — |
| Red externa en Modo B | Máx. ~5 s de espera por diseño (2 intentos × 2,5 s), cancelable | ✓ buena decisión de UX. |

**Disponibilidad (P1):** el Modo B depende de servidores Overpass públicos y gratuitos. El
2026-11-12 el principal no respondió desde el navegador en 8 s y las dos réplicas no respondieron en
15 s (también rechaza dominios `*.web.app`). El motor de itinerarios —núcleo del Paso 3— dependerá
todavía más de Overpass (consultas más pesadas). Sin un proxy/caché propio o un catálogo de lugares
propio, la experiencia central será frágil en producción.

---

## 4. Mantenibilidad

### 4.1 Lo que está bien
- Código pequeño (~5,7 k líneas con pruebas), legible y **muy bien comentado** en español.
- Separación clara: funciones puras ↔ clientes de red inyectables ↔ hooks ↔ componentes.
- 101 pruebas unitarias rápidas (1,9 s) sobre lo más delicado: validación, reducer, resolución de
  destino, autocompletado, consultas OSM, motor de rutas, sugerencias.
- Lint sin avisos; build sin errores; dependencias mínimas (3 de producción).
- Degradación elegante ante fallos de red, con mensajes claros.

### 4.2 Lo que preocupa

| Tema | Detalle |
|---|---|
| Tipado (Q2) | `tsconfig.app.json` no activa `strict`. Sin `strictNullChecks`, `null`/`undefined` no se verifican (hay aserciones `budget!`). Activarlo antes de crecer evitará una clase entera de errores. |
| Código muerto / no conectado (Q3) | `lib/firebase/*` y `generateItinerary` no se usan en la UI. `generateItinerary(TripInput)` vuelve a geocodificar un texto en lugar de recibir el `Destination` ya resuelto; `TripInput` no incluye viajeros/habitaciones/modo. |
| Arquitectura de navegación (Q6) | Sin router; el estado se pierde al recargar; "atrás" del navegador no funciona entre pasos. Añadir Pasos 3–4 sobre `if (step === n)` escalará mal. |
| Pruebas (Q4) | Entorno `node` únicamente: ningún test de componentes (React Testing Library) ni E2E (Playwright). Los clientes de red (`osmClient`, `elevationClient`, `overpassCache`, `throttle`) se prueban parcialmente vía `suggestDestination`/`osm`. |
| Errores en producción | Sin `ErrorBoundary` ni telemetría: un fallo de render deja la página en blanco y nadie se entera. |
| Acoplamiento | `useTripDetailsForm` concentra mucha lógica (modo, búsqueda, foco, geocodificación, envío); `PhotoCard` mezcla presentación con observadores y temporizadores. Aceptable hoy, candidato a dividirse al crecer. |
| Duplicación | Iconos SVG repetidos; clases de botón similares repetidas en varios componentes (no hay `Button`). |
| Operación (Q1) | Sin CI, sin despliegue reproducible, sin entornos de prueba. |
| Documentación | README bueno y específico; faltaba documentación de arquitectura (este análisis). Comentarios desactualizados puntuales. |
| Herramientas | Sin Prettier/EditorConfig ni `.gitattributes` (ya hubo un commit para restaurar CRLF). Sin `engines`. |
| Repositorio | 11 MB de imágenes versionadas en Git; aceptable hoy, pero crecerá con cada destino. |

---

## 5. Recomendaciones (sin implementar)

Ordenadas por impacto/esfuerzo; el detalle de priorización está en `07_ESTADO_ACTUAL_Y_ROADMAP.md`.

1. **Verificar la consola de Firebase** (Auth anónima, reglas desplegadas, restricciones de API key,
   alertas de presupuesto) y endurecer reglas + App Check **antes** de conectar cualquier escritura.
2. **CI en GitHub Actions**: `npm ci`, `lint`, `test`, `build` en cada PR; despliegue a Hosting desde
   CI (con canal de vista previa por PR) para que producción = `main`.
3. Activar `strict` en TypeScript y corregir lo que aparezca.
4. Compilar producción con `VITE_NOMINATIM_EMAIL` (vía secreto de CI).
5. Actualizar `vite` a ≥ 8.3.8; evaluar `firebase` 13.x cuando se use.
6. Cabeceras en `firebase.json` (CSP, `X-Content-Type-Options`, `frame-ancestors`, caché `immutable`
   para `/assets/**`) y 404 real si se introduce un router con rutas conocidas.
7. Respetar `prefers-reduced-motion` y permitir pausar el carrusel en táctil.
8. Imágenes responsivas (`srcset`, WebP/AVIF) empezando por el hero.
9. Estrategia para Overpass: proxy/caché propio (p. ej. Cloud Function con caché) o catálogo propio
   de lugares para los destinos principales.
10. `ErrorBoundary` + monitoreo de errores; pruebas de componentes y un E2E del flujo principal.

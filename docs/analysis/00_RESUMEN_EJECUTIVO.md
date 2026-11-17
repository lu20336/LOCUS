# 00 · Resumen ejecutivo — Análisis integral de LOCUS

> **Fecha:** 2026-11-12 · **Versión analizada:** rama `main`, commit `a141668` (PR #3 fusionado).
> **Alcance:** solo análisis y documentación. No se modificó código, configuración, base de datos ni
> despliegues. Los únicos archivos nuevos son los de `docs/analysis/`.

## ¿Qué es LOCUS hoy?

La visión de LOCUS es un compañero integral de viaje (hospedajes, experiencias, lugares, información
y reservas en un solo lugar). **Lo que existe hoy es un prototipo de planificador de viajes por
Colombia**, centrado en el primer paso de un flujo de 4:

1. **Tu viaje** — destino, fechas, viajeros, habitaciones y presupuesto. ✅ Operativo.
2. **Actividades** — 🟡 pantalla provisional "en construcción".
3. **Itinerario** — 🟡 el motor existe y está probado, pero solo corre en la terminal.
4. **Confirmación** — ❌ no existe.

El destino se elige de dos formas: escribiéndolo (con autocompletado local y geocodificación en
OpenStreetMap) o pidiendo una sugerencia por **clima** (piso térmico por altitud) y **actividades**
(conteo de lugares reales en OSM). La portada añade inspiración visual: 8 destinos destacados con
"lugares para visitar" y un carrusel de 6 actividades.

## Cómo está construido

| Capa | Realidad verificada |
|---|---|
| Frontend | SPA en **React 19.3 + TypeScript 6.0 + Vite 8.3 + Tailwind CSS 4.3**. Sin router; estado con Context + `useReducer`. |
| Backend | **No existe.** Toda la lógica corre en el navegador. |
| Datos | Estáticos en el código (destinos, categorías) y en `colombiaTowns.json` (300 municipios). El viaje vive solo en memoria. |
| Servicios externos | **Nominatim** (geocodificación), **Overpass** (lugares; 3 réplicas públicas), **Open-Elevation** (altitud, hoy sin uso efectivo), **Google Fonts**. Sin API keys. |
| Firebase | **Solo Hosting está en uso.** Auth anónima y Firestore (`itineraries`) están programados pero **no conectados** y el SDK **no llega al bundle**. |
| Pruebas / calidad | 101 pruebas unitarias ✓, lint sin avisos ✓, build ✓. Sin pruebas de UI, sin CI/CD. |

## Cómo está desplegado

- **Firebase Hosting**, proyecto `locus-bb57e`, en `https://locus-bb57e.firebaseapp.com`
  (`*.web.app` redirige por JavaScript porque Overpass rechaza ese dominio).
- Despliegue **manual** con Firebase CLI (`npm run build` + `firebase deploy`). Sin CI, sin entornos
  de prueba. El sitio publicado es **idéntico byte a byte** al build actual de `main`.
- La base Firestore existe (responde 403 a lecturas anónimas); Realtime Database y Cloud Storage no.

## Estado general del producto

**Prototipo temprano, técnicamente sano y visualmente pulido, con el flujo principal incompleto.**
La calidad de la base (arquitectura limpia, pruebas, accesibilidad, diseño) es alta para su etapa;
la cobertura funcional respecto a la visión es baja: **ninguno de los módulos de hospedajes,
reservas, usuarios, favoritos, pagos o administración existe**.

## Principales hallazgos

1. **El usuario no puede completar ninguna tarea de punta a punta:** tras el Paso 1 llega a
   "Este paso está en construcción".
2. **Firebase se usa solo como hosting.** Auth/Firestore son código sin conectar; presentarlos como
   funcionalidad sería incorrecto.
3. **Riesgo latente en Firestore (Alta):** las reglas solo verifican `uid`; sin validación de
   esquema ni App Check. Si la autenticación anónima está activa en la consola (no verificable),
   cualquiera podría escribir en `itineraries` sin pasar por la app.
4. **Dependencia frágil de Overpass (Media):** en la prueba real no respondió ningún servidor; el
   Modo B mostró un resultado degradado. El futuro Paso 3 dependerá aún más de este servicio.
5. **Producción sin email de contacto para Nominatim (Media):** el build publicado no incluye
   `VITE_NOMINATIM_EMAIL`.
6. **Sin CI/CD ni `strict` en TypeScript (Alta/Media):** lo que llega a producción depende de la
   máquina de quien despliega.
7. **Datos capturados sin uso:** presupuesto, viajeros y habitaciones no alimentan ningún cálculo;
   el motor de itinerarios ni siquiera los recibe y vuelve a geocodificar el destino como texto.
8. **Fortalezas destacadas:** lógica de dominio pura y probada, respeto de políticas de OSM,
   degradación elegante, accesibilidad muy cuidada, sistema de tokens con modo oscuro completo,
   código documentado en español.
9. **Detalles visibles:** favicon por defecto de Vite; animaciones que ignoran "reducir movimiento";
   hero de 1920 px en móvil.

## Documentos de este análisis

| Archivo | Contenido |
|---|---|
| [01_ARQUITECTURA_TECNICA.md](01_ARQUITECTURA_TECNICA.md) | Inventario tecnológico con versiones, estructura, capas, Firebase servicio por servicio, despliegue, integraciones. |
| [02_BASE_DE_DATOS.md](02_BASE_DE_DATOS.md) | Firestore, colección `itineraries`, dónde viven realmente los datos, entidades, reglas y riesgos. |
| [03_MODULOS_Y_FUNCIONALIDADES.md](03_MODULOS_Y_FUNCIONALIDADES.md) | Cada pantalla/módulo: objetivo, acciones, componentes, datos, estado real. |
| [04_FLUJOS_DE_FUNCIONAMIENTO.md](04_FLUJOS_DE_FUNCIONAMIENTO.md) | Diagramas de secuencia de cada flujo y dónde se ejecuta cada operación. |
| [05_DISENO_Y_EXPERIENCIA_USUARIO.md](05_DISENO_Y_EXPERIENCIA_USUARIO.md) | Identidad, tokens, componentes, animaciones, responsive, accesibilidad, evaluación UX. |
| [06_SEGURIDAD_RENDIMIENTO_Y_CALIDAD.md](06_SEGURIDAD_RENDIMIENTO_Y_CALIDAD.md) | Hallazgos clasificados por criticidad y recomendaciones. |
| [07_ESTADO_ACTUAL_Y_ROADMAP.md](07_ESTADO_ACTUAL_Y_ROADMAP.md) | Matriz de madurez, decisiones de arquitectura, deuda técnica y fases propuestas. |
| [capturas/](capturas/) | 8 capturas de pantalla (escritorio, tablet, móvil; claro y oscuro). |

## Limitaciones de acceso

| Qué no se pudo verificar | Acceso necesario |
|---|---|
| Si el proveedor de Auth "Anónimo" está activo | Consola de Firebase → Authentication (o Firebase CLI con permisos) |
| Reglas de Firestore realmente desplegadas y si la base tiene documentos | Consola → Firestore (Rules / Data) |
| Restricciones de la API key web, cuotas y alertas de facturación, plan (Spark/Blaze) | Consola de Google Cloud / Firebase → Uso y facturación |
| Dominios personalizados, historial de versiones de Hosting, quién despliega | Consola → Hosting |
| Proyecto de la landing (`locus-landing`) | Fuera del repositorio |

Durante el análisis se instalaron dependencias con `npm ci` y se generó `dist/` localmente para
ejecutar pruebas y el build; ambas carpetas están en `.gitignore`. Firebase CLI no está instalada en
esta máquina y no se ejecutó ningún comando contra Firebase. Las consultas al sitio y a las APIs
fueron de solo lectura.

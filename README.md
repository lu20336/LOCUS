# Locus · Compañero inteligente de viajes por Colombia

Plataforma de **hospedajes, experiencias, itinerarios y recomendaciones con IA** para Colombia (curso de Ingeniería Aplicada).
React 19 + Vite + TypeScript + Tailwind, **Firebase** (proyecto `locus-bb57e`, plan gratuito Spark), Gemini vía Firebase AI Logic y datos abiertos de OpenStreetMap.

**Dos modos en una sola cuenta:** *Huésped* (explora, reserva, guarda favoritos, planea viajes, conversa con tu compañero LOCUS) y *Anfitrión* (publica alojamientos y experiencias, gestiona calendario y reservas).

> ⚠ Los **pagos son simulados** (no se cobra dinero). Ver [docs/PROVEEDORES.md](docs/PROVEEDORES.md) para saber qué es real y qué está pendiente.

## Empezar (local, sin tocar producción)

```bash
npm ci
npm run dev     # emuladores de Firebase + Vite en http://localhost:5173
npm run seed    # (otra terminal) datos de prueba: anfitrion@ / huesped@ / admin@locus.test, clave locus-prueba-123
```

## Documentación

| Documento | Contenido |
|---|---|
| [docs/CONFIGURACION_Y_DESPLIEGUE.md](docs/CONFIGURACION_Y_DESPLIEGUE.md) | Flujo de ramas, variables, pasos en la consola de Firebase, despliegue, cuotas |
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Arquitectura, modelo de datos, reservas sin servidor, agente de IA, seguridad |
| [docs/PROVEEDORES.md](docs/PROVEEDORES.md) | Investigación de APIs (gratuitas/pagas), decisiones y normativa |
| [docs/SEGUIMIENTO.md](docs/SEGUIMIENTO.md) | Qué está hecho, parcial y pendiente; lo que se necesita de ti |
| [docs/analysis/](docs/analysis/00_RESUMEN_EJECUTIVO.md) | Auditoría del prototipo original (previa a esta versión) |

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Emuladores (Auth + Firestore) y servidor de desarrollo. |
| `npm run dev:web` | Solo Vite (si ya tienes los emuladores corriendo). |
| `npm run dev:real` | Vite contra el Firebase **real** (cuidado: escribe en producción). |
| `npm run seed` | Carga datos de prueba en el emulador. |
| `npm test` | Pruebas unitarias (Vitest). |
| `npm run test:rules` | Pruebas de las reglas de Firestore con el emulador. |
| `npm run data:places` | Genera el respaldo estático de lugares de los destinos destacados (cuando Overpass responda). |
| `npm run lint` · `npm run build` | Lint · compilación a `dist/`. |
| `npm run deploy` | Publica reglas + Hosting (requiere `firebase login`). |
| `npm run deploy:preview` | Publica un canal de vista previa temporal. |

---

# Documentación del prototipo original

El resto de este archivo describe el motor de itinerarios y el despliegue del prototipo inicial, que se conservan.

## Locus · App de planificación de viajes

Prototipo funcional de Locus (curso de Ingeniería Aplicada). React + Vite + TypeScript + Tailwind, Firebase (proyecto propio `locus-bb57e`, independiente del de la landing) y datos de OpenStreetMap.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (Vite). |
| `npm test` | Pruebas del motor de itinerarios (Vitest, sin red). |
| `npm run demo:engine` | Genera un itinerario **en vivo** contra OpenStreetMap desde la terminal. |
| `npm run demo:engine -- "Medellín, Colombia" cultura,gastronomia 2` | Igual, con otro destino, categorías y días. |
| `npm run demo:engine -- --offline` | Igual, con datos de ejemplo (sin red). |
| `npm run demo:suggest -- frio cultura,gastronomia` | Sugerencia de destino (Modo B) **en vivo**: clima + actividades → 3 lugares. |
| `npm run build` | Compila para producción en `dist/`. |
| `npm run data:towns` | Regenera `src/data/colombiaTowns.json` (pueblos candidatos del Modo B) desde Overpass + Open-Elevation. |

## El motor de itinerarios

Todo está en [`src/lib/itinerary/`](src/lib/itinerary/); el archivo principal, comentado paso a paso, es [`generateItinerary.ts`](src/lib/itinerary/generateItinerary.ts):

1. `geocodeDestination()` — destino → coordenadas (Nominatim).
2. `searchPlaces()` — lugares reales cercanos por categoría (Overpass).
3. `selectPlaces()` — elige los más relevantes alternando categorías.
4. `optimizeRoute()` — **heurística del vecino más cercano** (TSP), O(n²).
5. `buildDailyPlan()` — reparte por zonas entre los días y optimiza cada día.

| Archivo | Rol |
|---|---|
| `geo.ts` | Distancia de Haversine. |
| `categories.ts` | Categorías de Locus → etiquetas de OSM. |
| `osm.ts` | Construye consultas y lee respuestas de OSM (funciones puras). |
| `osmClient.ts` | Peticiones directas a Nominatim y Overpass con `fetch` (navegador y Node). |
| `browserClient.ts` | Instancia que usa la app, con el correo de contacto de `.env.local`. |
| `throttle.ts` | Límite de 1 petición/segundo. |
| `errors.ts` | Errores con mensajes en español para la UI. |
| `suggestDestination.ts` | Modo B del Paso 1: sugiere pueblos de Colombia por clima (altitud) y actividades cercanas. |
| `../../data/colombiaTowns.json` | Lista precalculada de pueblos candidatos (generada con `npm run data:towns`). |
| `elevationClient.ts` | Altitud de coordenadas con Open-Elevation. |

La app llama a OpenStreetMap **directo desde el navegador** (sin servidor intermedio). Para respetar la [política de uso de Nominatim](https://operations.osmfoundation.org/policies/nominatim/): máximo 1 petición/segundo (`throttle.ts`), el navegador envía el `Referer` con el dominio de la app y se agrega el parámetro `email` de contacto.

**Configuración:** copia `.env.example` como `.env.local` y pon un correo real en `VITE_NOMINATIM_EMAIL` (queda visible en el código público de la app). Para el script de demo: `NOMINATIM_EMAIL=correo@ejemplo.com npm run demo:engine`.

## Firebase y despliegue

Proyecto **`locus-bb57e`** (alias `default` en `.firebaserc`), con Hosting simple que publica la carpeta `dist/`.

```
npm run build
firebase deploy                    # Hosting + reglas de Firestore
firebase deploy --only hosting     # solo la app
```

URL pública: **https://locus-bb57e.firebaseapp.com**

> `https://locus-bb57e.web.app` también funciona, pero redirige automáticamente a `firebaseapp.com`: el servidor principal de Overpass (overpass-api.de) rechaza las peticiones que vienen de dominios `*.web.app` (responde 406 sin cabecera CORS, y el navegador lo muestra como error de CORS). Además, `osmClient.ts` da a cada consulta a Overpass como máximo 2 intentos de 2,5 s en servidores distintos (sin esperas entre ellos) y recuerda 5 minutos qué servidor falló; si ninguno responde, el Modo B muestra igual 3 destinos por clima con el aviso de que no se alcanzaron a confirmar las actividades.

Pendiente en la consola de Firebase del proyecto `locus-bb57e`:

- **Firestore Database**: crear la base de datos si aún no existe.
- **Authentication → Anónimo**: activarlo (los itinerarios se guardan por sesión anónima).

`firestore.rules` contiene solo las reglas de esta app (colección `itineraries`). La landing tiene su propio proyecto y sus propias reglas.

Datos de mapas © OpenStreetMap contributors.

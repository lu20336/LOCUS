# Locus · App de planificación de viajes

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

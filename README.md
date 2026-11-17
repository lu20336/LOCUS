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
| `npm run data:reference` | Regenera los alojamientos de referencia y el respaldo de lugares (Nominatim, ~5 min, una sola vez). |
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
| `npm run data:activities` | Regenera `src/data/activityAvailability.json` (actividades cerca de cada municipio) desde Overpass. |
| `npm run data:towns` | Regenera `src/data/colombiaTowns.json` (pueblos candidatos del Modo B) desde Overpass + Open-Elevation. |

## El motor de itinerarios

Todo está en [`src/lib/itinerary/`](src/lib/itinerary/); el archivo principal, comentado paso a paso, es [`generateItinerary.ts`](src/lib/itinerary/generateItinerary.ts):

1. `geocodeDestination()` — destino → coordenadas (Nominatim).
2. `searchPlaces()` — lugares reales cercanos por categoría (Overpass).
3. `selectPlaces()` — elige los más relevantes alternando categorías.
4. `optimizeRoute()` — **heurística del vecino más cercano** (TSP), O(n²).
5. `buildDailyPlan()` — reparte los lugares entre los días y optimiza cada día:
   - **Algoritmo de barrido** (`sweepOrder()`, O(n log n)): ordena los lugares por su ángulo visto desde el centro, así cada día cubre una "tajada" de la ciudad.
   - `splitByCategory()`: cada día recibe su parte de cada actividad elegida (no un día solo de restaurantes).
   - Vecino más cercano dentro de cada día; la vida nocturna va al final.
   - **Excursiones (opcional):** si en el Paso 2 se eligen pueblos cercanos, cada uno es un día aparte (`planExcursionDay()`): lugares a menos de 6 km del pueblo, sobre todo cultura y naturaleza, y un solo restaurante. Los pueblos salen de `src/data/touristTowns.json`, una lista de 65 pueblos turísticos escrita a mano con coordenadas verificadas en Nominatim (`npm run data:tourist-towns`).

En la app, el Paso 3 usa `planItinerary()` (pasos 2 a 5) con el destino ya resuelto en el Paso 1, y muestra el plan con un mapa por día ([MapLibre GL JS](https://maplibre.org/) con las teselas de OpenFreeMap/OpenStreetMap, cargado solo en ese paso; es el mismo mapa de toda la app).

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

### Fuentes de lugares y respaldo

| Fuente | Para qué | Configuración |
|---|---|---|
| `src/data/activityAvailability.json` | Qué actividades hay a menos de 7 km de cada municipio y destino destacado (Paso 2 y Modo B). Funciona sin red. | Se regenera con `npm run data:activities` (usa Overpass; tarda varios minutos). |
| Overpass (en vivo) | Lugares reales para el itinerario. | Sin clave. |
| [Geoapify Places](https://apidocs.geoapify.com/docs/places/) | **Respaldo** si Overpass no responde. Mismos datos de OpenStreetMap. | Opcional: `VITE_GEOAPIFY_KEY` en `.env.local` (plan gratuito, 3.000 consultas/día). Limitar la clave a los dominios de la app (ver `.env.example`). Con clave, el pie de página muestra "Powered by Geoapify", obligatorio en el plan gratuito. |
| Wikidata + Wikimedia Commons | Fotos reales de cualquier destino en el Paso 2: un lugar de cada actividad (ej. Cali · Cultura: Museo del Oro Calima) y la foto de la ciudad. Con autor y licencia en pantalla. | Sin clave. `src/lib/itinerary/placePhotos.ts`. |

## Firebase y despliegue

Proyecto **`locus-bb57e`** (alias `default` en `.firebaserc`), con Hosting simple que publica la carpeta `dist/`.

```
npm run build
firebase deploy                    # Hosting + reglas de Firestore
firebase deploy --only hosting     # solo la app (⚠ NO publica reglas de Firestore: las cuentas, reservas y anfitriones fallarán si las reglas de producción están desactualizadas)
```

URL pública: **https://locus-bb57e.firebaseapp.com**

> `https://locus-bb57e.web.app` también funciona, pero redirige automáticamente a `firebaseapp.com`: el servidor principal de Overpass (overpass-api.de) rechaza las peticiones que vienen de dominios `*.web.app` (responde 406 sin cabecera CORS, y el navegador lo muestra como error de CORS). Además, `osmClient.ts` da a cada consulta a Overpass como máximo 2 intentos de 2,5 s en servidores distintos (sin esperas entre ellos) y recuerda 5 minutos qué servidor falló; si ninguno responde, el Modo B muestra igual 3 destinos por clima con el aviso de que no se alcanzaron a confirmar las actividades.

Pendiente en la consola de Firebase del proyecto `locus-bb57e`:

- **Firestore Database**: crear la base de datos si aún no existe.
- **Authentication → Anónimo**: activarlo (los itinerarios se guardan por sesión anónima).

`firestore.rules` contiene solo las reglas de esta app (colección `itineraries`). La landing tiene su propio proyecto y sus propias reglas.

Datos de mapas © OpenStreetMap contributors.

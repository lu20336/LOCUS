# 07 · Estado actual y roadmap de LOCUS

> Consolidación de los documentos 01–06. Estados: **Operativo** · **Parcial** · **Solo interfaz** ·
> **Simulado** (datos estáticos/curados) · **No implementado** · **No verificable**.

---

## 1. Matriz de madurez por módulo

| Módulo | Estado | Evidencia encontrada | Dependencias | Pendientes |
|---|---|---|---|---|
| Hospedajes | **No implementado** | Solo el contador "Habitaciones" en el Paso 1 (`TripDetails.rooms`), sin uso posterior. | — | Modelo de datos, catálogo, búsqueda, detalle, fotos, anfitriones. |
| Reservas | **No implementado** | Ningún código. | Requiere backend | Disponibilidad, bloqueo de fechas, estados de reserva, cancelaciones. |
| Usuarios | **No implementado** (en UI) | `ensureAnonymousUser()` existe pero no se llama; Auth anónima en consola: **no verificable**. | Firebase Auth | Registro/login, recuperación, perfil, vinculación de cuenta anónima. |
| Destinos | **Operativo** | Autocompletado local (8 destacados + 300 municipios), geocodificación Nominatim (probado con Barichara), tarjetas con coordenadas. | Nominatim (respaldo: lista local) | Páginas de detalle; email de contacto en producción. |
| Sugerencia de destino (Modo B) | **Parcial** | Algoritmo completo y probado; en la prueba real Overpass no respondió y se mostró resultado degradado. | Overpass público | Fiabilidad del servicio (proxy/caché o datos propios). |
| Actividades | **Parcial / Simulado** | 6 categorías mapeadas a OSM; carrusel de inspiración; Paso 2 "en construcción". | Overpass | Selector del Paso 2, catálogo real de experiencias (precio, horario, proveedor). |
| Lugares turísticos | **Simulado** (portada) / **Parcial** (motor) | 40 lugares curados con foto, solo decorativos; el motor obtiene lugares reales de OSM pero no se muestra. | Overpass | Mostrar lugares en el itinerario, detalle, mapa. |
| Itinerario (Paso 3) | **Parcial** (motor sin UI) | `generateItinerary()` con 29 pruebas; solo en CLI (`npm run demo:engine`). | Nominatim, Overpass | Pantalla, adaptación de la firma al `Destination` ya resuelto, mapa, manejo de errores en UI. |
| Confirmación (Paso 4) | **No implementado** | Solo aparece en el `Stepper`. | — | Definir qué se confirma (¿guardar? ¿compartir? ¿reservar?). |
| Persistencia de itinerarios | **Parcial** (no conectada) | `saveItinerary()` + reglas `itineraries`; base Firestore existe (403). | Auth anónima, Firestore | Conectar, endurecer reglas, "mis itinerarios". |
| Favoritos | **No implementado** | — | Auth + Firestore | — |
| Pagos | **No implementado** | — | Pasarela + backend | — |
| Administración / anfitriones | **No implementado** | — | Roles (custom claims), backend | — |
| Reseñas / calificaciones | **No implementado** | Solo `score` heurístico interno. | — | — |
| Mapa interactivo | **No implementado** | — | Proveedor de mapas | Elegir proveedor y política de teselas. |
| Tema claro/oscuro | **Operativo** | `ThemeToggle` + script anti-parpadeo. | — | — |
| Hosting / despliegue | **Operativo, manual** | Sitio publicado = build de `main` (hash idéntico). | Firebase Hosting | CI/CD, entornos, cabeceras. |
| Analítica / monitoreo | **No implementado** | `measurementId` sin uso. | — | Decidir herramienta y consentimiento. |

---

## 2. Qué está bien construido

- **Base técnica moderna y ligera:** React 19, Vite 8, Tailwind 4, TS 6, 3 dependencias de producción.
- **Lógica de dominio de calidad:** funciones puras, inyección de dependencias, errores tipados,
  degradación elegante, respeto explícito de las políticas de uso de OSM.
- **Pruebas** sólidas en la lógica (101 ✓ en 1,9 s) y lint limpio.
- **Diseño visual y accesibilidad** cuidados; sistema de tokens con modo oscuro completo.
- **Documentación en el código** excepcional para un equipo que aprende y crece.

## 3. Qué funciona correctamente (verificado en navegador)

- Portada completa, responsive (móvil, tablet, escritorio) y en ambos temas.
- Autocompletado de destinos y selección con teclado.
- Validación del Paso 1 con mensajes y foco correctos.
- Resolución de destino (destacado, lista local, Nominatim) y paso al Paso 2 con los datos.
- Modo B con su ruta de degradación cuando Overpass falla.

## 4. Qué está incompleto

- Pasos 2, 3 y 4 del propio planificador.
- Conexión de Auth/Firestore.
- Uso de presupuesto, viajeros y habitaciones.
- Todo el ecosistema de la visión (hospedajes, reservas, experiencias, pagos, cuentas).

## 5. Qué presenta problemas

- Dependencia de Overpass público (no respondió durante la prueba).
- Producción sin email de contacto para Nominatim.
- Reglas de Firestore permisivas en estructura; estado de Auth anónima desconocido.
- Sin CI/CD ni entornos; despliegue manual no trazable.
- Animaciones que ignoran "reducir movimiento"; favicon de Vite.

## 6. Qué depende de servicios externos

| Servicio | Funcionalidad | Riesgo |
|---|---|---|
| Firebase Hosting | Todo el sitio | Bajo (servicio gestionado). |
| Nominatim | Destinos fuera de la lista local | Medio: límite 1 req/s por IP de usuario, política de uso, sin SLA. Hay respaldo local. |
| Overpass | Modo B y futuro itinerario | **Alto**: servidores comunitarios saturados, rechazo de `*.web.app`, sin SLA. |
| Open-Elevation | Altitud (hoy no se invoca) | Bajo. |
| Google Fonts | Tipografía | Bajo (hay fuentes de respaldo). |

## 7. Decisiones de arquitectura pendientes

Estas decisiones deben tomarse **antes** de los nuevos desarrollos grandes; condicionan todo lo demás.

| # | Decisión | Opciones a evaluar | Por qué importa |
|---|---|---|---|
| D1 | **¿Backend propio?** | (a) Cloud Functions for Firebase (requiere plan Blaze), (b) servicio aparte (Cloud Run u otro), (c) seguir solo-cliente | Reservas, precios, disponibilidad, pagos y anti-abuso **no** pueden quedar solo en el navegador. |
| D2 | **Fuente de lugares/actividades** | (a) OSM en vivo, (b) OSM vía proxy/caché propio, (c) catálogo propio en Firestore curado/enriquecido, (d) API turística comercial | Fiabilidad del itinerario y posibilidad de agregar fotos, precios, reseñas. |
| D3 | **Modelo de identidad** | Anónima + vinculación posterior (correo, Google) vs. registro obligatorio para guardar | Afecta reglas, retención de datos y experiencia. |
| D4 | **Modelo de datos del marketplace** | Colecciones `users`, `hosts`, `listings` (+ `availability`), `bookings`, `payments`, `reviews`, `favorites`; roles con *custom claims* | Integridad de reservas (transacciones), seguridad por rol, índices. |
| D5 | **Pasarela de pagos** | Proveedores con soporte en Colombia (a evaluar) + webhooks en servidor | Requisitos legales, comisiones, conciliación. |
| D6 | **Navegación** | Adoptar un router (rutas por paso y por entidad: `/destinos/:id`, `/hospedajes/:id`) | Compartir enlaces, SEO, botón atrás, recarga sin pérdida. |
| D7 | **Mapas** | Librería (p. ej. Leaflet/MapLibre) + proveedor de teselas con política compatible | El itinerario sin mapa pierde gran parte de su valor. |
| D8 | **Entornos** | Proyectos Firebase separados (dev/staging/prod) o al menos canales de vista previa | Probar reglas y datos sin tocar producción. |
| D9 | **Alcance geográfico** | Solo Colombia (hoy forzado en Nominatim y en toda la copia) vs. expansión | Afecta datos, textos y consultas. |

## 8. Deuda técnica

| Deuda | Esfuerzo | Impacto |
|---|---|---|
| TypeScript sin `strict` | Bajo–medio | Alto a futuro |
| Sin CI/CD | Bajo | Alto |
| Firma de `generateItinerary` (re-geocodifica texto) y `TripInput` incompleto | Bajo | Alto para el Paso 3 |
| Estado sin persistencia y sin router | Medio | Alto para UX |
| Reglas de Firestore sin validación; sin App Check | Bajo–medio | Alto al conectar escrituras |
| Sin pruebas de componentes/E2E; sin ErrorBoundary/monitoreo | Medio | Medio |
| Imágenes no responsivas | Bajo | Medio (móvil) |
| Dependencias con avisos (`vite`) | Bajo | Bajo–medio |
| Comentarios desactualizados, favicon, `.gitattributes`, `engines` | Muy bajo | Bajo |

## 9. Recomendación de priorización

No se recomienda reescribir: la base es sana. Se propone **completar y endurecer lo existente
antes de ampliar el alcance**.

### Fase 0 · Higiene y verificación (corta, sin cambios de producto)
1. Revisar la consola de Firebase: proveedor anónimo, reglas desplegadas, restricciones de la API
   key, alertas de presupuesto, quién tiene acceso al proyecto.
2. CI en GitHub (lint + test + build por PR) y despliegue desde CI con `VITE_NOMINATIM_EMAIL` como secreto.
3. `strict` en TypeScript, actualizar `vite`, `.gitattributes`, `engines`, favicon propio.
4. Cabeceras de seguridad y caché en `firebase.json`.

### Fase 1 · Completar el planificador (el producto que ya se insinúa)
1. Router y persistencia del viaje (URL y/o `sessionStorage`).
2. Paso 2: selector de actividades (reutilizar `ChipGroup` y `CATEGORY_OPTIONS`).
3. Paso 3: adaptar `generateItinerary` para recibir el `Destination` resuelto; pantalla de itinerario
   día a día; mapa (D7); estrategia de fiabilidad para Overpass (D2).
4. Paso 4: confirmar/guardar (conectar `saveItinerary` **después** de endurecer reglas + App Check),
   compartir enlace.
5. Usar o quitar presupuesto/viajeros/habitaciones para no generar expectativas falsas.

### Fase 2 · Fundaciones del ecosistema
1. Decidir D1 (backend), D3 (identidad) y D8 (entornos).
2. Cuentas reales con vinculación de la sesión anónima; perfil; "mis itinerarios"; favoritos.
3. Catálogo propio de destinos/lugares/experiencias (D2), con páginas de detalle.

### Fase 3 · Marketplace
1. Hospedajes (anfitriones, publicación, fotos en Cloud Storage con reglas).
2. Disponibilidad y reservas con lógica transaccional en servidor.
3. Pagos (D5), notificaciones por correo, reseñas.
4. Panel de administración/anfitriones con roles.

## 10. Qué tener en cuenta antes de comenzar nuevos desarrollos

- **Lo que se ve no es lo que existe:** la portada sugiere un producto más amplio (habitaciones,
  lugares para visitar) que el implementado. Cada nueva pieza debe cerrar un flujo completo.
- **Firebase hoy = hosting.** Auth y Firestore son puntos de partida, no funcionalidades operativas.
- **No hay servidor.** Cualquier regla de negocio sensible requiere primero decidir D1.
- **OSM es frágil como dependencia de producción.** Planificar caché/proxy o datos propios.
- **No hay red de seguridad automática** (CI, pruebas de UI, monitoreo): crearla primero abarata todo lo demás.
- **Respetar las convenciones existentes** (código en español, funciones puras, clientes inyectables,
  tokens de diseño, accesibilidad) para mantener la coherencia que hoy es una fortaleza.

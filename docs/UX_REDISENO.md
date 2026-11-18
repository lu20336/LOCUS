# Rediseño UX/UI de LOCUS: navegación, "Mis viajes", inicio personalizado y planes

> Informe de la evolución de experiencia (noviembre 2026). Conserva la identidad: teal, navy y coral solo para
> llamadas a la acción, tipografías Fraunces/Inter, logotipo y modo claro/oscuro.

## 1. Diagnóstico (lo que encontramos)

| Problema | Por qué importa | Solución |
|---|---|---|
| Itinerarios, favoritos y reservas **solo** estaban dentro del menú de la inicial (C) | Un usuario nuevo no lo descubre; "creé un itinerario y no lo encuentro". | Accesos directos permanentes: **Mis viajes · Favoritos · Mis reservas** en la barra superior (escritorio) e inferior (celular). |
| Cabecera con 4 enlaces planos (Comparar, Hospedajes, Experiencias, Itinerarios) y hamburguesa en celular | Sin jerarquía entre "descubrir" y "lo mío". | Menú **Explorar ▾** (qué hay) separado de **Mi espacio** (lo mío) y de la **Cuenta**. |
| La portada era igual para todos | Quien ya tiene viajes no ve su progreso. | **Tu espacio**: saludo, próximo viaje, últimos itinerarios, reservas y favoritos. Hero más bajo con sesión. |
| "Itinerarios" era solo una lista de texto | No distingue próximo/pasado, sin foto ni acciones. | **Mis viajes** completo (§3). |
| Favoritos era una lista plana sin imagen | Cuesta reconocer lo guardado. | Tarjetas con foto y precio, filtros por tipo, "Planear este viaje". |
| Estados vacíos y de carga genéricos (texto/spinner) | Se siente inacabado. | `EmptyState` con icono y acciones; **esqueletos** de carga; avisos (toasts) al guardar. |
| Sin feedback al guardar | El usuario duda si funcionó. | Toast "Guardado en Mis viajes · Ver viaje", corazón que rebota, "Guardado/Guardar cambios". |
| Contraste en modo oscuro (`bg-navy text-white`) | En oscuro navy es claro y el texto blanco no se lee. | Pares corregidos a `text-surface` / `text-on-coral`. |
| El agente guardaba itinerarios pero sin camino claro de vuelta | "¿Dónde quedó lo que me armó la IA?" | Botón "Guardar en Mis viajes" + enlace directo; tarjetas del agente con corazón. |
| Panel Host sin contexto de plan ni pendientes | El anfitrión no ve qué requiere acción. | Franja con **plan, uso de publicaciones y solicitudes pendientes**, y salida clara a "modo viajero". |

## 2. Arquitectura de información

```
Explorar ▾  → Hospedajes · Experiencias · Comparar precios · Planear mi viaje
Comparar
── Mi espacio (con sesión) ──
Mis viajes  → Próximos · Realizados · Ideas guardadas (+ borrador y reservas próximas)
Favoritos   → Hospedajes · Experiencias · Destinos · Lugares
Mis reservas
── Cuenta (avatar) ──
Perfil y preferencias · Planes y suscripción · Modo anfitrión / Ofrecer · Cerrar sesión
```

- **Escritorio (≥ lg):** barra superior con "Explorar ▾", "Comparar" y el trío de Mi espacio (con contador de favoritos). En
  las pantallas personales aparece además una **barra lateral** (perfil, compañero de IA, navegación, "Descubre").
- **Celular y tableta (< lg):** **barra inferior** Inicio · Explorar · Mis viajes · Favoritos · Cuenta (sin sesión:
  Inicio · Explorar · Comparar · Planes · Ingresar). "Explorar" y "Cuenta" abren una hoja inferior (`<dialog>` accesible).
  El botón flotante del compañero IA sube para no tapar la barra.
- **Compatibilidad:** `/itinerarios` y `/itinerarios/:id` redirigen a `/mis-viajes` (enlaces guardados siguen sirviendo).

## 3. Mis viajes (módulo central)

- **Estado derivado de las fechas** (`src/lib/trips/tripStatus.ts`): Próximo / En curso / Realizado. No se guarda ningún campo
  nuevo ni se tocan las reglas de Firestore: los itinerarios ya existentes aparecen sin migración.
- **Próximo viaje** destacado (foto del destino, cuenta regresiva, "Abrir viaje", "Comparar hospedaje").
- **Pestañas:** Próximos · Realizados · Ideas guardadas (destinos con corazón → "Planear este viaje") + búsqueda por nombre/destino.
- **Borrador:** si el plan del planificador no se ha guardado, una franja invita a continuar.
- **Reservas próximas** enlazadas a Mis reservas.
- **Acciones reales** sobre Firestore: abrir, **renombrar**, **duplicar**, **compartir** (menú del sistema o copia al portapapeles) y
  **eliminar** con confirmación. El detalle (`/mis-viajes/:id`) conserva la edición (mover/quitar paradas, notas) con aviso de cambios sin guardar.
- Pendiente: itinerarios compartidos con enlace público (requiere reglas y decisiones de privacidad).

## 4. Movimiento y microinteracciones

Sin librerías nuevas (CSS puro, ~1 KB): fundido entre pantallas, aparición escalonada de tarjetas, sube-y-aparece al entrar en pantalla
(`Reveal`), hoja inferior, menús con entrada suave, corazón que rebota, check animado en avisos, brillo en esqueletos, zoom suave de fotos.
Todo respeta **`prefers-reduced-motion`** (regla global existente) y no afecta el rendimiento en móviles.

## 5. Accesibilidad y calidad

Menús con `aria-expanded/haspopup`, Escape y clic fuera; hojas y confirmaciones con `<dialog>`; regiones `aria-live` para avisos; tablas semánticas
en la comparación de planes; foco visible; contraste corregido en oscuro; navegación inferior con `aria-label`; sin desbordes horizontales verificados a 375 px.

## 6. Recomendaciones siguientes (priorizadas)

1. **Itinerario compartible** con enlace público de solo lectura (SEO + crecimiento viral).
2. **Notificaciones** (correo/WhatsApp) de reservas, cambios y recordatorios de viaje próximo.
3. **Búsquedas recientes** y "continuar donde lo dejaste" (guardar el borrador del planificador en la cuenta).
4. **Estadísticas de Host** con gráficos (ocupación, ingresos) y calendario visual por alojamiento.
5. **Analítica respetuosa** (Plausible/Umami) para medir el embudo: plan generado → guardado → clic saliente → reserva.
6. **Pruebas E2E** (Playwright) de los flujos críticos; hoy se verifican con pruebas unitarias, de reglas y recorridos manuales.
7. **Internacionalización** (inglés) para viajeros extranjeros.

# 05 · Diseño y experiencia de usuario de LOCUS

> Evaluación hecha ejecutando el build de producción en el navegador (claro y oscuro; escritorio
> 1366 px, tablet 768 px, móvil 375 px) y leyendo los estilos. Las capturas están en
> [`capturas/`](capturas/). No se rediseñó nada.

| Captura | Qué muestra |
|---|---|
| [01](capturas/01-escritorio-portada-oscuro.jpg) | Portada en escritorio, modo oscuro |
| [02](capturas/02-escritorio-autocompletar.jpg) | Autocompletado "med" → Medellín |
| [03](capturas/03-escritorio-paso1-formulario.jpg) | Panel del Paso 1 lleno, con ayuda de presupuesto por día |
| [04](capturas/04-escritorio-paso2-provisional.jpg) | Paso 2 provisional ("en construcción") |
| [05](capturas/05-escritorio-modoB-sin-overpass.jpg) | Modo B con aviso de actividades no verificadas |
| [06](capturas/06-movil-portada-claro.jpg) | Portada en móvil, modo claro |
| [07](capturas/07-movil-tarjetas-destino.jpg) | Carrusel de destinos en móvil |
| [08](capturas/08-tablet-tarjetas-destino.jpg) | Cuadrícula de destinos en tablet con "Qué visitar" animándose |

---

## 1. Identidad visual

| Elemento | Hallazgo |
|---|---|
| Logotipo | Wordmark tipográfico "Locus." en Fraunces semibold, con el punto en teal. No hay isotipo ni versión gráfica. **No es un enlace.** |
| Favicon | `public/favicon.svg` es el **logo por defecto de Vite** (rayo morado `#863bff`): no corresponde a la marca y es lo primero que se ve en la pestaña. |
| Personalidad | Viajes por Colombia, cálida y editorial: fotografía grande, serif con itálica ("*Colombia*" en teal claro), textos cercanos en segunda persona ("Te armamos un plan…"). |
| Fotografía | Muy buena calidad, licencias libres documentadas (Unsplash + Wikimedia Commons, con autor y licencia por foto en `CREDITOS.md`). Encuadres ajustados por tarjeta (`imagePosition`). |
| Ilustraciones | No hay. |
| Coherencia con la landing | Los comentarios dicen que los tokens son "los mismos validados en la landing" y que la clave del tema es compartida; como la landing vive en otro proyecto/dominio, el `localStorage` **no** se comparte realmente entre ambos sitios. |

## 2. Sistema de diseño

### 2.1 Tokens (variables CSS en `src/index.css`)

| Token | Claro | Oscuro | Utilidad Tailwind | Uso |
|---|---|---|---|---|
| `--bg` | `#F7F7F7` | `#0F1720` | `bg-bg` | Fondo de página |
| `--surface` | `#FFFFFF` | `#182430` | `bg-surface` | Tarjetas, paneles, barra |
| `--surface-2` | `#EDF1F5` | `#1F2E3B` | `bg-surface-2` | Hover, bloques secundarios |
| `--primary` | `#00A699` | `#2DD4C4` | `teal` | Color primario (bordes de foco, selección, progreso) |
| `--primary-soft` | `#00877D` | `#5EE6D9` | `teal-soft` | Texto/enlaces teal, anillo de foco |
| `--secondary` | `#003366` | `#6FA8DC` | `navy` | Titulares |
| `--accent` | `#FF5A5F` | `#FF7A73` | `coral` | **Solo CTA** ("Sugiéreme un lugar", "Continuar") |
| `--on-accent` | `#1A2130` | (igual) | `on-coral` | Texto oscuro sobre coral (contraste AA) |
| `--text` | `#003366` | `#EAF0F6` | `ink` | Texto principal |
| `--text-muted` | `#5C7A99` | `#9FB3C8` | `muted` | Texto secundario |
| `--line` | navy 14 % | blanco 16 % | `line` | Bordes |
| `--danger` | `#B42318` | `#FF9B94` | `danger` | Errores (separado del coral) |
| `--color-teal-light` | `#5EE6D9` | (igual) | `teal-light` | Texto teal sobre fotos oscurecidas |
| `--serif` / `--sans` | Fraunces / Inter | | `font-serif` / `font-sans` | h1–h3 en serif; resto Inter |

- Tailwind v4 en modo "CSS-first": `@theme inline` expone las variables como utilidades y
  `@custom-variant dark` activa `dark:` por el atributo `data-theme`, no por el sistema operativo.
- El modo oscuro está **completo y bien resuelto**: basta redefinir variables.
- No existen tokens de espaciado, radios, sombras ni escala tipográfica propios: se usan los valores
  por defecto de Tailwind. Uso real: `rounded-full` (12), `rounded-xl` (10), `rounded-2xl` (5),
  `rounded-3xl` (4); sombras `shadow-sm` y variantes teñidas `shadow-navy/5…/25`.

### 2.2 Tipografía y jerarquía

- H1 del hero 48/60/72 px (móvil/tablet/escritorio) en Fraunces; H2 de sección 30–36 px; cuerpo
  16–20 px en Inter; etiquetas en versalitas espaciadas ("ITINERARIOS CON LUGARES REALES", "PASO 1 DE 4").
- Jerarquía clara y consistente. La combinación serif + sans transmite calidad editorial.

### 2.3 Componentes visuales

- **Barra de búsqueda tipo píldora** (estilo portales de viaje): en móvil se apila (campo arriba,
  botón coral a todo el ancho); desde 640 px es una sola barra.
- **Tarjetas con foto** con degradado inferior, chip de clima, elevación y zoom suave al hover.
- **Chips** de selección con check, anillo de foco y estado marcado en teal.
- **Contadores** `−`/`+` de 44 px (buen tamaño táctil).
- **Panel desplegable** con transición de `grid-template-rows` 0fr→1fr.
- **Iconografía mixta:** SVG de trazo (lupa, pin, cerrar, luna/sol) + emojis (☀️🧥🌤️, 🏖️🏛️🍽️🧗🌙🛍️,
  👥🛏). Los emojis se ven distintos en cada sistema operativo y restan consistencia.

### 2.4 Animaciones y microinteracciones

| Animación | Dónde | Comentario |
|---|---|---|
| Despliegue del panel (300 ms) | Paso 1 | Suave, sin saltos de layout. |
| Hover de tarjeta: elevación + zoom 105 % (700 ms) | Destinos y actividades | Agradable. |
| "Qué visitar": rotación de 5 fotos/nombres cada 2,2 s, entrada desde la derecha | Tarjetas de destino | En táctil se activa al estar ≥ 60 % visible; en tablet se animan **varias tarjetas a la vez**. |
| Carrusel infinito de actividades (45 s) | "¿Qué te gustaría hacer?" | Se pausa con hover/foco; **no** hay control para táctil. |
| Spinner y barra de progreso con pulso | Envío y Modo B | Correctos, con `aria-live`. |

**Decisión de accesibilidad discutible:** `index.css` desactiva animaciones con
`prefers-reduced-motion`, **excepto** en elementos con `data-force-motion` (tarjetas con lugares y
carrusel), "que el equipo decidió mostrar siempre". Además, el comentario dice que el carrusel
"conserva su botón Pausar", pero ese botón se eliminó en el commit `d758078`: comentario desactualizado.
Contenido que se mueve solo por más de 5 s sin forma de pausarlo en táctil contraviene WCAG 2.2.2
(nivel A), y forzar movimiento ignorando la preferencia del usuario afecta a personas con trastornos
vestibulares.

## 3. Diseño responsive

| Vista | Resultado |
|---|---|
| Móvil 375 px | Sin desbordamiento horizontal (`scrollWidth = 375`). Hero de 80 svh, titular en 2 líneas, barra apilada. Destinos como carrusel horizontal con *snap* (tarjeta al 82 %, se asoma la siguiente). Contadores y chips cómodos al tacto. |
| Tablet 768 px | Destinos en 2 columnas; todas las tarjetas visibles animan "Qué visitar" simultáneamente. |
| Escritorio 1366 px | Contenido centrado a 72 rem; destinos en 3 columnas con la primera a doble ancho (8 tarjetas = 3 filas). |

Puntos de mejora: el hero carga la foto de 1920 px también en móvil (sin `srcset`); no hay imágenes
en WebP/AVIF; el panel del formulario es largo en móvil y el botón "Continuar" queda lejos de la barra.

## 4. Accesibilidad (fortalezas notables)

- Enlace "Saltar al contenido", `lang="es"`, landmarks (`header`, `main`, `nav`, `footer`, `section` con `aria-labelledby`).
- Combobox de destino con patrón WAI-ARIA completo (`aria-activedescendant`, `aria-expanded`, anuncios `aria-live`).
- Panel cerrado con `inert`; copia visual del carrusel con `aria-hidden` + `inert`.
- Gestión de foco: al cambiar de paso se enfoca el título; al fallar la validación, el primer campo inválido.
- Errores asociados con `aria-describedby` / `aria-invalid`; `role="alert"` para errores de servicio.
- Contraste cuidado (texto oscuro sobre coral; texto blanco sobre degradado oscuro).
- Inputs nativos ocultos en los chips: teclado y lector de pantalla funcionan sin código extra.

Debilidades: animaciones forzadas (ver §2.4); emojis decorativos correctamente ocultos pero los
nombres accesibles de algunos checkboxes resultan en minúscula ("playa") en el árbol de accesibilidad.

## 5. Evaluación UX desde la perspectiva del viajero

| Pregunta | Respuesta |
|---|---|
| ¿Se entiende qué ofrece LOCUS? | Sí, como **planificador de itinerarios por Colombia** ("Te armamos un plan día a día…"). **No** se comunica nada de hospedajes, reservas o experiencias, que son el núcleo de la visión. |
| ¿Es fácil descubrir hospedajes? | No aplica: no existen. Los contadores de "Habitaciones" sugieren que habrá alojamiento, generando una expectativa que hoy no se cumple. |
| ¿Es sencillo explorar actividades y destinos? | La inspiración es atractiva (8 destinos, 6 actividades), pero **todo conduce al mismo formulario**; no hay páginas de detalle, ni mapa, ni listados explorables. |
| ¿La navegación es intuitiva? | Para el Paso 1 sí: dos entradas claras ("Ya sé a dónde ir" / "Sugiéreme un lugar") y atajos desde tarjetas. Pero no hay menú, la URL no cambia, el botón "atrás" del navegador sale de la app y recargar borra todo. |
| ¿Se puede completar la tarea? | **No.** Tras "Continuar" el usuario llega a "Este paso está en construcción": no obtiene ningún itinerario. Es el principal problema de experiencia. |
| ¿La información está bien organizada? | Sí dentro de la portada: hero → formulario → inspiración. |
| ¿Hay consistencia entre módulos? | Alta en lo visual (mismos tokens, radios y tarjetas). Inconsistencias menores: favicon de Vite, emojis vs SVG, CTA coral también usado en "Sugiéreme un lugar" (dos CTA coral compitiendo en la misma barra). |
| ¿Se siente un producto integral? | Se siente como **la primera pantalla de un producto** muy pulida; aún no como un ecosistema. |

## 6. Fortalezas, inconsistencias y oportunidades

**Fortalezas**
- Calidad visual y fotográfica alta; sistema de tokens limpio con modo oscuro completo.
- Accesibilidad muy por encima del promedio de un prototipo.
- Mensajes de error y estados de carga redactados para personas, en español natural.
- Responsive bien pensado (carrusel en móvil, cuadrícula en tablet/escritorio).

**Inconsistencias**
- Favicon por defecto de Vite.
- Comentario de "botón Pausar" que ya no existe.
- Datos capturados que no se usan (presupuesto, viajeros, habitaciones).
- "Lugares para visitar" visibles pero no interactivos.
- Iconografía mixta.

**Oportunidades (sin rediseñar en esta fase)**
- Completar el flujo (Pasos 2–4) antes de agregar nuevas superficies.
- Navegación con URL (router) para compartir, volver atrás y recargar sin perder el viaje.
- Respetar `prefers-reduced-motion` y agregar control de pausa táctil.
- Imágenes responsivas y formatos modernos.
- Definir isotipo/favicon y una librería de iconos única.
- Comunicar en la portada la visión ampliada (hospedajes, experiencias) solo cuando exista.

# Auditoría del agente de IA: "a veces no responde / se queda esperando"

## Causas raíz encontradas

1. **`ChatSession` envenenada**: tras un fallo del SDK de Firebase AI, la promesa interna de envíos (`_sendPromise`) queda rechazada y los siguientes mensajes de esa sesión fallaban o no avanzaban.
2. **Timeout por defecto de 180 s** en el SDK: ante una red colgada, la interfaz parecía esperar sin fin.
3. **Sin reintentos** para fallos transitorios (red, 429, 5xx), y sin distinguirlos de los permanentes (configuración, permisos, bloqueo de seguridad).
4. **Herramientas sin límite de tiempo**: una llamada lenta (clima, OpenStreetMap) bloqueaba el turno completo.
5. **Doble envío / estados atascados**: nada impedía procesar dos veces el mismo mensaje ni había salida si el turno no terminaba.

## Correcciones (`src/lib/agent/`)

- `resilience.ts`: clasifica errores (transitorio, límite de cuota, timeout, permanente, configuración, bloqueado, cancelado); reintentos con *backoff* exponencial y *jitter* (×2 en cuota, respeta `Retry-After` hasta 15 s) **solo** para errores transitorios; timeout por intento (45 s) con cancelación inmediata por señal externa.
- `agent.ts`: envío de un solo vuelo (un mensaje a la vez, `requestId`); la sesión se reconstruye desde el historial confirmado tras un fallo; timeout de herramientas (20 s) y plazo total del turno (150 s); mensajes de error claros en el idioma activo; botón de reintento manual que conserva el texto y el contexto; el interfaz sale del estado "pensando" siempre.
- `telemetry.ts`: registro seguro en `sessionStorage` (máx. 100): marca de tiempo, proveedor, latencia, estado, código de error, reintentos, causa. **Sin contenido de conversaciones, claves ni datos personales**; botón "Copiar detalles técnicos".

## Latencia observada en producción

En la verificación en producción (18-nov-2026) cada llamada a `gemini-3.8-flash` tardaba 15–45 s con el razonamiento por defecto, lo que agotaba el timeout de 30 s y obligaba a reintentar. Se subió el timeout por intento a 45 s. Se probó `thinkingConfig.thinkingLevel = LOW` pero en la prueba en producción las llamadas no mejoraron (no concluyeron en 115 s), así que se retiró; queda pendiente medir la latencia con un navegador visible (el panel del navegador integrado en segundo plano limita temporizadores y puede falsear las mediciones).

## Pruebas

`resilience.test.ts` y `agentSession.test.ts` simulan: fallos transitorios con reintento, cuota, timeouts, desconexión, cancelación, que los reintentos no dupliquen el procesamiento y que el contexto se preserve. Toda la suite: 510 pruebas pasan.

## Límites conocidos

- Con Firebase AI Logic y App Check sin registrar (entorno local) el agente muestra el error de configuración y el modo guiado; es esperado y no reintentable.
- El comportamiento con el modelo real solo se puede verificar en producción.

## Dependencias externas

Firebase AI Logic (Gemini, nivel gratuito, con límites de cuota), App Check, Open-Meteo, OpenStreetMap/Overpass, Web Speech API del navegador.

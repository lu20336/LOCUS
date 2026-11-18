# Asistente por voz de LOCUS

## Qué hace

Modo de conversación por voz sobre el mismo agente de texto: esfera animada con estados (en espera, escuchando, pensando, preparando, hablando, silenciado, sin permiso, sin micrófono, sin red, no soportado), interrumpir, silenciar micrófono o voz, terminar, y transcripción escrita siempre disponible. Respeta `prefers-reduced-motion`.

## Tecnología elegida: Web Speech API

| Opción | Costo | Veredicto |
|---|---|---|
| Web Speech API (`SpeechRecognition` + `speechSynthesis`) | Gratis, sin claves | **Elegida**: cumple Spark y no expone claves en el frontend. |
| Gemini Live API / Cloud STT-TTS | Cuotas gratuitas inciertas o de pago | Opción futura; requeriría backend o plan de pago. |

Archivos: `src/lib/voice/speech.ts` (reconocimiento, síntesis, selección de voz, detección de idioma), `voiceMachine.ts` (máquina de estados pura, probada), `useVoiceConversation.ts` (solo se monta en modo voz: sin consumo en reposo), `src/components/agent/VoiceMode.tsx`, `VoicePanel.tsx`, `VoiceOrb.tsx`.

## Privacidad

- El micrófono se pide **solo** al activar la voz, tras un aviso de consentimiento.
- LOCUS no graba ni guarda audio. En Chrome/Edge el navegador envía el audio a Google/Microsoft para transcribirlo (se informa al usuario). Se muestra un indicador mientras el micrófono está activo.
- El nivel del micrófono se usa solo para animar la esfera.

## Idiomas y limitaciones

- Reconocimiento: el idioma se fija por conversación (es-CO, en-US, pt-BR, fr-FR, de-DE); no hay autodetección del habla. Chrome y Edge lo soportan; Safari parcialmente; **Firefox no tiene reconocimiento** (se avisa y se sigue por texto).
- Síntesis: depende de las voces instaladas en el dispositivo. Si no hay voz para el idioma, LOCUS responde por escrito y lo dice.
- El navegador integrado de la app de escritorio bloquea el micrófono: la prueba con micrófono real debe hacerse en Chrome.

## Pruebas

`src/lib/voice/__tests__/voice.test.ts` cubre la máquina de estados, la división de texto para síntesis y la selección de voz. En navegador se verificaron: modal de consentimiento, estado "sin permiso" con alternativa de texto, en alemán. **No verificado automáticamente**: reconocimiento y síntesis reales (requieren micrófono y voces del dispositivo).

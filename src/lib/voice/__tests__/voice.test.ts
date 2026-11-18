import { describe, expect, it } from 'vitest'
import { cleanForSpeech, detectLanguage, mapRecognitionError, pickVoice, scoreVoice, splitForSpeech } from '../speech'
import { MAX_SILENCES, initialVoiceState, micIsActive, shouldListen, voiceReducer, type VoiceEvent, type VoiceState } from '../voiceMachine'

const run = (events: VoiceEvent[], from: VoiceState = initialVoiceState) => events.reduce(voiceReducer, from)

describe('cleanForSpeech', () => {
  it('quita negritas, viñetas, enlaces y emojis', () => {
    const text = cleanForSpeech('**Salento** es genial 😀\n- Valle del Cocora\n- Café https://example.com/x\nVisita el pueblo.')
    expect(text).not.toMatch(/\*|https?:|😀/)
    expect(text).toContain('Salento es genial')
    expect(text).toContain('Valle del Cocora')
    expect(text).not.toContain('\n')
  })
  it('un texto vacío o solo símbolos queda vacío', () => {
    expect(cleanForSpeech('  ***  ')).toBe('')
  })
})

describe('splitForSpeech', () => {
  it('separa por frases y respeta el máximo', () => {
    const chunks = splitForSpeech('Hola. ¿Cómo estás? Muy bien, gracias. ' + 'palabra '.repeat(60) + 'fin.', 80)
    expect(chunks.length).toBeGreaterThan(2)
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(80)
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toContain('Hola.')
  })
  it('un texto corto es un solo bloque', () => {
    expect(splitForSpeech('Hola, ¿cómo vas?')).toEqual(['Hola, ¿cómo vas?'])
  })
})

describe('pickVoice', () => {
  const voices = [
    { name: 'Microsoft Sabina', lang: 'es-MX' },
    { name: 'Google español de Estados Unidos', lang: 'es-US' },
    { name: 'Google español', lang: 'es-ES' },
    { name: 'Google US English', lang: 'en-US' },
    { name: 'Microsoft Maria', lang: 'pt_BR' },
    { name: 'Google français', lang: 'fr-FR' },
    { name: 'eSpeak German', lang: 'de-DE' },
    { name: 'Google Deutsch', lang: 'de-DE' },
  ]
  it('elige la voz del idioma, prefiriendo región latinoamericana y voces de calidad', () => {
    expect(pickVoice(voices, 'es')?.name).toContain('Google español de Estados Unidos')
    expect(pickVoice(voices, 'en')?.name).toBe('Google US English')
    expect(pickVoice(voices, 'pt')?.lang).toBe('pt_BR')
    expect(pickVoice(voices, 'de')?.name).toBe('Google Deutsch')
  })
  it('sin voz para el idioma devuelve null (no se simula)', () => {
    expect(pickVoice([{ name: 'Google US English', lang: 'en-US' }], 'fr')).toBeNull()
    expect(pickVoice([], 'es')).toBeNull()
  })
  it('una voz de otro idioma puntúa 0', () => {
    expect(scoreVoice({ name: 'x', lang: 'en-US' }, 'es')).toBe(0)
  })
})

describe('detectLanguage', () => {
  it.each([
    ['es', 'Hola, quiero un hotel en Cartagena para tres días con mi familia'],
    ['en', 'Hello, I want to find a hotel in Cartagena for the weekend with my family'],
    ['pt', 'Olá, eu quero uma viagem para Cartagena com a minha família e não sei onde ficar'],
    ['fr', 'Bonjour, je veux un hôtel à Carthagène pour trois jours avec ma famille'],
    ['de', 'Hallo, ich möchte eine Reise nach Cartagena mit meiner Familie und ein Hotel'],
  ] as const)('reconoce %s', (lang, text) => {
    expect(detectLanguage(text, lang === 'es' ? 'en' : 'es')).toBe(lang)
  })
  it('con poca evidencia usa el idioma de respaldo', () => {
    expect(detectLanguage('ok', 'fr')).toBe('fr')
    expect(detectLanguage('Cartagena Salento Medellín', 'de')).toBe('de')
  })
})

describe('mapRecognitionError', () => {
  it('traduce los códigos del navegador', () => {
    expect(mapRecognitionError('not-allowed')).toBe('denied')
    expect(mapRecognitionError('service-not-allowed')).toBe('denied')
    expect(mapRecognitionError('audio-capture')).toBe('no-device')
    expect(mapRecognitionError('network')).toBe('network')
    expect(mapRecognitionError('no-speech')).toBe('no-speech')
    expect(mapRecognitionError('language-not-supported')).toBe('language')
    expect(mapRecognitionError('raro')).toBe('other')
  })
})

describe('voiceReducer: conversación completa', () => {
  it('flujo feliz: escuchar → procesar → hablar → volver a escuchar', () => {
    let s = run([{ type: 'START', supported: true }, { type: 'LISTEN' }])
    expect(s.phase).toBe('listening')
    expect(shouldListen(s) && micIsActive(s)).toBe(true)
    s = run([{ type: 'HEARD_INTERIM', text: 'quiero ir a' }], s)
    expect(s.interim).toBe('quiero ir a')
    s = run([{ type: 'HEARD_FINAL', text: 'quiero ir a Salento' }], s)
    expect(s).toMatchObject({ phase: 'processing', heard: 'quiero ir a Salento', interim: '' })
    expect(shouldListen(s)).toBe(false) // no se escucha mientras piensa
    s = run([{ type: 'REPLY_READY', speak: true }], s)
    expect(s.phase).toBe('speaking')
    expect(shouldListen(s)).toBe(false) // ni mientras habla (evita oír su propia voz)
    s = run([{ type: 'SPEAK_END' }], s)
    expect(s.phase).toBe('listening')
  })

  it('interrumpir mientras habla vuelve a escuchar', () => {
    const s = run([{ type: 'START', supported: true }, { type: 'LISTEN' }, { type: 'HEARD_FINAL', text: 'hola' }, { type: 'REPLY_READY', speak: true }, { type: 'INTERRUPT' }])
    expect(s.phase).toBe('listening')
  })

  it('con la voz de LOCUS silenciada la respuesta solo se escribe y se sigue escuchando', () => {
    const s = run([{ type: 'START', supported: true }, { type: 'TOGGLE_AUDIO' }, { type: 'LISTEN' }, { type: 'HEARD_FINAL', text: 'hola' }, { type: 'REPLY_READY', speak: true }])
    expect(s.phase).toBe('listening')
    expect(s.audioOn).toBe(false)
  })

  it('sin voz instalada se avisa y se sigue por texto (sin simular)', () => {
    const s = run([{ type: 'START', supported: true }, { type: 'LISTEN' }, { type: 'HEARD_FINAL', text: 'hola' }, { type: 'REPLY_READY', speak: false, noVoice: true }])
    expect(s).toMatchObject({ phase: 'listening', notice: 'no-voice' })
  })

  it('silenciar el micrófono apaga la escucha y reactivarlo la retoma', () => {
    let s = run([{ type: 'START', supported: true }, { type: 'LISTEN' }, { type: 'TOGGLE_MIC' }])
    expect(s).toMatchObject({ phase: 'muted', micOn: false })
    expect(micIsActive(s)).toBe(false)
    s = run([{ type: 'TOGGLE_MIC' }], s)
    expect(s).toMatchObject({ phase: 'listening', micOn: true })
  })

  it('tras varios silencios deja de reabrir el micrófono y lo avisa', () => {
    let s = run([{ type: 'START', supported: true }, { type: 'LISTEN' }])
    for (let i = 0; i < MAX_SILENCES; i++) s = run([{ type: 'NO_SPEECH' }], s)
    expect(s).toMatchObject({ phase: 'idle', notice: 'no-speech' })
    s = run([{ type: 'LISTEN' }], s)
    expect(s.phase).toBe('listening')
    expect(s.notice).toBeNull()
  })

  it('terminar la conversación lo apaga todo y conserva la preferencia de audio', () => {
    const s = run([{ type: 'START', supported: true }, { type: 'TOGGLE_AUDIO' }, { type: 'LISTEN' }, { type: 'STOP' }])
    expect(s.phase).toBe('off')
    expect(s.audioOn).toBe(false)
    expect(micIsActive(s)).toBe(false)
  })

  it('texto vacío no dispara una consulta', () => {
    const s = run([{ type: 'START', supported: true }, { type: 'LISTEN' }, { type: 'HEARD_FINAL', text: '   ' }])
    expect(s.phase).toBe('listening')
  })
})

describe('voiceReducer: errores y estados especiales', () => {
  it('navegador sin reconocimiento de voz → unsupported', () => {
    expect(run([{ type: 'START', supported: false }]).phase).toBe('unsupported')
  })
  it('permiso denegado, sin micrófono y red caída tienen estado propio y se puede reintentar', () => {
    for (const [issue, phase] of [['denied', 'denied'], ['no-device', 'no-device'], ['network', 'network']] as const) {
      let s = run([{ type: 'START', supported: true }, { type: 'LISTEN' }, { type: 'ISSUE', issue }])
      expect(s.phase).toBe(phase)
      expect(shouldListen(s)).toBe(false)
      s = run([{ type: 'RETRY' }, { type: 'LISTEN' }], s)
      expect(s.phase).toBe('listening')
    }
  })
  it('idioma no soportado por el reconocimiento avisa sin romper', () => {
    const s = run([{ type: 'START', supported: true }, { type: 'LISTEN' }, { type: 'ISSUE', issue: 'language' }])
    expect(s).toMatchObject({ phase: 'idle', notice: 'no-recognition' })
  })
  it('los eventos fuera de lugar se ignoran (por ejemplo, oír algo mientras procesa)', () => {
    const s = run([{ type: 'START', supported: true }, { type: 'LISTEN' }, { type: 'HEARD_FINAL', text: 'hola' }])
    expect(voiceReducer(s, { type: 'HEARD_INTERIM', text: 'ruido' })).toBe(s)
    expect(voiceReducer(s, { type: 'HEARD_FINAL', text: 'otra' })).toBe(s)
    expect(voiceReducer(s, { type: 'SPEAK_END' })).toBe(s)
  })
})

import { defineConfig } from 'vitest/config'

// Pruebas de las reglas de Firestore: necesitan el emulador (npm run test:rules).
export default defineConfig({
  test: { environment: 'node', include: ['tests/rules/**/*.test.ts'], testTimeout: 20000, hookTimeout: 30000 },
})

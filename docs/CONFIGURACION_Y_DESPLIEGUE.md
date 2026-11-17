# Configuración, ejecución local y despliegue

## 1. Flujo de trabajo (ramas)

```
c.lamusg  ──(pruebas locales con npm run dev)──►  merge  ──►  main  ──►  CI: despliegue a producción
```

1. Trabajas en la rama **`c.lamusg`** y pruebas en `http://localhost:5173` con `npm run dev`.
2. Cuando todo esté bien: `git checkout main && git merge c.lamusg && git push` (o un Pull Request en GitHub).
3. **Al hacer push a `main`**, el workflow [`deploy.yml`](../.github/workflows/deploy.yml) verifica (lint, pruebas, reglas),
   compila y publica **reglas de Firestore + Hosting**. **Solo funciona cuando configures el secreto de la §5**; mientras
   tanto, el despliegue es manual: `npm run deploy`.
4. Las ramas y los PR ejecutan [`ci.yml`](../.github/workflows/ci.yml) (lint, build, pruebas unitarias y de reglas), sin publicar nada.

> ⚠ **Antes del primer despliegue** haz los pasos de la §4 (activar Auth y AI Logic). Si publicas sin activar el
> ingreso con correo/Google, el sitio carga pero nadie podrá registrarse.

## 2. Ejecutar en local (sin tocar producción)

Requisitos: **Node 24**, **npm**, **Java 11+** (para el emulador de Firestore; ya lo tienes: Java 25).

```bash
npm ci            # instala dependencias (una vez)
npm run dev       # emuladores de Auth + Firestore + Vite → http://localhost:5173
npm run seed      # (otra terminal, con el emulador corriendo) datos de prueba
```

- `npm run dev` usa **`.env.development`** (`VITE_USE_EMULATORS=true`): **todo lo que hagas queda en el emulador** y se
  borra al apagarlo. Interfaz del emulador: <http://127.0.0.1:4000> (si abre) / Auth `:9099` / Firestore `:8080`.
- `npm run seed` crea (solo en el emulador): cuentas **`anfitrion@locus.test`**, **`huesped@locus.test`**, **`admin@locus.test`**
  (clave `locus-prueba-123`), 3 alojamientos publicados + 1 pendiente, 2 experiencias. Todo marcado "Dato de prueba".
- Lo que **sí** es real en local: el agente de IA (necesita el paso 4.3), OpenFreeMap, Nominatim, Overpass, Open-Meteo, Wikipedia.
- `npm run dev:real` apunta al Firebase **real** (no recomendado para pruebas: escribirías en producción).
- Para probar el **flujo completo** usa: huésped (reserva) → anfitrión (acepta solicitudes en `Cartagena`, calendario) → admin (aprueba la finca pendiente).

Otros comandos: `npm test` (pruebas unitarias) · `npm run test:rules` (reglas con emulador; detén `npm run dev` primero o usa
`npx vitest run --config vitest.rules.config.ts` contra el emulador ya abierto) · `npm run lint` · `npm run build`.

## 3. Variables de entorno

**Ninguna es un secreto** (todo `VITE_*` queda visible en el navegador). Los secretos reales (llaves de pasarela de pago,
cuentas de servicio) **no van en el repositorio ni en el frontend**.

| Variable | ¿Obligatoria? | Para qué | Dónde se define |
|---|---|---|---|
| `VITE_USE_EMULATORS` | No | `true` = emuladores (ya activo en dev) | `.env.development` |
| `VITE_NOMINATIM_EMAIL` | Recomendada | Contacto que pide la política de Nominatim (queda visible) | `.env.local` / variable de GitHub |
| `VITE_GEMINI_MODEL` | No | Cambia el modelo (por defecto `gemini-3.8-flash`) | `.env.local` / variable de GitHub |
| `VITE_APPCHECK_SITE_KEY` | Recomendada en producción | reCAPTCHA v3 para App Check (protege la cuota de Gemini) | `.env.local` / variable de GitHub |
| `VITE_MAPILLARY_TOKEN` | No | Token de **cliente** de Mapillary (fotos de calle) | `.env.local` / variable de GitHub |

La configuración web de Firebase (`src/lib/firebase/client.ts`) es pública por diseño y no cambia.

## 4. Pasos en la consola de Firebase (proyecto `locus-bb57e`) — **requieren tu intervención**

1. **Authentication → Método de acceso:** habilita **Correo electrónico/contraseña** y **Google**. (Verifica que `locus-bb57e.firebaseapp.com` esté en *dominios autorizados*.)
2. **Firestore Database:** ya existe. Publica las reglas con `npm run deploy:rules` (o el CI). Las reglas anteriores solo cubrían `itineraries`; las nuevas conservan ese bloque.
3. **Firebase AI Logic** (el "cerebro" del agente): abre <https://console.firebase.google.com/project/locus-bb57e/ailogic/> → **Get started** → elige **Gemini Developer API**.
   Es **gratuito sin facturación** (plan Spark). *Esto es lo único que falta para que el compañero responda; hoy muestra "todavía no está activado" y un modo guiado.*
   - En AI Studio puedes ver los **límites reales** de tu proyecto (no se publican por modelo).
4. **App Check (⚠ necesario para que la IA responda):** al activar Firebase AI Logic, la consola **exige App Check** por defecto, y sin un token válido Google responde
   `401 "Firebase App Check token is invalid"` (lo comprobé llamando a la API directamente). Elige UNA de estas dos rutas:
   - **Rápida (demostración):** consola → **App Check → pestaña "APIs" → Firebase AI Logic → ⋮ → Unenforce**. Efecto en pocos minutos. Inconveniente: sin protección, cualquiera con la configuración web (que es pública) podría gastar tu cuota gratuita de Gemini.
   - **Correcta (recomendada antes de abrirlo al público):**
     1. Crea una clave **reCAPTCHA v3** en <https://www.google.com/recaptcha/admin/create> con los dominios `localhost`, `locus-bb57e.firebaseapp.com` y `locus-bb57e.web.app`. Guarda la *clave del sitio* y la *clave secreta*.
     2. Consola → **App Check → Apps →** tu app web → **reCAPTCHA** → pega la **clave secreta** → Guardar.
     3. Pon la *clave del sitio* en `.env.local`: `VITE_APPCHECK_SITE_KEY=...` y reinicia `npm run dev`.
     4. En local, abre la consola del navegador (F12): aparece **"AppCheck debug token: …"**. Cópialo en **App Check → ⋮ de tu app → Manage debug tokens → Add**.
     5. Deja **Enforce** activo para Firebase AI Logic. En producción añade `VITE_APPCHECK_SITE_KEY` como variable de GitHub.
5. **Primer administrador:** crea una cuenta en el sitio, copia su **UID** (Authentication → Usuarios) y en Firestore crea la colección `admins` con un documento cuyo **ID sea ese UID** (cualquier campo, p. ej. `createdAt`).
6. **Restricciones de la API key web** (Google Cloud → Credenciales): limítala a los dominios de LOCUS. Y revisa **alertas de presupuesto**.
7. *(Opcional)* **Mapillary:** crea una cuenta en <https://www.mapillary.com/dashboard/developers>, genera un **token de cliente** y ponlo en `VITE_MAPILLARY_TOKEN`. Confirma ahí los términos de uso de las imágenes.

## 5. Despliegue automático desde GitHub (opcional, recomendado)

Para que `git push` a `main` publique solo:

1. Consola de Google Cloud → IAM → **Cuentas de servicio** → crea una (p. ej. `github-deploy`) con los roles **Firebase Hosting Admin**, **Firebase Rules Admin** y **Cloud Datastore Index Admin** (*más* `Service Usage Consumer`). Genera una **clave JSON**.
2. GitHub → repositorio → *Settings → Secrets and variables → Actions*:
   - **Secret** `FIREBASE_SERVICE_ACCOUNT` = el contenido del JSON (⚠ es sensible; bórralo de tu computador después).
   - **Variables** (públicas): `VITE_NOMINATIM_EMAIL`, `VITE_APPCHECK_SITE_KEY`, `VITE_MAPILLARY_TOKEN`, `VITE_GEMINI_MODEL` (las que uses).
3. *(Recomendado)* *Settings → Environments → production → Required reviewers* = tú: así cada despliegue pide tu aprobación.

Alternativa más simple solo para Hosting: `firebase init hosting:github` (crea su propia cuenta de servicio). Las reglas se publicarían a mano con `npm run deploy:rules`.

> ⚠ **No uses solo `firebase deploy --only hosting`** (el comando que se usaba antes): publica la interfaz pero **no las reglas de Firestore**, y esta versión depende de reglas nuevas (reservas, anfitriones, favoritos, chat). Usa `npm run deploy` (reglas + Hosting). Antes de desplegar haz `git checkout main` y `git pull` para no publicar una versión vieja.

**Despliegue manual** (sin CI): `npx firebase login` (una vez) y luego `npm run deploy` (reglas + Hosting) o `npm run deploy:hosting`.
Revertir: Firebase Hosting guarda versiones; *Hosting → Historial → Revertir*. Las reglas se revierten re-desplegando la versión anterior del archivo.
Vista previa sin tocar producción: `npm run deploy:preview` (canal temporal).

## 6. Cuotas y costos (plan Spark)

| Recurso | Límite gratuito de referencia | Nota |
|---|---|---|
| Firestore | cuota diaria de lecturas/escrituras y 1 GiB (⚠ valores a confirmar en la [página de precios](https://firebase.google.com/pricing)) | Las fotos como data URL consumen almacenamiento y lecturas: la miniatura de la ficha mantiene las listas livianas. |
| Hosting | cuota de almacenamiento y transferencia (⚠ confirmar) | |
| Auth | gratis para correo/Google | |
| Gemini (nivel gratuito) | límites por proyecto en AI Studio; 100 RPM por usuario en AI Logic | 60 mensajes/día por usuario en LOCUS |
| Open-Meteo | 10.000 llamadas/día, **solo uso no comercial** | caché de 30 min |
| OpenFreeMap | sin límite | atribución obligatoria |
| Nominatim | 1 petición/s | solo por acción del usuario |
| Overpass | best-effort | caché 24 h |

**No se activó nada con facturación.** Cloud Functions y Cloud Storage de Firebase **requieren plan Blaze**; por eso no se usan.
Si superas la cuota gratuita, Firestore deja de responder hasta el día siguiente (no cobra).

# Precios de referencia (Fase 2, 100 % gratis)

> **Estado:** el código está listo y probado con simulaciones (`src/lib/compare/__tests__/livePrices.test.ts`), pero
> **todavía no está activado**: faltan dos cuentas gratuitas que solo tú puedes crear (Travelpayouts y Cloudflare).
> Mientras no pongas `VITE_PRICES_API_URL`, la app funciona igual y el bloque de precios simplemente no aparece.

## Qué es (y qué no es)

- ✅ **Vuelos:** una **referencia de precio** ("desde $X por persona, visto hace unas horas") sacada de la API de datos de
  Aviasales/Travelpayouts, que guarda los precios más baratos que encontraron viajeros en las últimas ~48 h.
  Se muestra con el aviso de que puede haber cambiado y un botón a Aviasales; además entra a la *libreta de precios*
  etiquetada **"Referencia · puede variar"**.
- ❌ **No son precios en vivo ni reservables.** La API de búsqueda en tiempo real de Travelpayouts exige un mínimo de
  tráfico (≈50 000 usuarios al mes); cuando LOCUS lo alcance se puede migrar.
- ❌ **Hoteles / Booking / Airbnb:** no existe una fuente gratuita y legal de precios en vivo. Booking y Expedia exigen
  aprobación como socio (con tráfico demostrable) y Airbnb no ofrece API pública. Por ahora se compara con enlaces
  pre-llenados + libreta de precios (Fase 1). Cuando tengas aprobación de algún programa, se añade al mismo Worker.
- ❌ **Nada de scraping**, nunca.

## Costo

| Pieza | Plan | Límite relevante |
|---|---|---|
| Cloudflare Workers | Gratis, **sin tarjeta** | 100 000 solicitudes/día ([límites](https://developers.cloudflare.com/workers/platform/limits/)) |
| Travelpayouts (API de datos de Aviasales) | Gratis para socios | Límite de solicitudes por minuto; el Worker cachea 6 h por ruta+fecha para no gastarlo |

## Cómo se protege

- El **token de Travelpayouts es un secreto**: vive solo en el Worker (`wrangler secret put`), nunca en el repo ni en el navegador.
- El Worker solo responde a los orígenes de LOCUS (`ALLOWED_ORIGINS`) y valida rutas, fechas y códigos IATA.
- Responde **"sin datos"** ante cualquier respuesta rara y descarta precios que no vengan en COP; jamás inventa un precio.
- El navegador valida otra vez la respuesta (solo enlaces https a `aviasales.com`).

## Paso a paso (≈ 20 minutos)

### 1. Cuenta de Travelpayouts (gratis)

1. Regístrate en <https://www.travelpayouts.com/> y **conecta el programa Aviasales**.
2. En tu perfil copia el **API token** (secreto) y el **Marker** (tu identificador de afiliado, público).
3. Verifica que tu cuenta permite la *Data API* de Aviasales (la documentación pide estar registrado y conectado al programa).

### 2. Cuenta de Cloudflare y despliegue del Worker (gratis)

Desde la carpeta del proyecto:

```bash
npx wrangler login
```

Abre el navegador; inicia sesión (o crea la cuenta gratis, sin tarjeta). Luego:

```bash
npx wrangler secret put TRAVELPAYOUTS_TOKEN --config workers/prices/wrangler.toml
```

Pega el token cuando lo pida. Abre `workers/prices/wrangler.toml` y pon tu marker en `TRAVELPAYOUTS_MARKER = "..."`. Después:

```bash
npx wrangler deploy --config workers/prices/wrangler.toml
```

Al terminar muestra la URL, algo como `https://locus-prices.<tu-subdominio>.workers.dev`.

### 3. Probarlo

```bash
curl https://locus-prices.<tu-subdominio>.workers.dev/health
# → {"ok":true,"service":"locus-prices","configured":true}
```

`configured:true` confirma que el secreto está puesto. Luego prueba una consulta real **desde el navegador** (el Worker exige
origen): abre `http://localhost:5173/comparar?tipo=vuelos` con la variable del paso 4 y elige una ruta con fecha.
Si ves "No hay precios recientes", no es un error: esa ruta/fecha no tiene datos en el caché de Aviasales.

> ⚠ **Primera verificación importante:** el contrato con `/aviasales/v3/prices_for_dates` se escribió con la documentación
> pública pero no se pudo probar sin token. Si la primera consulta real no muestra precio en una ruta popular (BOG→CTG, un
> mes cercano), revisa `workers/prices/src/handler.ts` (`pickCheapest` y `queryUpstream`) con la respuesta real, ajusta y vuelve a desplegar.

### 4. Conectar la web

- **Local:** en `.env.local` agrega `VITE_PRICES_API_URL=https://locus-prices.<tu-subdominio>.workers.dev`.
- **Producción:** GitHub → *Settings → Secrets and variables → Actions → Variables* → crea `VITE_PRICES_API_URL` con esa URL
  (el workflow `deploy.yml` ya la lee). El siguiente push a `main` la incluye.
- Si compras un dominio propio, agrégalo a `ALLOWED_ORIGINS` en `wrangler.toml` y vuelve a desplegar el Worker.

## Afiliados

Con el **Marker** puesto, el botón "Ver este vuelo en Aviasales" lleva tu identificador y LOCUS gana comisión si el usuario compra.
Para los demás enlaces del comparador (Aviasales general, Booking, GetYourGuide…) usa las variables `VITE_AFF_*`
(`.env.example`, `docs/NEGOCIO.md`).

## Próximos pasos (cuando haya tráfico y aprobaciones)

1. Hoteles: solicitar el programa de afiliados de Booking.com / Expedia Rapid y añadir un endpoint `/hotels` al Worker.
2. Búsqueda en tiempo real de vuelos (Travelpayouts ≥ 50 000 MAU, o Duffel para vender dentro de LOCUS).
3. Alertas de precio por correo (Cloudflare Cron Triggers, también gratis).

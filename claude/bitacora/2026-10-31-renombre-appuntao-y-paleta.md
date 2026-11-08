# 2026-10-31 — Fiao pasa a llamarse Appuntao, con paleta nueva

**Objetivo:** el proyecto cambia de nombre a **Appuntao**. El repositorio pasó a
`github.com/yjgarizabalo/appuntao-mobil` y la carpeta local a `appuntao-mobil`. Llegó una
paleta nueva (azul eléctrico, azul profundo, lima, blanco frío). Las imágenes se mantienen.

**Rama:** `main`

---

## Qué se decidió

- **Solo cambia el nombre visible.** `expo.name`, `package.json > name` y los textos de la
  UI (WhatsApp, inicio, perfil). Se conservan `slug`, `scheme`, `com.yair77.fiao` y el
  `projectId` de EAS: cambiarlos crea una app nueva en Play/App Store, exige keystore nuevo
  y rompe el vínculo con el proyecto de expo.dev. Quedó como regla en `CLAUDE.md`.
- **Se conservan** el prefijo de caché `fiao_cache:` (llave de almacenamiento, contrato),
  el correo `soporte@fiao.app` (no hay todavía un dominio de Appuntao) y la URL
  `fiao-backend.onrender.com` (el backend no se renombró).
- `package-lock.json` se actualizó con `npm install --package-lock-only` (solo cambian las
  dos líneas `name`), no a mano.

## Paleta

| Paleta         | Hex       | Dónde quedó                                         |
| -------------- | --------- | --------------------------------------------------- |
| Azul eléctrico | `#1746E8` | `brand[500]` → rol `brand` (reemplaza al verde)     |
| Azul profundo  | `#102B65` | `brand[800]` → roles `brandDeep`, `accentOn`; héroe |
| Lima vibrante  | `#C8F000` | escala nueva `lime` → rol `accent`                  |
| Blanco frío    | `#F5F8FF` | `ink[50]` → rol `bg`                                |

- La escala `brand` se interpoló entre el eléctrico (500) y el profundo (800).
- `ink` se re-tintó hacia azul (`900` = `#0A1736`), así el overlay, el scrim, las sombras de
  iOS y el fondo del splash (`app.json`) siguen al tono.
- El verde anterior se movió a una escala `success`: «pagado / al día» sigue siendo verde,
  porque la lima no se lee como texto sobre blanco.
- La lima aparece en los íconos de estadísticas del héroe de Inicio y en el spinner de la
  pantalla de entrada (antes `brand[300]`).
- La paleta de avatares (`format.ts`) usa `brand[500]`, así que uno de sus tonos ahora es azul.

## Qué se verificó

- `npm run typecheck` y `npm run lint` en 0.
- **No** se probó en dispositivo Android ni iOS en esta sesión: el cambio es de color y
  textos, pero hay que revisar a ojo el contraste de los héroes y los botones en los dos.

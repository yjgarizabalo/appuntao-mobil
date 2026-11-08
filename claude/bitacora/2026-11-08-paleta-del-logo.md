# 2026-11-08 — La paleta de la interfaz pasa a ser la del logo

**Objetivo:** que el azul de la app sea el mismo del logotipo. La paleta del 2026-10-31
(`#1746E8` / `#102B65` / `#C8F000`) se parecía a la del logo, pero no era la misma; con las
imágenes nuevas en `assets/images/` la diferencia se notaba: botones y héroes de un azul
más apagado y violáceo que el logo puesto encima.

**Rama:** `main`

---

## Qué se encontró

Se midieron los píxeles de `icon.png` e `icon-blanco.png` (con `pngjs`, que ya está en
`node_modules`). Los tres colores dominantes coinciden **exactos** con la paleta oficial
que pasó el dueño del producto:

| Color          | Logo      | Tema anterior | Diferencia                       |
| -------------- | --------- | ------------- | -------------------------------- |
| Azul principal | `#0066FF` | `#1746E8`     | el anterior, más apagado/violeta |
| Azul oscuro    | `#0B2D6B` | `#102B65`     | casi igual                       |
| Verde lima     | `#B6FF00` | `#C8F000`     | el anterior, más amarillento     |

## Qué se cambió

1. **`src/theme/tokens.ts`.** `brand[500]`, `brand[800]` y `lime[500]` toman los valores
   del logo. El resto de cada escala se recalculó **a partir de ellos**, no a ojo:
   - `brand` 50–400: `500` mezclado con blanco (92 %, 83 %, 66 %, 45 %, 22 %);
   - `brand` 600–700: `500` mezclado con `800` (25 %, 50 %);
   - `lime` 50–300: con blanco; `lime` 600–700: con negro (18 %, 40 %).
2. **Roles (`src/theme/index.ts`): sin cambios.** Toda la app consume roles, así que el
   cambio de escala llega solo a botones, héroes, foco, badges y toasts.
3. **Avatares (`src/core/utils/format.ts`).** El último tono era `#3B82F6`, que con la
   marca en `#0066FF` quedaba indistinguible de `brand[500]` (primer tono): dos clientes
   distintos parecían del mismo color. Se reemplazó por `brand[700]` (`#064AB5`).
4. **`CLAUDE.md`, Fase 6.** Tabla de paleta con los valores del logo, qué parte del logo es
   cada uno y la regla de derivar la escala desde los extremos.

## Contraste (WCAG)

| Combinación                             | Contraste | Uso                    |
| --------------------------------------- | --------- | ---------------------- |
| Blanco sobre `brand[500]`               | 4.83:1    | texto de botón primario (AA) |
| `brand[500]` sobre `bg` (`#F5F8FF`)     | 4.55:1    | enlaces, texto de marca (AA, justo) |
| `brand[600]` sobre `brand[50]`          | 5.51:1    | badges suaves          |
| `brand[800]` sobre `lime[500]`          | 10.80:1   | `accentOn` sobre acento |
| `lime[500]` sobre `ink[900]`            | 14.55:1   | detalles en héroes     |
| `lime[500]` sobre blanco                | 1.21:1    | **prohibido** como texto |

El azul nuevo es más luminoso que el anterior (6:1 → 4.8:1 con blanco). Sigue cumpliendo
AA para texto normal, pero ya no sobra margen: nada más claro que `brand[500]` puede ir
como texto sobre blanco.

## Segunda parte: `info` y los colores sueltos

En la misma sesión se resolvieron los dos pendientes que dejó la primera parte.

**`info` pasa de azul (`#3B82F6`) a cian (`#0891B2`).** Con la marca en `#0066FF`, los
badges «Próximamente», el rol ADMIN, los diálogos informativos y el aviso de pago global se
leían como acciones de marca. El cian queda entre la marca y el verde de éxito. Contraste:
`info[600]` sobre `info[50]` 4.9:1 (texto de badge), `info[500]` sobre `info[50]` 3.4:1
(íconos). `infoOn` pasó de blanco (3.7:1 sobre el cian) a `ink[900]` (4.8:1); hoy ningún
componente lo usa, pero el rol ya queda correcto.

**Cero colores literales fuera de `src/theme/`.** Había ocho `rgba(255,255,255,…)` en
pantallas y componentes, con tres opacidades (8 %, 12 %, 14 %) para dos funciones:

| Rol nuevo           | Valor       | Dónde                                                          |
| ------------------- | ----------- | -------------------------------------------------------------- |
| `fillInverse`       | blanco 12 % | botón de perfil (Inicio y Wallet), `IconButton` inverso, `BusinessSwitcher`, `ModeSwitcher` |
| `fillInverseSubtle` | blanco 8 %  | franja de estadísticas del héroe (Inicio y Wallet), `StatTile` inverso |

`ModeSwitcher` usaba 14 % y quedó en 12 %: va al lado del botón de perfil y los dos
controles deben pesar igual. La diferencia no se nota a simple vista.

Los colores de avatar pasaron de `format.ts` a `palette.avatar` en `tokens.ts`. Al medirlos
apareció un problema anterior: el ámbar (`warning[500]`) daba **2.0:1** con las iniciales
blancas. Se cambió por `warning[700]` (4.4:1); el más bajo de la lista queda en 3.1:1, que
alcanza para texto en negrita.

De paso, `AppBar` tenía `inverse ? 'transparent' : 'transparent'`; quedó en `'transparent'`.

## Qué no se tocó, y por qué

- **`app.json`**: el fondo del splash es `ink[900]` (`#0A1736`) y el del ícono adaptativo
  blanco; ninguno es un color de marca, así que no hizo falta prebuild.
- Algunos componentes (`Toast`, `ClientWalletScreen`, `ClientStoreScreen`,
  `DebtorDetailScreen`) leen `theme.palette.*` directamente en vez de un rol. No es un
  literal, así que no incumple la Fase 0.4, pero sí la regla de la Fase 6 («roles, nunca la
  escala»). Queda como deuda aparte.

## Qué se verificó

- `npm run typecheck` y `npm run lint` en 0.
- `npx expo export --platform android --platform ios` compila; el bundle contiene
  `#0066FF` y ya no contiene `#1746E8`. Se repitió tras la segunda parte, con el mismo
  resultado.
- `grep` de `#xxxxxx` y `rgba(` en `src/` y `app/` fuera de `src/theme/`: sin resultados.
- **No** se probó en dispositivo Android ni iOS: falta revisar a ojo el héroe (el degradado
  termina ahora en `brand[700]` = `#064AB5`, más luminoso que antes), los botones
  primarios y los badges.

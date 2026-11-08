# 2026-11-08 — Los documentos legales vienen del backend

El 2026-10-14 el registro ganó una casilla de aceptación, pero la aceptación se quedaba en
el teléfono y el texto viajaba en el bundle. El backend ya tiene su módulo legal
(`feature/legal-consent`) y la app se alinea a él: **el backend es la fuente de verdad**.

## Cómo funciona el backend

- `GET /legal/current` (público) devuelve la versión vigente de **dos** documentos:
  `TERMS_AND_CONDITIONS` y `PRIVACY_POLICY`, con su texto en Markdown, su huella
  SHA-256 y su `id`.
- `POST /users` exige `acceptedLegalDocumentIds` con los ids de **todos** los vigentes.
  Guarda el usuario y la aceptación (IP, app, fecha) en una sola transacción.
- Sin documentos publicados, el registro responde **503**. Con una versión vieja, **400**.
- `GET /legal/pending` y `POST /legal/accept` cubren a quien ya tiene cuenta cuando se
  publica una versión nueva. El backend **no bloquea** a quien tenga pendientes; quien
  pide la aceptación es la app.

## Qué cambió

### El texto ya no está en la app

`src/domain/legal.ts` dejó de tener las 26 cláusulas. Ahora tiene los tipos del backend,
las etiquetas, el contacto y `parseLegalContent`, un intérprete del Markdown mínimo que
usan los documentos (`#` título, `## N. Cláusula`, párrafos y viñetas `-`). No se agregó
una librería de Markdown porque las versiones están congeladas.

El motivo es legal, no técnico: la prueba de la autorización es la huella del texto que
el backend sirvió. Si la app mostrara su propia copia, esa prueba no diría nada de lo que
el usuario leyó.

El intérprete se probó contra el documento viejo: convertido a Markdown y leído de vuelta,
da las mismas 26 cláusulas, idénticas.

### Registro

- Al abrir la pantalla se piden los documentos vigentes. La tarjeta de aceptación
  (`features/legal/components/LegalAcceptance`, antes `auth/components/TermsAcceptance`)
  muestra un esqueleto mientras cargan, un error con "Reintentar" si fallan, y "El registro
  no está disponible por ahora" si el backend no tiene documentos publicados. En esos tres
  casos no hay casilla: no se acepta lo que no se ha podido ver.
- Una sola casilla acepta los dos documentos, con una fila de lectura para cada uno.
- Los ids viajan en `acceptedLegalDocumentIds`.
- Si el registro falla con 400 o 503, se vuelven a pedir los documentos. Si cambiaron, se
  desmarca la casilla y se pide aceptar de nuevo, sin perder lo escrito. Se compara contra
  el backend en vez de leer el mensaje del error, que es texto para personas.

### Lectura

`/legal/terms` pasó a ser `/legal/[type]`, con `terminos` y `privacidad`. Cada vez que se
abre, pide el texto vigente, **sin caché**: mostrar una versión vieja como vigente sería
engañar al usuario. Si el documento no está publicado, lo dice.

### Versiones nuevas con sesión iniciada

`LegalGate` envuelve la app en `app/(app)/_layout.tsx` y consulta `GET /legal/pending`. Si
hay pendientes, en lugar de la app muestra `LegalUpdateScreen`: "Actualizamos nuestros
documentos", con la casilla y "Cerrar sesión" como salida.

- No bloquea mientras pregunta, y sin red no bloquea: el backend gratuito tarda en
  despertar y esto casi nunca pasa.
- Usa `/legal/pending` y no el `pendingLegalDocuments` del login, para que funcione igual
  con una sesión restaurada.
- Al cambiar de la app a la pantalla de aceptación, el stack se desmonta. Después de
  aceptar se vuelve al inicio, no a la pantalla en la que se estaba. Como pasa al entrar,
  se aceptó.

### Perfil

En "Ayuda" hay dos filas nuevas para releer los términos y la política de datos.

## Los tipos los decide el backend

Después de probar en dispositivo, el backend cambió el enum de tipos por un catálogo
(`LegalDocumentKind`) y salió a producción con tres:

| Código                      | Se exige a                    | Por qué (Colombia)                                     |
|-----------------------------|-------------------------------|--------------------------------------------------------|
| `TERMS_AND_CONDITIONS`      | todo usuario, al registrarse  | El contrato de uso                                     |
| `PRIVACY_POLICY`            | todo usuario, al registrarse  | Ley 1581 de 2012: todo Responsable debe tener política |
| `DATA_PROCESSING_AGREEMENT` | quien crea o tiene un negocio | El tendero es Responsable de los datos de sus clientes y Appuntao los trata como Encargado (Decreto 1074 de 2015) |

Lo que cambió en la app:

- **Ya no hay lista de tipos ni etiquetas.** Cada documento trae `title`, `audience` y
  `required`, y la app pinta lo que llegue. Antes, un tipo nuevo habría hecho que la app
  mandara menos ids de los exigidos y el registro fallara.
- El registro pide `?audience=ALL_USERS`. La creación de negocio pide
  `?audience=BUSINESS_OWNERS` y muestra la tarjeta de aceptación antes de enviar. Si no
  llega ninguno, no hay tarjeta.
- La frase del registro dice "**autorizo** el tratamiento de mis datos personales": la
  Ley 1581 pide una autorización expresa, no solo aceptar un texto.
- La ruta usa el código: `/legal/PRIVACY_POLICY`. El perfil tiene una sola fila,
  "Documentos legales", que abre `/legal`, la lista que sirva el backend.
- Solo se aceptan los obligatorios. Un consentimiento opcional, como marketing, necesitaría
  su propia casilla, que no existe todavía.

## Los pendientes del 2026-10-14

1. La aceptación viaja al backend: **cerrado**.
2. Enlace desde el perfil: **cerrado**.
3. Aviso cuando el documento cambia: **cerrado** con `LegalGate`.

## Qué se verificó

- `npm run typecheck`: 0 errores. `npm run lint`: 0 problemas.
- `npx expo export --platform android --platform ios`: los dos bundles compilan.
- `parseLegalContent` contra el documento viejo (26 cláusulas idénticas) y contra casos
  borde: introducción, cláusula sin número, texto después de una lista y negritas.

Las cuatro pruebas de abajo se hicieron en dispositivo contra el backend local antes del
catálogo. Después del catálogo falta probar en dispositivo la creación de negocio con el
acuerdo, y que un dueño que ya existía vea el acuerdo en `LegalGate`:

1. Backend sin documentos publicados: el registro muestra "no disponible" y no envía nada.
2. Con los dos publicados: el registro funciona y la lectura muestra cada documento.
3. Publicar una versión nueva con la app abierta: el registro pide volver a aceptar.
4. Un usuario que ya existía, al entrar: ve "Actualizamos nuestros documentos", acepta y
   entra.

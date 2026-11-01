# 2026-10-14 — Aceptar los términos al crear la cuenta

Hasta hoy el registro pedía nombre, documento, correo, celular y contraseña, y los enviaba
sin que el usuario hubiera consentido nada. En Colombia el tratamiento de datos personales
exige autorización previa y expresa del titular (Ley 1581 de 2012), así que el formulario
no estaba completo: faltaba la puerta.

Se agrega esa puerta —una casilla de aceptación— y la pantalla donde se lee lo que se
acepta: las 26 cláusulas del documento vigente desde el 14 de octubre de 2026.

---

## Qué se decidió

### La casilla bloquea el envío, el botón no se apaga

`Crear cuenta` sigue pulsable aunque la casilla esté sin marcar. Un botón desactivado sin
explicación es el motivo clásico de abandono en un registro: el usuario no sabe qué le
falta y se va. Al pulsar sin aceptar aparece el error debajo de la casilla, con vibración
de advertencia, y el formulario **no manda nada** al servidor.

La comprobación es lo primero que corre dentro de `onSubmit`, antes incluso de comparar
las contraseñas: sin consentimiento no sale un solo dato personal del dispositivo.

### El documento se lee en una pantalla propia, no en una hoja

`/legal/terms` es una pantalla completa con la `AppBar` **fuera** del scroll. En un
documento de 26 cláusulas, tener que volver al principio para encontrar el botón de atrás
es justo lo que hace que nadie lo lea. Un `Sheet` habría dejado menos alto útil y el mismo
problema.

Cuelga de `app/legal/`, en la **raíz** del enrutador, no de `(auth)` ni de `(app)`: se lee
antes de tener cuenta y también después (el día que se enlace desde el perfil), y esos dos
grupos redirigen según la sesión. Es una regla nueva y quedó escrita en `CLAUDE.md`.

### Índice plegado, no desplegado

Veintiséis cláusulas piden un índice, pero desplegado mide dos pantallas y empujaría el
documento fuera de la vista —lo contrario de lo que se busca—. Va cerrado por defecto:
quien busca una cláusula concreta lo abre, quien viene a leer de corrido ni lo nota.

El salto lo ejecuta `TermsScreen`, que es la dueña del `ScrollView`; el render del texto
solo le reporta dónde quedó cada cláusula al medirse (`onLayout`). Así el documento sigue
sin saber nada de cómo se desplaza la pantalla, y las posiciones se recalculan solas
cuando el índice se abre o se cierra.

### Dos zonas táctiles, no un enlace dentro de la frase

La convención web es subrayar "Términos y Condiciones" dentro de la frase que se acepta.
Aquí se separó en dos filas —la que marca y la que abre el documento— por dos razones: el
usuario sabe en todo momento si al tocar está aceptando o leyendo, y se evita anidar un
presionable dentro de otro, que en Android reparte el toque según dónde cae el dedo.

### El contenido vive en `domain`, no en la feature

`src/domain/legal.ts` guarda el documento como datos (`LegalDocument`: cláusulas, bloques,
contacto, versión). Lo necesitan dos features —`auth` para la casilla, `legal` para la
lectura— y una feature no importa de otra, así que lo que comparten va a `domain`.

La forma de `LegalDocument` es la que tendría la respuesta de un `GET /legal/terms`. El día
que el documento se sirva desde el backend cambia de dónde sale `TERMS` y nada más: ni la
pantalla ni la casilla se enteran.

Los títulos de las cláusulas se guardan en mayúscula inicial ("Vigencia", no "VIGENCIA"):
el título es una etiqueta de navegación y en versales se lee peor. El texto que obliga
—párrafos y viñetas— está **literal**.

### Un token nuevo: `prose`

La variante `body` es 15/21. Para leer veinte renglones seguidos el ojo se pierde de línea
al volver; `prose` es el mismo cuerpo con interlineado 24. Se agregó al tema en vez de
escribir un `lineHeight` en la pantalla, que es la regla de la Fase 0.4.

---

## Una corrección al documento recibido

El pie del texto venía con `soporte@elfiao.com/`, con una barra final. Se guardó **sin** la
barra: con ella el `mailto:` no abre el cliente de correo. En el cuerpo (cláusulas 12 y 16)
el correo venía bien escrito, así que se tomó eso como la forma correcta.

---

## Qué quedó pendiente

1. **La aceptación no viaja al backend.** `POST /users` no recibe hoy ningún campo de
   consentimiento, así que la casilla solo bloquea el envío en el dispositivo.
   Jurídicamente la autorización hay que poder **probarla**: cuando el backend tenga el
   campo, se envía `TERMS.version` (`2026-10-14`, ya está en el documento) con la fecha de
   aceptación. El componente `TermsAcceptance` no cambia.
2. **No está enlazado desde el perfil.** La pantalla ya es alcanzable con sesión; falta la
   fila que la abra desde `/profile` para quien quiera releerla después.
3. **Nadie avisa cuando el documento cambia.** Si se sube `version`, quien ya tiene cuenta
   no vuelve a aceptar. Eso necesita que el backend guarde qué versión aceptó cada usuario
   —o sea, el pendiente 1 primero.

---

## Qué se verificó

- `npm run typecheck` → 0 errores.
- `npm run lint` → 0 problemas.
- `npx expo export --platform android --platform ios` → los dos bundles compilan.
- Las 26 cláusulas están cargadas, en orden y sin saltos de numeración (se contaron).

**Qué NO se verificó: la prueba manual en dispositivo.** No se abrió la app en Android ni
en iOS. Queda por mirar con el dedo, en las dos plataformas: que el documento se desplace
con la `AppBar` quieta, que el salto del índice caiga donde debe, que la presentación
`modal` de iOS no recorte la cabecera, que el error de la casilla aparezca sin empujar el
botón fuera de la pantalla con el teclado abierto, y que los enlaces del pie abran
navegador y correo.

# 2026-10-12 — Modo cliente: la app desde el otro lado del mostrador

Hasta hoy Fiao solo servía al tendero: quien abría la app veía a quién le debían. Pero la
misma persona que atiende su tienda es cliente en la de la esquina, y de eso la app no
sabía nada. Se agrega un **modo cliente**, con el mismo gesto que usan inDriver o Rappi
para pasar de conductor a pasajero: una cuenta, dos modos, un interruptor.

---

## Qué se encontró en el backend

El vínculo entre una cuenta y una ficha de deudor **ya existía**: `Debtor.userId`. Se
rellena solo de dos maneras, ninguna de ellas inventada aquí:

1. al registrarse, si el documento o el celular coinciden con los de una ficha sin dueño
   (`UsersService.create` hace el cruce y los vincula en lote);
2. al aceptar una invitación de tipo `DEBTOR` (`InvitationsService.accept`).

Lo que **no** existía eran endpoints pensados para el cliente. Se revisaron uno por uno:

| Lo que hacía falta                      | Qué hay hoy                                                        |
| --------------------------------------- | ------------------------------------------------------------------ |
| Tiendas donde me fían                   | `GET /users/me/dashboard` → `clientBusinesses` (sin saldos)        |
| Mis deudas en una tienda                | `GET /debtors/:debtorId/debts` con `x-business-id`                 |
| Mi saldo consolidado                    | **No existe.** Se calcula en el móvil con `summarizeDebts`         |
| Guard que valide que la ficha es mía    | **No existe.** Ver el riesgo abierto, abajo                        |

`GET /debtors/me/all` **no** sirve para esto, aunque el nombre lo sugiera: filtra por los
negocios donde el usuario es **miembro** (`businessUser`), o sea los clientes *del*
tendero. No mira `debtor.userId`.

Se decidió construir el modo cliente **sin tocar el backend**, con los dos endpoints que
ya existen. Cuesta una petición por tienda (un cliente típico tiene dos o tres) y el total
se suma en el móvil.

---

## Riesgo abierto: falta un guard en el backend

`GET /debtors/:debtorId/debts` y `GET /debts/:debtId/payments` solo pasan por
`BusinessContextGuard` —que comprueba que el negocio exista y esté activo— y por
`BusinessRoleGuard`, que **devuelve `true` cuando el endpoint no declara `@BusinessRoles`**,
como es el caso. No se valida ni la pertenencia al negocio ni que la ficha sea del
usuario.

Dicho claro: hoy cualquier usuario autenticado que conozca un `debtorId` y un `businessId`
puede leer esas deudas. El modo cliente funciona gracias a esa falta de validación, no por
diseño.

Para no apoyarse en el hueco más de lo imprescindible, `clientApi` **solo** pide con los
`debtorId` que vinieron del dashboard del propio usuario, nunca con uno construido en una
pantalla. Es una mitigación, no un arreglo.

**Pendiente en `fiao-backend`**: un `DebtorOwnershipGuard` que exija
`debtor.userId === user.id` cuando quien pregunta no es miembro del negocio, o endpoints
propios bajo `/me/`. Cuando existan, en el móvil solo cambia `clientApi.ts`.

---

## Qué se decidió en el móvil

**Dos árboles de pestañas, no uno con condicionales.** `(tabs)` sigue siendo el del
tendero; `(client)` es nuevo, con *Mi cuenta* · *Movimientos* · *Perfil*. Las dos vistas
responden preguntas opuestas ("¿quién me debe?" contra "¿cuánto debo?") y mezclarlas en
una sola barra confundía las dos. El perfil sí es la misma pantalla: los datos de la
cuenta no cambian con el modo.

**El modo se persiste** (`app_mode`), igual que el negocio activo, y la puerta de entrada
lo espera antes de redirigir: sin eso el arranque siempre pasaba un frame por el inicio
del tendero.

**Solo lectura.** El cliente consulta; no registra abonos. Quien mueve un saldo es siempre
el tendero, porque si las dos partes pudieran escribir el cuaderno dejaría de ser una sola
verdad. La única acción es escribirle a la tienda por WhatsApp.

**El WhatsApp va sin destinatario.** El API no le da al cliente el teléfono del negocio
(`GET /business/:id` responde 403 a quien no es miembro, y `clientBusinesses` solo trae
nombre y moneda), así que se abre `wa.me` con el mensaje escrito y el usuario elige el
contacto. Antes que ocultar el botón o inventar un número.

**El escenario sin vínculo se trata como una pantalla, no como un vacío.** Quien cambia a
modo cliente por curiosidad cae en `ClientNotLinked`, que explica las dos formas reales de
vincularse y siempre deja volver al modo tendero. También se agregó una salida en el
estado "crea tu primer negocio": quien se registró sin tienda ya no queda encerrado ahí.

**Un solo flujo de códigos.** `AcceptInvitationScreen` ahora atiende los dos tipos de
invitación: para quien recibe un código, un código es un código. Antes rechazaba los
`DEBTOR` con "este código no sirve".

---

## Qué se verificó y qué no

Verificado:

- `npm run typecheck` → 0 errores.
- `npm run lint` → 0 problemas.
- `npx expo export --platform android --platform ios` → los dos bundles compilan.

**No verificado:** no se probó en dispositivo ni en emulador, en ninguna de las dos
plataformas. Queda por comprobar a mano, con una cuenta que tenga al menos una ficha de
deudor vinculada:

- que el interruptor cambie de árbol de pestañas sin dejar la pantalla anterior en la pila;
- los insets del héroe y de la barra de pestañas del modo cliente en un iPhone con notch;
- que `wa.me` sin número abra el selector de contactos en Android y en iOS;
- el canje de un código de invitación `DEBTOR` de punta a punta.

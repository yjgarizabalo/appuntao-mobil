# 2026-11-24 — Recuperar la contraseña olvidada

El enlace «¿Olvidaste tu contraseña?» del login solo mostraba «estará disponible pronto».
El backend agregó la recuperación con un código al correo (rama `feature/password-reset`,
documentada en `docs/modulos/auth.md` del backend) y la app la integra.

## Qué se hizo

- **Pantalla `/forgot-password`** (`ForgotPasswordScreen`), con tres pasos en la misma
  pantalla: correo, código y contraseña nueva. La flecha de atrás retrocede un paso antes
  de salir.
- Si en el login ya se había escrito un correo, llega escrito al primer paso. Un celular o
  documento no se usa: la recuperación es solo por correo.
- **Código:** teclado numérico, solo dígitos, máximo 6, y autocompletado del código
  (`oneTimeCode`). «Pedir otro código» se habilita a los 60 segundos y avisa que el anterior
  ya no sirve. «Cambiar correo» vuelve al primer paso.
- **Contraseña nueva:** las mismas reglas que el registro, con confirmación. Al terminar,
  un diálogo lleva al login.
- `authApi` ganó `requestPasswordReset`, `verifyPasswordResetCode` y `resetPassword`,
  todos con `skipAuthRefresh` (no hay sesión).

## Decisiones

- **El paso del código no confirma que el correo exista.** El texto es condicional,
  porque el backend responde igual en los dos casos para no delatar qué correos tienen
  cuenta.
- **No se inicia sesión al terminar.** El backend no lo hace, y el login ya resuelve el
  estado de la cuenta (por ejemplo, ofrecer reactivarla) y los documentos legales.
- **Ingreso rápido:** si la persona tenía la contraseña recordada, al volver al login la
  huella falla con 401 y el flujo que ya existe la borra y pide la nueva. No se tocó.

## Qué se verificó y qué no

- `tsc --noEmit` y `eslint` sin errores.
- El backend se probó en local de punta a punta (código malo, bueno, vencido por intentos,
  reenvío, límites, cierre de sesiones).
- **Falta probarlo en un teléfono.** En development el remitente de los correos es
  `onboarding@resend.dev`, que solo entrega al dueño de la cuenta de Resend: para recibir
  el código con otro correo hace falta un dominio verificado en Resend.

# 2026-11-22 — Revisión de auth y users contra el backend

Antes de desplegar invitations se repasaron los módulos `auth` y `users` del backend y su
uso en la app. Los endpoints, el login por dispositivo, la renovación con rotación, el
logout, el registro con aceptación legal, la edición del perfil (solo nombres) y el cambio
de contraseña (que cierra la sesión) coinciden con el backend.

## Qué se corrigió en la app

Las validaciones de los formularios no coincidían con las del backend. Cuando el backend
rechazaba un dato, el error llegaba como "datos inválidos" genérico, porque la app descarta
los mensajes de validación en lista.

- **Documento por tipo** (`documentNumberFor`), con las mismas reglas que `IsDocumentNumber`:
  cédula de 6 a 10 dígitos, NIT de 9 o 10, extranjería de 3 a 20 letras o números. Antes era
  "solo dígitos, de 6 a 12" para todos: un documento de extranjería con letras no se podía
  registrar, y una cédula de 11 o 12 dígitos pasaba en la app y fallaba en el backend. Se
  aplica al enviar, en el registro y al crear o editar un cliente.
- **Login:** el identificador acepta el celular con espacios o con +57, el documento con
  puntos y el documento de extranjería con letras. Antes exigía solo dígitos o un correo.
- **Nombres** (`personName`): letras con tildes y ñ, espacios, apóstrofo, punto y guion, igual
  que el backend. Se usan rangos explícitos y no `\p{L}`, que Hermes no garantiza.

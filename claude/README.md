# Contexto de trabajo

El historial de decisiones de este proyecto: qué se migró, qué se refactorizó, cómo se
despliega y por qué cada cosa quedó como quedó.

La diferencia con los documentos de la raíz es el tiempo verbal. `CLAUDE.md` y `README.md`
describen **cómo está el proyecto hoy** y hay que mantenerlos al día. Lo de aquí describe
**qué pasó y por qué se decidió así**, y se lee para entender el presente sin tener que
reconstruirlo desde los commits.

---

## Qué hay

### [`migraciones/`](migraciones/)

Cambios grandes y planificados, con su antes y su después.

- [**v1-a-v2-arquitectura.md**](migraciones/v1-a-v2-arquitectura.md) — la refactorización
  de la rama `refactor/v2-arquitectura`: arquitectura por capas, design system propio,
  bugs corregidos por el camino y tabla de paridad funcional con el v1.

### [`despliegue/`](despliegue/)

Cómo sacar la app de la máquina de desarrollo.

- [**eas-build-android.md**](despliegue/eas-build-android.md) — cómo está configurado EAS
  Build: perfiles, variables de entorno, keystore, versionado y pendientes conocidos.
- [**probar-con-backend-local.md**](despliegue/probar-con-backend-local.md) — cómo probar
  el APK mientras el API solo corre en local. Incluye por qué un build de release no puede
  hablar por HTTP plano.

### [`bitacora/`](bitacora/)

Una entrada por sesión de trabajo relevante, con fecha: qué se encontró, qué se cambió,
qué se decidió y —sobre todo— **qué se verificó y qué no**.

- [**2026-09-17-configuracion-eas-build.md**](bitacora/2026-09-17-configuracion-eas-build.md)
- [**2026-09-20-teclado-tapa-inputs.md**](bitacora/2026-09-20-teclado-tapa-inputs.md) — el
  teclado tapaba los inputs en Android (registro, login, crear cliente, hojas de fiar/pago);
  se adoptó `react-native-keyboard-controller` en vez del `KeyboardAvoidingView` nativo.
- [**2026-10-12-modo-cliente.md**](bitacora/2026-10-12-modo-cliente.md) — se agregó el modo
  cliente (ver lo que uno debe en las tiendas donde le fían), construido sobre los endpoints
  que ya existían. Incluye el repaso del backend y un riesgo de autorización abierto allí.
- [**2026-10-14-terminos-y-condiciones.md**](bitacora/2026-10-14-terminos-y-condiciones.md) —
  el registro ya no envía datos personales sin consentimiento: casilla de aceptación y
  pantalla de lectura en `/legal/terms` con las 26 cláusulas y un índice plegable.
  Incluye el pendiente abierto: el backend todavía no guarda la aceptación.
- [**2026-10-19-endurecimiento-de-autenticacion.md**](bitacora/2026-10-19-endurecimiento-de-autenticacion.md) —
  el backend pasó a rotar el refresh token y a manejar una sesión por dispositivo; la app
  aprendió a renovar antes de que venza, a no cerrar sesión por un bache de red y a pedir
  la contraseña actual para cambiarla. Incluye lo que quedó sin probar contra el servidor.
- [**2026-10-31-renombre-appuntao-y-paleta.md**](bitacora/2026-10-31-renombre-appuntao-y-paleta.md) —
  Fiao pasa a llamarse Appuntao: qué identificadores se conservaron y por qué, y cómo se
  mapeó la paleta nueva a los tokens.
- [**2026-11-08-paleta-del-logo.md**](bitacora/2026-11-08-paleta-del-logo.md) — los colores
  de marca pasan a ser los exactos del logotipo (`#0066FF`, `#0B2D6B`, `#B6FF00`): cómo se
  midieron, cómo se derivaron las escalas y el contraste resultante. También: `info` pasa a
  cian y desaparecen los colores literales fuera del tema.

---

## Convención

- **Español**, igual que el resto de la documentación del proyecto.
- Un documento explica **decisiones**, no repite lo que ya dice el código. Si algo se
  entiende leyendo el archivo fuente, no va aquí.
- Las entradas de bitácora llevan `AAAA-MM-DD-` al principio del nombre y **no se
  reescriben** después: son el registro de lo que se sabía ese día. Lo que cambie se
  corrige en el documento vigente (`CLAUDE.md`, o el de `despliegue/`), no en la bitácora.
- Todo documento nuevo se enlaza desde este índice. Si no está aquí, no existe.
- Lo que sea **regla** —algo que haya que cumplir en cada cambio— no va aquí: va a
  `CLAUDE.md`. Esta carpeta es el porqué; `CLAUDE.md` es el qué hacer.

---

Las reglas del proyecto están en [`../CLAUDE.md`](../CLAUDE.md) y la presentación de la app
en [`../README.md`](../README.md).

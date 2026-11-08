# Appuntao

> Antes se llamaba **Fiao**. Repositorio: [yjgarizabalo/appuntao-mobil](https://github.com/yjgarizabalo/appuntao-mobil).

App móvil para que un tendero lleve el control de lo que fía: quién le debe,
cuánto, desde cuándo y qué ha abonado. Reemplaza el cuaderno del mostrador.

Android e iOS, con Expo. La UI está en español de Colombia y el dinero en pesos.

---

## Qué hace

### Lo que el tendero ve al abrir la app

La pantalla de inicio responde las dos preguntas que lo traen aquí: **cuánto le
deben** y **quién le debe**. El total por cobrar y el ranking de morosos los
calcula el servidor con una consulta agregada, así que son exactos tenga 10
clientes o 3.000.

### Clientes

- Lista con scroll infinito y buscador que consulta al servidor: encuentra a un
  cliente por nombre, documento o celular esté en la página que esté.
- La búsqueda **ignora tildes**: "jose" encuentra a "José".
- Filtro entre los que deben y los que están al día, también resuelto en el
  servidor, con contadores reales del negocio.
- Registrar un cliente y corregir después sus datos (nombre, documento, celular)
  sin perder su historial de deudas.

### Deudas y pagos

- Registrar una deuda con descripción y fecha de vencimiento; las vencidas se
  señalan solas.
- Dos formas de abonar, y las dos importan:
  - **a una deuda concreta**, cuando el cliente paga un vale puntual;
  - **al saldo total**, y el servidor reparte el abono entre las deudas abiertas
    de la más antigua a la más nueva. Es la forma habitual en el mostrador.
- Extracto unificado por cliente: deudas y pagos mezclados en una sola línea de
  tiempo, que es como el tendero lee su cuaderno.

### Cobrar

- **Recordatorio por WhatsApp** con el mensaje ya redactado y el saldo dentro.
  Abre el chat; el envío lo confirma el tendero, que puede ajustar el texto
  antes de mandarlo.
- Llamada directa al celular del cliente.

### Varios negocios

Un usuario puede tener varias tiendas. Cada una lleva sus propios clientes,
deudas y pagos por separado, y el negocio activo se recuerda entre sesiones.

### Cuenta

Registro, inicio de sesión **con correo o con número de documento** (el tendero
recuerda antes su cédula), edición del perfil y cambio de contraseña. La sesión
se renueva sola y solo saca al usuario al login cuando el refresh falla de
verdad.

---

## Ponerla a correr

El proyecto se desarrolla con **Node 22.19.0** (no hay `engines` declarado,
pero esa es la versión probada) y necesita el backend de [`fiao-backend`](../fiao-backend)
corriendo. Para compilar nativo, además Android Studio (Android) o Xcode (iOS,
solo en macOS).

```bash
npm install          # instala exactamente lo del package-lock
cp .env.example .env.local
npm run env:local    # activa .env.local como .env
npm start            # servidor de desarrollo
```

> En desarrollo, `EXPO_PUBLIC_API_BASE_URL` debe apuntar a la **IP LAN** de tu
> máquina, no a `localhost`: ni un celular físico ni el simulador de iOS
> alcanzan el localhost del PC. La app te avisa si detecta que lo pusiste.

### Entornos

`npm run env:local`, `env:dev` y `env:prd` copian el `.env.<entorno>`
correspondiente a `.env`. El script es Node, así que funciona igual en Windows y
en macOS — necesario porque el build de iOS se hace en Mac.

Tras cambiar el `.env`, arranca con `npm run start:clear` para vaciar la caché
de Metro.

### Compilar

```bash
npm run android      # build nativo Android
npm run ios          # build nativo iOS (solo macOS)
```

Las carpetas `android/` e `ios/` **no están en el repo**: se generan con
`npm run prebuild:android` / `npm run prebuild:ios`. Un cambio en `app.json` (un
permiso, un icono, un plugin) se aplica regenerando, sin editar Gradle a mano.

### Compartir la app con alguien (EAS Build)

Para que un cliente la instale en su celular sin pasar por Google Play, se
compila un **APK** en la nube de Expo:

```bash
npm install -g eas-cli   # una sola vez
eas login                # tu cuenta de expo.dev es la cuenta de EAS
eas init                 # vincula el proyecto (escribe el projectId en app.json)
npm run build:android    # APK de demostración — perfil `preview`
```

EAS devuelve un link con QR: el cliente lo abre en el celular, descarga el APK y
acepta instalar «de origen desconocido».

`npm run build:android:prod` genera el AAB que pide Google Play, y
`npm run build:ios` compila iOS **desde Windows** (EAS pone el Mac), aunque eso
exige cuenta de Apple Developer de pago.

> ⚠️ El `.env` **no** viaja a EAS: está en `.gitignore` y el servidor solo recibe
> lo que git conoce. Las variables `EXPO_PUBLIC_*` de los builds viven en el
> bloque `env` de cada perfil de `eas.json`. Si agregas una al `.env`, agrégala
> también allí.
>
> Hoy esos perfiles llevan la URL del API como **placeholder**: hasta que
> `fiao-backend` esté desplegado con HTTPS público, el APK compila pero no
> conecta.

El detalle completo (perfiles, keystore, versionado, pendientes) está en la
**Fase 11 de [CLAUDE.md](CLAUDE.md)**.

---

## Cómo está organizado

```
app/          rutas de expo-router (archivos de una línea, sin lógica)
src/
  core/       infraestructura: http, errores, hooks, storage, tema de utilidades
  domain/     entidades, constantes y traducción de las respuestas del backend
  theme/      tokens y roles de color, tipografía, espaciado
  ui/         design system propio (Screen, Button, Sheet, Dialog, Toast…)
  features/   una carpeta por área: auth, businesses, debtors, debts, payments…
```

Las dependencias van en un solo sentido: `app/` → `features/` → `domain/` →
`core/`. Los imports usan siempre los alias `@/` y `@app/`, nunca `../../..`.

El detalle de por qué cada cosa está donde está vive en **[CLAUDE.md](CLAUDE.md)**;
qué cambió respecto de la versión anterior y cómo se despliega, en la carpeta
**[claude/](claude/README.md)**.

---

## Antes de dar un cambio por bueno

```bash
npm run typecheck                                    # debe quedar en 0
npm run lint                                         # debe quedar en 0
npx expo export --platform android --platform ios    # compila los dos bundles
```

No hay tests automatizados configurados: la verificación son esos tres comandos
más la prueba manual en las dos plataformas.

Las versiones de `expo`, `react` y `react-native` están **fijadas a propósito**
(ver `expo.install.exclude` en `package.json`). No corras `npm update` ni
`expo install --fix`: para añadir un paquete, siempre `npx expo install <paquete>`.

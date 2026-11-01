/**
 * Layout raíz: providers y stack de navegación.
 *
 * Antes se anidaban seis providers (Gluestack + cinco contexts de dominio).
 * Aquí quedan los imprescindibles:
 *  - `GestureHandlerRootView`, requerido por los gestos de los bottom sheets;
 *  - `KeyboardProvider` (`react-native-keyboard-controller`), que reemplaza al
 *    `KeyboardAvoidingView` nativo: con `edgeToEdgeEnabled` en Android ese
 *    componente reporta la altura del teclado de forma inconsistente y los
 *    inputs quedaban tapados. `statusBarTranslucent`/`navigationBarTranslucent`
 *    en `true` porque el edge-to-edge del proyecto ya hace translúcidas esas
 *    barras, y `preserveEdgeToEdge` para que no lo desactive al animar;
 *  - `SafeAreaProvider`, que alimenta los insets reales del dispositivo;
 *  - `SessionProvider`, `AppModeProvider` y `BusinessProvider`, el único
 *    estado verdaderamente global, y `ToastProvider` para los avisos.
 *    `AppModeProvider` va por encima de las pantallas porque decide qué
 *    árbol de pestañas se monta (tendero o cliente).
 *
 * `preventAutoHideAsync` se llama aquí, antes de montar nada: es el archivo
 * que expo-router garantiza cargar primero, así que es el único punto donde
 * podemos estar seguros de ganarle al ocultamiento automático del splash
 * nativo. Quien lo oculta de verdad es `EntryScreen` (`app/index.tsx`), una
 * vez que su propio splash de marca ya está pintado en pantalla.
 */
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { SessionProvider } from '@/features/auth/session/SessionProvider';
import { BusinessProvider } from '@/features/businesses/state/BusinessProvider';
import { AppModeProvider } from '@/features/client/state/AppModeProvider';
import { OfflineBanner, ToastProvider } from '@/ui';
import { theme } from '@/theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge>
        <SafeAreaProvider>
          <SessionProvider>
            <AppModeProvider>
              <BusinessProvider>
                <ToastProvider>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: theme.color.bg },
                      // Transición nativa: en iOS empuja desde la derecha, en
                      // Android usa la animación del sistema.
                      animation: 'slide_from_right',
                    }}
                  >
                    <Stack.Screen name="index" options={{ animation: 'none' }} />
                    <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
                    <Stack.Screen name="(app)" options={{ animation: 'fade' }} />

                    {/*
                      Los documentos legales son hermanos de los dos grupos:
                      se abren desde el registro (sin sesión) y más adelante
                      desde el perfil (con sesión), así que no pueden colgar de
                      `(auth)` ni de `(app)`, que redirigen según la sesión.
                    */}
                    <Stack.Screen
                      name="legal/terms"
                      options={{ presentation: Platform.OS === 'ios' ? 'modal' : 'card' }}
                    />
                  </Stack>

                  {/*
                    Después del Stack para quedar por encima de cualquier
                    pantalla, y dentro del ToastProvider porque los dos avisos
                    comparten esquina y el toast se aparta cuando este aparece.
                  */}
                  <OfflineBanner />
                </ToastProvider>
              </BusinessProvider>
            </AppModeProvider>
          </SessionProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

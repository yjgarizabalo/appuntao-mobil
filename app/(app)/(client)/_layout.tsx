/**
 * Pestañas del modo cliente.
 *
 * Son tres y en este orden: "Mi cuenta" responde lo único que el cliente abre
 * la app a mirar (cuánto debe y dónde), "Movimientos" es el extracto de todas
 * sus tiendas juntas, y "Perfil" comparte pantalla con el modo tendero porque
 * los datos de la cuenta son los mismos.
 *
 * Es un grupo aparte del de tendero, con su propio `Tabs`, para que cada modo
 * tenga su barra sin condicionales dentro de la barra.
 */
import { Tabs } from 'expo-router';

import { TabBar } from '@/ui/TabBar';

export default function ClientTabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="wallet" options={{ title: 'Mi cuenta' }} />
      <Tabs.Screen name="movements" options={{ title: 'Movimientos' }} />
      <Tabs.Screen name="me" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}

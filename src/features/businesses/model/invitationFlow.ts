/**
 * Piezas compartidas del flujo de invitaciones.
 *
 *  - `shareInvitation`: abre WhatsApp con el mensaje que arma el backend, o la
 *    hoja de compartir si la invitación va a un correo o WhatsApp no abre.
 *  - `useFinishAcceptedInvitation`: qué pasa después de aceptar, igual desde
 *    la tarjeta de invitaciones recibidas que desde "Tengo un código".
 */
import { router } from 'expo-router';
import { useCallback } from 'react';
import { Linking, Share } from 'react-native';

import { haptics } from '@/core/haptics';
import { routes } from '@/core/navigation/routes';
import type { InvitationShare } from '@/domain/models';
import type { AcceptedInvitation } from '@/features/businesses/api/invitationApi';
import { useBusinesses } from '@/features/businesses/state/BusinessProvider';
import { useAppMode } from '@/features/client/state/AppModeProvider';
import { useToast } from '@/ui';

/**
 * Comparte la invitación. No la envía: quien invita revisa el mensaje y lo
 * manda desde su propio WhatsApp, como los recordatorios de cobro.
 *
 * Devuelve `false` si no se pudo abrir nada, para que la pantalla muestre el
 * código y la persona lo comparta a mano.
 */
export const shareInvitation = async (share: InvitationShare): Promise<boolean> => {
  haptics.tap();
  if (share.whatsappUrl) {
    try {
      await Linking.openURL(share.whatsappUrl);
      return true;
    } catch {
      // Sin WhatsApp instalado: se cae a la hoja de compartir.
    }
  }
  if (!share.shareText) return false;
  try {
    await Share.share({ message: share.shareText });
    return true;
  } catch {
    return false;
  }
};

/**
 * Después de aceptar se lleva a la persona a donde acaba de entrar:
 *
 *  - al equipo: se refrescan sus negocios, el nuevo queda como activo y se
 *    vuelve al modo tendero;
 *  - como cliente: se refrescan sus tiendas y se pasa al modo cliente, donde
 *    ya ve lo que debe. No es presuntuoso: acaba de pedirlo.
 */
export const useFinishAcceptedInvitation = () => {
  const { refresh: refreshBusinesses, selectBusiness } = useBusinesses();
  const { setMode, refreshAccounts } = useAppMode();
  const toast = useToast();

  return useCallback(
    async (result: AcceptedInvitation) => {
      if (result.type === 'BUSINESS_USER') {
        await refreshBusinesses();
        if (result.businessId) selectBusiness(result.businessId);
        setMode('merchant');
        toast.success(result.message || '¡Ya eres parte del equipo!');
        router.replace(routes.tabs.home);
        return;
      }
      await refreshAccounts();
      setMode('client');
      toast.success(result.message || '¡Listo! Ya puedes ver tu cuenta en esa tienda.');
      router.replace(routes.clientMode.wallet);
    },
    [refreshAccounts, refreshBusinesses, selectBusiness, setMode, toast],
  );
};

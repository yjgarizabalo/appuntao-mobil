/**
 * Hoja para hacer un descuento a una deuda (`POST /payments/discounts`).
 *
 * Un descuento es lo que el negocio le perdona al cliente: baja el saldo sin
 * que entre plata. El caso típico son unos pocos pesos que faltan ("debe
 * 10.300, pagó 10.000, le perdono los 300"), así que la hoja abre con el
 * saldo completo de la deuda como tope y pide un motivo, que el backend exige
 * y que queda en el historial.
 *
 * Solo la abren el dueño y el administrador.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatMoney } from '@/core/utils/format';
import { Button, MoneyField, Sheet, Text, TextField } from '@/ui';
import { theme } from '@/theme';

/** Lo mismo que valida el backend. */
const REASON_MIN = 3;
const REASON_MAX = 200;

export interface DiscountSheetProps {
  visible: boolean;
  onClose: () => void;
  debtorName: string;
  /** Descripción de la deuda, para el subtítulo. */
  target: string;
  /** Saldo de la deuda: el máximo que se puede descontar. */
  balance: number;
  /** Devuelve una promesa: la hoja muestra el estado de carga hasta que acabe. */
  onSubmit: (values: { amount: number; reason: string }) => Promise<void>;
}

export const DiscountSheet = ({
  visible,
  onClose,
  debtorName,
  target,
  balance,
  onSubmit,
}: DiscountSheetProps) => {
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Se limpia al abrir, no al cerrar: si el envío falla se conserva lo escrito.
  useEffect(() => {
    if (visible) {
      setAmount(0);
      setReason('');
    }
  }, [visible]);

  const trimmed = reason.trim();
  const exceeds = amount > balance;
  const reasonError =
    reason.length > 0 && trimmed.length < REASON_MIN
      ? `Escribe el motivo (mínimo ${REASON_MIN} caracteres)`
      : undefined;
  const canSubmit =
    amount > 0 && !exceeds && trimmed.length >= REASON_MIN && !isSubmitting;
  const remaining = Math.max(0, balance - amount);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await onSubmit({ amount, reason: trimmed });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Hacer un descuento"
      subtitle={`${debtorName} · ${target}`}
      dismissible={!isSubmitting}
      scrollable
      footer={
        <Button
          label={amount > 0 ? `Descontar ${formatMoney(amount)}` : 'Descontar'}
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!canSubmit}
          size="lg"
          fullWidth
        />
      }
    >
      <View style={styles.notice}>
        <Ionicons name="information-circle" size={16} color={theme.color.info} />
        <Text variant="caption" color="textMuted" style={styles.noticeText}>
          Baja lo que te debe sin que entre plata. Queda en el historial con tu motivo.
        </Text>
      </View>

      <MoneyField
        value={amount}
        onChangeValue={setAmount}
        label="¿Cuánto le descuentas?"
        size="hero"
        autoFocus
        max={balance}
        maxExceededMessage={`No puede ser mayor al saldo de la deuda (${formatMoney(balance)})`}
      />

      {amount > 0 && !exceeds ? (
        <Text variant="caption" color="textMuted" style={styles.remaining}>
          {remaining === 0
            ? 'La deuda queda saldada.'
            : `Quedarán ${formatMoney(remaining)} pendientes de esta deuda.`}
        </Text>
      ) : null}

      <TextField
        label="Motivo"
        placeholder="Se le perdonan las vueltas, cliente frecuente…"
        value={reason}
        onChangeText={setReason}
        maxLength={REASON_MAX}
        error={reasonError}
        helper="Obligatorio: ayuda a recordar por qué se hizo"
        returnKeyType="done"
      />
    </Sheet>
  );
};

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  noticeText: {
    flex: 1,
  },
  remaining: {
    marginBottom: theme.spacing.lg,
  },
});

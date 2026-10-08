import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { api } from '@/api/client';
import { noErrors, toFormErrors } from '@/api/formErrors';
import { Button, Screen, Text, TextField, ScreenHeader } from '@/ui';

const RESEND_COOLDOWN_S = 60;

export default function ResetPasswordScreen() {
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState(noErrors);
  // The first code was just requested on the previous screen.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const canSubmit = /^\d{6}$/.test(code) && newPassword !== '' && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrors(noErrors);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { email, code, newPassword } });
      // Every session was ended by the reset: log in again with the new password.
      router.dismissTo({ pathname: '/login', params: { email, reset: '1' } });
    } catch (err) {
      setErrors(toFormErrors(err));
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setResendNotice(null);
    setErrors(noErrors);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email } });
      setResendNotice('If the account exists, a new code is on its way.');
      setCode('');
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setErrors(toFormErrors(err));
    }
  };

  return (
    <Screen form>
      <ScreenHeader back title="Reset password" />
      <Text variant="muted">
        If {email} has an account, we sent it a 6-digit code. It expires in 15 minutes.
      </Text>

      <TextField
        label="Reset code"
        placeholder="123456"
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
        error={errors.fields.code}
        keyboardType="number-pad"
        maxLength={6}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="New password"
        placeholder="At least 8 characters"
        value={newPassword}
        onChangeText={setNewPassword}
        error={errors.fields.newPassword}
        secure
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />

      {errors.form ? <Text variant="error">{errors.form}</Text> : null}
      {resendNotice ? <Text variant="muted">{resendNotice}</Text> : null}

      <Button
        title="Reset password"
        loading={submitting}
        disabled={!canSubmit}
        onPress={() => void submit()}
      />
      <Button
        title={cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}
        variant="secondary"
        disabled={cooldown > 0}
        onPress={() => void resend()}
      />
    </Screen>
  );
}

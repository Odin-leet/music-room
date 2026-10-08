import { Link, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { api } from '@/api/client';
import { noErrors, toFormErrors } from '@/api/formErrors';
import { Button, Screen, Text, TextField, ScreenHeader } from '@/ui';

export default function ForgotPasswordScreen() {
  // Prefilled when coming from the login screen.
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState(noErrors);

  const canSend = email.trim() !== '' && !sending;

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    setErrors(noErrors);
    try {
      // Always succeeds (204) for a well-formed email, account or not.
      await api('/auth/forgot-password', { method: 'POST', body: { email: email.trim() } });
      router.push({ pathname: '/reset-password', params: { email: email.trim() } });
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen form>
      <ScreenHeader back title="Forgot password" />
      <Text variant="muted">
        Enter your account email. If it exists, we&apos;ll send a 6-digit code to reset your password.
      </Text>

      <TextField
        label="Email"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        error={errors.fields.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={() => void send()}
      />

      {errors.form ? <Text variant="error">{errors.form}</Text> : null}
      <Button title="Send code" loading={sending} disabled={!canSend} onPress={() => void send()} />

      <Link href="/login">
        <Text variant="muted">Back to log in</Text>
      </Link>
    </Screen>
  );
}

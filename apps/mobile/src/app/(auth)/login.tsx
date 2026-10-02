import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { noErrors, toFormErrors } from '@/api/formErrors';
import { useSession } from '@/session/SessionProvider';
import { Button, Screen, Text, TextField } from '@/ui';

export default function LoginScreen() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState(noErrors);
  const passwordRef = useRef<TextInput>(null);

  const canSubmit = email.trim() !== '' && password !== '' && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrors(noErrors);
    try {
      // On success the session flips to signedIn and the router leaves this
      // screen, so there's nothing else to do here.
      await signIn(email.trim(), password);
    } catch (err) {
      setErrors(toFormErrors(err));
      setSubmitting(false);
    }
  };

  return (
    <Screen centered form>
      <Text variant="title">Log in</Text>

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
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        placeholder="Your password"
        value={password}
        onChangeText={setPassword}
        error={errors.fields.password}
        secure
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />

      {errors.form ? <Text variant="error">{errors.form}</Text> : null}
      <Button
        title="Log in"
        loading={submitting}
        disabled={!canSubmit}
        onPress={() => void submit()}
      />

      <Link href="/register">
        <Text variant="muted">No account yet? Register</Text>
      </Link>
    </Screen>
  );
}

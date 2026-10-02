import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { noErrors, toFormErrors } from '@/api/formErrors';
import { useSession } from '@/session/SessionProvider';
import { Button, Screen, Text, TextField } from '@/ui';

export default function RegisterScreen() {
  const { register } = useSession();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState(noErrors);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // Only "is it filled in" here — the API owns the real rules (email format,
  // 8–72 char password) and its messages are shown under each field.
  const canSubmit =
    displayName.trim() !== '' && email.trim() !== '' && password !== '' && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrors(noErrors);
    try {
      // Creates the account, then logs in; the router then shows Home.
      await register({ displayName: displayName.trim(), email: email.trim(), password });
    } catch (err) {
      setErrors(toFormErrors(err));
      setSubmitting(false);
    }
  };

  return (
    <Screen centered form>
      <Text variant="title">Create account</Text>

      <TextField
        label="Display name"
        placeholder="Alice"
        value={displayName}
        onChangeText={setDisplayName}
        error={errors.fields.displayName}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <TextField
        ref={emailRef}
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
        placeholder="At least 8 characters"
        value={password}
        onChangeText={setPassword}
        error={errors.fields.password}
        secure
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />

      {errors.form ? <Text variant="error">{errors.form}</Text> : null}
      <Button
        title="Create account"
        loading={submitting}
        disabled={!canSubmit}
        onPress={() => void submit()}
      />

      <Link href="/login">
        <Text variant="muted">Already have an account? Log in</Text>
      </Link>
    </Screen>
  );
}

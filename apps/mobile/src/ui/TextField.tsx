import type { Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, font, radius, spacing } from '@/theme';
import { Text } from './Text';

type Props = Omit<TextInputProps, 'style' | 'secureTextEntry'> & {
  label: string;
  // Shown under the field and turns the border red, e.g. an API 400/409 message.
  error?: string;
  // Hides the input (passwords).
  secure?: boolean;
  // Lets a form move focus to this field (keyboard "Next"). React 19: ref is a plain prop.
  ref?: Ref<TextInput>;
};

export function TextField({ label, error, secure = false, ref, ...inputProps }: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secure}
        style={[styles.input, error ? styles.inputError : null]}
        {...inputProps}
      />
      {error ? <Text variant="error">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { fontSize: font.size.sm, fontWeight: font.weight.medium },
  input: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: font.size.md,
  },
  inputError: { borderColor: colors.danger },
});

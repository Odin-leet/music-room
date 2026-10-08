import type { UserSummary } from '@music-room/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { ApiError } from '@/api/client';
import { useSession } from '@/session/SessionProvider';
import { spacing } from '@/theme';
import { PersonRow } from '@/profile/PersonRow';
import { Button, Screen, Text, TextField } from '@/ui';

// Find people by name. Results carry public info only.
export default function PeopleScreen() {
  const { authedApi } = useSession();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSummary[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = query.trim();
  const search = async () => {
    if (q.length < 2 || searching) return;
    setSearching(true);
    setError(null);
    try {
      setResults(await authedApi<UserSummary[]>(`/users?q=${encodeURIComponent(q)}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  return (
    <Screen>
      <Text variant="title">People</Text>
      <Button title="My friends & requests" variant="secondary" onPress={() => router.push('/people/friends')} />
      <TextField
        label="Search by name"
        placeholder="At least 2 letters"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        onSubmitEditing={() => void search()}
      />
      <Button title="Search" loading={searching} disabled={q.length < 2} onPress={() => void search()} />
      {error ? <Text variant="error">{error}</Text> : null}
      <FlatList
        data={results ?? []}
        keyExtractor={(u) => u.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={results ? <Text variant="muted">Nobody found with that name.</Text> : null}
        renderItem={({ item }) => <PersonRow person={item} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
});

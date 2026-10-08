import type { UserSummary } from '@music-room/shared';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { colors } from '@/theme';
import { Avatar, ListItem } from '@/ui';

// One person in a list (search results, friends, requests): opens their
// profile. `trailing` replaces the chevron (e.g. Accept / Decline).
export function PersonRow({ person, detail, trailing }: { person: UserSummary; detail?: string; trailing?: ReactNode }) {
  return (
    <ListItem
      title={person.displayName}
      subtitle={detail ?? (person.bio || undefined)}
      leading={<Avatar name={person.displayName} />}
      trailing={trailing ?? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
      onPress={() => router.push({ pathname: '/people/[id]', params: { id: person.id } })}
      accessibilityLabel={`Open ${person.displayName}'s profile`}
    />
  );
}

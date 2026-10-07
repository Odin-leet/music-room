import type { UserSummary } from '@music-room/shared';
import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { Card, Text } from '@/ui';

// One person in a list (search results, friends, requests): opens their profile.
export function PersonRow({ person, detail }: { person: UserSummary; detail?: string }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/people/[id]', params: { id: person.id } })}
      accessibilityRole="button"
      accessibilityLabel={`Open ${person.displayName}'s profile`}
    >
      <Card>
        <Text numberOfLines={1}>{person.displayName}</Text>
        {detail || person.bio ? (
          <Text variant="muted" numberOfLines={1}>
            {detail ?? person.bio}
          </Text>
        ) : null}
      </Card>
    </Pressable>
  );
}

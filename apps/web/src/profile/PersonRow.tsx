import type { UserSummary } from '@music-room/shared';
import type { ReactNode } from 'react';
import { IoChevronForward } from 'react-icons/io5';
import { Avatar, ListItem } from '@/ui';

// One person in a list (search results, friends, requests): opens their
// profile. `trailing` (wrap buttons in <Actions>) replaces the chevron.
export function PersonRow({ person, detail, trailing }: { person: UserSummary; detail?: string; trailing?: ReactNode }) {
  return (
    <ListItem
      to={`/people/${person.id}`}
      title={person.displayName}
      subtitle={detail ?? (person.bio || undefined)}
      leading={<Avatar name={person.displayName} />}
      trailing={trailing ?? <IoChevronForward className="chevron" size={18} aria-hidden />}
      label={`Open ${person.displayName}'s profile`}
    />
  );
}

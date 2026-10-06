import type { MemberRole } from '../events/event-member.entity';
import { canView, type Decision } from '../events/event-policy';
import type { Playlist } from './playlist.entity';

// Playlist permissions, as plain functions (unit-tested like event-policy).
// Seeing follows exactly the same rule as events: public = everyone,
// private = members only (others get a 404, as if it didn't exist).

export type PolicyPlaylist = Pick<Playlist, 'visibility' | 'license'>;

export const canViewPlaylist = (playlist: Pick<PolicyPlaylist, 'visibility'>, role: MemberRole | null) =>
  canView(playlist, role);

// Can this user add, remove and reorder tracks?
export function canEdit(playlist: PolicyPlaylist, role: MemberRole | null): Decision {
  const view = canViewPlaylist(playlist, role);
  if (!view.allowed) return view;
  if (role === 'owner') return { allowed: true };
  if (playlist.license === 'open') return { allowed: true };
  // license 'invited': the invite code gives access, not editing rights.
  return role === 'invited' ? { allowed: true } : { allowed: false, reason: 'not_invited' };
}

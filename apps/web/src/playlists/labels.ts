import type { EditDenyReason, PlaylistLicense, PlaylistView } from '@music-room/shared';
import { ROLE_LABEL, VISIBILITY_LABEL } from '@/events/labels';

export const PLAYLIST_LICENSE_LABEL: Record<PlaylistLicense, string> = {
  open: 'Anyone edits',
  invited: 'Invited only',
};

export const PLAYLIST_LICENSE_HINT: Record<PlaylistLicense, string> = {
  open: 'Anyone who can see the playlist can add, remove and reorder tracks.',
  invited: 'Only people the owner invites by email can edit. Everyone else who can see it can listen.',
};

export const VISIBILITY_HINT = {
  public: 'Listed for everyone.',
  private: 'Hidden. People join with the invite code.',
} as const;

export const EDIT_DENY_MESSAGE: Record<EditDenyReason, string> = {
  not_member: 'You are not a member of this playlist.',
  not_invited: 'Only invited people can edit this playlist. You can listen.',
};

// One-line summary for lists: "Private · Invited only · Owner · 12 tracks"
export function playlistSubtitle(p: PlaylistView) {
  return [
    VISIBILITY_LABEL[p.visibility],
    PLAYLIST_LICENSE_LABEL[p.license],
    p.myRole ? ROLE_LABEL[p.myRole] : null,
    `${p.trackCount} ${p.trackCount === 1 ? 'track' : 'tracks'}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

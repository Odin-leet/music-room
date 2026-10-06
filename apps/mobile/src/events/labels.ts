import type { EventLicense, EventView, MemberRole, ParticipationDenyReason } from '@music-room/shared';

export const VISIBILITY_LABEL = { public: 'Public', private: 'Private' } as const;

export const LICENSE_LABEL: Record<EventLicense, string> = {
  open: 'Everyone votes',
  invited: 'Invited only',
  geo: 'On site, on time',
};

export const LICENSE_HINT: Record<EventLicense, string> = {
  open: 'Anyone who can see the event can vote and suggest tracks.',
  invited: 'Only people the organiser invites by email can vote and suggest. The invite code only lets people watch.',
  geo: 'Voting only works close to the event, during its voting window.',
};

export const ROLE_LABEL: Record<MemberRole, string> = {
  owner: 'Owner',
  invited: 'Invited',
  guest: 'Guest',
};

export const DENY_MESSAGE: Record<ParticipationDenyReason, string> = {
  not_member: 'You are not a member of this event.',
  not_invited: 'Only invited guests can vote in this event.',
  not_started: 'Voting has not started yet.',
  ended: 'Voting has ended.',
  location_required: 'Share your location to check if you can vote here.',
  outside_area: 'You are too far from the event to vote.',
};

// One-line summary for lists: "Public · Everyone votes · Owner"
export function eventSubtitle(e: EventView) {
  return [VISIBILITY_LABEL[e.visibility], LICENSE_LABEL[e.license], e.myRole ? ROLE_LABEL[e.myRole] : null]
    .filter(Boolean)
    .join(' · ');
}

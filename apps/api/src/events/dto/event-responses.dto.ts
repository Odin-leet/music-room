import { ApiProperty } from '@nestjs/swagger';
import type {
  BroadcastTrack,
  EventGeo,
  EventLicense,
  EventView,
  EventVisibility,
  MemberRole,
  Participation,
  ParticipationDenyReason,
  QueueBroadcast,
  QueueTrack,
  QueueTrackStatus,
  QueueView,
  VoteResult,
} from '@music-room/shared';
import { TrackSummaryDto } from '../../music/dto/music-responses.dto';
import { UserRefDto } from '../../users/dto/user-responses.dto';

// See auth-responses.dto.ts: `implements` keeps the docs in step with the contract.

const DENY_REASONS: ParticipationDenyReason[] = [
  'not_member',
  'not_invited',
  'not_started',
  'ended',
  'location_required',
  'outside_area',
];

export class EventGeoDto implements EventGeo {
  /** @example 48.8966 */
  lat: number;

  /** @example 2.3185 */
  lng: number;

  /** @example 200 */
  radiusM: number;

  @ApiProperty({ format: 'date-time' })
  startsAt: string;

  @ApiProperty({ format: 'date-time' })
  endsAt: string;
}

// `Participation` is a union ({allowed:true} | {allowed:false, reason}); in
// the docs it's one object with an optional reason.
export class ParticipationDto {
  /** Whether you can vote and suggest tracks right now. */
  allowed: boolean;

  /** Present when `allowed` is false. */
  @ApiProperty({ enum: DENY_REASONS, required: false })
  reason?: ParticipationDenyReason;
}

export class EventViewDto implements EventView {
  id: string;

  /** @example "Friday Party" */
  name: string;

  description: string;

  @ApiProperty({ enum: ['public', 'private'] })
  visibility: EventVisibility;

  /** open = anyone who can see it · invited = owner + invited accounts · geo = inside an area during a time window */
  @ApiProperty({ enum: ['open', 'invited', 'geo'] })
  license: EventLicense;

  /** Only when license is 'geo'. */
  @ApiProperty({ type: EventGeoDto, nullable: true })
  geo: EventGeo | null;

  @ApiProperty({ type: UserRefDto })
  owner: { id: string; displayName: string };

  /** Your membership; null = not a member (only possible for public events). */
  @ApiProperty({ enum: ['owner', 'invited', 'guest'], nullable: true })
  myRole: MemberRole | null;

  /** 8 characters; only shown to members. */
  @ApiProperty({ type: String, nullable: true, example: 'KVAMDDE4' })
  inviteCode: string | null;

  /** For license 'geo' this depends on the location you sent (?lat=&lng=). */
  @ApiProperty({ type: ParticipationDto })
  participation: Participation;

  /** A picture for lists: the playing track's cover, else the next one's (null if none has one). */
  @ApiProperty({ type: String, nullable: true })
  cover: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class BroadcastTrackDto extends TrackSummaryDto implements BroadcastTrack {
  /** The queue entry's id — use it to vote (not the provider's track id). */
  id: string;

  /** Number of votes. */
  score: number;

  @ApiProperty({ enum: ['queued', 'playing', 'played'] })
  status: QueueTrackStatus;

  @ApiProperty({ type: UserRefDto, nullable: true })
  suggestedBy: { id: string; displayName: string } | null;

  /** Tie-break: at equal score the earliest suggestion plays first. */
  @ApiProperty({ format: 'date-time' })
  suggestedAt: string;
}

export class QueueTrackDto extends BroadcastTrackDto implements QueueTrack {
  /** Whether you voted for this track. */
  votedByMe: boolean;
}

export class QueueViewDto implements QueueView {
  @ApiProperty({ type: QueueTrackDto, nullable: true })
  nowPlaying: QueueTrack | null;

  /** Ranked: score DESC, then suggestedAt ASC. */
  @ApiProperty({ type: [QueueTrackDto] })
  upcoming: QueueTrack[];
}

// What POST /next returns (and what the realtime `queue:updated` carries).
export class QueueBroadcastDto implements QueueBroadcast {
  eventId: string;

  @ApiProperty({ type: BroadcastTrackDto, nullable: true })
  nowPlaying: BroadcastTrack | null;

  @ApiProperty({ type: [BroadcastTrackDto] })
  upcoming: BroadcastTrack[];
}

export class VoteResultDto implements VoteResult {
  trackId: string;

  /** The track's score after your request. */
  score: number;

  votedByMe: boolean;
}

export class InviteResultDto {
  @ApiProperty({ type: UserRefDto })
  invited: { id: string; displayName: string };
}

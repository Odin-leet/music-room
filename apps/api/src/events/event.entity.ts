import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';

export const EVENT_VISIBILITIES = ['public', 'private'] as const;
export type EventVisibility = (typeof EVENT_VISIBILITIES)[number];

// Who may vote (and suggest tracks):
// open    = anyone who can see the event
// invited = only the owner and accounts the owner explicitly invited
// geo     = anyone who can see it, inside a time window and a radius around a point
export const EVENT_LICENSES = ['open', 'invited', 'geo'] as const;
export type EventLicense = (typeof EVENT_LICENSES)[number];

// A Track Vote party: one live queue that people vote on.
@Entity('events')
@Check('CHK_events_visibility', `"visibility" IN ('public', 'private')`)
@Check('CHK_events_license', `"license" IN ('open', 'invited', 'geo')`)
// A geo event needs its whole area and time window; other events need none of it.
@Check(
  'CHK_events_geo_fields',
  `("license" = 'geo') = ("geoLat" IS NOT NULL AND "geoLng" IS NOT NULL AND "geoRadiusM" IS NOT NULL AND "startsAt" IS NOT NULL AND "endsAt" IS NOT NULL)`,
)
@Check('CHK_events_geo_ranges', `"geoLat" BETWEEN -90 AND 90 AND "geoLng" BETWEEN -180 AND 180 AND "geoRadiusM" > 0`)
@Check('CHK_events_time_window', `"startsAt" < "endsAt"`)
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Index()
  @Column({ type: 'uuid' })
  ownerId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 500, default: '' })
  description: string;

  @Column({ type: 'varchar', length: 10 })
  visibility: EventVisibility;

  @Column({ type: 'varchar', length: 10, default: 'open' })
  license: EventLicense;

  // Short random code to join (required for private events, shareable for public ones).
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 12 })
  inviteCode: string;

  // Only for license = 'geo'. Double precision is plenty for metres-level radii.
  @Column({ type: 'double precision', nullable: true })
  geoLat: number | null;

  @Column({ type: 'double precision', nullable: true })
  geoLng: number | null;

  @Column({ type: 'int', nullable: true })
  geoRadiusM: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

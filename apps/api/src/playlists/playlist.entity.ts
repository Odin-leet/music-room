import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export const PLAYLIST_VISIBILITIES = ['public', 'private'] as const;
export type PlaylistVisibility = (typeof PLAYLIST_VISIBILITIES)[number];

// Who may EDIT (add / remove / reorder). Everyone who can see it can listen.
// open    = anyone who can see the playlist
// invited = only the owner and accounts the owner invited by email
export const PLAYLIST_LICENSES = ['open', 'invited'] as const;
export type PlaylistLicense = (typeof PLAYLIST_LICENSES)[number];

// A shared playlist several people edit at once.
@Entity('playlists')
@Check('CHK_playlists_visibility', `"visibility" IN ('public', 'private')`)
@Check('CHK_playlists_license', `"license" IN ('open', 'invited')`)
export class Playlist {
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
  visibility: PlaylistVisibility;

  @Column({ type: 'varchar', length: 10, default: 'open' })
  license: PlaylistLicense;

  // Same 8-character format as event codes; lets people into a private playlist.
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 12 })
  inviteCode: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

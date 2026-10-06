import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { MemberRole } from '../events/event-member.entity';
import { User } from '../users/user.entity';
import { Playlist } from './playlist.entity';

// Same roles as events: owner · invited (may edit under license 'invited') · guest.
@Entity('playlist_members')
@Check('CHK_playlist_members_role', `"role" IN ('owner', 'invited', 'guest')`)
export class PlaylistMember {
  @PrimaryColumn({ type: 'uuid' })
  playlistId: string;

  // Indexed for "playlists I'm a member of".
  @Index()
  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => Playlist, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'playlistId' })
  playlist: Playlist;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 10 })
  role: MemberRole;

  @CreateDateColumn({ type: 'timestamptz' })
  joinedAt: Date;
}

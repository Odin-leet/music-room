import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { MAX_POSITION_LENGTH } from './positions';
import { Playlist } from './playlist.entity';

// One track of a playlist. Order = `position` (a fractional key, see
// positions.ts), compared byte by byte thanks to COLLATE "C".
@Entity('playlist_tracks')
// Strict order: two tracks never share a key. A rare collision (two people
// inserting into the same gap at the same instant) makes the second insert
// fail here; the service re-reads the neighbours and retries.
@Index('UQ_playlist_tracks_position', ['playlistId', 'position'], { unique: true })
// The same song only once per playlist.
@Index('UQ_playlist_tracks_song_once', ['playlistId', 'provider', 'providerTrackId'], { unique: true })
export class PlaylistTrack {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Playlist, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'playlistId' })
  playlist: Playlist;

  @Column({ type: 'uuid' })
  playlistId: string;

  // COLLATE "C" = plain byte order. The default collation follows language
  // rules (case-insensitive-ish) and would put "Zz" after "a0", breaking the order.
  @Column({ type: 'varchar', length: MAX_POSITION_LENGTH, collation: 'C' })
  position: string;

  // Snapshot taken from the provider by the server, never sent by the app.
  @Column({ type: 'varchar', length: 20 })
  provider: string;

  @Column({ type: 'varchar', length: 64 })
  providerTrackId: string;

  @Column({ type: 'varchar', length: 300 })
  title: string;

  @Column({ type: 'varchar', length: 300 })
  artist: string;

  @Column({ type: 'varchar', length: 300 })
  album: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  coverUrl: string | null;

  @Column({ type: 'int' })
  durationSec: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  isrc: string | null;

  // Kept if the person who added it deletes their account.
  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'addedById' })
  addedBy: User | null;

  @Column({ type: 'uuid', nullable: true })
  addedById: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  addedAt: Date;
}

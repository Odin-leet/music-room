import { Exclude, Expose } from 'class-transformer';
import { MUSIC_GENRES, type MusicGenre, type ProfileVisibility } from '@music-room/shared';
import { Check, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const PROFILE_VISIBILITIES = ['public', 'friends', 'private'] as const;
export const MAX_ARTISTS = 10;

// With UNIQUE(email), this makes emails unique case-insensitively at the DB level.
@Check('CHK_users_email_normalized', `"email" = lower(btrim("email"))`)
@Check('CHK_users_music_visibility', `"musicVisibility" IN ('public', 'friends', 'private')`)
@Check('CHK_users_music_genres', `"musicGenres" <@ ARRAY[${MUSIC_GENRES.map((g) => `'${g}'`).join(', ')}]::text[]`)
@Check('CHK_users_music_artists', `cardinality("musicArtists") <= ${MAX_ARTISTS}`)
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  // Null for accounts created through Google: they have no password until
  // they set one with "forgot password". Explicit type: TypeORM can't infer
  // a column type from a `string | null` union.
  @Exclude()
  @Column({ type: 'varchar', nullable: true })
  passwordHash: string | null;

  @Column()
  displayName: string;

  // Google's permanent account id (the ID token's `sub`), set when the user
  // signs in with Google. Never changes, even if their Gmail address does.
  @Exclude()
  @Column({ type: 'varchar', nullable: true, unique: true })
  googleId: string | null;

  // Facebook's app-scoped user id, set when the user logs in with Facebook.
  @Exclude()
  @Column({ type: 'varchar', nullable: true, unique: true })
  facebookId: string | null;

  // Null until the user enters the code we emailed them.
  @Exclude()
  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  // What clients see instead of the timestamp. Not `!== null`: right after
  // save(), TypeORM leaves an unset nullable column as undefined.
  @Expose()
  get emailVerified(): boolean {
    return this.emailVerifiedAt != null;
  }

  // ---------- Login lockout (V.6) ----------
  // Wrong passwords in a row; reset on success and when a lock starts.
  @Exclude()
  @Column({ type: 'int', default: 0 })
  failedLoginCount: number;

  // While in the future, login is refused even with the right password.
  @Exclude()
  @Column({ type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  // ---------- Profile (V.1) ----------
  // One row, fields grouped by who may see them; profileFor() (profile-policy.ts)
  // decides what each viewer gets. @Exclude: GET /users/me keeps its shape.

  // Public: anyone, even without logging in (plus displayName above).
  @Exclude()
  @Column({ type: 'varchar', length: 300, default: '' })
  bio: string;

  // Friends only.
  @Exclude()
  @Column({ type: 'varchar', length: 100, nullable: true })
  realName: string | null;

  @Exclude()
  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  // Private: only the user.
  @Exclude()
  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  // 'YYYY-MM-DD' (a date column comes back from pg as a string, no time zone shift).
  @Exclude()
  @Column({ type: 'date', nullable: true })
  birthDate: string | null;

  // Music preferences: structured tags, visible to whom the user chooses.
  @Exclude()
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  musicGenres: MusicGenre[];

  @Exclude()
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  musicArtists: string[];

  @Exclude()
  @Column({ type: 'varchar', length: 10, default: 'friends' })
  musicVisibility: ProfileVisibility;
}

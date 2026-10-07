import { config } from 'dotenv';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import { EmailVerificationCode } from './auth/email-verification-code.entity';
import { OAuthLoginCode } from './auth/oauth-login-code.entity';
import { EventMember } from './events/event-member.entity';
import { EventTrack } from './events/event-track.entity';
import { Event } from './events/event.entity';
import { Vote } from './events/vote.entity';
import { PlaylistMember } from './playlists/playlist-member.entity';
import { PlaylistTrack } from './playlists/playlist-track.entity';
import { Playlist } from './playlists/playlist.entity';
import { PasswordResetCode } from './auth/password-reset-code.entity';
import { RefreshToken } from './auth/refresh-token.entity';
import { Friendship } from './friends/friendship.entity';
import { User } from './users/user.entity';

config({ path: resolve(__dirname, '../../../.env') });

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [
    User,
    RefreshToken,
    EmailVerificationCode,
    PasswordResetCode,
    OAuthLoginCode,
    Event,
    EventMember,
    EventTrack,
    Vote,
    Playlist,
    PlaylistMember,
    PlaylistTrack,
    Friendship,
  ],
  migrations: ['src/migrations/*.ts'],
});

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

// Single-use code handed to the app at the end of a social login (in the
// return link). The app trades it, plus its PKCE verifier, for our usual
// tokens at POST /auth/oauth/exchange. Lives 60 seconds; deleted when used.
@Entity('oauth_login_codes')
export class OAuthLoginCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // SHA-256 of the code; the plain code only ever exists in the return link.
  @Index({ unique: true })
  @Column({ type: 'varchar' })
  codeHash: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  // PKCE: base64url(SHA-256(verifier)), sent by the app when it started the
  // login. Only the app that started it knows the verifier.
  @Column({ type: 'varchar' })
  codeChallenge: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

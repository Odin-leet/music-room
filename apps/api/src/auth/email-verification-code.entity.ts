import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

// The current email-verification code for a user. At most one per user
// (unique userId): requesting a new code replaces the old one.
@Entity('email_verification_codes')
export class EmailVerificationCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  // Unique: @OneToOne + @JoinColumn already adds a UNIQUE constraint on it.
  @Column({ type: 'uuid' })
  userId: string;

  // SHA-256 of the code; the plain code only ever exists in the email.
  @Column({ type: 'varchar' })
  codeHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  // Wrong guesses so far; the code is dead after MAX_ATTEMPTS.
  @Column({ type: 'int', default: 0 })
  attempts: number;

  // Also used for the resend cooldown.
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

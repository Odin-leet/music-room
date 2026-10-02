import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

// The current password-reset code for a user. Separate from email
// verification codes so the two can never be confused. At most one per user:
// requesting a new code replaces the old one.
@Entity('password_reset_codes')
export class PasswordResetCode {
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

  @Column({ type: 'int', default: 0 })
  attempts: number;

  // Also used for the resend cooldown.
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

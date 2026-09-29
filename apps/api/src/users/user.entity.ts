import { Exclude } from 'class-transformer';
import { Check, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// With UNIQUE(email), this makes emails unique case-insensitively at the DB level.
@Check('CHK_users_email_normalized', `"email" = lower(btrim("email"))`)
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Exclude()
  @Column()
  passwordHash: string;

  @Column()
  displayName: string;
}

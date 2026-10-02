import { Exclude, Expose } from 'class-transformer';
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
}

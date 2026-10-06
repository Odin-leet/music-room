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
}

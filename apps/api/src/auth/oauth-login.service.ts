import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { EmailVerificationService } from './email-verification.service';
import type { FacebookProfile } from './facebook-oauth.service';
import type { GoogleProfile } from './google-oauth.service';
import { OAuthLoginCode } from './oauth-login-code.entity';

const LOGIN_CODE_TTL_MS = 60_000;
// Postgres error code for a unique constraint violation.
const UNIQUE_VIOLATION = '23505';

// Thrown when the email already belongs to an account and the provider
// can't vouch for it (unverified email): linking would let whoever controls
// the provider account take over ours.
export class AccountExistsError extends Error {}

// The provider gave us no email (e.g. a phone-only Facebook account). Every
// Music Room account needs one (verification, password reset, uniqueness).
export class EmailRequiredError extends Error {}

const sha256 = (value: string) => createHash('sha256').update(value).digest();

@Injectable()
export class OAuthLoginService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(OAuthLoginCode)
    private readonly codes: Repository<OAuthLoginCode>,
    private readonly dataSource: DataSource,
    private readonly emailVerification: EmailVerificationService,
  ) {}

  // Who is this Google user in our app? In order:
  // 1. already linked (googleId) -> that user
  // 2. same email exists -> link, but only if Google verified the email
  // 3. otherwise -> new account: no password, email already verified
  async findOrCreateFromGoogle(profile: GoogleProfile): Promise<User> {
    const linked = await this.users.findOneBy({ googleId: profile.googleId });
    if (linked) return linked;

    const byEmail = await this.users.findOneBy({ email: profile.email });
    if (byEmail) {
      if (!profile.emailVerified) throw new AccountExistsError();
      await this.users.update(byEmail.id, {
        googleId: profile.googleId,
        // Google confirmed they own this address.
        emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
      });
      return this.users.findOneByOrFail({ id: byEmail.id });
    }

    const user = await this.createUser(
      {
        email: profile.email,
        displayName: profile.name,
        googleId: profile.googleId,
        emailVerifiedAt: profile.emailVerified ? new Date() : null,
      },
      { googleId: profile.googleId },
    );
    // Rare: Google said the email isn't verified. Verify it ourselves.
    if (!user.emailVerifiedAt) await this.emailVerification.sendInitialCode(user);
    return user;
  }

  // Same idea for Facebook, but Facebook doesn't tell us whether the email is
  // verified, so we never trust it to prove ownership:
  // 1. already linked (facebookId) -> that user
  // 2. same email exists -> refuse (no automatic linking through Facebook)
  // 3. otherwise -> new account, email NOT verified: we send our own code
  async findOrCreateFromFacebook(profile: FacebookProfile): Promise<User> {
    const linked = await this.users.findOneBy({ facebookId: profile.facebookId });
    if (linked) return linked;

    if (!profile.email) throw new EmailRequiredError();
    if (await this.users.existsBy({ email: profile.email })) throw new AccountExistsError();

    const user = await this.createUser(
      {
        email: profile.email,
        displayName: profile.name,
        facebookId: profile.facebookId,
        emailVerifiedAt: null,
      },
      { facebookId: profile.facebookId },
    );
    await this.emailVerification.sendInitialCode(user);
    return user;
  }

  // Creates a password-less social account. If two callbacks for the same
  // new user race, the unique constraints let only one insert win; the other
  // finds the row it created.
  private async createUser(
    data: Pick<User, 'email' | 'displayName' | 'emailVerifiedAt'> &
      Partial<Pick<User, 'googleId' | 'facebookId'>>,
    providerKey: { googleId: string } | { facebookId: string },
  ): Promise<User> {
    try {
      return await this.users.save(this.users.create({ ...data, passwordHash: null }));
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err.driverError as { code?: string }).code === UNIQUE_VIOLATION
      ) {
        const created = await this.users.findOneBy(providerKey);
        if (created) return created;
        // The email was taken in the meantime by another account.
        throw new AccountExistsError();
      }
      throw err;
    }
  }

  // The code that goes into the return link. Only its hash is stored.
  async createLoginCode(userId: string, codeChallenge: string): Promise<string> {
    const code = randomBytes(32).toString('base64url');
    await this.codes.insert({
      userId,
      codeHash: sha256(code).toString('hex'),
      codeChallenge,
      expiresAt: new Date(Date.now() + LOGIN_CODE_TTL_MS),
    });
    return code;
  }

  // Trades a login code + PKCE verifier for the user it belongs to.
  // One generic error for every failure (unknown, used, expired, wrong verifier).
  async exchange(code: string, codeVerifier: string): Promise<User> {
    const invalid = new BadRequestException('Invalid or expired login code');

    // Consume atomically: DELETE … RETURNING. If two requests race with the
    // same code, only one gets the row back — a code can never be used twice.
    const result = await this.dataSource
      .createQueryBuilder()
      .delete()
      .from(OAuthLoginCode)
      .where('"codeHash" = :hash', { hash: sha256(code).toString('hex') })
      .returning(['userId', 'codeChallenge', 'expiresAt'])
      .execute();
    const row = (result.raw as Array<Pick<OAuthLoginCode, 'userId' | 'codeChallenge' | 'expiresAt'>>)[0];
    if (!row || new Date(row.expiresAt).getTime() <= Date.now()) throw invalid;

    // PKCE check: hashing the verifier must give the challenge sent at start.
    const expected = Buffer.from(row.codeChallenge, 'base64url');
    const actual = sha256(codeVerifier);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw invalid;

    const user = await this.users.findOneBy({ id: row.userId });
    if (!user) throw invalid;
    return user;
  }
}

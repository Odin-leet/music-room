import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, LessThan, MoreThan, Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { User } from '../users/user.entity';
import {
  CODE_TTL_MS,
  codeMatches,
  generateCode,
  hashCode,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
} from './one-time-code';
import { hashPassword } from './password';
import { PasswordResetCode } from './password-reset-code.entity';
import { RefreshToken } from './refresh-token.entity';

// Same message for every failure (unknown email, no code, wrong, expired,
// too many attempts), so this endpoint can't confirm which emails exist.
const INVALID = 'Invalid or expired code';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectRepository(PasswordResetCode)
    private readonly codes: Repository<PasswordResetCode>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly mail: MailService,
    private readonly dataSource: DataSource,
  ) {}

  // Returns immediately and does the work in the background: the caller gets
  // the same response, in the same time, whether or not the email exists.
  requestReset(email: string) {
    void this.issueIfAllowed(email).catch((err: unknown) =>
      this.logger.error(`Password reset email failed for ${email}`, err),
    );
  }

  async reset(email: string, code: string, newPassword: string) {
    const user = await this.users.findOneBy({ email });
    const row = user ? await this.codes.findOneBy({ userId: user.id }) : null;
    if (!user || !row) throw new BadRequestException(INVALID);

    // Count the attempt atomically, only while the code is still usable.
    const { affected } = await this.codes.update(
      { id: row.id, attempts: LessThan(MAX_ATTEMPTS), expiresAt: MoreThan(new Date()) },
      { attempts: () => '"attempts" + 1' },
    );
    if (!affected || !codeMatches('reset-password', user.id, code, row.codeHash)) {
      throw new BadRequestException(INVALID);
    }

    const passwordHash = await hashPassword(newPassword);
    await this.dataSource.transaction(async (tx) => {
      await tx.update(User, { id: user.id }, {
        passwordHash,
        // The code arrived by email, so the user clearly owns the address.
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        // Proving you own the email also lifts a login lockout.
        failedLoginCount: 0,
        lockedUntil: null,
      });
      await tx.delete(PasswordResetCode, { userId: user.id });
      // Whoever knew the old password may be logged in somewhere: end every session.
      await tx.update(RefreshToken, { userId: user.id, revokedAt: IsNull() }, { revokedAt: new Date() });
    });
  }

  private async issueIfAllowed(email: string) {
    const user = await this.users.findOneBy({ email });
    if (!user) return;

    // Silent cooldown: a 429 here would reveal that the account exists.
    const recent = await this.codes.findOneBy({
      userId: user.id,
      createdAt: MoreThan(new Date(Date.now() - RESEND_COOLDOWN_MS)),
    });
    if (recent) return;

    const code = generateCode();
    await this.dataSource.transaction(async (tx) => {
      await tx.delete(PasswordResetCode, { userId: user.id });
      await tx.insert(PasswordResetCode, {
        userId: user.id,
        codeHash: hashCode('reset-password', user.id, code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      });
    });

    await this.mail.send({
      to: user.email,
      subject: `${code} is your Music Room password reset code`,
      text: [
        `Hi ${user.displayName},`,
        '',
        `Your password reset code is: ${code}`,
        '',
        'It expires in 15 minutes. If you did not ask to reset your password,',
        'ignore this email — your password stays the same.',
      ].join('\n'),
    });
  }
}

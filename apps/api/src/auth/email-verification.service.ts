import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThan, MoreThan, Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { User } from '../users/user.entity';
import { EmailVerificationCode } from './email-verification-code.entity';
import {
  CODE_TTL_MS,
  codeMatches,
  generateCode,
  hashCode,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
} from './one-time-code';

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    @InjectRepository(EmailVerificationCode)
    private readonly codes: Repository<EmailVerificationCode>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly mail: MailService,
    private readonly dataSource: DataSource,
  ) {}

  // Called right after registration. A mail failure must not fail the
  // registration — the user can ask for a new code from the app.
  async sendInitialCode(user: User) {
    try {
      await this.issueAndSend(user);
    } catch (err) {
      this.logger.error(`Could not send verification email to ${user.email}`, err);
    }
  }

  async resend(userId: string) {
    const user = await this.requireUser(userId);
    if (user.emailVerifiedAt) throw new BadRequestException('Email is already verified');

    const recent = await this.codes.findOneBy({
      userId,
      createdAt: MoreThan(new Date(Date.now() - RESEND_COOLDOWN_MS)),
    });
    if (recent) {
      const waitS = Math.ceil(
        (recent.createdAt.getTime() + RESEND_COOLDOWN_MS - Date.now()) / 1000,
      );
      throw new HttpException(
        `Please wait ${waitS}s before requesting a new code`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.issueAndSend(user);
  }

  async verify(userId: string, code: string) {
    const user = await this.requireUser(userId);
    if (user.emailVerifiedAt) return; // idempotent: verifying twice is fine

    const row = await this.codes.findOneBy({ userId });
    if (!row) throw new BadRequestException('No active code. Request a new one.');

    // Count this attempt first, atomically, and only if the code is still
    // usable. Parallel guesses can't get past MAX_ATTEMPTS this way.
    const { affected } = await this.codes.update(
      { id: row.id, attempts: LessThan(MAX_ATTEMPTS), expiresAt: MoreThan(new Date()) },
      { attempts: () => '"attempts" + 1' },
    );
    if (!affected) {
      throw new BadRequestException(
        row.expiresAt.getTime() <= Date.now()
          ? 'Code expired. Request a new one.'
          : 'Too many attempts. Request a new code.',
      );
    }

    if (!codeMatches('verify-email', userId, code, row.codeHash)) {
      throw new BadRequestException('Invalid code');
    }

    // Mark verified and burn the code together.
    await this.dataSource.transaction(async (tx) => {
      await tx.update(User, { id: userId }, { emailVerifiedAt: new Date() });
      await tx.delete(EmailVerificationCode, { userId });
    });
  }

  private async issueAndSend(user: User) {
    const code = generateCode();

    // One code per user: replace whatever was there (fresh attempts, fresh expiry).
    await this.dataSource.transaction(async (tx) => {
      await tx.delete(EmailVerificationCode, { userId: user.id });
      await tx.insert(EmailVerificationCode, {
        userId: user.id,
        codeHash: hashCode('verify-email', user.id, code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      });
    });

    await this.mail.send({
      to: user.email,
      subject: `${code} is your Music Room verification code`,
      text: [
        `Hi ${user.displayName},`,
        '',
        `Your Music Room verification code is: ${code}`,
        '',
        'It expires in 15 minutes. If you did not create an account, ignore this email.',
      ].join('\n'),
    });
  }

  private async requireUser(userId: string) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}

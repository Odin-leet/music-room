import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hashSync } from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { parseDurationMs } from '../common/parse-duration';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { EmailVerificationService } from './email-verification.service';
import { BCRYPT_ROUNDS, hashPassword } from './password';
import { RefreshToken } from './refresh-token.entity';

// Compared against when the email doesn't exist, so an unknown email takes as
// long as a wrong password and response time doesn't reveal which is which.
const DUMMY_PASSWORD_HASH = hashSync('dummy-password', BCRYPT_ROUNDS);

export function hashRefreshToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly refreshTtlMs: number;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailVerification: EmailVerificationService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    config: ConfigService,
  ) {
    this.refreshTtlMs = parseDurationMs(
      config.getOrThrow<string>('JWT_REFRESH_EXPIRES'),
    );
  }

  async register(dto: RegisterDto) {
    const passwordHash = await hashPassword(dto.password);
    const user = await this.usersService.create({
      email: dto.email,
      displayName: dto.displayName,
      passwordHash,
    });
    await this.emailVerification.sendInitialCode(user);
    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    // Same error for unknown email and wrong password, so login can't be
    // used to discover which emails are registered.
    const passwordOk = await compare(
      dto.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !passwordOk) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    const invalid = new UnauthorizedException('Invalid refresh token');

    const row = await this.refreshTokens.findOneBy({
      tokenHash: hashRefreshToken(refreshToken),
    });
    if (!row) throw invalid;

    // A revoked token being presented again means it was copied: whoever has
    // it isn't necessarily the user, so end every session for that account.
    if (row.revokedAt) {
      await this.revokeAllSessions(row.userId);
      throw invalid;
    }

    if (row.expiresAt.getTime() <= Date.now()) throw invalid;

    // Conditional revoke: if two requests race with the same token, only one
    // update matches; the loser is treated as reuse.
    const { affected } = await this.refreshTokens.update(
      { id: row.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    if (!affected) {
      await this.revokeAllSessions(row.userId);
      throw invalid;
    }

    const user = await this.usersService.findById(row.userId);
    if (!user) throw invalid;

    return this.issueTokens(user);
  }

  // Revokes just this session. Silent on unknown/already-revoked tokens so
  // logout can't be used to probe which tokens exist.
  async logout(refreshToken: string) {
    await this.refreshTokens.update(
      { tokenHash: hashRefreshToken(refreshToken), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async revokeAllSessions(userId: string) {
    await this.refreshTokens.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async issueTokens(user: User) {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });

    // Opaque random token: the DB row, not a signature, is what makes it valid.
    const refreshToken = randomBytes(32).toString('base64url');
    await this.refreshTokens.save({
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + this.refreshTtlMs),
    });

    return { accessToken, refreshToken };
  }
}

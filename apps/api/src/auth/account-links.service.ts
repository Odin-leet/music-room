import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { SignInMethods } from '@music-room/shared';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import type { OAuthProvider } from './oauth-state.service';
import { pkceMatches } from './pkce';

const UNIQUE_VIOLATION = '23505';
const TICKET_TTL = '60s';
const COLUMN = { google: 'googleId', facebook: 'facebookId' } as const;
const NAME = { google: 'Google', facebook: 'Facebook' } as const;

type Ticket = {
  purpose: 'oauth-link-ticket';
  userId: string; // who started the link (from the signed state)
  provider: OAuthProvider;
  providerUserId: string; // Google `sub` / Facebook app-scoped id
  codeChallenge: string; // PKCE: only the app that started can confirm
};

// Linking a Google / Facebook account to the logged-in user (brief V.1:
// "an email account can later attach a Google identity and vice versa").
//
// Why a ticket + confirm step instead of linking in the browser callback:
// otherwise an attacker could start "link" on THEIR account and get a victim
// to open the link: the victim's Google would end up attached to the
// attacker's account (login CSRF). Here the callback only hands the app a
// 60-second signed ticket; linking needs (1) the access token of the same
// user who started, and (2) the PKCE verifier only that app holds.
@Injectable()
export class AccountLinksService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async methods(userId: string): Promise<SignInMethods> {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');
    return {
      email: user.email,
      password: user.passwordHash !== null,
      google: user.googleId !== null,
      facebook: user.facebookId !== null,
    };
  }

  // Called from the provider's callback in link mode.
  createTicket(userId: string, provider: OAuthProvider, providerUserId: string, codeChallenge: string): string {
    const ticket: Ticket = { purpose: 'oauth-link-ticket', userId, provider, providerUserId, codeChallenge };
    return this.jwt.sign(ticket, { expiresIn: TICKET_TTL });
  }

  async confirm(callerId: string, rawTicket: string, codeVerifier: string): Promise<SignInMethods> {
    const ticket = this.readTicket(rawTicket);
    // Same user who started, and the app that started (PKCE).
    if (ticket.userId !== callerId || !pkceMatches(ticket.codeChallenge, codeVerifier)) {
      throw new BadRequestException('This link attempt was not started by you');
    }
    const column = COLUMN[ticket.provider];

    const owner = await this.users.findOneBy({ [column]: ticket.providerUserId });
    if (owner && owner.id !== callerId) {
      throw new ConflictException(`This ${NAME[ticket.provider]} account is already linked to another Music Room account`);
    }
    if (!owner) {
      try {
        // Only if no (other) account of that provider is linked yet:
        // replacing one silently would be surprising — unlink it first.
        const result = await this.users
          .createQueryBuilder()
          .update()
          .set({ [column]: ticket.providerUserId })
          .where('id = :id', { id: callerId })
          .andWhere(`"${column}" IS NULL`)
          .execute();
        if (!result.affected) {
          throw new ConflictException(`You already have another ${NAME[ticket.provider]} account linked — unlink it first`);
        }
      } catch (err) {
        // Someone linked the same provider account to another user meanwhile.
        if (err instanceof QueryFailedError && (err.driverError as { code?: string }).code === UNIQUE_VIOLATION) {
          throw new ConflictException(`This ${NAME[ticket.provider]} account is already linked to another Music Room account`);
        }
        throw err;
      }
    }
    return this.methods(callerId);
  }

  // Refused when it's your last way to sign in. One UPDATE whose WHERE checks
  // that another method remains: two simultaneous unlinks (Google and
  // Facebook on a password-less account) can't both pass, because Postgres
  // re-checks the WHERE on the row after the first one commits.
  async unlink(userId: string, provider: OAuthProvider): Promise<SignInMethods> {
    const others = (['passwordHash', 'googleId', 'facebookId'] as const)
      .filter((c) => c !== COLUMN[provider])
      .map((c) => `"${c}" IS NOT NULL`)
      .join(' OR ');
    const result = await this.users
      .createQueryBuilder()
      .update()
      .set({ [COLUMN[provider]]: null })
      .where('id = :id', { id: userId })
      .andWhere(`(${others})`)
      .execute();
    if (!result.affected) {
      const methods = await this.methods(userId);
      if (methods[provider]) {
        throw new ConflictException(
          `${NAME[provider]} is your only way to sign in. Set a password ("Forgot password") or link another account first.`,
        );
      }
    }
    return this.methods(userId);
  }

  private readTicket(raw: string): Ticket {
    try {
      const t = this.jwt.verify<Ticket>(raw);
      if (t.purpose !== 'oauth-link-ticket' || !(t.provider in COLUMN)) throw new Error('wrong ticket');
      return t;
    } catch {
      throw new BadRequestException('Invalid or expired link attempt — try again');
    }
  }
}

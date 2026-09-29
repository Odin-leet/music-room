import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from './user.entity';

// Postgres error code for a unique constraint violation.
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async create(data: Pick<User, 'email' | 'displayName' | 'passwordHash'>) {
    if (await this.users.existsBy({ email: data.email })) {
      throw new ConflictException('Email is already registered');
    }

    const user = this.users.create(data);
    try {
      return await this.users.save(user);
    } catch (err) {
      // Two requests can both pass the check above before either saves;
      // the DB's unique constraint is the real guarantee.
      if (
        err instanceof QueryFailedError &&
        (err.driverError as { code?: string }).code === UNIQUE_VIOLATION
      ) {
        throw new ConflictException('Email is already registered');
      }
      throw err;
    }
  }

  findByEmail(email: string) {
    return this.users.findOneBy({ email });
  }

  findById(id: string) {
    return this.users.findOneBy({ id });
  }
}

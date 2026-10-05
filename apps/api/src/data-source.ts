import { config } from 'dotenv';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import { EmailVerificationCode } from './auth/email-verification-code.entity';
import { OAuthLoginCode } from './auth/oauth-login-code.entity';
import { PasswordResetCode } from './auth/password-reset-code.entity';
import { RefreshToken } from './auth/refresh-token.entity';
import { User } from './users/user.entity';

config({ path: resolve(__dirname, '../../../.env') });

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [User, RefreshToken, EmailVerificationCode, PasswordResetCode, OAuthLoginCode],
  migrations: ['src/migrations/*.ts'],
});

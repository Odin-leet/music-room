import { IsString, Matches } from 'class-validator';

export class OAuthExchangeDto {
  @IsString()
  code: string;

  // PKCE verifier (RFC 7636): 43–128 chars of [A-Z a-z 0-9 - . _ ~].
  @Matches(/^[A-Za-z0-9\-._~]{43,128}$/, { message: 'codeVerifier is not a valid PKCE verifier' })
  codeVerifier: string;
}

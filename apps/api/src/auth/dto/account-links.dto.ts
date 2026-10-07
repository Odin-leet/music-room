import type { SignInMethods } from '@music-room/shared';
import { IsString, Matches } from 'class-validator';

export class StartLinkDto {
  /** App deep link the browser returns to. @example "exp://192.168.1.10:8081/--/oauth" */
  @IsString()
  redirect: string;

  /** PKCE S256 challenge: base64url(SHA-256(verifier)), 43 characters. */
  @IsString()
  codeChallenge: string;
}

export class ConfirmLinkDto {
  /** The `link` value the browser brought back to the app (valid 60 s). */
  @IsString()
  ticket: string;

  // PKCE verifier (RFC 7636): 43–128 chars of [A-Z a-z 0-9 - . _ ~].
  @Matches(/^[A-Za-z0-9\-._~]{43,128}$/, { message: 'codeVerifier is not a valid PKCE verifier' })
  codeVerifier: string;
}

export class StartLinkResultDto {
  /** Open this in a browser tab (the provider's sign-in page). */
  url: string;
}

export class SignInMethodsDto implements SignInMethods {
  email: string;

  /** False for accounts created with Google / Facebook until a password is set ("Forgot password"). */
  password: boolean;

  google: boolean;

  facebook: boolean;
}

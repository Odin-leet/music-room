import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

const GRAPH_VERSION = 'v25.0';

export type FacebookProfile = {
  facebookId: string;
  // Can be missing: some Facebook accounts are registered with a phone number.
  email: string | null;
  name: string;
};

// "Log in with Facebook" = plain OAuth 2.0 (Facebook's web login is not
// OpenID Connect: there's no ID token). We exchange the code server-side with
// the app secret, then ask the Graph API who the access token belongs to.
@Injectable()
export class FacebookOAuthService {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly redirectUri: string;

  constructor(config: ConfigService) {
    this.appId = config.getOrThrow<string>('FACEBOOK_APP_ID');
    this.appSecret = config.getOrThrow<string>('FACEBOOK_APP_SECRET');
    // http://localhost is allowed automatically while the Facebook app is in
    // Development mode; any other address must be in "Valid OAuth Redirect URIs".
    this.redirectUri = config.get<string>(
      'FACEBOOK_REDIRECT_URI',
      'http://localhost:3000/auth/facebook/callback',
    );
  }

  buildAuthUrl(state: string) {
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      state,
      response_type: 'code',
      scope: 'email,public_profile',
    });
    return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
  }

  async profileFromCode(code: string): Promise<FacebookProfile> {
    // 1. Code -> access token. redirect_uri must equal the one used above.
    const tokenParams = new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      redirect_uri: this.redirectUri,
      code,
    });
    const tokenRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?${tokenParams.toString()}`,
    );
    const token = (await tokenRes.json()) as { access_token?: string };
    if (!tokenRes.ok || !token.access_token) {
      throw new BadRequestException('Facebook rejected the login code');
    }

    // 2. Who is this? appsecret_proof proves the call comes from our server
    //    (it requires the app secret), so a leaked token alone can't be reused here.
    const meParams = new URLSearchParams({
      fields: 'id,name,email',
      access_token: token.access_token,
      appsecret_proof: createHmac('sha256', this.appSecret).update(token.access_token).digest('hex'),
    });
    const meRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/me?${meParams.toString()}`);
    const me = (await meRes.json()) as { id?: string; name?: string; email?: string };
    if (!meRes.ok || !me.id) throw new BadRequestException('Could not read the Facebook profile');

    return {
      facebookId: me.id,
      email: me.email ? me.email.toLowerCase() : null,
      name: me.name ?? 'Facebook user',
    };
  }
}

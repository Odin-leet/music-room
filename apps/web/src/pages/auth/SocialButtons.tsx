import { useState } from 'react';
import { IoLogoFacebook, IoLogoGoogle } from 'react-icons/io5';
import { PROVIDER_NAME, startSocialLogin, type SocialProvider } from '@/session/oauthFlow';
import { Button } from '@/ui';

// Used on both Log in and Register: the provider creates the account if
// needed. The browser goes to the provider and comes back to /oauth.
export function SocialButtons({ returnTo, error }: { returnTo: string; error?: string | null }) {
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const go = (p: SocialProvider) => {
    setBusy(p);
    void startSocialLogin(p, returnTo).catch(() => setBusy(null));
  };
  return (
    <>
      {(['google', 'facebook'] as const).map((p) => (
        <Button
          key={p}
          title={`Continue with ${PROVIDER_NAME[p]}`}
          icon={p === 'google' ? IoLogoGoogle : IoLogoFacebook}
          variant="secondary"
          loading={busy === p}
          disabled={busy !== null && busy !== p}
          onClick={() => go(p)}
          block
        />
      ))}
      {error ? <p className="error">{error}</p> : null}
    </>
  );
}

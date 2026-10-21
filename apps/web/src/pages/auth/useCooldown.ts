import { useEffect, useState } from 'react';

// "Resend code (42s)": counts down to 0, one second at a time.
export function useCooldown(initial: number) {
  const [cooldown, setCooldown] = useState(initial);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  return [cooldown, setCooldown] as const;
}

export const RESEND_COOLDOWN_S = 60;

export const digitsOnly = (text: string) => text.replace(/\D/g, '').slice(0, 6);

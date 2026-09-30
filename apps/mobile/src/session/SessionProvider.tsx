import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type Session = {
  isLoggedIn: boolean;
  signIn: () => void;
  signOut: () => void;
};

const SessionContext = createContext<Session | null>(null);

// TEMPORARY (step 8): an in-memory flag so we can prove the routing works.
// Step 9 replaces this with real tokens from POST /auth/login, persisted in
// expo-secure-store. Screens only use useSession(), so they won't change.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const value = useMemo<Session>(
    () => ({
      isLoggedIn,
      signIn: () => setIsLoggedIn(true),
      signOut: () => setIsLoggedIn(false),
    }),
    [isLoggedIn],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside <SessionProvider>');
  return session;
}

import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { AppShell } from '@/layout/AppShell';
import { AuthLayout } from '@/layout/AuthLayout';
import { PlayerProvider } from '@/player/PlayerProvider';
import { MeRealtimeProvider } from '@/realtime/MeRealtimeProvider';
import { CurrentUserProvider, useCurrentUser } from '@/session/CurrentUserProvider';
import { SessionProvider, useSession } from '@/session/SessionProvider';
import { Button, DialogsProvider, Spinner } from '@/ui';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { LoginPage, type AuthState } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { VerifyEmailPage } from '@/pages/auth/VerifyEmailPage';
import { HomePage } from '@/pages/HomePage';
import { EventPage } from '@/pages/events/EventPage';
import { EventAddTrackPage } from '@/pages/events/EventAddTrackPage';
import { EventInfoPage } from '@/pages/events/EventInfoPage';
import { EventsPage } from '@/pages/events/EventsPage';
import { JoinEventPage } from '@/pages/events/JoinEventPage';
import { NewEventPage } from '@/pages/events/NewEventPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { OAuthReturnPage } from '@/pages/OAuthReturnPage';
import { FriendsPage } from '@/pages/people/FriendsPage';
import { PersonPage } from '@/pages/people/PersonPage';
import { JoinPlaylistPage } from '@/pages/playlists/JoinPlaylistPage';
import { NewPlaylistPage } from '@/pages/playlists/NewPlaylistPage';
import { PlaylistAddTracksPage } from '@/pages/playlists/PlaylistAddTracksPage';
import { PlaylistInfoPage } from '@/pages/playlists/PlaylistInfoPage';
import { PlaylistPage } from '@/pages/playlists/PlaylistPage';
import { PlaylistsPage } from '@/pages/playlists/PlaylistsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { SettingsPage } from '@/pages/SettingsPage';

export function App() {
  return (
    <BrowserRouter>
      <DialogsProvider>
        <SessionProvider>
          <Root />
        </SessionProvider>
      </DialogsProvider>
    </BrowserRouter>
  );
}

const Splash = () => (
  <div className="full-center">
    <Spinner large />
  </div>
);

// Exactly one set of pages is reachable at a time, like the mobile app's
// route groups: signed out -> the auth pages; signed in -> the app (once the
// email is verified). /oauth and Server settings work in every state.
function Root() {
  const { status } = useSession();
  if (status === 'restoring') return <Splash />;
  if (status === 'signedOut') return <SignedOutRoutes />;
  return (
    <CurrentUserProvider>
      {/* One /me socket for the whole signed-in area (friend notifications). */}
      <MeRealtimeProvider>
        {/* One audio player for the whole app: music keeps playing across pages. */}
        <PlayerProvider>
          <SignedInRoutes />
        </PlayerProvider>
      </MeRealtimeProvider>
    </CurrentUserProvider>
  );
}

function SignedOutRoutes() {
  return (
    <Routes>
      <Route path="/oauth" element={<OAuthReturnPage />} />
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<ToLogin />} />
    </Routes>
  );
}

// Opened a link while signed out (e.g. /events/123): log in, then go there.
function ToLogin() {
  const { pathname, search } = useLocation();
  const from = pathname === '/' ? undefined : `${pathname}${search}`;
  return <Navigate to="/login" replace state={{ from } satisfies AuthState} />;
}

function SignedInRoutes() {
  const { me, reload } = useCurrentUser();
  const { signOut } = useSession();

  if (me.state === 'loading') return <Splash />;
  if (me.state === 'error') {
    return (
      <div className="full-center">
        <p className="error">{me.message}</p>
        <Button title="Try again" onClick={() => void reload()} />
        <Button title="Log out" variant="secondary" onClick={() => void signOut()} />
      </div>
    );
  }

  // Until the email is verified, the only page is verify-email.
  if (!me.user.emailVerified) {
    return (
      <Routes>
        <Route path="/oauth" element={<OAuthReturnPage />} />
        <Route element={<AuthLayout />}>
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/verify-email" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/oauth" element={<OAuthReturnPage />} />
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="events">
          <Route index element={<EventsPage />} />
          <Route path="new" element={<NewEventPage />} />
          <Route path="join" element={<JoinEventPage />} />
          <Route path=":id" element={<EventPage />} />
          <Route path=":id/add" element={<EventAddTrackPage />} />
          <Route path=":id/info" element={<EventInfoPage />} />
        </Route>
        <Route path="playlists">
          <Route index element={<PlaylistsPage />} />
          <Route path="new" element={<NewPlaylistPage />} />
          <Route path="join" element={<JoinPlaylistPage />} />
          <Route path=":id" element={<PlaylistPage />} />
          <Route path=":id/add" element={<PlaylistAddTracksPage />} />
          <Route path=":id/info" element={<PlaylistInfoPage />} />
        </Route>
        <Route path="people">
          <Route index element={<FriendsPage />} />
          <Route path=":id" element={<PersonPage />} />
        </Route>
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      {/* Just signed in / verified: go where you were going. */}
      <Route path="/login" element={<FromState />} />
      <Route path="/register" element={<FromState />} />
      <Route path="/verify-email" element={<FromState />} />
    </Routes>
  );
}

function FromState() {
  const state = useLocation().state as AuthState;
  return <Navigate to={state?.from ?? '/'} replace />;
}

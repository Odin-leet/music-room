import { Outlet } from 'react-router';

// Signed-out pages (and verify-email): one centred card.
export function AuthLayout() {
  return (
    <div className="auth">
      <main className="auth-card">
        <Outlet />
      </main>
    </div>
  );
}

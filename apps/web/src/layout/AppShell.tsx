import { useEffect, useRef } from 'react';
import type { IconType } from 'react-icons';
import {
  IoHeart,
  IoHeartOutline,
  IoHome,
  IoHomeOutline,
  IoMusicalNotes,
  IoMusicalNotesOutline,
  IoPeopleCircle,
  IoPeopleCircleOutline,
  IoPersonCircle,
  IoPersonCircleOutline,
  IoServerOutline,
} from 'react-icons/io5';
import { NavLink, Outlet, useLocation } from 'react-router';
import wordmark from '@/assets/wordmark-light.png';
import { PlayerBar } from '@/player/PlayerBar';
import { useIncomingRequests } from '@/realtime/MeRealtimeProvider';

type Tab = { to: string; title: string; icon: IconType; iconOff: IconType; badge?: number; end?: boolean };

// The signed-in app, same 5 places as the mobile tabs. Wide screens: a
// sidebar and a full-width player at the bottom. Phones: the player sits
// right above a bottom tab bar, like the mobile app.
export function AppShell() {
  const incoming = useIncomingRequests();
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);

  // A new page starts at the top (the main area is the scroll container).
  useEffect(() => {
    main.current?.scrollTo(0, 0);
  }, [pathname]);

  const tabs: Tab[] = [
    { to: '/', title: 'Home', icon: IoHome, iconOff: IoHomeOutline, end: true },
    { to: '/events', title: 'Events', icon: IoPeopleCircle, iconOff: IoPeopleCircleOutline },
    { to: '/playlists', title: 'Playlists', icon: IoMusicalNotes, iconOff: IoMusicalNotesOutline },
    { to: '/people', title: 'Friends', icon: IoHeart, iconOff: IoHeartOutline, badge: incoming },
    { to: '/profile', title: 'Profile', icon: IoPersonCircle, iconOff: IoPersonCircleOutline },
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <NavLink to="/" className="sidebar-brand" aria-label="HOLY, home">
          <img src={wordmark} alt="HOLY" />
        </NavLink>
        <nav className="nav" aria-label="Main">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              {({ isActive }) => (
                <>
                  <TabIcon tab={t} active={isActive} size={22} />
                  <span>{t.title}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <NavLink to="/settings" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <IoServerOutline size={20} aria-hidden />
            <span>Server settings</span>
          </NavLink>
        </div>
      </aside>

      <main className="main" ref={main}>
        <Outlet />
      </main>

      <div className="player-area">
        <PlayerBar />
        <nav className="tabbar" aria-label="Main">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) => `tab${isActive ? ' active' : ''}`}
              aria-label={t.badge ? `${t.title}, ${t.badge} new` : t.title}
            >
              {({ isActive }) => (
                <>
                  <TabIcon tab={t} active={isActive} size={24} />
                  <span>{t.title}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

function TabIcon({ tab, active, size }: { tab: Tab; active: boolean; size: number }) {
  const Icon = active ? tab.icon : tab.iconOff;
  return (
    <span className="nav-icon">
      <Icon size={size} aria-hidden />
      {tab.badge ? <span className="badge">{tab.badge > 9 ? '9+' : tab.badge}</span> : null}
    </span>
  );
}

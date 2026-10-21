import type { ReactNode } from 'react';
import type { IconType } from 'react-icons';
import { IoChevronBack } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { Button } from './Button';
import { IconButton } from './IconButton';

// Outer container of every signed-in page: width and padding.
export const Page = ({ children, narrow }: { children: ReactNode; narrow?: boolean }) => (
  <div className={`page${narrow ? ' narrow' : ''}`}>{children}</div>
);

// Title (+ subtitle) at the top of a page, an optional back arrow, and
// actions on the right. Pages with a back arrow are detail pages: a smaller
// title on up to 2 lines, so long names aren't cut off.
export function PageHeader(props: { title: string; subtitle?: string; back?: string; right?: ReactNode }) {
  const navigate = useNavigate();
  // Back in history when there is some (inside the app), else to `back`.
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(props.back ?? '/');
  };
  const compact = props.back !== undefined;
  return (
    <header className="page-header">
      {compact ? <IconButton icon={IoChevronBack} label="Back" onClick={goBack} /> : null}
      <div className="page-header-text">
        <h1 className={compact ? 'heading clamp-2' : 'title ellipsis'}>{props.title}</h1>
        {props.subtitle ? <p className="muted ellipsis">{props.subtitle}</p> : null}
      </div>
      {props.right ? <div className="page-header-right">{props.right}</div> : null}
    </header>
  );
}

// "Up next ·  See all"
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="section-header">
      <h2 className="heading">{title}</h2>
      {action && onAction ? (
        <button type="button" className="link" onClick={onAction} aria-label={`${action}: ${title}`}>
          {action}
        </button>
      ) : null}
    </div>
  );
}

// Surface box for grouped content.
export const Card = ({ children, roomy }: { children: ReactNode; roomy?: boolean }) => (
  <section className={`card${roomy ? ' roomy' : ''}`}>{children}</section>
);

// The top of a Card: an icon, a title, and an optional line under it.
export function CardTitle({ icon: Icon, title, hint }: { icon: IconType; title: string; hint?: string }) {
  return (
    <div className="card-title">
      <div className="card-title-row">
        <Icon size={18} aria-hidden />
        <h2 className="heading">{title}</h2>
      </div>
      {hint ? <span className="caption">{hint}</span> : null}
    </div>
  );
}

// An empty list says what to do next, instead of a blank page.
export function EmptyState(props: { icon: IconType; title: string; text?: string; action?: string; onAction?: () => void }) {
  const Icon = props.icon;
  return (
    <div className="empty">
      <Icon size={40} aria-hidden />
      <h3 className="heading">{props.title}</h3>
      {props.text ? <p className="muted">{props.text}</p> : null}
      {props.action && props.onAction ? <Button title={props.action} size="sm" onClick={props.onAction} /> : null}
    </div>
  );
}

// "● Live" while the realtime socket is joined, grey otherwise.
export function LiveDot({ status }: { status: 'connecting' | 'live' | 'offline' }) {
  const live = status === 'live';
  return (
    <span className={`live${live ? ' on' : ''}`} role="status" aria-label={`Live updates: ${status}`}>
      <span className="live-dot" />
      {live ? 'Live' : status === 'connecting' ? '…' : 'Offline'}
    </span>
  );
}

export const OrDivider = () => <div className="or-divider">or</div>;

export const Spinner = ({ large }: { large?: boolean }) => <span className={`spinner${large ? ' lg' : ''}`} role="status" aria-label="Loading" />;

// A small line with an icon: why you can't vote / edit, etc.
export function Notice({ icon: Icon, children }: { icon: IconType; children: ReactNode }) {
  return (
    <div className="notice">
      <Icon size={18} aria-hidden />
      <span>{children}</span>
    </div>
  );
}

// Loading / error for a page whose data isn't there yet.
export function PageStatus({ error, back }: { error: string | null; back: string }) {
  const navigate = useNavigate();
  return (
    <Page>
      <div className="empty">
        {error ? <p className="error">{error}</p> : <Spinner large />}
        {error ? <Button title="Back" variant="secondary" onClick={() => navigate(back)} /> : null}
      </div>
    </Page>
  );
}

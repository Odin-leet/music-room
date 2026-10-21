import type { ReactNode } from 'react';
import { Link } from 'react-router';

type Props = {
  title: string;
  subtitle?: string;
  leading?: ReactNode; // a Cover, an Avatar, a position number…
  trailing?: ReactNode; // buttons, a chevron, a count…
  to?: string; // a link…
  onClick?: () => void; // …or an action
  highlighted?: boolean; // e.g. the track playing now
  label?: string; // accessible name when the row is clickable
  disabled?: boolean; // an action row that's done (e.g. "Added"): still announced
};

// The row used by every list: events, playlists, tracks, people.
export function ListItem({ title, subtitle, leading, trailing, to, onClick, highlighted, label, disabled }: Props) {
  const cls = `list-item${highlighted ? ' highlighted' : ''}`;
  const body = (
    <>
      {leading}
      <span className="list-item-text">
        <span className="list-item-title">{title}</span>
        {subtitle ? <span className="muted ellipsis">{subtitle}</span> : null}
      </span>
    </>
  );
  // A link or button can't contain the trailing buttons: they sit next to it.
  if (to || onClick) {
    const main = to ? (
      <Link to={to} className={cls} aria-label={label}>
        {body}
        {!trailingIsInteractive(trailing) ? trailing : null}
      </Link>
    ) : (
      <button type="button" className={cls} onClick={onClick} aria-label={label} disabled={disabled}>
        {body}
        {!trailingIsInteractive(trailing) ? trailing : null}
      </button>
    );
    if (!trailingIsInteractive(trailing)) return main;
    return (
      <div className="row-sm">
        <div className="grow">{main}</div>
        {trailing}
      </div>
    );
  }
  return (
    <div className={cls}>
      {body}
      {trailing}
    </div>
  );
}

// Trailing content that contains its own buttons must not be nested inside
// the row's link / button (invalid HTML, and two click targets in one).
export const Actions = ({ children }: { children: ReactNode }) => <div className="row-sm actions">{children}</div>;
const trailingIsInteractive = (node: ReactNode) =>
  typeof node === 'object' && node !== null && 'type' in node && node.type === Actions;

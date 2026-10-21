// Initials in a circle (we don't store profile pictures). The tint is picked
// from the name, so the same person always gets the same one.
const TINTS = ['var(--primary)', 'var(--surface-raised)', '#4E3A47', '#5A4B5E'];

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?';
  const tint = TINTS[[...name].reduce((h, c) => h + c.charCodeAt(0), 0) % TINTS.length];
  return (
    <div className="avatar" style={{ width: size, height: size, background: tint, fontSize: size * 0.38 }} aria-hidden>
      {initials}
    </div>
  );
}

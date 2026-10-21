import type { IconType } from 'react-icons';
import { IoMusicalNote } from 'react-icons/io5';

type Props = {
  // One cover, or up to 4 (a 2x2 mosaic, like a playlist's first tracks).
  uri?: string | null;
  uris?: (string | null)[];
  size: number;
  // Shown when there's no image.
  icon?: IconType;
  rounded?: boolean;
};

// Album art, or a calm placeholder with an icon. Decorative: the title next
// to it says what it is.
export function Cover({ uri, uris, size, icon: Icon = IoMusicalNote, rounded = false }: Props) {
  const style = { width: size, height: size, borderRadius: rounded ? '50%' : size > 80 ? 'var(--r-lg)' : 'var(--r-sm)' };
  const images = (uris ?? (uri ? [uri] : [])).filter((u): u is string => !!u);

  if (images.length >= 4) {
    return (
      <div className="cover mosaic" style={style} aria-hidden>
        {images.slice(0, 4).map((u, i) => (
          <img key={`${u}-${i}`} src={u} alt="" loading="lazy" />
        ))}
      </div>
    );
  }
  return (
    <div className="cover" style={style} aria-hidden>
      {images.length ? <img src={images[0]} alt="" loading="lazy" /> : <Icon size={size * 0.42} />}
    </div>
  );
}

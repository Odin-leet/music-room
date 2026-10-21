import type { IconType } from 'react-icons';

type Props = {
  icon: IconType;
  // What it does, for screen readers and the tooltip ("Remove Get Lucky").
  label: string;
  onClick: () => void;
  variant?: 'plain' | 'tonal' | 'filled';
  size?: number;
  disabled?: boolean;
  className?: string;
};

// A round icon-only button (play, next, remove, move…).
export function IconButton({ icon: Icon, label, onClick, variant = 'plain', size = 40, disabled = false, className }: Props) {
  return (
    <button
      type="button"
      className={['icon-btn', variant !== 'plain' && variant, className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      <Icon size={size * 0.5} aria-hidden />
    </button>
  );
}

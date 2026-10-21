import type { IconType } from 'react-icons';

type Props = {
  title: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: IconType;
  size?: 'md' | 'sm';
  // Shows a spinner and blocks clicks — prevents double-submitting forms.
  loading?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
  block?: boolean;
};

export function Button({ title, onClick, variant = 'primary', icon: Icon, size = 'md', loading = false, disabled = false, type = 'button', block = false }: Props) {
  const cls = ['btn', `btn-${variant}`, size === 'sm' && 'btn-sm', block && 'btn-block', loading && 'busy'].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled || loading} aria-busy={loading || undefined}>
      {loading ? <span className="spinner" aria-hidden /> : Icon ? <Icon size={size === 'sm' ? 16 : 20} aria-hidden /> : null}
      <span>{title}</span>
    </button>
  );
}

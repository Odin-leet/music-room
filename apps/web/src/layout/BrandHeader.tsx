import wordmark from '@/assets/wordmark-light.png';

// The HOLY wordmark, then what this page does.
export function BrandHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="brand-header">
      <img src={wordmark} alt="HOLY" />
      <h1 className="title">{title}</h1>
      {subtitle ? <p className="muted">{subtitle}</p> : null}
    </div>
  );
}

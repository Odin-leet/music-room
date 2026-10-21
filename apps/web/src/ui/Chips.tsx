import { useId } from 'react';

type Option<T extends string | number> = { value: T; label: string };

// Pick exactly one of a few options (e.g. Public / Private).
export function ChoiceChips<T extends string | number>(props: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  // Optional line under the chips explaining the current choice.
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <span className="field-label" id={id}>
        {props.label}
      </span>
      <div className="chips" role="radiogroup" aria-labelledby={id}>
        {props.options.map((o) => {
          const selected = o.value === props.value;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`chip${selected ? ' selected' : ''}`}
              onClick={() => props.onChange(o.value)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {props.hint ? <span className="muted">{props.hint}</span> : null}
    </div>
  );
}

// Pick any number of options (e.g. music genres). Click to toggle.
export function MultiChips<T extends string>(props: {
  label: string;
  options: Option<T>[];
  values: T[];
  onChange: (values: T[]) => void;
}) {
  const id = useId();
  const toggle = (v: T) => props.onChange(props.values.includes(v) ? props.values.filter((x) => x !== v) : [...props.values, v]);
  return (
    <div className="field">
      <span className="field-label" id={id}>
        {props.label}
      </span>
      <div className="chips" role="group" aria-labelledby={id}>
        {props.options.map((o) => {
          const selected = props.values.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              role="checkbox"
              aria-checked={selected}
              className={`chip${selected ? ' selected' : ''}`}
              onClick={() => toggle(o.value)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { useId, useState, type InputHTMLAttributes, type Ref } from 'react';
import { IoEyeOffOutline, IoEyeOutline } from 'react-icons/io5';
import { IconButton } from './IconButton';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  // Shown under the field and turns the border red, e.g. an API 400/409 message.
  error?: string;
  // A password: hidden, with a show / hide button.
  secure?: boolean;
  multiline?: boolean;
  ref?: Ref<HTMLInputElement>;
};

export function TextField({ label, error, secure = false, multiline = false, onChangeText, ref, ...inputProps }: Props) {
  const id = useId();
  const errorId = `${id}-error`;
  const [shown, setShown] = useState(false);
  const common = {
    id,
    className: `input${error ? ' invalid' : ''}`,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId : undefined,
  };

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {multiline ? (
        <textarea
          {...common}
          value={inputProps.value}
          placeholder={inputProps.placeholder}
          maxLength={inputProps.maxLength}
          onChange={(e) => onChangeText(e.target.value)}
        />
      ) : secure ? (
        <div className="password-wrap">
          <input {...inputProps} {...common} ref={ref} type={shown ? 'text' : 'password'} onChange={(e) => onChangeText(e.target.value)} />
          <IconButton
            icon={shown ? IoEyeOffOutline : IoEyeOutline}
            label={shown ? 'Hide password' : 'Show password'}
            size={40}
            onClick={() => setShown((s) => !s)}
          />
        </div>
      ) : (
        <input {...inputProps} {...common} ref={ref} onChange={(e) => onChangeText(e.target.value)} />
      )}
      {error ? (
        <span id={errorId} className="error">
          {error}
        </span>
      ) : null}
    </div>
  );
}

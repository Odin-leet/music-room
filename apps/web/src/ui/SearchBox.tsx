import { IoCloseCircle, IoSearch } from 'react-icons/io5';
import { Spinner } from './Bits';
import { IconButton } from './IconButton';

// The rounded search field (people, tracks).
export function SearchBox(props: { value: string; onChange: (v: string) => void; placeholder: string; busy?: boolean; autoFocus?: boolean }) {
  return (
    <form className="search-box" role="search" onSubmit={(e) => e.preventDefault()}>
      <IoSearch size={18} aria-hidden />
      <input
        type="search"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        aria-label={props.placeholder}
        autoComplete="off"
        spellCheck={false}
        autoFocus={props.autoFocus}
      />
      {props.busy ? <Spinner /> : null}
      {props.value ? <IconButton icon={IoCloseCircle} label="Clear the search" size={36} onClick={() => props.onChange('')} /> : null}
    </form>
  );
}

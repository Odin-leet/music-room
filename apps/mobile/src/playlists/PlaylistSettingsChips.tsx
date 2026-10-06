import type { PlaylistLicense, PlaylistVisibility } from '@music-room/shared';
import { ChoiceChips } from '@/ui';
import { PLAYLIST_LICENSE_HINT, PLAYLIST_LICENSE_LABEL, VISIBILITY_HINT } from './labels';

// Who can find it / who can edit. Used by "New playlist" and the owner's settings.
export function PlaylistSettingsChips(props: {
  visibility: PlaylistVisibility;
  license: PlaylistLicense;
  onVisibility: (v: PlaylistVisibility) => void;
  onLicense: (l: PlaylistLicense) => void;
}) {
  return (
    <>
      <ChoiceChips
        label="Who can find it"
        value={props.visibility}
        onChange={props.onVisibility}
        options={[
          { value: 'public', label: 'Public' },
          { value: 'private', label: 'Private' },
        ]}
        hint={VISIBILITY_HINT[props.visibility]}
      />
      <ChoiceChips
        label="Who can edit"
        value={props.license}
        onChange={props.onLicense}
        options={(['open', 'invited'] as const).map((v) => ({ value: v, label: PLAYLIST_LICENSE_LABEL[v] }))}
        hint={PLAYLIST_LICENSE_HINT[props.license]}
      />
    </>
  );
}

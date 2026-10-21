import type { EventLicense, EventView, EventVisibility } from '@music-room/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { noErrors, toFormErrors } from '@/api/formErrors';
import { LICENSE_HINT, LICENSE_LABEL } from '@/events/labels';
import { getCurrentCoords, LocationError } from '@/events/location';
import { VISIBILITY_HINT } from '@/playlists/labels';
import { useSession } from '@/session/SessionProvider';
import { Button, ChoiceChips, Page, PageHeader, TextField } from '@/ui';

export const RADII = [50, 200, 500, 2000] as const;
export const HOURS = [1, 3, 6, 24] as const;
export const radiusLabel = (r: number) => (r >= 1000 ? `${r / 1000} km` : `${r} m`);

export function NewEventPage() {
  const { authedApi } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<EventVisibility>('public');
  const [license, setLicense] = useState<EventLicense>('open');
  const [radiusM, setRadiusM] = useState<(typeof RADII)[number]>(200);
  const [hours, setHours] = useState<(typeof HOURS)[number]>(3);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState(noErrors);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setErrors(noErrors);
    try {
      // Geo events: the area is centred on where you are now, and voting
      // opens now for the chosen number of hours.
      let geo = {};
      if (license === 'geo') {
        const here = await getCurrentCoords();
        const now = Date.now();
        geo = {
          geoLat: here.lat,
          geoLng: here.lng,
          geoRadiusM: radiusM,
          startsAt: new Date(now).toISOString(),
          endsAt: new Date(now + hours * 3600_000).toISOString(),
        };
      }
      const event = await authedApi<EventView>('/events', {
        method: 'POST',
        body: { name: name.trim(), description: description.trim(), visibility, license, ...geo },
      });
      navigate(`/events/${event.id}`, { replace: true });
    } catch (err) {
      setErrors(err instanceof LocationError ? { fields: {}, form: err.message } : toFormErrors(err));
      setSubmitting(false);
    }
  };

  return (
    <Page narrow>
      <PageHeader back="/events" title="New event" />
      <form className="stack" onSubmit={(e) => void submit(e)} noValidate>
        <TextField label="Name" placeholder="Friday party" value={name} onChangeText={setName} error={errors.fields.name} maxLength={100} autoFocus />
        <TextField label="Description (optional)" placeholder="What's the vibe?" value={description} onChangeText={setDescription} error={errors.fields.description} maxLength={500} />
        <ChoiceChips
          label="Who can find it"
          value={visibility}
          onChange={setVisibility}
          options={[
            { value: 'public', label: 'Public' },
            { value: 'private', label: 'Private' },
          ]}
          hint={VISIBILITY_HINT[visibility]}
        />
        <ChoiceChips
          label="Who can vote"
          value={license}
          onChange={setLicense}
          options={(['open', 'invited', 'geo'] as const).map((v) => ({ value: v, label: LICENSE_LABEL[v] }))}
          hint={LICENSE_HINT[license]}
        />
        {license === 'geo' ? (
          <>
            <ChoiceChips label="Distance from you" value={radiusM} onChange={setRadiusM} options={RADII.map((r) => ({ value: r, label: radiusLabel(r) }))} />
            <ChoiceChips
              label="Voting window"
              value={hours}
              onChange={setHours}
              options={HOURS.map((h) => ({ value: h, label: `${h} h` }))}
              hint="Starts now. The area is centred on your current location (your browser will ask)."
            />
          </>
        ) : null}
        {errors.form ? <p className="error">{errors.form}</p> : null}
        <Button type="submit" title="Create event" loading={submitting} disabled={!name.trim()} block />
      </form>
    </Page>
  );
}

import type { EventLicense, EventView, EventVisibility } from '@music-room/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { noErrors, toFormErrors } from '@/api/formErrors';
import { LICENSE_HINT, LICENSE_LABEL } from '@/events/labels';
import { getCurrentCoords, LocationError } from '@/events/location';
import { useSession } from '@/session/SessionProvider';
import { Button, ChoiceChips, Screen, Text, TextField, ScreenHeader } from '@/ui';

const RADII = [50, 200, 500, 2000] as const;
const HOURS = [1, 3, 6, 24] as const;

export default function NewEventScreen() {
  const { authedApi } = useSession();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<EventVisibility>('public');
  const [license, setLicense] = useState<EventLicense>('open');
  const [radiusM, setRadiusM] = useState<(typeof RADII)[number]>(200);
  const [hours, setHours] = useState<(typeof HOURS)[number]>(3);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState(noErrors);

  const submit = async () => {
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
      router.replace({ pathname: '/events/[id]', params: { id: event.id } });
    } catch (err) {
      setErrors(err instanceof LocationError ? { fields: {}, form: err.message } : toFormErrors(err));
      setSubmitting(false);
    }
  };

  return (
    <Screen form>
      <ScreenHeader back title="New event" />
      <TextField
        label="Name"
        placeholder="Friday party"
        value={name}
        onChangeText={setName}
        error={errors.fields.name}
        maxLength={100}
      />
      <TextField
        label="Description (optional)"
        placeholder="What's the vibe?"
        value={description}
        onChangeText={setDescription}
        error={errors.fields.description}
        maxLength={500}
      />
      <ChoiceChips
        label="Who can find it"
        value={visibility}
        onChange={setVisibility}
        options={[
          { value: 'public', label: 'Public' },
          { value: 'private', label: 'Private' },
        ]}
        hint={visibility === 'public' ? 'Listed for everyone.' : 'Hidden. People join with the invite code.'}
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
          <ChoiceChips
            label="Distance from you"
            value={radiusM}
            onChange={setRadiusM}
            options={RADII.map((r) => ({ value: r, label: r >= 1000 ? `${r / 1000} km` : `${r} m` }))}
          />
          <ChoiceChips
            label="Voting window"
            value={hours}
            onChange={setHours}
            options={HOURS.map((h) => ({ value: h, label: `${h} h` }))}
            hint="Starts now. The area is centred on your current location."
          />
        </>
      ) : null}

      {errors.form ? <Text variant="error">{errors.form}</Text> : null}
      <Button title="Create event" loading={submitting} disabled={!name.trim()} onPress={() => void submit()} />
    </Screen>
  );
}

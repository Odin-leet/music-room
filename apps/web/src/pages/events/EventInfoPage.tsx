import type { EventLicense, EventView, EventVisibility } from '@music-room/shared';
import { useCallback, useEffect, useState } from 'react';
import { IoSettingsOutline, IoTrashOutline } from 'react-icons/io5';
import { useNavigate, useParams } from 'react-router';
import { ApiError } from '@/api/client';
import { noErrors, toFormErrors } from '@/api/formErrors';
import { DENY_MESSAGE, eventSubtitle, LICENSE_HINT, LICENSE_LABEL } from '@/events/labels';
import { getCurrentCoords, LocationError, type Coords } from '@/events/location';
import { VISIBILITY_HINT } from '@/playlists/labels';
import { useSession } from '@/session/SessionProvider';
import { Button, Card, CardTitle, ChoiceChips, Page, PageHeader, PageStatus, TextField, useDialogs } from '@/ui';
import { InviteByEmail, InviteCodeCard } from '@/pages/shared/InviteCards';
import { HOURS, RADII, radiusLabel } from './NewEventPage';

// Event details: who can vote, invite code, invites, settings, delete.
export function EventInfoPage() {
  const { id = '' } = useParams();
  const { authedApi } = useSession();
  const { confirm } = useDialogs();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Geo events: participation depends on where you are.
  const [coords, setCoords] = useState<Coords | null>(null);

  const load = useCallback(
    async (at: Coords | null = coords) => {
      try {
        setEvent(await authedApi<EventView>(`/events/${id}${at ? `?lat=${at.lat}&lng=${at.lng}` : ''}`));
        setLoadError(null);
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : 'Could not load the event');
      }
    },
    [authedApi, id, coords],
  );

  useEffect(() => {
    let cancelled = false;
    authedApi<EventView>(`/events/${id}`).then(
      (e) => !cancelled && setEvent(e),
      (err: unknown) => !cancelled && setLoadError(err instanceof ApiError ? err.message : 'Could not load the event'),
    );
    return () => {
      cancelled = true;
    };
  }, [authedApi, id]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setNotice(err instanceof LocationError || err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  if (!event) return <PageStatus error={loadError} back={`/events/${id}`} />;
  const isOwner = event.myRole === 'owner';

  const remove = async () => {
    const ok = await confirm({ title: 'Delete event?', message: `“${event.name}” and its queue will be removed for everyone.`, confirm: 'Delete', destructive: true });
    if (!ok) return;
    void run(async () => {
      await authedApi(`/events/${event.id}`, { method: 'DELETE' });
      navigate('/events', { replace: true });
    });
  };

  return (
    <Page narrow>
      <PageHeader back={`/events/${event.id}`} title={event.name} subtitle={`${eventSubtitle(event)} · by ${event.owner.displayName}`} />
      {event.description ? <p>{event.description}</p> : null}

      <Card>
        <p>{LICENSE_HINT[event.license]}</p>
        {event.participation.allowed ? (
          <p className="success">You can vote and suggest tracks.</p>
        ) : (
          <p className="error">{DENY_MESSAGE[event.participation.reason]}</p>
        )}
        {event.license === 'geo' && event.geo ? (
          <>
            <p className="muted">
              Within {radiusLabel(event.geo.radiusM)} · {new Date(event.geo.startsAt).toLocaleString()} → {new Date(event.geo.endsAt).toLocaleString()}
            </p>
            <Button
              title={coords ? 'Check my location again' : 'Share my location'}
              variant="secondary"
              size="sm"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  const here = await getCurrentCoords();
                  setCoords(here);
                  await load(here);
                })
              }
            />
          </>
        ) : null}
      </Card>

      {!event.myRole ? (
        <Button
          title="Join this event"
          loading={busy}
          onClick={() => void run(async () => setEvent(await authedApi<EventView>(`/events/${event.id}/join`, { method: 'POST' })))}
        />
      ) : null}

      {event.inviteCode ? <InviteCodeCard code={event.inviteCode} message={`Join “${event.name}” on HOLY with the code ${event.inviteCode}`} /> : null}
      {isOwner ? <InviteByEmail path={`/events/${event.id}/invites`} onInvited={() => void load()} /> : null}
      {isOwner ? <EventSettings event={event} onSaved={setEvent} /> : null}

      {notice ? <p className="error">{notice}</p> : null}
      {isOwner ? <Button title="Delete event" icon={IoTrashOutline} variant="danger" onClick={() => void remove()} /> : null}
    </Page>
  );
}

// Owner only: name, description, who can find it, who can vote. Switching
// to "On site, on time" centres the area on where you are now, like creating.
function EventSettings({ event, onSaved }: { event: EventView; onSaved: (e: EventView) => void }) {
  const { authedApi } = useSession();
  const [name, setName] = useState(event.name);
  const [description, setDescription] = useState(event.description);
  const [visibility, setVisibility] = useState<EventVisibility>(event.visibility);
  const [license, setLicense] = useState<EventLicense>(event.license);
  const [radiusM, setRadiusM] = useState<(typeof RADII)[number]>(200);
  const [hours, setHours] = useState<(typeof HOURS)[number]>(3);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState(noErrors);
  const [saved, setSaved] = useState(false);

  const toGeo = license === 'geo' && event.license !== 'geo';
  const changed = name.trim() !== event.name || description.trim() !== event.description || visibility !== event.visibility || license !== event.license;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !changed || saving) return;
    setSaving(true);
    setErrors(noErrors);
    setSaved(false);
    try {
      let geo = {};
      if (toGeo) {
        const here = await getCurrentCoords();
        const now = Date.now();
        geo = { geoLat: here.lat, geoLng: here.lng, geoRadiusM: radiusM, startsAt: new Date(now).toISOString(), endsAt: new Date(now + hours * 3600_000).toISOString() };
      }
      onSaved(
        await authedApi<EventView>(`/events/${event.id}`, {
          method: 'PATCH',
          body: { name: name.trim(), description: description.trim(), visibility, license, ...geo },
        }),
      );
      setSaved(true);
    } catch (err) {
      setErrors(err instanceof LocationError ? { fields: {}, form: err.message } : toFormErrors(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card roomy>
      <CardTitle icon={IoSettingsOutline} title="Settings" />
      <form className="stack" onSubmit={(e) => void save(e)} noValidate>
        <TextField label="Name" value={name} onChangeText={setName} error={errors.fields.name} maxLength={100} />
        <TextField label="Description" value={description} onChangeText={setDescription} error={errors.fields.description} maxLength={500} />
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
        {toGeo ? (
          <>
            <ChoiceChips label="Distance from you" value={radiusM} onChange={setRadiusM} options={RADII.map((r) => ({ value: r, label: radiusLabel(r) }))} />
            <ChoiceChips label="Voting window" value={hours} onChange={setHours} options={HOURS.map((h) => ({ value: h, label: `${h} h` }))} hint="Starts now, centred on your current location." />
          </>
        ) : null}
        {errors.form ? <p className="error">{errors.form}</p> : null}
        {saved && !changed ? <p className="success">Saved.</p> : null}
        <Button type="submit" title="Save settings" variant="secondary" loading={saving} disabled={!name.trim() || !changed} />
      </form>
    </Card>
  );
}

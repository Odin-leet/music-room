import type { BroadcastTrack } from '@music-room/shared';
import { IoMusicalNotesOutline, IoPause, IoPlay, IoPlaySkipForward, IoVolumeHigh } from 'react-icons/io5';
import { toPlayerTrack, usePlayer } from '@/player/PlayerProvider';
import { Button, Cover, IconButton } from '@/ui';

type Props = {
  event: { id: string; name: string };
  nowPlaying: BroadcastTrack | null;
  queueLength: number;
  isOwner: boolean;
};

// The top of a party's page: what's playing for everyone. In the owner's
// browser it's also the speaker's controls — the audio itself lives in the
// app-wide player, so it keeps playing (and moving the queue on) whichever
// page the owner goes to.
export function NowPlayingCard({ event, nowPlaying, queueLength, isOwner }: Props) {
  const p = usePlayer();
  const source = { kind: 'event' as const, id: event.id, name: event.name };
  const playingHere = isOwner && p.source?.kind === 'event' && p.source.id === event.id && !!p.track;
  const track = playingHere ? p.track : nowPlaying;

  if (!track) {
    return (
      <div className="now-playing">
        <div className="row">
          <IoMusicalNotesOutline size={28} color="var(--accent)" aria-hidden />
          <p className="muted grow">{isOwner ? 'Nothing is playing yet. This browser is the speaker.' : 'Nothing is playing yet.'}</p>
        </div>
        {isOwner ? (
          <Button
            title={queueLength ? 'Start the party' : 'Add tracks first'}
            icon={IoPlay}
            size="sm"
            disabled={!queueLength}
            loading={p.busy}
            onClick={() => p.playEvent(source, null)}
          />
        ) : null}
      </div>
    );
  }

  const progress = playingHere && p.durationSec ? Math.min(1, p.positionSec / p.durationSec) : 0;
  return (
    <div className="now-playing">
      <span className="now-playing-label">Now playing{isOwner ? ' · this browser is the speaker' : ''}</span>
      <div className="row" style={{ gap: 'var(--lg)' }}>
        <Cover uri={track.coverUrl} size={96} />
        <div className="stack-xs grow">
          <h2 className="heading clamp-2">{track.title}</h2>
          <p className="muted ellipsis">{track.artist}</p>
          {nowPlaying?.suggestedBy ? <p className="caption">Suggested by {nowPlaying.suggestedBy.displayName}</p> : null}
        </div>
      </div>

      {isOwner ? (
        playingHere ? (
          <>
            <div className="progress" role="progressbar" aria-label="Track progress" aria-valuemin={0} aria-valuemax={p.durationSec} aria-valuenow={p.positionSec}>
              <div style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="row between">
              <span className="caption">
                {p.positionSec}s / {p.durationSec}s{p.buffering ? ' · buffering…' : ''}
              </span>
              <div className="row">
                <IconButton icon={p.playing ? IoPause : IoPlay} label={p.playing ? 'Pause' : 'Resume'} variant="filled" size={52} onClick={p.togglePause} />
                <IconButton icon={IoPlaySkipForward} label="Next track" variant="tonal" size={44} disabled={p.busy} onClick={p.next} />
              </div>
            </div>
          </>
        ) : (
          // "Playing" for the party, but not in this browser (e.g. after a reload).
          <Button title="Play it in this browser" icon={IoVolumeHigh} size="sm" onClick={() => p.playEvent(source, toPlayerTrack(track))} />
        )
      ) : null}
      {playingHere && p.error ? <p className="error">{p.error}</p> : null}
    </div>
  );
}

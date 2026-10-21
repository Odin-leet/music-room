import { IoPause, IoPlay, IoPlaySkipForward, IoVolumeHigh, IoVolumeLow, IoVolumeMute } from 'react-icons/io5';
import { Link } from 'react-router';
import { Cover, IconButton } from '@/ui';
import { usePlayer } from './PlayerProvider';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// At the bottom of every page while something plays (above the tabs on a
// phone): what plays, from where (click to open it), play / pause / next.
export function PlayerBar() {
  const p = usePlayer();
  if (!p.source || !p.track) return null;
  const { source, track } = p;
  const to = source.kind === 'event' ? `/events/${source.id}` : `/playlists/${source.id}`;
  const progress = p.durationSec ? Math.min(1, p.positionSec / p.durationSec) : 0;
  const VolumeIcon = p.volume === 0 ? IoVolumeMute : p.volume < 0.5 ? IoVolumeLow : IoVolumeHigh;

  return (
    <div className="player" role="region" aria-label="Player">
      <div className="player-top-progress" aria-hidden>
        <div style={{ width: `${progress * 100}%` }} />
      </div>
      <Link to={to} className="player-track" aria-label={`Now playing ${track.title}. Open ${source.name}`}>
        <Cover uri={track.coverUrl} size={44} />
        <span className="list-item-text">
          <span className="list-item-title">{track.title}</span>
          <span className="muted ellipsis">
            {track.artist} · {source.kind === 'event' ? 'party' : 'playlist'} {source.name}
          </span>
        </span>
      </Link>

      <div className="player-center">
        <div className="player-controls">
          <IconButton icon={p.playing ? IoPause : IoPlay} label={p.playing ? 'Pause' : 'Play'} variant="filled" size={40} onClick={p.togglePause} />
          <IconButton icon={IoPlaySkipForward} label="Next track" size={36} disabled={p.busy} onClick={p.next} />
        </div>
        <div className="player-time">
          <span>{clock(p.positionSec)}</span>
          <div className="progress" role="progressbar" aria-label="Track progress" aria-valuemin={0} aria-valuemax={p.durationSec} aria-valuenow={p.positionSec}>
            <div style={{ width: `${progress * 100}%` }} />
          </div>
          <span>{clock(p.durationSec)}</span>
        </div>
      </div>

      <div className="player-right">
        {p.error ? <span className="error ellipsis">{p.error}</span> : p.buffering ? <span className="caption">buffering…</span> : null}
        <IconButton icon={VolumeIcon} label={p.volume === 0 ? 'Unmute' : 'Mute'} size={32} onClick={() => p.setVolume(p.volume === 0 ? 0.8 : 0)} />
        <input
          className="volume"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={p.volume}
          onChange={(e) => p.setVolume(Number(e.target.value))}
          aria-label="Volume"
        />
      </div>
    </div>
  );
}

import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import type { TrackPreview, TrackSummary } from '@music-room/shared';

const DEEZER = 'https://api.deezer.com';

// The subset of Deezer's track JSON we use.
type DeezerTrack = {
  id: number;
  title: string;
  duration: number;
  isrc?: string;
  preview?: string;
  readable?: boolean;
  artist: { name: string };
  album: { title: string; cover_medium?: string };
};

// Deezer answers errors with HTTP 200 and an `error` object, e.g.
// { error: { type: 'DataException', message: 'no data', code: 800 } }.
type DeezerError = { error?: { type: string; message: string; code: number } };

// Music provider: Deezer's public API (search + 30 s previews, no API key).
// The app never calls Deezer directly — it goes through our API, so we can
// reshape, cache, and swap providers without touching the app.
@Injectable()
export class DeezerService {
  async search(query: string, limit = 20): Promise<TrackSummary[]> {
    const body = await this.get<{ data: DeezerTrack[] }>(
      `/search?${new URLSearchParams({ q: query, limit: String(limit) }).toString()}`,
    );
    // `readable: false` = not streamable in this region: no use to us.
    return body.data.filter((t) => t.readable !== false).map(toSummary);
  }

  // The server's own copy of a track's details: when someone suggests a
  // track we look it up here instead of trusting what the app sent.
  async track(providerTrackId: string): Promise<TrackSummary> {
    if (!/^\d{1,20}$/.test(providerTrackId)) throw new NotFoundException('Track not found');
    const track = await this.get<DeezerTrack>(`/track/${providerTrackId}`);
    if (track.readable === false) throw new NotFoundException('This track is not available');
    return toSummary(track);
  }

  // Preview links are signed and expire (~15 min), so they're never stored:
  // ask Deezer for a fresh one right before playing.
  async preview(providerTrackId: string): Promise<TrackPreview> {
    const track = await this.get<DeezerTrack>(`/track/${encodeURIComponent(providerTrackId)}`);
    if (!track.preview) throw new NotFoundException('This track has no preview');
    const exp = /exp=(\d+)/.exec(track.preview)?.[1];
    return {
      url: track.preview,
      expiresAt: new Date(exp ? Number(exp) * 1000 : Date.now() + 10 * 60_000).toISOString(),
    };
  }

  private async get<T>(path: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${DEEZER}${path}`, { signal: AbortSignal.timeout(8_000) });
    } catch {
      throw new BadGatewayException('Music provider unreachable');
    }
    const body = (await res.json()) as T & DeezerError;
    if (body.error) {
      // 800 = "no data" (unknown track id)
      if (body.error.code === 800) throw new NotFoundException('Track not found');
      throw new BadGatewayException(`Music provider error: ${body.error.message}`);
    }
    if (!res.ok) throw new BadGatewayException(`Music provider error (HTTP ${res.status})`);
    return body;
  }
}

function toSummary(t: DeezerTrack): TrackSummary {
  return {
    provider: 'deezer',
    providerTrackId: String(t.id),
    title: t.title,
    artist: t.artist.name,
    album: t.album.title,
    coverUrl: t.album.cover_medium ?? null,
    durationSec: t.duration,
    isrc: t.isrc ?? null,
  };
}

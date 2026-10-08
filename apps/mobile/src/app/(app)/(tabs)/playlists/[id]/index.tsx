import type { PlaylistTracksView, PlaylistTrackView, PlaylistView } from '@music-room/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { ApiError } from '@/api/client';
import { EDIT_DENY_MESSAGE, playlistSubtitle } from '@/playlists/labels';
import { DragList } from '@/playlists/DragList';
import { afterIdAt, guessPosition, sorted } from '@/playlists/order';
import { toPlayerTrack, usePlayer } from '@/player/PlayerProvider';
import { usePlaylistRealtime } from '@/playlists/usePlaylistRealtime';
import { useSession } from '@/session/SessionProvider';
import { colors, font, radius, spacing } from '@/theme';
import { Button, Cover, EmptyState, IconButton, LiveDot, Screen, ScreenHeader, Text } from '@/ui';

// A playlist's tracks: listen, and (if you can edit) add, remove and reorder.
// Every edit is shown at once, sent to the API, and confirmed by the
// server's answer and the live messages; other people's edits arrive live.
export default function PlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { authedApi } = useSession();
  const [playlist, setPlaylist] = useState<PlaylistView | null>(null);
  const [tracks, setTracks] = useState<PlaylistTrackView[] | null>(null);
  // What plays comes from the app-wide player: it keeps playing (and the ▶
  // stays on the right row) even after you leave this screen.
  const player = usePlayer();
  const playingHere = player.source?.kind === 'playlist' && player.source.id === id;
  const playingId = playingHere ? (player.track?.id ?? null) : null;
  const [error, setError] = useState<string | null>(null);

  const loadDetails = useCallback(async () => {
    setPlaylist(await authedApi<PlaylistView>(`/playlists/${id}`));
  }, [authedApi, id]);

  const load = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([
        authedApi<PlaylistView>(`/playlists/${id}`),
        authedApi<PlaylistTracksView>(`/playlists/${id}/tracks`),
      ]);
      setPlaylist(p);
      setTracks(t.tracks);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the playlist');
    }
  }, [authedApi, id]);

  // Back from Info / Add: details may have changed, and a reload is cheap.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // ---------- applying changes (mine and everyone else's) ----------

  const upsert = (track: PlaylistTrackView) =>
    setTracks((list) => (list ? sorted([...list.filter((t) => t.id !== track.id), track]) : list));
  const setPosition = (trackId: string, position: string) =>
    setTracks((list) => (list ? sorted(list.map((t) => (t.id === trackId ? { ...t, position } : t))) : list));
  const drop = (trackId: string) => setTracks((list) => (list ? list.filter((t) => t.id !== trackId) : list));

  const realtime = usePlaylistRealtime(id, {
    onAdded: upsert,
    onMoved: setPosition,
    onRemoved: drop,
    onUpdated: () => void loadDetails().catch(() => undefined),
    onGone: (why) => {
      if (playingHere) player.stop();
      Alert.alert(why === 'deleted' ? 'Playlist deleted' : 'No access', 'This playlist is no longer available.');
      router.dismissTo('/playlists');
    },
    onJoined: () => void load(),
  });

  // Something went wrong (e.g. a 409 because the neighbour just moved or
  // vanished): say it, and take the server's list as the truth.
  const recover = (err: unknown, fallback: string) => {
    setError(err instanceof ApiError ? err.message : fallback);
    void load();
  };

  // `list` is the new order with the moved track at `to`.
  const commitMove = (list: PlaylistTrackView[], to: number) => {
    const moved = list[to];
    const guess = guessPosition(list[to - 1], list[to + 1]);
    setTracks(guess ? list.map((t) => (t.id === moved.id ? { ...t, position: guess } : t)) : list);
    setError(null);
    authedApi<PlaylistTrackView>(`/playlists/${id}/tracks/${moved.id}`, {
      method: 'PATCH',
      body: { afterId: afterIdAt(list, to) },
    }).then(
      (res) => setPosition(res.id, res.position),
      (err: unknown) => recover(err, 'Could not move the track'),
    );
  };

  const moveBy = (from: number, delta: -1 | 1) => {
    if (!tracks) return;
    const to = from + delta;
    if (to < 0 || to >= tracks.length) return;
    moveTo(from, to);
  };

  const remove = (track: PlaylistTrackView) => {
    drop(track.id);
    setError(null);
    authedApi(`/playlists/${id}/tracks/${track.id}`, { method: 'DELETE' }).catch((err: unknown) =>
      recover(err, 'Could not remove the track'),
    );
  };

  if (!playlist || !tracks) {
    return (
      <Screen centered>
        <Text variant={error ? 'error' : 'muted'}>{error ?? 'Loading…'}</Text>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const canEdit = playlist.canEdit.allowed;
  const play = (t: PlaylistTrackView) =>
    player.playPlaylist({ kind: 'playlist', id: playlist.id, name: playlist.name }, toPlayerTrack(t));

  const moveTo = (from: number, to: number) => {
    const list = [...tracks];
    const [t] = list.splice(from, 1);
    list.splice(to, 0, t);
    commitMove(list, to);
  };

  const renderRow = (item: PlaylistTrackView, index: number) => {
    const playing = item.id === playingId;
    return (
      <View style={styles.row}>
        <Pressable
          style={styles.rowMain}
          onPress={() => play(item)}
          accessibilityRole="button"
          accessibilityLabel={`${index + 1}. ${item.title} by ${item.artist}. ${playing ? 'Playing' : 'Tap to play'}`}
        >
          <View style={styles.index}>
            {playing ? (
              <Ionicons name="stats-chart" size={14} color={colors.accent} />
            ) : (
              <Text variant="caption">{index + 1}</Text>
            )}
          </View>
          <Cover uri={item.coverUrl} size={44} />
          <View style={styles.rowText}>
            <Text numberOfLines={1} style={playing && styles.playing}>
              {item.title}
            </Text>
            <Text variant="caption" numberOfLines={1}>
              {item.artist}
              {item.addedBy ? ` · ${item.addedBy.displayName}` : ''}
            </Text>
          </View>
        </Pressable>
        {canEdit ? (
          <View style={styles.tools}>
            <IconButton icon="chevron-up" label={`Move ${item.title} up`} size={30} disabled={index === 0} onPress={() => moveBy(index, -1)} />
            <IconButton
              icon="chevron-down"
              label={`Move ${item.title} down`}
              size={30}
              disabled={index === tracks.length - 1}
              onPress={() => moveBy(index, 1)}
            />
            <IconButton
              icon="close"
              label={`Remove ${item.title}`}
              size={30}
              onPress={() =>
                Alert.alert('Remove track?', `"${item.title}" will be removed for everyone.`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => remove(item) },
                ])
              }
            />
          </View>
        ) : null}
      </View>
    );
  };

  const addTracks = () => router.push({ pathname: '/playlists/[id]/add', params: { id: playlist.id } });

  return (
    <Screen>
      <ScreenHeader
        back
        title={playlist.name}
        subtitle={`by ${playlist.owner.displayName}`}
        right={
          <>
            <LiveDot status={realtime} />
            <IconButton
              icon="information-circle-outline"
              label="Playlist info and invite"
              onPress={() => router.push({ pathname: '/playlists/[id]/info', params: { id: playlist.id } })}
            />
          </>
        }
      />

      <View style={styles.hero}>
        <Cover uris={tracks.slice(0, 4).map((t) => t.coverUrl)} uri={tracks[0]?.coverUrl} size={112} icon="musical-notes" />
        <View style={styles.heroText}>
          <Text variant="muted" numberOfLines={2}>
            {playlistSubtitle({ ...playlist, trackCount: tracks.length })}
          </Text>
          <View style={styles.heroButtons}>
            {tracks.length ? (
              <IconButton
                icon={playingHere && player.playing ? 'pause' : 'play'}
                label={playingHere ? (player.playing ? 'Pause' : 'Resume') : 'Play from the top'}
                variant="filled"
                size={52}
                onPress={() => (playingHere ? player.togglePause() : play(tracks[0]))}
              />
            ) : null}
            {canEdit ? <Button title="Add" icon="add" size="sm" variant="secondary" onPress={addTracks} /> : null}
          </View>
        </View>
      </View>

      {canEdit ? null : (
        <View style={styles.notice}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
          <Text variant="muted" style={styles.flex}>
            {EDIT_DENY_MESSAGE[playlist.canEdit.reason]}
          </Text>
        </View>
      )}
      {error ? <Text variant="error">{error}</Text> : null}

      <View style={styles.flex}>
        <DragList
          items={tracks}
          keyOf={(t) => t.id}
          renderRow={renderRow}
          enabled={canEdit}
          onMove={moveTo}
          empty={
            <EmptyState
              icon="musical-notes-outline"
              title="No tracks yet"
              text={canEdit ? 'Add the first one — everyone here will see it live.' : 'Tracks will show up here.'}
              action={canEdit ? 'Add tracks' : undefined}
              onAction={addTracks}
            />
          }
        />
      </View>
      {canEdit && tracks.length > 1 ? (
        <Text variant="caption" style={styles.hint}>
          Tap a track to play it · drag the handle, or use the arrows, to reorder
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  heroText: { flex: 1, gap: spacing.md },
  heroButtons: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingRight: spacing.xs },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  index: { width: 20, alignItems: 'center' },
  rowText: { flex: 1 },
  playing: { color: colors.accent, fontWeight: font.weight.bold },
  tools: { flexDirection: 'row' },
  hint: { textAlign: 'center' },
});

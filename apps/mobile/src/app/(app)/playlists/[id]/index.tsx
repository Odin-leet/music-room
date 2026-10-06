import type { PlaylistTracksView, PlaylistTrackView, PlaylistView } from '@music-room/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { ApiError } from '@/api/client';
import { EDIT_DENY_MESSAGE, playlistSubtitle } from '@/playlists/labels';
import { DragList } from '@/playlists/DragList';
import { afterIdAt, guessPosition, sorted } from '@/playlists/order';
import { PlaylistPlayer } from '@/playlists/PlaylistPlayer';
import { usePlaylistRealtime } from '@/playlists/usePlaylistRealtime';
import { useSession } from '@/session/SessionProvider';
import { colors, font, radius, spacing } from '@/theme';
import { Button, Screen, Text } from '@/ui';

const STATUS_LABEL = { connecting: 'connecting…', live: '● live', offline: 'offline' } as const;

// A playlist's tracks: listen, and (if you can edit) add, remove and reorder.
// Every edit is shown at once, sent to the API, and confirmed by the
// server's answer and the live messages; other people's edits arrive live.
export default function PlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { authedApi } = useSession();
  const [playlist, setPlaylist] = useState<PlaylistView | null>(null);
  const [tracks, setTracks] = useState<PlaylistTrackView[] | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
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
      setPlayingId(null);
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
          onPress={() => setPlayingId(item.id)}
          accessibilityRole="button"
          accessibilityLabel={`${index + 1}. ${item.title} by ${item.artist}. Tap to play`}
        >
          <Text variant="muted" style={styles.index}>
            {playing ? '▶' : index + 1}
          </Text>
          {item.coverUrl ? <Image source={{ uri: item.coverUrl }} style={styles.cover} /> : <View style={styles.cover} />}
          <View style={styles.rowText}>
            <Text numberOfLines={1} style={playing && styles.playing}>
              {item.title}
            </Text>
            <Text variant="muted" numberOfLines={1}>
              {item.artist}
              {item.addedBy ? ` · ${item.addedBy.displayName}` : ''}
            </Text>
          </View>
        </Pressable>
        {canEdit ? (
          <View style={styles.tools}>
            <IconButton label="▲" a11y={`Move ${item.title} up`} disabled={index === 0} onPress={() => moveBy(index, -1)} />
            <IconButton
              label="▼"
              a11y={`Move ${item.title} down`}
              disabled={index === tracks.length - 1}
              onPress={() => moveBy(index, 1)}
            />
            <IconButton
              label="✕"
              a11y={`Remove ${item.title}`}
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

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="title" numberOfLines={1}>
            {playlist.name}
          </Text>
          <Text variant="muted" numberOfLines={1}>
            {playlistSubtitle({ ...playlist, trackCount: tracks.length })} · {STATUS_LABEL[realtime]}
          </Text>
        </View>
        <Button
          title="Info"
          variant="secondary"
          onPress={() => router.push({ pathname: '/playlists/[id]/info', params: { id: playlist.id } })}
        />
      </View>

      <PlaylistPlayer tracks={tracks} playingId={playingId} onPlayingChange={setPlayingId} />

      {canEdit ? (
        <Button
          title="+ Add tracks"
          onPress={() => router.push({ pathname: '/playlists/[id]/add', params: { id: playlist.id } })}
        />
      ) : (
        <Text variant="muted">{EDIT_DENY_MESSAGE[playlist.canEdit.reason]}</Text>
      )}
      {error ? <Text variant="error">{error}</Text> : null}

      <View style={styles.flex}>
        <DragList
          items={tracks}
          keyOf={(t) => t.id}
          renderRow={renderRow}
          enabled={canEdit}
          onMove={moveTo}
          empty={<Text variant="muted">{canEdit ? 'No tracks yet. Add the first one!' : 'No tracks yet.'}</Text>}
        />
      </View>
      {canEdit && tracks.length > 1 ? (
        <Text variant="muted">Tap a track to play it · drag ≡, or use ▲ ▼, to reorder</Text>
      ) : null}
      <Button title="Back" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

function IconButton(props: { label: string; a11y: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={props.a11y}
      style={[styles.icon, props.disabled && styles.iconDisabled]}
    >
      <Text style={styles.iconText}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingRight: spacing.sm },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.xs },
  index: { width: 22, textAlign: 'center' },
  cover: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.border },
  rowText: { flex: 1 },
  playing: { color: colors.primary, fontWeight: font.weight.medium },
  tools: { flexDirection: 'row', gap: spacing.xs },
  icon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  iconDisabled: { opacity: 0.3 },
  iconText: { fontSize: font.size.sm },
});

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// ─── MMKV instance ────────────────────────────────────────────────────────────
export const storage = new MMKV({ id: "tunebase-storage" });

// ─── Zustand MMKV adapter ─────────────────────────────────────────────────────
const mmkvStorage = {
  getItem: (key) => storage.getString(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};

// ─── Player Store ─────────────────────────────────────────────────────────────
export const usePlayerStore = create(
  persist(
    (set, get) => ({
      // ── Queue & Track ──────────────────────────────────────────────────────
      queue: [], // full list of song objects currently loaded
      queueIndex: 0, // index of current track in queue
      currentTrack: null, // song object currently loaded

      setQueue: (songs, startIndex = 0) =>
        set({
          queue: songs,
          queueIndex: startIndex,
          currentTrack: songs[startIndex] ?? null,
        }),

      setCurrentTrack: (track) => set({ currentTrack: track }),

      nextTrack: () => {
        const { queue, queueIndex } = get();
        if (!queue.length) return;
        const next = (queueIndex + 1) % queue.length;
        set({ queueIndex: next, currentTrack: queue[next] });
      },

      prevTrack: () => {
        const { queue, queueIndex } = get();
        if (!queue.length) return;
        const prev = (queueIndex - 1 + queue.length) % queue.length;
        set({ queueIndex: prev, currentTrack: queue[prev] });
      },

      // ── Playback State ────────────────────────────────────────────────────
      isPlaying: false,
      positionMs: 0, // current playback position in ms
      durationMs: 0, // total duration in ms

      setIsPlaying: (val) => set({ isPlaying: val }),
      setPositionMs: (val) => set({ positionMs: val }),
      setDurationMs: (val) => set({ durationMs: val }),

      // ── Playback Modes ────────────────────────────────────────────────────
      shuffleOn: false,
      repeatMode: "off", // "off" | "all" | "one"

      toggleShuffle: () => set((s) => ({ shuffleOn: !s.shuffleOn })),
      cycleRepeat: () =>
        set((s) => ({
          repeatMode:
            s.repeatMode === "off"
              ? "all"
              : s.repeatMode === "all"
                ? "one"
                : "off",
        })),

      // ── Persisted Prefs (survive app restart) ─────────────────────────────
      themePref: "system", // "light" | "dark" | "system"
      eqEnabled: false,
      lastSongId: null, // resume where user left off
      lastPositionMs: 0,

      setThemePref: (val) => set({ themePref: val }),
      setEqEnabled: (val) => set({ eqEnabled: val }),
      setLastSongId: (val) => set({ lastSongId: val }),
      setLastPositionMs: (val) => set({ lastPositionMs: val }),

      // ── Library Cache (non-persisted, refreshed on mount) ─────────────────
      songs: [],
      playlists: [],
      recentSongs: [],

      setSongs: (val) => set({ songs: val }),
      setPlaylists: (val) => set({ playlists: val }),
      setRecentSongs: (val) => set({ recentSongs: val }),
    }),
    {
      name: "tunebase-player",
      storage: createJSONStorage(() => mmkvStorage),
      // only persist prefs + last position, not the full queue/library
      partialize: (s) => ({
        themePref: s.themePref,
        eqEnabled: s.eqEnabled,
        shuffleOn: s.shuffleOn,
        repeatMode: s.repeatMode,
        lastSongId: s.lastSongId,
        lastPositionMs: s.lastPositionMs,
      }),
    },
  ),
);

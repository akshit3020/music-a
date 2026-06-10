// store/useLibraryStore.js
import { create } from "zustand";
import {
    getAllPlaylists,
    getAllSongs,
    getFavoriteSongs,
    getRecentSongs,
    searchSongs,
} from "../lib/db";

export const useLibraryStore = create((set) => ({
  songs: [],
  recentSongs: [],
  favSongs: [],
  playlists: [],
  searchResults: [],
  isLoading: false,

  // ── Load everything from SQLite ──────────────────────────────────────────
  loadLibrary: () => {
    set({ isLoading: true });
    try {
      const songs = getAllSongs();
      const recent = getRecentSongs(20);
      const favorites = getFavoriteSongs();
      const playlists = getAllPlaylists();
      set({ songs, recentSongs: recent, favSongs: favorites, playlists });
    } finally {
      set({ isLoading: false });
    }
  },

  // ── Refresh individual slices ─────────────────────────────────────────────
  refreshSongs: () => set({ songs: getAllSongs() }),
  refreshRecent: () => set({ recentSongs: getRecentSongs(20) }),
  refreshFavorites: () => set({ favSongs: getFavoriteSongs() }),
  refreshPlaylists: () => set({ playlists: getAllPlaylists() }),

  // ── Search ────────────────────────────────────────────────────────────────
  search: (query) => {
    if (!query.trim()) return set({ searchResults: [] });
    set({ searchResults: searchSongs(query) });
  },
  clearSearch: () => set({ searchResults: [] }),
}));

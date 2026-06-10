import * as SQLite from "expo-sqlite";

// ─── Open DB ──────────────────────────────────────────────────────────────────
const db = SQLite.openDatabaseSync("tunebase.db");

// ─── Init Schema ─────────────────────────────────────────────────────────────
export function initDB() {
  db.execSync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS songs (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      artist      TEXT NOT NULL DEFAULT 'Unknown Artist',
      album       TEXT NOT NULL DEFAULT 'Unknown Album',
      uri         TEXT NOT NULL UNIQUE,
      duration    INTEGER,          -- milliseconds
      artwork_uri TEXT,
      date_added  INTEGER NOT NULL, -- unix timestamp
      play_count  INTEGER NOT NULL DEFAULT 0,
      is_favorite INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS playlist_songs (
      playlist_id TEXT NOT NULL,
      song_id     TEXT NOT NULL,
      position    INTEGER NOT NULL,
      PRIMARY KEY (playlist_id, song_id),
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (song_id)     REFERENCES songs(id)     ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS play_history (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id   TEXT NOT NULL,
      played_at INTEGER NOT NULL,
      FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
    );
  `);
}

// ─── Songs CRUD ───────────────────────────────────────────────────────────────

/** Insert multiple songs at once (from import). Skips duplicates by URI. */
export function insertSongs(songs) {
  const stmt = db.prepareSync(`
    INSERT OR IGNORE INTO songs (id, title, artist, album, uri, duration, artwork_uri, date_added)
    VALUES ($id, $title, $artist, $album, $uri, $duration, $artwork_uri, $date_added)
  `);
  try {
    db.withTransactionSync(() => {
      for (const s of songs) {
        stmt.executeSync({
          $id: s.id,
          $title: s.title,
          $artist: s.artist ?? "Unknown Artist",
          $album: s.album ?? "Unknown Album",
          $uri: s.uri,
          $duration: s.duration ?? null,
          $artwork_uri: s.artwork_uri ?? null,
          $date_added: s.date_added ?? Date.now(),
        });
      }
    });
  } finally {
    stmt.finalizeSync();
  }
}

/** Fetch all songs ordered by title. */
export function getAllSongs() {
  return db.getAllSync("SELECT * FROM songs ORDER BY title ASC");
}

/** Fetch recently added songs (last N). */
export function getRecentSongs(limit = 20) {
  return db.getAllSync("SELECT * FROM songs ORDER BY date_added DESC LIMIT ?", [
    limit,
  ]);
}

/** Fetch favorite songs. */
export function getFavoriteSongs() {
  return db.getAllSync(
    "SELECT * FROM songs WHERE is_favorite = 1 ORDER BY title ASC",
  );
}

/** Toggle favorite on a song. */
export function toggleFavorite(id) {
  db.runSync(
    "UPDATE songs SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END WHERE id = ?",
    [id],
  );
}

/** Increment play count + log to history. */
export function recordPlay(songId) {
  db.withTransactionSync(() => {
    db.runSync("UPDATE songs SET play_count = play_count + 1 WHERE id = ?", [
      songId,
    ]);
    db.runSync("INSERT INTO play_history (song_id, played_at) VALUES (?, ?)", [
      songId,
      Date.now(),
    ]);
  });
}

/** Fetch recent play history with song details (last N). */
export function getPlayHistory(limit = 10) {
  return db.getAllSync(
    `
    SELECT s.*, h.played_at
    FROM play_history h
    JOIN songs s ON s.id = h.song_id
    ORDER BY h.played_at DESC
    LIMIT ?
  `,
    [limit],
  );
}

/** Search songs by title or artist. */
export function searchSongs(query) {
  const q = `%${query}%`;
  return db.getAllSync(
    "SELECT * FROM songs WHERE title LIKE ? OR artist LIKE ? ORDER BY title ASC",
    [q, q],
  );
}

/** Delete a song by id. */
export function deleteSong(id) {
  db.runSync("DELETE FROM songs WHERE id = ?", [id]);
}

// ─── Playlists CRUD ───────────────────────────────────────────────────────────

export function createPlaylist(name) {
  const id = `pl_${Date.now()}`;
  db.runSync("INSERT INTO playlists (id, name, created_at) VALUES (?, ?, ?)", [
    id,
    name,
    Date.now(),
  ]);
  return id;
}

export function getAllPlaylists() {
  return db.getAllSync(`
    SELECT p.*, COUNT(ps.song_id) as song_count
    FROM playlists p
    LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `);
}

export function addSongToPlaylist(playlistId, songId) {
  const position =
    db.getFirstSync(
      "SELECT COUNT(*) as cnt FROM playlist_songs WHERE playlist_id = ?",
      [playlistId],
    )?.cnt ?? 0;
  db.runSync(
    "INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)",
    [playlistId, songId, position],
  );
}

export function getPlaylistSongs(playlistId) {
  return db.getAllSync(
    `
    SELECT s.*
    FROM playlist_songs ps
    JOIN songs s ON s.id = ps.song_id
    WHERE ps.playlist_id = ?
    ORDER BY ps.position ASC
  `,
    [playlistId],
  );
}

export function deletePlaylist(id) {
  db.runSync("DELETE FROM playlists WHERE id = ?", [id]);
}

export { db };

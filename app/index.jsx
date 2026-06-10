import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { insertSongs } from "../lib/db";

// ─── Phosphor Icons ───────────────────────────────────────────────────────────
import {
  ClockCounterClockwise,
  DotsThreeVertical,
  FolderOpen,
  GearSix,
  Heart,
  MagnifyingGlass,
  MusicNote,
  MusicNotesIcon,
  Pause,
  Play,
  Plus,
  SkipForward,
  Timer,
  WaveTriangleIcon,
  X,
} from "phosphor-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import uuid from "react-native-uuid";

import { useLibraryStore } from "../store/useLibraryStore";
import { usePlayerStore } from "../store/usePlayerStore";

const LIBRARY_STATS = [
  {
    id: "s1",
    label: "Songs",
    value: songs.length.toLocaleString(),
    Icon: MusicNoteSimple,
  },
  {
    id: "s2",
    label: "Playlists",
    value: String(playlists.length),
    Icon: MusicNotes,
  },
  {
    id: "s3",
    label: "Duration",
    value: formatTotalDuration(songs),
    Icon: Timer,
  },
];

// helper — add above your component
function formatTotalDuration(songs) {
  const totalMs = songs.reduce((acc, s) => acc + (s.duration ?? 0), 0);
  const hrs = Math.floor(totalMs / 3_600_000);
  return hrs > 0 ? `${hrs}h` : `${Math.floor(totalMs / 60000)}m`;
}

const QUICK_ACTIONS = [
  {
    id: "q1",
    label: "Import",
    sublabel: "Add songs",
    Icon: FolderOpen,
    color: "#92400E",
  },
  {
    id: "q2",
    label: "Playlist",
    sublabel: "Create new",
    Icon: Plus,
    color: "#3B3F3F",
  },
  {
    id: "q3",
    label: "Recent",
    sublabel: "Just added",
    Icon: ClockCounterClockwise,
    color: "#3B3F3F",
  },
  {
    id: "q4",
    label: "Favorites",
    sublabel: "Liked songs",
    Icon: Heart,
    color: "#7F1D1D",
  },
];

// ─── Theme Tokens ─────────────────────────────────────────────────────────────

const LIGHT = {
  bg: "bg-zinc-50",
  surface: "bg-white",
  surfaceAlt: "bg-zinc-100",
  border: "border-zinc-200",
  text: "text-zinc-900",
  textSub: "text-zinc-500",
  textMuted: "text-zinc-400",
  accent: "text-amber-600",
  accentBg: "bg-amber-600",
  iconColor: "#18181B",
  iconSubColor: "#71717A",
  accentColor: "#D97706",
  miniPlayer: "bg-white border-zinc-200",
};

const DARK = {
  bg: "bg-zinc-950",
  surface: "bg-zinc-900",
  surfaceAlt: "bg-zinc-800",
  border: "border-zinc-700",
  text: "text-zinc-100",
  textSub: "text-zinc-400",
  textMuted: "text-zinc-600",
  accent: "text-amber-400",
  accentBg: "bg-amber-500",
  iconColor: "#F4F4F5",
  iconSubColor: "#A1A1AA",
  accentColor: "#F59E0B",
  miniPlayer: "bg-zinc-900 border-zinc-700",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Section heading with optional right action */
function SectionHeader({ title, actionLabel, onAction, t }) {
  return (
    <View className="mb-3 flex-row items-center justify-between px-5">
      <Text className={`text-base font-semibold tracking-tight ${t.text}`}>
        {title}
      </Text>
      {actionLabel && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text className={`text-sm font-medium ${t.accent}`}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/** Artwork placeholder with a bold letter + tinted background */
function ArtworkPlaceholder({
  title,
  size = 48,
  color = "#292524",
  textSize = "text-lg",
}) {
  const letter = title?.[0]?.toUpperCase() ?? "?";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        backgroundColor: color,
      }}
      className="items-center justify-center"
    >
      <Text className={`${textSize} font-bold text-zinc-100 opacity-80`}>
        {letter}
      </Text>
    </View>
  );
}

/** Thin horizontal progress bar */
function ProgressBar({ progress, t }) {
  return (
    <View className={`h-1 rounded-full ${t.surfaceAlt} overflow-hidden`}>
      <View
        className={`h-full ${t.accentBg} rounded-full`}
        style={{ width: `${Math.round(progress * 100)}%` }}
      />
    </View>
  );
}

/** Single recent track row */
function RecentTrackRow({ item, isPlaying, onPlay, t }) {
  return (
    <View
      className={`mb-1 flex-row items-center rounded-xl px-5 py-3 ${t.surface}`}
    >
      <ArtworkPlaceholder
        title={item.title}
        size={40}
        color="#292524"
        textSize="text-base"
      />
      <View className="ml-3 flex-1">
        <Text
          className={`text-sm font-semibold leading-tight ${t.text}`}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <Text className={`mt-0.5 text-xs ${t.textSub}`} numberOfLines={1}>
          {item.artist}
        </Text>
      </View>
      <Text className={`mr-3 text-xs ${t.textMuted}`}>{item.duration}</Text>
      <TouchableOpacity
        onPress={() => onPlay(item.id)}
        activeOpacity={0.7}
        className={`h-8 w-8 items-center justify-center rounded-full ${t.surfaceAlt}`}
      >
        {isPlaying ? (
          <Pause size={14} color={t.accentColor} weight="fill" />
        ) : (
          <Play size={14} color={t.iconSubColor} weight="fill" />
        )}
      </TouchableOpacity>
    </View>
  );
}

/** Horizontally scrollable playlist card */
function PlaylistCard({ item, t }) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      className={`mr-3 w-36 overflow-hidden rounded-2xl ${t.surface}`}
    >
      <View
        className="w-full items-center justify-center"
        style={{ height: 96, backgroundColor: item.color }}
      >
        <MusicNotesIcon size={32} color="#A8A29E" weight="regular" />
      </View>
      <View className="p-3">
        <Text
          className={`text-sm font-semibold leading-snug ${t.text}`}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text className={`mt-0.5 text-xs ${t.textMuted}`}>
          {item.count} songs
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/** Library stat card */
function StatCard({ item, t }) {
  const { Icon, label, value } = item;
  return (
    <View className={`mx-1 flex-1 rounded-2xl p-4 ${t.surface}`}>
      <Icon size={20} color={t.accentColor} weight="regular" />
      <Text className={`mt-2 text-xl font-bold tracking-tight ${t.text}`}>
        {value}
      </Text>
      <Text className={`mt-0.5 text-xs ${t.textMuted}`}>{label}</Text>
    </View>
  );
}

// ─── Main HomeScreen ──────────────────────────────────────────────────────────

export default function Index() {
  const {
    themePref,
    setThemePref,
    eqEnabled,
    setEqEnabled,
    isPlaying,
    setIsPlaying,
    currentTrack,
  } = usePlayerStore();

  const colorScheme = useColorScheme();
  // const [themePref, setThemePref] = useState("system");
  const systemDark = colorScheme === "dark";
  const isDark = themePref === "system" ? systemDark : themePref === "dark";
  const t = isDark ? DARK : LIGHT;

  // const [eqEnabled, setEqEnabled] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef(null);

  const [settingsOpen, setSettingsOpen] = useState(false);

  // const [isPlaying, setIsPlaying] = useState(true);
  const [activeTrackId, setActiveTrackId] = useState(CURRENT_TRACK.id);

  const handlePlayRecent = useCallback((id) => {
    setActiveTrackId((prev) => (prev === id ? null : id));
  }, []);

  const togglePlay = useCallback(() => setIsPlaying((p) => !p), []);

  // *****************************************************************

  const {
    recentSongs,
    playlists,
    songs,
    refreshSongs,
    refreshRecent,
    refreshPlaylists,
  } = useLibraryStore();


  // *****************************************************************
  const router = useRouter();

  // Import songs from device storage
  const handleImport = async () => {

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        multiple: true,
        copyToCacheDirectory: false,
      });

      if (result.canceled) {
        console.log("User cancelled picker");
        return;
      }

      const imported = result.assets.map((asset) => ({
        id: uuid.v4(),
        title: asset.name.replace(/\.[^/.]+$/, ""),
        artist: "Unknown Artist",
        album: "Unknown Album",
        uri: asset.uri,
        duration: asset.duration ?? null,
        date_added: Date.now(),
      }));

      insertSongs(imported);
      refreshSongs(); // update library store
      refreshRecent(); // update recent list

      Alert.alert(
        "Imported",
        `${imported.length} song(s) added to your library.`,
      );
    } catch (e) {
      console.error("Import error:", e);
      Alert.alert("Error", "Could not import songs.");
    }
  };

  // Create playlist modal state
  const [createPlaylistOpen, setCreatePlaylistOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");

  const handleCreatePlaylist = () => {
    if (!newPlaylistName.trim()) return;
    // TODO: save to your playlists store/context/db
    Alert.alert("Created", `Playlist "${newPlaylistName}" created.`);
    setNewPlaylistName("");
    setCreatePlaylistOpen(false);
  };

  const QUICK_ACTION_HANDLERS = {
    q1: handleImport,
    q2: () => setCreatePlaylistOpen(true),
    q3: () => router.push("/recent"),
    q4: () => router.push("/favorites"),
  };

  return (
    <SafeAreaView className={`flex-1 ${t.bg}`}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={isDark ? "#09090b" : "#fafafa"}
      />

      {/* ── Scrollable Content ─────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ── 1. Header ──────────────────────────────────────────────────── */}
        {searchOpen ? (
          /* ── Search Bar ── */
          <View className="flex-row items-center gap-3 px-5 pb-7 pt-4">
            <View
              className={`h-11 flex-1 flex-row items-center gap-2 rounded-xl px-3 ${t.surfaceAlt}`}
            >
              <MagnifyingGlass
                size={19}
                color={t.iconSubColor}
                weight="regular"
              />
              <TextInput
                ref={searchRef}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search songs, artists, albums..."
                placeholderTextColor={t.iconSubColor}
                autoFocus
                returnKeyType="search"
                className={`flex-1 text-lg ${t.text} m-0 p-0`}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <X size={19} color={t.iconSubColor} weight="bold" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={() => {
                setSearchOpen(false);
                setSearchQuery("");
              }}
            >
              <Text className={`text-sm font-medium ${t.accent}`}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Normal Header ── */
          <View className="flex-row items-center justify-between px-5 pb-7 pt-4">
            {/* Logo + Greeting */}
            <View className="flex-row items-center gap-3">
              <View
                className={`h-10 w-10 items-center justify-center rounded-xl ${t.accentBg}`}
              >
                <MusicNote size={19} color="#fff" weight="fill" />
              </View>
              <View>
                <Text className={`text-sm font-medium ${t.textMuted}`}>
                  Tunebase
                </Text>
                <Text className={`text-base font-bold leading-tight ${t.text}`}>
                  {getGreeting()}
                </Text>
              </View>
            </View>

            {/* Action buttons */}
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                onPress={() => setSearchOpen(true)}
                className={`h-10 w-10 items-center justify-center rounded-xl ${t.surfaceAlt}`}
              >
                <MagnifyingGlass
                  size={19}
                  color={t.iconColor}
                  weight="regular"
                />
              </TouchableOpacity>

              {/* Settings button + dropdown */}
              <View style={{ position: "relative" }}>
                <TouchableOpacity
                  onPress={() => setSettingsOpen((p) => !p)}
                  className={`h-10 w-10 items-center justify-center rounded-xl ${t.surfaceAlt}`}
                >
                  <GearSix size={19} color={t.iconColor} weight="regular" />
                </TouchableOpacity>

                {settingsOpen && (
                  <>
                    {/* Backdrop to dismiss */}
                    <TouchableOpacity
                      style={{
                        position: "absolute",
                        top: -200,
                        left: -400,
                        right: -400,
                        bottom: -800,
                        zIndex: 10,
                      }}
                      onPress={() => setSettingsOpen(false)}
                      activeOpacity={1}
                    />
                    {/* Dropdown card */}
                    <View
                      className={`absolute right-0 rounded-2xl border ${t.surface} ${t.border}`}
                      style={{
                        top: 46,
                        width: 220,
                        zIndex: 20,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: isDark ? 0.5 : 0.12,
                        shadowRadius: 16,
                        elevation: 12,
                      }}
                    >
                      {/* Appearance */}
                      <View className={`border-b px-4 pb-2 pt-3 ${t.border}`}>
                        <Text
                          className={`mb-3 text-xs font-semibold uppercase tracking-widest ${t.textMuted}`}
                        >
                          Appearance
                        </Text>
                        <View className="flex-row gap-2">
                          {[
                            { label: "Light", value: "light" },
                            { label: "Dark", value: "dark" },
                            { label: "System", value: "system" },
                          ].map((opt) => (
                            <TouchableOpacity
                              key={opt.value}
                              onPress={() => setThemePref(opt.value)}
                              activeOpacity={0.75}
                              className={`flex-1 items-center rounded-lg border py-1.5 ${
                                themePref === opt.value
                                  ? `${t.accentBg} border-transparent`
                                  : `${t.surfaceAlt} ${t.border}`
                              }`}
                            >
                              <Text
                                className={`text-xs font-semibold ${
                                  themePref === opt.value
                                    ? "text-white"
                                    : t.textSub
                                }`}
                              >
                                {opt.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      {/* Equalizer */}
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={() => setEqEnabled((p) => !p)}
                        className={`flex-row items-center justify-between border-b px-4 py-3 ${t.border}`}
                      >
                        <View className="flex-row items-center gap-3">
                          <WaveTriangleIcon
                            size={18}
                            color={t.iconSubColor}
                            weight="regular"
                          />
                          <Text className={`text-sm font-medium ${t.text}`}>
                            Equalizer
                          </Text>
                        </View>
                        <View
                          className={`h-5 w-10 items-center justify-center rounded-full ${eqEnabled ? t.accentBg : t.surfaceAlt}`}
                        >
                          <View
                            className={`h-4 w-4 rounded-full bg-white shadow-sm`}
                            style={{
                              marginLeft: eqEnabled ? "auto" : undefined,
                              marginRight: eqEnabled ? undefined : "auto",
                            }}
                          />
                        </View>
                      </TouchableOpacity>

                      {/* Sleep Timer */}
                      <TouchableOpacity
                        activeOpacity={0.75}
                        className="flex-row items-center justify-between px-4 py-3"
                      >
                        <View className="flex-row items-center gap-3">
                          <Timer
                            size={18}
                            color={t.iconSubColor}
                            weight="regular"
                          />
                          <Text className={`text-sm font-medium ${t.text}`}>
                            Sleep Timer
                          </Text>
                        </View>
                        <Text className={`text-xs font-medium ${t.textMuted}`}>
                          Off
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ── 2. Quick Actions ───────────────────────────────────────────── */}
        <View className="mb-6 px-5">
          <View className="flex-row justify-between gap-3">
            {QUICK_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.id}
                onPress={QUICK_ACTION_HANDLERS[action.id]}
                className={`flex-1 items-center rounded-2xl p-3 ${t.surface}`}
                style={{ minHeight: 76 }}
              >
                <View
                  className="mb-2 h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: action.color }}
                >
                  <action.Icon size={19} color="#E7E5E4" weight="regular" />
                </View>
                <Text
                  className={`text-center text-[10px] font-semibold leading-tight ${t.text} uppercase`}
                >
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Create Playlist Modal ─────────────────────────────────────── */}
        <Modal
          visible={createPlaylistOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setCreatePlaylistOpen(false)}
        >
          <TouchableOpacity
            className="flex-1 items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
            activeOpacity={1}
            onPress={() => setCreatePlaylistOpen(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              className={`mx-6 w-96 rounded-2xl p-5 ${t.surface}`}
              onPress={() => {}} // prevent backdrop dismiss when tapping inside
            >
              <Text className={`mb-4 text-base font-bold ${t.text}`}>
                New Playlist
              </Text>
              <TextInput
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
                placeholder="Playlist name"
                placeholderTextColor={t.iconSubColor}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleCreatePlaylist}
                className={`mb-4 h-11 rounded-xl px-4 text-sm ${t.surfaceAlt} ${t.text}`}
              />
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => setCreatePlaylistOpen(false)}
                  activeOpacity={0.75}
                  className={`h-10 flex-1 items-center justify-center rounded-xl ${t.surfaceAlt}`}
                >
                  <Text className={`text-sm font-semibold ${t.textSub}`}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCreatePlaylist}
                  activeOpacity={0.75}
                  className={`h-10 flex-1 items-center justify-center rounded-xl ${t.accentBg}`}
                >
                  <Text className="text-sm font-semibold text-white">
                    Create
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* ── 3. Continue Listening ──────────────────────────────────────── */}
        <SectionHeader title="Continue Listening" t={t} />
        <View className="mx-5 mb-6">
          <View className={`rounded-2xl p-4 ${t.surface}`}>
            <View className="flex-row items-center gap-4">
              {/* Artwork */}
              <ArtworkPlaceholder
                title={CURRENT_TRACK.title}
                size={64}
                color={CURRENT_TRACK.colorHint}
                textSize="text-2xl"
              />

              {/* Track info */}
              <View className="flex-1">
                <Text
                  className={`text-base font-bold leading-tight ${t.text}`}
                  numberOfLines={1}
                >
                  {CURRENT_TRACK.title}
                </Text>
                <Text
                  className={`mt-0.5 text-sm ${t.textSub}`}
                  numberOfLines={1}
                >
                  {CURRENT_TRACK.artist} · {CURRENT_TRACK.album}
                </Text>
              </View>

              {/* Options */}
              <TouchableOpacity activeOpacity={0.7}>
                <DotsThreeVertical
                  size={20}
                  color={t.iconSubColor}
                  weight="bold"
                />
              </TouchableOpacity>
            </View>

            {/* Progress */}
            <View className="mb-2 mt-4">
              <ProgressBar progress={CURRENT_TRACK.progress} t={t} />
              <View className="mt-1.5 flex-row justify-between">
                <Text className={`text-xs ${t.textMuted}`}>1:50</Text>
                <Text className={`text-xs ${t.textMuted}`}>
                  {CURRENT_TRACK.duration}
                </Text>
              </View>
            </View>

            {/* Controls */}
            <View className="mt-1 flex-row items-center justify-between">
              <TouchableOpacity activeOpacity={0.7}>
                <WaveTriangleIcon
                  size={20}
                  color={t.iconSubColor}
                  weight="regular"
                />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={togglePlay}
                className={`h-11 w-11 items-center justify-center rounded-full ${t.accentBg}`}
              >
                {isPlaying ? (
                  <Pause size={20} color="#fff" weight="fill" />
                ) : (
                  <Play size={20} color="#fff" weight="fill" />
                )}
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.7}>
                <SkipForward
                  size={20}
                  color={t.iconSubColor}
                  weight="regular"
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── 4. Recent Playback History ─────────────────────────────────── */}
        <SectionHeader title="Recent Playback" actionLabel="See all" t={t} />
        <View className="mx-5 mb-6">
          {RECENT_TRACKS.map((track) => (
            <RecentTrackRow
              key={track.id}
              item={track}
              isPlaying={activeTrackId === track.id}
              onPlay={handlePlayRecent}
              t={t}
            />
          ))}
        </View>

        {/* ── 5. User Playlists ──────────────────────────────────────────── */}
        <SectionHeader
          title="Your Playlists"
          actionLabel="All playlists"
          t={t}
        />
        <FlatList
          data={PLAYLISTS}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4 }}
          className="mb-6"
          renderItem={({ item }) => <PlaylistCard item={item} t={t} />}
        />

        {/* ── 6. Library Summary ─────────────────────────────────────────── */}
        <SectionHeader title="Library" t={t} />
        <View className="mx-4 mb-6 flex-row">
          {LIBRARY_STATS.map((stat) => (
            <StatCard key={stat.id} item={stat} t={t} />
          ))}
        </View>
      </ScrollView>

      {/* ── 7. Floating Mini Player ────────────────────────────────────── */}
      {isPlaying && (
        <TouchableOpacity
          activeOpacity={0.92}
          className={`absolute bottom-5 left-4 right-4 flex-row items-center rounded-2xl border px-4 py-3 shadow-lg ${t.miniPlayer}`}
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.5 : 0.12,
            shadowRadius: 12,
            elevation: 10,
          }}
        >
          {/* Artwork */}
          <ArtworkPlaceholder
            title={CURRENT_TRACK.title}
            size={42}
            color={CURRENT_TRACK.colorHint}
            textSize="text-base"
          />

          {/* Track info */}
          <View className="ml-3 flex-1">
            <Text
              className={`text-sm font-semibold leading-tight ${t.text}`}
              numberOfLines={1}
            >
              {CURRENT_TRACK.title}
            </Text>
            <Text className={`mt-0.5 text-xs ${t.textSub}`} numberOfLines={1}>
              {CURRENT_TRACK.artist}
            </Text>
            {/* Mini progress */}
            <View
              className={`mt-1.5 h-0.5 rounded-full ${t.surfaceAlt} overflow-hidden`}
            >
              <View
                className={`h-full ${t.accentBg} rounded-full`}
                style={{
                  width: `${Math.round(CURRENT_TRACK.progress * 100)}%`,
                }}
              />
            </View>
          </View>

          {/* Controls */}
          <View className="ml-3 flex-row items-center gap-2">
            <TouchableOpacity
              onPress={togglePlay}
              activeOpacity={0.7}
              className={`h-9 w-9 items-center justify-center rounded-full ${t.accentBg}`}
            >
              {isPlaying ? (
                <Pause size={16} color="#fff" weight="fill" />
              ) : (
                <Play size={16} color="#fff" weight="fill" />
              )}
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7}>
              <SkipForward size={20} color={t.iconSubColor} weight="regular" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

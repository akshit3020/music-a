import { Audio } from "expo-av";
import { usePlayerStore } from "../store/usePlayerStore";
import { recordPlay } from "./db";

let soundObject = null; // single Sound instance reused across tracks

// ─── Audio session (call once at app start) ───────────────────────────────────
export async function setupAudioSession() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    staysActiveInBackground: true, // keep playing when screen is off
    interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DUCK_OTHERS,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: true,
    interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DUCK_OTHERS,
    playThroughEarpieceAndroid: false,
  });
}

// ─── Playback status callback ─────────────────────────────────────────────────
function onPlaybackStatusUpdate(status) {
  if (!status.isLoaded) return;

  const { setPositionMs, setDurationMs, setIsPlaying, nextTrack, repeatMode } =
    usePlayerStore.getState();

  setPositionMs(status.positionMillis ?? 0);
  setDurationMs(status.durationMillis ?? 0);
  setIsPlaying(status.isPlaying);

  // track finished
  if (status.didJustFinish) {
    if (repeatMode === "one") {
      seekTo(0);
      play();
    } else {
      nextTrack(); // store updates currentTrack → triggers useEffect in hook
    }
  }
}

// ─── Core controls ────────────────────────────────────────────────────────────

/** Load a song URI and start playing immediately. */
export async function loadAndPlay(song) {
  try {
    // unload previous
    if (soundObject) {
      await soundObject.unloadAsync();
      soundObject = null;
    }

    const { sound } = await Audio.Sound.createAsync(
      { uri: song.uri },
      { shouldPlay: true, progressUpdateIntervalMillis: 500 },
      onPlaybackStatusUpdate,
    );

    soundObject = sound;

    // update store
    const { setIsPlaying, setLastSongId } = usePlayerStore.getState();
    setIsPlaying(true);
    setLastSongId(song.id);

    // record play in SQLite
    recordPlay(song.id);
  } catch (e) {
    console.error("loadAndPlay error:", e);
  }
}

export async function play() {
  if (!soundObject) return;
  await soundObject.playAsync();
  usePlayerStore.getState().setIsPlaying(true);
}

export async function pause() {
  if (!soundObject) return;
  await soundObject.pauseAsync();
  usePlayerStore.getState().setIsPlaying(false);
}

export async function togglePlayPause() {
  const { isPlaying } = usePlayerStore.getState();
  isPlaying ? await pause() : await play();
}

export async function seekTo(ms) {
  if (!soundObject) return;
  await soundObject.setPositionAsync(ms);
  usePlayerStore.getState().setPositionMs(ms);
}

export async function unloadSound() {
  if (!soundObject) return;
  await soundObject.unloadAsync();
  soundObject = null;
}

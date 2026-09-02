/**
 * Audio chime generator for Cafe Kitchen KDS & Customer Order Status updates
 * Uses Web Audio API for 100% reliable, zero-latency chimes across all browsers.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  } catch (e) {
    console.warn("Could not initialize AudioContext:", e);
    return null;
  }
}

/**
 * Play a warm, 3-note melodic kitchen chime (E5 -> G#5 -> B5)
 * Signifies: New incoming order or payment completed!
 */
export function playOrderChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) {
      // Fallback to HTML Audio if available
      try {
        const audio = new Audio("/notification.mp3");
        audio.play().catch(() => {});
      } catch {}
      return;
    }

    const now = ctx.currentTime;
    const notes = [
      { freq: 659.25, time: 0.0, dur: 0.25 }, // E5
      { freq: 830.61, time: 0.15, dur: 0.3 }, // G#5
      { freq: 987.77, time: 0.32, dur: 0.55 }, // B5
    ];

    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + time);

      // Smooth attack and natural exponential decay
      gain.gain.setValueAtTime(0.001, now + time);
      gain.gain.linearRampToValueAtTime(0.28, now + time + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + dur);
    });
  } catch (err) {
    console.warn("Could not play order chime:", err);
  }
}

/**
 * Play a gentle 2-note "Order Ready" chime (A5 -> C#6)
 */
export function playOrderReadyChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { freq: 880.0, time: 0.0, dur: 0.2 }, // A5
      { freq: 1108.73, time: 0.16, dur: 0.45 }, // C#6
    ];

    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + time);

      gain.gain.setValueAtTime(0.001, now + time);
      gain.gain.linearRampToValueAtTime(0.25, now + time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + dur);
    });
  } catch (err) {
    console.warn("Could not play ready chime:", err);
  }
}

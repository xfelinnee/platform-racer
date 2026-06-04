// Procedural audio engine (Web Audio API) — no external files.
const Audio2 = (() => {
  let ctx = null;
  let master, musicGain, sfxGain;
  let musicTimer = null;
  let musicOn = false;
  let step = 0;

  // volumes 0..1
  let musicVol = 0.5, sfxVol = 0.7;

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = musicVol * 0.5;
    musicGain.connect(master);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = sfxVol;
    sfxGain.connect(master);
  }

  function resume() {
    if (!ctx) init();
    if (ctx.state === 'suspended') ctx.resume();
  }

  function setVolumes(music, sfx) {
    musicVol = music / 100;
    sfxVol = sfx / 100;
    if (musicGain) musicGain.gain.value = musicVol * 0.5;
    if (sfxGain) sfxGain.gain.value = sfxVol;
  }

  // ---- one-shot tone helper ----
  function tone({ freq = 440, type = 'sine', dur = 0.15, vol = 0.5, slideTo = null, attack = 0.005, decay = null }) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (decay || dur));
    osc.connect(g); g.connect(sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noise({ dur = 0.2, vol = 0.4, type = 'lowpass', freq = 800 }) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = type; filt.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt); filt.connect(g); g.connect(sfxGain);
    src.start(t); src.stop(t + dur);
  }

  // ---- SFX ----
  const sfx = {
    jump() { tone({ freq: 320, slideTo: 720, type: 'square', dur: 0.18, vol: 0.35 }); },
    land() { noise({ dur: 0.12, vol: 0.3, freq: 500 }); tone({ freq: 160, slideTo: 90, type: 'sine', dur: 0.12, vol: 0.3 }); },
    coin() {
      tone({ freq: 880, type: 'square', dur: 0.08, vol: 0.3 });
      setTimeout(() => tone({ freq: 1320, type: 'square', dur: 0.12, vol: 0.3 }), 70);
    },
    death() {
      tone({ freq: 440, slideTo: 70, type: 'sawtooth', dur: 0.6, vol: 0.4 });
      noise({ dur: 0.5, vol: 0.25, freq: 1200 });
    },
    ui() { tone({ freq: 600, type: 'triangle', dur: 0.06, vol: 0.25 }); },
  };

  // ---- MUSIC: an evolving synth track (chords + bass + arp + drums) ----
  // The track walks an 8-bar chord progression and rotates between several
  // arp patterns / sections so it keeps changing instead of looping one bar.
  const SCALE = [0, 3, 5, 7, 10];           // minor pentatonic
  const ROOT = 220;                          // A3
  const STEPS_PER_BAR = 16;
  const PROG = [0, 0, 5, 3, -2, -2, 5, 7];   // chord-root offsets, one per bar (8 bars)
  const PATTERNS = [
    [0, 2, 4, 2, 1, 3, 2, 4, 0, 2, 4, 5, 4, 2, 1, 0], // section A
    [4, 3, 2, 1, 0, 1, 2, 3, 4, 2, 0, 2, 3, 1, 4, 2], // section B
    [0, 0, 2, 2, 4, 4, 2, 2, 1, 1, 3, 3, 5, 5, 4, 2], // section C
  ];
  const TOTAL = PROG.length * STEPS_PER_BAR;  // full song length in steps

  // Convert a scale index (can exceed the scale) into a semitone, wrapping octaves.
  function scaleSemi(i) {
    const oct = Math.floor(i / SCALE.length);
    return SCALE[((i % SCALE.length) + SCALE.length) % SCALE.length] + oct * 12;
  }
  function noteFreq(semi) { return ROOT * Math.pow(2, semi / 12); }

  function blip({ freq, type, dur, vol, attack = 0.01 }) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(musicGain);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  function drum(kind) {
    const t = ctx.currentTime;
    if (kind === 'kick') {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.6, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      osc.connect(g); g.connect(musicGain);
      osc.start(t); osc.stop(t + 0.16);
    } else { // hat
      const dur = 0.03;
      const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const filt = ctx.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = 7000;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filt); filt.connect(g); g.connect(musicGain);
      src.start(t); src.stop(t + dur);
    }
  }

  function tickMusic() {
    if (!ctx || !musicOn) return;

    const bar = Math.floor(step / STEPS_PER_BAR);
    const inBar = step % STEPS_PER_BAR;
    const chord = PROG[bar % PROG.length];
    const pattern = PATTERNS[Math.floor(bar / 2) % PATTERNS.length]; // change section every 2 bars

    // drums: kick on the beat, hats on the off-beats
    if (inBar % 4 === 0) drum('kick');
    if (inBar % 2 === 1) drum('hat');

    // bass on each beat, following the chord root
    if (inBar % 4 === 0) {
      blip({ freq: noteFreq(chord - 12), type: 'triangle', dur: 0.45, vol: 0.5, attack: 0.02 });
    }

    // arp lead from the current pattern/section
    const semi = scaleSemi(pattern[inBar]) + 12 + chord;
    blip({ freq: noteFreq(semi), type: 'square', dur: 0.16, vol: 0.14 });

    // a sparkly upper harmony at the top of every other bar for variety
    if (inBar === 12 && bar % 2 === 0) {
      blip({ freq: noteFreq(semi + 12), type: 'triangle', dur: 0.3, vol: 0.08 });
    }

    step = (step + 1) % TOTAL;
  }

  function startMusic() {
    resume();
    if (musicOn) return;
    musicOn = true;
    step = 0;
    musicTimer = setInterval(tickMusic, 150); // ~100bpm 16ths
  }
  function stopMusic() {
    musicOn = false;
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }

  return { init, resume, setVolumes, sfx, startMusic, stopMusic };
})();

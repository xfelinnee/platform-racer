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

  // ---- MUSIC: looping synth (bass + arp) ----
  const scale = [0, 3, 5, 7, 10, 12, 10, 7]; // minor pentatonic-ish
  const root = 220; // A3
  function noteFreq(semi) { return root * Math.pow(2, semi / 12); }

  function tickMusic() {
    if (!ctx || !musicOn) return;
    const t = ctx.currentTime;

    // bass every 4 steps
    if (step % 4 === 0) {
      const bf = noteFreq(scale[(step / 4) % scale.length] - 12);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = bf;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.connect(g); g.connect(musicGain);
      osc.start(t); osc.stop(t + 0.5);
    }

    // arp lead
    const lf = noteFreq(scale[step % scale.length] + 12);
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.value = lf;
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc2.connect(g2); g2.connect(musicGain);
    osc2.start(t); osc2.stop(t + 0.2);

    step = (step + 1) % 64;
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

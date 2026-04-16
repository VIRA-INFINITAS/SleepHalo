/**
 * SleepHalo Sound Library
 * Uses the Web Audio API to generate ambient sounds directly in the browser.
 * Each sound is synthesized in real-time so no audio files are needed.
 */

const SoundLibrary = (() => {
    let audioCtx = null;
    let masterGain = null;
    const activeSounds = {};
    let soundTimerTimeout = null;

    // Sound definitions with metadata
    const SOUNDS = [
        {
            id: 'ocean',
            name: 'Ocean Waves',
            icon: '🌊',
            description: 'Calm ocean waves',
            category: 'nature',
        },
        {
            id: 'rain',
            name: 'Gentle Rain',
            icon: '🌧️',
            description: 'Soft rainfall',
            category: 'nature',
        },
        {
            id: 'forest',
            name: 'Forest',
            icon: '🌳',
            description: 'Birds and leaves',
            category: 'nature',
        },
        {
            id: 'wind',
            name: 'Wind',
            icon: '🍃',
            description: 'Soft breeze',
            category: 'nature',
        },
        {
            id: 'fire',
            name: 'Campfire',
            icon: '🔥',
            description: 'Crackling fire',
            category: 'indoor',
        },
        {
            id: 'night',
            name: 'Night',
            icon: '🦗',
            description: 'Crickets and calm',
            category: 'nature',
        },
        {
            id: 'whitenoise',
            name: 'White Noise',
            icon: '📻',
            description: 'Steady static',
            category: 'ambient',
        },
        {
            id: 'creek',
            name: 'Creek',
            icon: '💧',
            description: 'Flowing water',
            category: 'nature',
        },
    ];

    /**
     * Initialise the audio context (must happen after user gesture).
     * On iOS Safari the context starts in 'suspended' state and must
     * be resumed inside a touch/click handler.
     */
    function init() {
        if (audioCtx) return;
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.6;
        masterGain.connect(audioCtx.destination);

        // iOS unlock: play a tiny silent buffer so the context becomes
        // "allowed" by the browser even before real sounds are queued.
        try {
            const silentBuf = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
            const src = audioCtx.createBufferSource();
            src.buffer = silentBuf;
            src.connect(audioCtx.destination);
            src.start(0);
        } catch (e) { /* ignore */ }
    }

    /**
     * Resume audio context if it was suspended (browser policy).
     * Returns a promise so callers can await it before creating nodes.
     */
    async function ensureRunning() {
        if (audioCtx && audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }
    }

    /**
     * Set the master volume (0 to 1).
     */
    function setMasterVolume(value) {
        if (masterGain) {
            masterGain.gain.setTargetAtTime(value, audioCtx.currentTime, 0.1);
        }
    }

    /**
     * Get all available sound definitions.
     */
    function getSounds() {
        return SOUNDS;
    }

    /**
     * Check if a specific sound is playing.
     */
    function isPlaying(soundId) {
        return !!activeSounds[soundId];
    }

    /**
     * Get list of currently playing sound IDs.
     */
    function getPlayingSounds() {
        return Object.keys(activeSounds);
    }

    /**
     * Toggle a sound on or off.
     */
    async function toggle(soundId) {
        init();
        await ensureRunning();
        if (activeSounds[soundId]) {
            stop(soundId);
        } else {
            await play(soundId);
        }
    }

    /**
     * Play a specific sound.
     */
    async function play(soundId) {
        init();
        await ensureRunning();
        if (activeSounds[soundId]) return; // already playing

        const nodes = createSoundNodes(soundId);
        if (!nodes) return;

        activeSounds[soundId] = nodes;
    }

    /**
     * Stop a specific sound with a short fade-out.
     */
    function stop(soundId) {
        const nodes = activeSounds[soundId];
        if (!nodes) return;

        // Fade out over 0.5 seconds
        if (nodes.gain) {
            nodes.gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.15);
        }

        setTimeout(() => {
            if (nodes.sources) {
                nodes.sources.forEach((s) => {
                    try { s.stop(); } catch (e) { /* ignore */ }
                });
            }
            if (nodes.gain) {
                try { nodes.gain.disconnect(); } catch (e) { /* ignore */ }
            }
            delete activeSounds[soundId];
        }, 600);
    }

    /**
     * Stop all playing sounds.
     */
    function stopAll() {
        Object.keys(activeSounds).forEach((id) => stop(id));
        clearSoundTimer();
    }

    /**
     * Set an auto-stop timer in minutes.
     */
    function setSoundTimer(minutes) {
        clearSoundTimer();
        if (minutes <= 0) return;
        soundTimerTimeout = setTimeout(() => {
            stopAll();
        }, minutes * 60 * 1000);
    }

    function clearSoundTimer() {
        if (soundTimerTimeout) {
            clearTimeout(soundTimerTimeout);
            soundTimerTimeout = null;
        }
    }

    // ---- Sound Generators ----
    // Each function creates Web Audio nodes that produce a specific ambient sound.

    function createSoundNodes(soundId) {
        const gain = audioCtx.createGain();
        gain.gain.value = 0;
        gain.connect(masterGain);

        let sources = [];

        switch (soundId) {
            case 'ocean':
                sources = createOcean(gain);
                break;
            case 'rain':
                sources = createRain(gain);
                break;
            case 'forest':
                sources = createForest(gain);
                break;
            case 'wind':
                sources = createWind(gain);
                break;
            case 'fire':
                sources = createFire(gain);
                break;
            case 'night':
                sources = createNight(gain);
                break;
            case 'whitenoise':
                sources = createWhiteNoise(gain);
                break;
            case 'creek':
                sources = createCreek(gain);
                break;
            default:
                gain.disconnect();
                return null;
        }

        // Fade in
        gain.gain.setTargetAtTime(0.7, audioCtx.currentTime, 0.3);

        return { gain, sources };
    }

    /**
     * Create a noise buffer source.
     * @param {string} type - 'white', 'pink', or 'brown'
     */
    function createNoiseSource(type = 'white') {
        const bufferSize = audioCtx.sampleRate * 4; // 4 seconds
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);

        if (type === 'white') {
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
        } else if (type === 'pink') {
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
                b6 = white * 0.115926;
            }
        } else if (type === 'brown') {
            let last = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                data[i] = (last + 0.02 * white) / 1.02;
                last = data[i];
                data[i] *= 3.5;
            }
        }

        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        return source;
    }

    // --- Ocean Waves ---
    function createOcean(output) {
        const sources = [];

        // Layer 1: Low rumble (brown noise with low-pass filter)
        const rumble = createNoiseSource('brown');
        const rumbleLp = audioCtx.createBiquadFilter();
        rumbleLp.type = 'lowpass';
        rumbleLp.frequency.value = 200;
        const rumbleGain = audioCtx.createGain();
        rumbleGain.gain.value = 0.4;
        rumble.connect(rumbleLp);
        rumbleLp.connect(rumbleGain);
        rumbleGain.connect(output);
        rumble.start();
        sources.push(rumble);

        // Layer 2: Wave crash (pink noise with amplitude modulation)
        const wave = createNoiseSource('pink');
        const waveBp = audioCtx.createBiquadFilter();
        waveBp.type = 'bandpass';
        waveBp.frequency.value = 800;
        waveBp.Q.value = 0.5;
        const waveGain = audioCtx.createGain();
        waveGain.gain.value = 0;

        // LFO to modulate wave amplitude (simulates waves coming and going)
        const lfo = audioCtx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.08; // slow wave cycle
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 0.3;
        lfo.connect(lfoGain);
        lfoGain.connect(waveGain.gain);

        wave.connect(waveBp);
        waveBp.connect(waveGain);
        waveGain.connect(output);
        wave.start();
        lfo.start();
        sources.push(wave, lfo);

        // Layer 3: High hiss (white noise, very soft, high-passed)
        const hiss = createNoiseSource('white');
        const hissHp = audioCtx.createBiquadFilter();
        hissHp.type = 'highpass';
        hissHp.frequency.value = 3000;
        const hissGain = audioCtx.createGain();
        hissGain.gain.value = 0.05;
        hiss.connect(hissHp);
        hissHp.connect(hissGain);
        hissGain.connect(output);
        hiss.start();
        sources.push(hiss);

        return sources;
    }

    // --- Gentle Rain ---
    function createRain(output) {
        const sources = [];

        // Rain body: pink noise filtered
        const rain = createNoiseSource('pink');
        const rainBp = audioCtx.createBiquadFilter();
        rainBp.type = 'bandpass';
        rainBp.frequency.value = 2500;
        rainBp.Q.value = 0.3;
        const rainGain = audioCtx.createGain();
        rainGain.gain.value = 0.45;
        rain.connect(rainBp);
        rainBp.connect(rainGain);
        rainGain.connect(output);
        rain.start();
        sources.push(rain);

        // Low rumble for thunder/distance
        const low = createNoiseSource('brown');
        const lowLp = audioCtx.createBiquadFilter();
        lowLp.type = 'lowpass';
        lowLp.frequency.value = 150;
        const lowGain = audioCtx.createGain();
        lowGain.gain.value = 0.15;
        low.connect(lowLp);
        lowLp.connect(lowGain);
        lowGain.connect(output);
        low.start();
        sources.push(low);

        // Raindrop texture: high frequency noise with modulation
        const drops = createNoiseSource('white');
        const dropsHp = audioCtx.createBiquadFilter();
        dropsHp.type = 'highpass';
        dropsHp.frequency.value = 5000;
        const dropsGain = audioCtx.createGain();
        dropsGain.gain.value = 0.08;

        const dropLfo = audioCtx.createOscillator();
        dropLfo.type = 'sine';
        dropLfo.frequency.value = 0.3;
        const dropLfoGain = audioCtx.createGain();
        dropLfoGain.gain.value = 0.06;
        dropLfo.connect(dropLfoGain);
        dropLfoGain.connect(dropsGain.gain);

        drops.connect(dropsHp);
        dropsHp.connect(dropsGain);
        dropsGain.connect(output);
        drops.start();
        dropLfo.start();
        sources.push(drops, dropLfo);

        return sources;
    }

    // --- Forest ---
    function createForest(output) {
        const sources = [];

        // Ambient rustle: soft pink noise
        const rustle = createNoiseSource('pink');
        const rustleBp = audioCtx.createBiquadFilter();
        rustleBp.type = 'bandpass';
        rustleBp.frequency.value = 1500;
        rustleBp.Q.value = 0.4;
        const rustleGain = audioCtx.createGain();
        rustleGain.gain.value = 0.12;

        const rustleLfo = audioCtx.createOscillator();
        rustleLfo.type = 'sine';
        rustleLfo.frequency.value = 0.15;
        const rustleLfoGain = audioCtx.createGain();
        rustleLfoGain.gain.value = 0.08;
        rustleLfo.connect(rustleLfoGain);
        rustleLfoGain.connect(rustleGain.gain);

        rustle.connect(rustleBp);
        rustleBp.connect(rustleGain);
        rustleGain.connect(output);
        rustle.start();
        rustleLfo.start();
        sources.push(rustle, rustleLfo);

        // Bird-like tones: oscillators at bird-call frequencies
        function createBirdCall(freq, modFreq, vol) {
            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;

            const mod = audioCtx.createOscillator();
            mod.type = 'sine';
            mod.frequency.value = modFreq;
            const modGain = audioCtx.createGain();
            modGain.gain.value = freq * 0.3;
            mod.connect(modGain);
            modGain.connect(osc.frequency);

            const ampMod = audioCtx.createOscillator();
            ampMod.type = 'sine';
            ampMod.frequency.value = 0.2 + Math.random() * 0.3;
            const ampModGain = audioCtx.createGain();
            ampModGain.gain.value = vol;
            ampMod.connect(ampModGain);

            const birdGain = audioCtx.createGain();
            birdGain.gain.value = 0;
            ampModGain.connect(birdGain.gain);

            osc.connect(birdGain);
            birdGain.connect(output);

            osc.start();
            mod.start();
            ampMod.start();
            return [osc, mod, ampMod];
        }

        sources.push(...createBirdCall(2800, 6, 0.04));
        sources.push(...createBirdCall(3500, 8, 0.03));
        sources.push(...createBirdCall(4200, 5, 0.025));

        return sources;
    }

    // --- Wind ---
    function createWind(output) {
        const sources = [];

        const wind = createNoiseSource('brown');
        const bp1 = audioCtx.createBiquadFilter();
        bp1.type = 'bandpass';
        bp1.frequency.value = 400;
        bp1.Q.value = 0.5;

        const bp2 = audioCtx.createBiquadFilter();
        bp2.type = 'bandpass';
        bp2.frequency.value = 1200;
        bp2.Q.value = 0.3;

        const windGain = audioCtx.createGain();
        windGain.gain.value = 0.35;

        // Slow modulation for gusts
        const lfo = audioCtx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.05;
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 0.2;
        lfo.connect(lfoGain);
        lfoGain.connect(windGain.gain);

        wind.connect(bp1);
        bp1.connect(bp2);
        bp2.connect(windGain);
        windGain.connect(output);
        wind.start();
        lfo.start();
        sources.push(wind, lfo);

        // Light whistle layer
        const whistle = createNoiseSource('white');
        const whistleBp = audioCtx.createBiquadFilter();
        whistleBp.type = 'bandpass';
        whistleBp.frequency.value = 3000;
        whistleBp.Q.value = 2;
        const whistleGain = audioCtx.createGain();
        whistleGain.gain.value = 0.03;
        whistle.connect(whistleBp);
        whistleBp.connect(whistleGain);
        whistleGain.connect(output);
        whistle.start();
        sources.push(whistle);

        return sources;
    }

    // --- Campfire ---
    function createFire(output) {
        const sources = [];

        // Crackling: filtered white noise bursts
        const crackle = createNoiseSource('white');
        const crackBp = audioCtx.createBiquadFilter();
        crackBp.type = 'bandpass';
        crackBp.frequency.value = 3000;
        crackBp.Q.value = 1;
        const crackGain = audioCtx.createGain();
        crackGain.gain.value = 0;

        // Random crackling modulation
        const crackLfo = audioCtx.createOscillator();
        crackLfo.type = 'sawtooth';
        crackLfo.frequency.value = 4;
        const crackLfoGain = audioCtx.createGain();
        crackLfoGain.gain.value = 0.15;
        crackLfo.connect(crackLfoGain);
        crackLfoGain.connect(crackGain.gain);

        crackle.connect(crackBp);
        crackBp.connect(crackGain);
        crackGain.connect(output);
        crackle.start();
        crackLfo.start();
        sources.push(crackle, crackLfo);

        // Low roar
        const roar = createNoiseSource('brown');
        const roarLp = audioCtx.createBiquadFilter();
        roarLp.type = 'lowpass';
        roarLp.frequency.value = 300;
        const roarGain = audioCtx.createGain();
        roarGain.gain.value = 0.3;
        roar.connect(roarLp);
        roarLp.connect(roarGain);
        roarGain.connect(output);
        roar.start();
        sources.push(roar);

        // Pop sounds
        const pop = createNoiseSource('white');
        const popBp = audioCtx.createBiquadFilter();
        popBp.type = 'bandpass';
        popBp.frequency.value = 1000;
        popBp.Q.value = 3;
        const popGain = audioCtx.createGain();
        popGain.gain.value = 0;
        const popLfo = audioCtx.createOscillator();
        popLfo.type = 'square';
        popLfo.frequency.value = 1.5;
        const popLfoGain = audioCtx.createGain();
        popLfoGain.gain.value = 0.08;
        popLfo.connect(popLfoGain);
        popLfoGain.connect(popGain.gain);

        pop.connect(popBp);
        popBp.connect(popGain);
        popGain.connect(output);
        pop.start();
        popLfo.start();
        sources.push(pop, popLfo);

        return sources;
    }

    // --- Night (Crickets) ---
    function createNight(output) {
        const sources = [];

        // Background ambience
        const ambient = createNoiseSource('brown');
        const ambLp = audioCtx.createBiquadFilter();
        ambLp.type = 'lowpass';
        ambLp.frequency.value = 200;
        const ambGain = audioCtx.createGain();
        ambGain.gain.value = 0.15;
        ambient.connect(ambLp);
        ambLp.connect(ambGain);
        ambGain.connect(output);
        ambient.start();
        sources.push(ambient);

        // Cricket chirps: high oscillators with amplitude modulation
        function createCricket(freq, chirpRate, vol) {
            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;

            const ampMod = audioCtx.createOscillator();
            ampMod.type = 'square';
            ampMod.frequency.value = chirpRate;

            const cricketGain = audioCtx.createGain();
            cricketGain.gain.value = 0;

            const ampModGain = audioCtx.createGain();
            ampModGain.gain.value = vol;
            ampMod.connect(ampModGain);
            ampModGain.connect(cricketGain.gain);

            osc.connect(cricketGain);
            cricketGain.connect(output);

            osc.start();
            ampMod.start();
            return [osc, ampMod];
        }

        sources.push(...createCricket(4800, 12, 0.025));
        sources.push(...createCricket(5200, 10, 0.02));
        sources.push(...createCricket(4400, 14, 0.015));

        return sources;
    }

    // --- White Noise ---
    function createWhiteNoise(output) {
        const noise = createNoiseSource('pink'); // pink sounds better than pure white
        const gain = audioCtx.createGain();
        gain.gain.value = 0.3;
        noise.connect(gain);
        gain.connect(output);
        noise.start();
        return [noise];
    }

    // --- Creek / Flowing Water ---
    function createCreek(output) {
        const sources = [];

        // Water flow: filtered noise
        const water = createNoiseSource('pink');
        const waterBp = audioCtx.createBiquadFilter();
        waterBp.type = 'bandpass';
        waterBp.frequency.value = 1800;
        waterBp.Q.value = 0.5;
        const waterGain = audioCtx.createGain();
        waterGain.gain.value = 0.25;

        const lfo = audioCtx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.2;
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 0.12;
        lfo.connect(lfoGain);
        lfoGain.connect(waterGain.gain);

        water.connect(waterBp);
        waterBp.connect(waterGain);
        waterGain.connect(output);
        water.start();
        lfo.start();
        sources.push(water, lfo);

        // Bubbling: high frequency filtered noise with modulation
        const bubbles = createNoiseSource('white');
        const bubBp = audioCtx.createBiquadFilter();
        bubBp.type = 'bandpass';
        bubBp.frequency.value = 4000;
        bubBp.Q.value = 2;
        const bubGain = audioCtx.createGain();
        bubGain.gain.value = 0;

        const bubLfo = audioCtx.createOscillator();
        bubLfo.type = 'sine';
        bubLfo.frequency.value = 2;
        const bubLfoGain = audioCtx.createGain();
        bubLfoGain.gain.value = 0.04;
        bubLfo.connect(bubLfoGain);
        bubLfoGain.connect(bubGain.gain);

        bubbles.connect(bubBp);
        bubBp.connect(bubGain);
        bubGain.connect(output);
        bubbles.start();
        bubLfo.start();
        sources.push(bubbles, bubLfo);

        return sources;
    }

    return {
        init,
        ensureRunning,
        setMasterVolume,
        getSounds,
        isPlaying,
        getPlayingSounds,
        toggle,
        play,
        stop,
        stopAll,
        setSoundTimer,
        clearSoundTimer,
    };
})();

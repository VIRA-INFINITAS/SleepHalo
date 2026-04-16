/**
 * SleepHalo Web App - Main Application
 * Handles UI interactions, view switching, simulation timers,
 * and coordination between the API and Sound modules.
 */

(() => {
    'use strict';

    // ---- State ----
    const state = {
        currentView: 'viewRoutine',
        userName: '',
        sunsetDuration: 30,
        sunriseDuration: 20,
        simulation: null, // 'sunset' | 'sunrise' | null
        simulationEndTime: null,
        simulationTimerInterval: null,
        alarmEnabled: false,
        alarmTimeout: null,
        focusMode: false,
    };

    // ---- DOM References ----
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // ---- Initialise App ----
    function init() {
        loadSettings();
        createStars();
        setupNavigation();
        setupSettings();
        setupRoutineControls();
        setupSoundView();
        setupSleepView();
        updateGreeting();
        updateSleepStats();
        scheduleAlarmCheck();

        // Auto-connect in demo mode
        if (SleepHaloAPI.isDemoMode()) {
            SleepHaloAPI.connect('demo', 5000).then(() => {
                updateConnectionUI(true, true);
            });
        }
    }

    // ---- Star Background ----
    function createStars() {
        const container = $('#bgStars');
        const count = 50;
        for (let i = 0; i < count; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            const size = Math.random() * 2 + 1;
            star.style.width = size + 'px';
            star.style.height = size + 'px';
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 100 + '%';
            star.style.animationDelay = Math.random() * 5 + 's';
            star.style.animationDuration = (2 + Math.random() * 4) + 's';
            container.appendChild(star);
        }
    }

    // ---- Navigation ----
    function setupNavigation() {
        $$('.nav-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const viewId = btn.dataset.view;
                switchView(viewId);
            });
        });
    }

    function switchView(viewId) {
        $$('.view').forEach((v) => v.classList.remove('active'));
        $$('.nav-btn').forEach((b) => b.classList.remove('active'));

        const view = $(`#${viewId}`);
        const btn = $(`.nav-btn[data-view="${viewId}"]`);
        if (view) view.classList.add('active');
        if (btn) btn.classList.add('active');

        state.currentView = viewId;

        // Scroll to top when switching
        $('#appMain').scrollTop = 0;

        // Update sleep stats when switching to sleep view
        if (viewId === 'viewSleep') {
            updateSleepStats();
        }
    }

    // ---- Greeting ----
    function updateGreeting() {
        const hour = new Date().getHours();
        let greeting = 'Good evening';
        if (hour >= 5 && hour < 12) greeting = 'Good morning';
        else if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
        else if (hour >= 17 && hour < 21) greeting = 'Good evening';
        else greeting = 'Good night';

        const name = state.userName ? `, ${state.userName}` : '';
        $('#greeting').textContent = greeting + name;
    }

    // ---- Settings ----
    function setupSettings() {
        $('#settingsBtn').addEventListener('click', () => {
            $('#settingsModal').classList.add('open');
            $('#userName').value = state.userName;
            $('#demoToggle').checked = SleepHaloAPI.isDemoMode();
        });

        $('#closeSettings').addEventListener('click', () => {
            $('#settingsModal').classList.remove('open');
        });

        $('#settingsModal').addEventListener('click', (e) => {
            if (e.target === $('#settingsModal')) {
                $('#settingsModal').classList.remove('open');
            }
        });

        $('#saveSettings').addEventListener('click', () => {
            state.userName = $('#userName').value.trim();
            SleepHaloAPI.setDemoMode($('#demoToggle').checked);
            saveSettings();
            updateGreeting();
            $('#settingsModal').classList.remove('open');
            showToast('Settings saved', 'success');
        });
    }

    // ---- Routine Controls ----
    function setupRoutineControls() {
        // Duration buttons
        $$('.duration-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.target;
                const delta = parseInt(btn.dataset.delta);
                const el = $(`#${target}`);
                let value = parseInt(el.textContent) + delta;
                value = Math.max(5, Math.min(120, value));
                el.textContent = value;

                if (target === 'sunsetDuration') state.sunsetDuration = value;
                if (target === 'sunriseDuration') state.sunriseDuration = value;
                saveSettings();
                updateSleepStats();
            });
        });

        // Bedtime and alarm time change
        $('#bedtime').addEventListener('change', () => {
            saveSettings();
            updateSleepStats();
        });

        $('#alarmTime').addEventListener('change', () => {
            saveSettings();
            updateSleepStats();
        });

        // Start Sunset
        $('#startSunsetBtn').addEventListener('click', async () => {
            try {
                await SleepHaloAPI.startSunset(state.sunsetDuration);
                startSimulationTimer('sunset', state.sunsetDuration);
                showToast('Sunset simulation started', 'info');
            } catch (err) {
                showToast('Failed to start sunset', 'error');
            }
        });

        // Stop Simulation
        $('#stopSimBtn').addEventListener('click', async () => {
            await stopCurrentSimulation();
        });

        // Focus Mode
        $('#focusToggle').addEventListener('change', async (e) => {
            state.focusMode = e.target.checked;
            try {
                await SleepHaloAPI.setFocusMode(state.focusMode);
                showToast(state.focusMode ? 'Focus mode on' : 'Focus mode off', 'info');
            } catch (err) {
                showToast('Failed to toggle focus mode', 'error');
            }
        });

        // Alarm Toggle
        $('#alarmToggle').addEventListener('change', (e) => {
            state.alarmEnabled = e.target.checked;
            saveSettings();
            scheduleAlarmCheck();
            if (state.alarmEnabled) {
                showToast('Alarm enabled', 'info');
            } else {
                if (state.alarmTimeout) {
                    clearTimeout(state.alarmTimeout);
                    state.alarmTimeout = null;
                }
                showToast('Alarm disabled', 'info');
            }
        });

        // Brightness slider
        const brightnessSlider = $('#brightnessSlider');
        brightnessSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            $('#brightnessValue').textContent = val + '%';
            // Send to device (debounced)
            clearTimeout(brightnessSlider._debounce);
            brightnessSlider._debounce = setTimeout(() => {
                SleepHaloAPI.setLight(
                    state.currentColor?.r || 0,
                    state.currentColor?.g || 0,
                    state.currentColor?.b || 0,
                    parseInt(val)
                );
            }, 200);
        });

        // Colour presets
        $$('.colour-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                $$('.colour-btn').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');

                const hex = btn.dataset.color;
                const rgb = SleepHaloAPI.hexToRgb(hex);
                state.currentColor = rgb;
                const brightness = parseInt($('#brightnessSlider').value);
                SleepHaloAPI.setLight(rgb.r, rgb.g, rgb.b, brightness);
            });
        });
    }

    // ---- Simulation Timer ----
    function startSimulationTimer(type, durationMinutes) {
        stopSimulationTimer();

        state.simulation = type;
        state.simulationEndTime = Date.now() + durationMinutes * 60 * 1000;

        // Update UI
        const statusCard = $('#statusCard');
        statusCard.className = `status-card active-${type}`;

        $('#celestialBody').textContent = type === 'sunset' ? '🌅' : '🌄';
        $('#statusText').textContent = type === 'sunset'
            ? 'Sunset Simulation in Progress'
            : 'Sunrise Simulation in Progress';

        $('#progressContainer').style.display = 'block';
        $('#timerCard').style.display = 'block';
        $('#timerLabel').textContent = type === 'sunset'
            ? 'Sunset Simulation Ends In'
            : 'Sunrise Simulation Ends In';

        // Start interval to update timer and progress
        state.simulationTimerInterval = setInterval(() => {
            const remaining = state.simulationEndTime - Date.now();

            if (remaining <= 0) {
                stopCurrentSimulation();
                showToast(`${type === 'sunset' ? 'Sunset' : 'Sunrise'} simulation complete`, 'success');
                return;
            }

            const totalMs = durationMinutes * 60 * 1000;
            const elapsed = totalMs - remaining;
            const progress = (elapsed / totalMs) * 100;

            // Update timer display
            const mins = Math.floor(remaining / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);
            $('#timerDisplay').textContent =
                String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');

            // Update progress bar
            $('#progressBar').style.width = progress + '%';
        }, 1000);
    }

    function stopSimulationTimer() {
        if (state.simulationTimerInterval) {
            clearInterval(state.simulationTimerInterval);
            state.simulationTimerInterval = null;
        }
    }

    async function stopCurrentSimulation() {
        if (state.simulation === 'sunset') {
            await SleepHaloAPI.stopSunset();
        } else if (state.simulation === 'sunrise') {
            await SleepHaloAPI.stopSunrise();
        }

        stopSimulationTimer();
        state.simulation = null;
        state.simulationEndTime = null;

        // Reset UI
        $('#statusCard').className = 'status-card';
        $('#celestialBody').textContent = '🌙';
        $('#statusText').textContent = 'No simulation active';
        $('#progressContainer').style.display = 'none';
        $('#progressBar').style.width = '0%';
        $('#timerCard').style.display = 'none';
    }

    // ---- Alarm Scheduling ----
    function scheduleAlarmCheck() {
        if (state.alarmTimeout) {
            clearTimeout(state.alarmTimeout);
            state.alarmTimeout = null;
        }

        if (!state.alarmEnabled) return;

        const alarmTime = $('#alarmTime').value;
        if (!alarmTime) return;

        const [hours, mins] = alarmTime.split(':').map(Number);
        const now = new Date();
        const alarm = new Date();
        alarm.setHours(hours, mins, 0, 0);

        // If alarm time already passed today, set for tomorrow
        if (alarm <= now) {
            alarm.setDate(alarm.getDate() + 1);
        }

        // Calculate when sunrise should start (before alarm)
        const sunriseStartMs = alarm.getTime() - state.sunriseDuration * 60 * 1000;
        const delayMs = sunriseStartMs - now.getTime();

        if (delayMs > 0) {
            state.alarmTimeout = setTimeout(async () => {
                // Start sunrise simulation
                try {
                    await SleepHaloAPI.startSunrise(state.sunriseDuration);
                    startSimulationTimer('sunrise', state.sunriseDuration);
                    showToast('Sunrise alarm started!', 'info');
                } catch (err) {
                    showToast('Failed to start sunrise alarm', 'error');
                }
            }, delayMs);
        }
    }

    // ---- Sound View ----
    function setupSoundView() {
        const grid = $('#soundGrid');
        const sounds = SoundLibrary.getSounds();

        sounds.forEach((sound) => {
            const card = document.createElement('div');
            card.className = 'sound-card';
            card.dataset.soundId = sound.id;
            card.innerHTML = `
                <span class="sound-icon">${sound.icon}</span>
                <div class="sound-name">${sound.name}</div>
                <div class="sound-desc">${sound.description}</div>
                <div class="sound-playing-indicator">
                    <div class="sound-bar"></div>
                    <div class="sound-bar"></div>
                    <div class="sound-bar"></div>
                    <div class="sound-bar"></div>
                </div>
            `;

            card.addEventListener('click', () => {
                SoundLibrary.toggle(sound.id);
                updateSoundUI();
            });

            grid.appendChild(card);
        });

        // Volume control
        const volumeSlider = $('#soundVolume');
        volumeSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            $('#volumeValue').textContent = val + '%';
            SoundLibrary.setMasterVolume(val / 100);
        });

        // Sound timer
        $('#soundTimer').addEventListener('change', (e) => {
            const minutes = parseInt(e.target.value);
            SoundLibrary.setSoundTimer(minutes);
        });

        // Stop all
        $('#stopAllSoundsBtn').addEventListener('click', () => {
            SoundLibrary.stopAll();
            setTimeout(updateSoundUI, 700);
        });
    }

    function updateSoundUI() {
        const playing = SoundLibrary.getPlayingSounds();

        $$('.sound-card').forEach((card) => {
            const id = card.dataset.soundId;
            card.classList.toggle('playing', playing.includes(id));
        });

        const mixInfo = $('#mixInfo');
        if (playing.length > 0) {
            mixInfo.style.display = 'block';
            const names = playing.map((id) => {
                const sound = SoundLibrary.getSounds().find((s) => s.id === id);
                return sound ? sound.name : id;
            });
            $('#activeSounds').textContent = names.join(' + ');
        } else {
            mixInfo.style.display = 'none';
        }
    }

    // ---- Sleep View ----
    function setupSleepView() {
        // Connection
        $('#connectBtn').addEventListener('click', async () => {
            const ip = $('#piAddress').value.trim();
            const port = parseInt($('#piPort').value) || 5000;

            if (!ip) {
                showToast('Please enter a device IP address', 'error');
                return;
            }

            try {
                SleepHaloAPI.setDemoMode(false);
                await SleepHaloAPI.connect(ip, port);
                updateConnectionUI(true, false);
                showToast('Connected to SleepHalo device!', 'success');
                saveSettings();
            } catch (err) {
                updateConnectionUI(false, false);
                showToast(err.message, 'error');
                // Fall back to demo mode
                SleepHaloAPI.setDemoMode(true);
            }
        });
    }

    function updateConnectionUI(isConnected, isDemo) {
        const dot = $('#connectionDot');
        const text = $('#connectionText');
        if (isConnected) {
            dot.classList.add('connected');
            text.textContent = isDemo ? 'Demo mode (simulated)' : 'Connected';
        } else {
            dot.classList.remove('connected');
            text.textContent = 'Not connected';
        }
    }

    function updateSleepStats() {
        const bedtime = $('#bedtime').value || '22:30';
        const alarmTime = $('#alarmTime').value || '07:00';

        const [bH, bM] = bedtime.split(':').map(Number);
        const [aH, aM] = alarmTime.split(':').map(Number);

        // Calculate sleep duration
        let sleepMinutes = (aH * 60 + aM) - (bH * 60 + bM);
        if (sleepMinutes <= 0) sleepMinutes += 24 * 60;

        const sleepH = Math.floor(sleepMinutes / 60);
        const sleepM = sleepMinutes % 60;

        // Calculate sunset start (bedtime minus sunset duration)
        let sunsetStartMin = (bH * 60 + bM) - state.sunsetDuration;
        if (sunsetStartMin < 0) sunsetStartMin += 24 * 60;
        const ssH = Math.floor(sunsetStartMin / 60) % 24;
        const ssM = sunsetStartMin % 60;

        // Calculate sunrise start (alarm minus sunrise duration)
        let sunriseStartMin = (aH * 60 + aM) - state.sunriseDuration;
        if (sunriseStartMin < 0) sunriseStartMin += 24 * 60;
        const srH = Math.floor(sunriseStartMin / 60) % 24;
        const srM = sunriseStartMin % 60;

        // Update UI
        $('#sleepDurationStat').textContent = `${sleepH}h ${sleepM}m`;
        $('#sunsetStartStat').textContent = pad(ssH) + ':' + pad(ssM);
        $('#sunriseStartStat').textContent = pad(srH) + ':' + pad(srM);
        $('#schedBedtime').textContent = bedtime;
        $('#schedWake').textContent = alarmTime;
    }

    function pad(n) {
        return String(n).padStart(2, '0');
    }

    // ---- Toast Notifications ----
    function showToast(message, type = 'info') {
        // Remove any existing toast
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    // ---- Local Storage ----
    function saveSettings() {
        const data = {
            userName: state.userName,
            sunsetDuration: state.sunsetDuration,
            sunriseDuration: state.sunriseDuration,
            alarmEnabled: state.alarmEnabled,
            bedtime: $('#bedtime').value,
            alarmTime: $('#alarmTime').value,
            piAddress: $('#piAddress').value,
            piPort: $('#piPort').value,
            demoMode: SleepHaloAPI.isDemoMode(),
            soundVolume: $('#soundVolume').value,
        };
        localStorage.setItem('sleephalo_settings', JSON.stringify(data));
    }

    function loadSettings() {
        try {
            const raw = localStorage.getItem('sleephalo_settings');
            if (!raw) return;

            const data = JSON.parse(raw);

            state.userName = data.userName || '';
            state.sunsetDuration = data.sunsetDuration || 30;
            state.sunriseDuration = data.sunriseDuration || 20;
            state.alarmEnabled = data.alarmEnabled || false;

            if (data.bedtime) $('#bedtime').value = data.bedtime;
            if (data.alarmTime) $('#alarmTime').value = data.alarmTime;
            if (data.piAddress) $('#piAddress').value = data.piAddress;
            if (data.piPort) $('#piPort').value = data.piPort;
            if (data.soundVolume) {
                $('#soundVolume').value = data.soundVolume;
                $('#volumeValue').textContent = data.soundVolume + '%';
            }

            $('#sunsetDuration').textContent = state.sunsetDuration;
            $('#sunriseDuration').textContent = state.sunriseDuration;
            $('#alarmToggle').checked = state.alarmEnabled;

            if (typeof data.demoMode !== 'undefined') {
                SleepHaloAPI.setDemoMode(data.demoMode);
            }
        } catch (e) {
            console.warn('Could not load settings:', e);
        }
    }

    // ---- Start ----
    document.addEventListener('DOMContentLoaded', init);
})();

/**
 * SleepHalo API Client
 * Handles communication with the Raspberry Pi device over HTTP.
 * When demo mode is on, API calls are simulated locally.
 */

const SleepHaloAPI = (() => {
    let baseUrl = '';
    let connected = false;
    let demoMode = true;
    let statusPollInterval = null;

    // Demo state used when no real device is available
    const demoState = {
        light: { r: 0, g: 0, b: 0, brightness: 0 },
        simulation: null, // 'sunset' | 'sunrise' | null
        simulationProgress: 0,
        focusMode: false,
    };

    /**
     * Configure the API base URL.
     * @param {string} ip - IP address of the Raspberry Pi.
     * @param {number} port - Port number (default 5000).
     */
    function configure(ip, port = 5000) {
        baseUrl = `http://${ip}:${port}`;
    }

    /**
     * Enable or disable demo mode.
     * @param {boolean} enabled
     */
    function setDemoMode(enabled) {
        demoMode = enabled;
    }

    function isDemoMode() {
        return demoMode;
    }

    function isConnected() {
        return connected;
    }

    /**
     * Make a request to the Pi server.
     */
    async function request(method, path, body = null) {
        if (demoMode) {
            return handleDemoRequest(method, path, body);
        }

        try {
            const options = {
                method,
                headers: { 'Content-Type': 'application/json' },
                mode: 'cors',
            };
            if (body) {
                options.body = JSON.stringify(body);
            }

            const response = await fetch(`${baseUrl}${path}`, options);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`API Error [${method} ${path}]:`, error);
            throw error;
        }
    }

    /**
     * Handle requests in demo mode (simulate device responses).
     */
    function handleDemoRequest(method, path, body) {
        return new Promise((resolve) => {
            setTimeout(() => {
                if (path === '/api/status') {
                    resolve({
                        ok: true,
                        light: { ...demoState.light },
                        simulation: demoState.simulation,
                        progress: demoState.simulationProgress,
                        focusMode: demoState.focusMode,
                    });
                } else if (path === '/api/light/set') {
                    Object.assign(demoState.light, body);
                    resolve({ ok: true });
                } else if (path === '/api/sunset/start') {
                    demoState.simulation = 'sunset';
                    demoState.simulationProgress = 0;
                    resolve({ ok: true, message: 'Sunset simulation started' });
                } else if (path === '/api/sunset/stop') {
                    demoState.simulation = null;
                    demoState.simulationProgress = 0;
                    resolve({ ok: true, message: 'Sunset simulation stopped' });
                } else if (path === '/api/sunrise/start') {
                    demoState.simulation = 'sunrise';
                    demoState.simulationProgress = 0;
                    resolve({ ok: true, message: 'Sunrise simulation started' });
                } else if (path === '/api/sunrise/stop') {
                    demoState.simulation = null;
                    demoState.simulationProgress = 0;
                    resolve({ ok: true, message: 'Sunrise simulation stopped' });
                } else if (path === '/api/focus') {
                    demoState.focusMode = body.enabled;
                    resolve({ ok: true });
                } else {
                    resolve({ ok: true });
                }
            }, 200); // simulate network delay
        });
    }

    // ---- Public API Methods ----

    /**
     * Try to connect to the device and check status.
     */
    async function connect(ip, port) {
        configure(ip, port);

        if (demoMode) {
            connected = true;
            return { ok: true, demo: true };
        }

        try {
            const status = await request('GET', '/api/status');
            connected = true;
            return status;
        } catch (err) {
            connected = false;
            throw new Error('Could not reach SleepHalo device. Check the IP address and make sure the server is running.');
        }
    }

    /**
     * Get current device status.
     */
    async function getStatus() {
        return await request('GET', '/api/status');
    }

    /**
     * Set light colour and brightness.
     * @param {number} r - Red (0-255)
     * @param {number} g - Green (0-255)
     * @param {number} b - Blue (0-255)
     * @param {number} brightness - Brightness (0-100)
     */
    async function setLight(r, g, b, brightness) {
        return await request('POST', '/api/light/set', { r, g, b, brightness });
    }

    /**
     * Start sunset simulation.
     * @param {number} durationMinutes - How long the sunset lasts.
     */
    async function startSunset(durationMinutes) {
        return await request('POST', '/api/sunset/start', { duration: durationMinutes });
    }

    /**
     * Stop sunset simulation.
     */
    async function stopSunset() {
        return await request('POST', '/api/sunset/stop');
    }

    /**
     * Start sunrise simulation.
     * @param {number} durationMinutes - How long the sunrise lasts.
     */
    async function startSunrise(durationMinutes) {
        return await request('POST', '/api/sunrise/start', { duration: durationMinutes });
    }

    /**
     * Stop sunrise simulation.
     */
    async function stopSunrise() {
        return await request('POST', '/api/sunrise/stop');
    }

    /**
     * Set focus mode on/off.
     */
    async function setFocusMode(enabled) {
        return await request('POST', '/api/focus', { enabled });
    }

    /**
     * Set an alarm with sunrise.
     * @param {string} time - Alarm time in HH:MM format.
     * @param {number} sunriseDuration - Minutes before alarm to start sunrise.
     * @param {string} sound - Sound type for the alarm.
     */
    async function setAlarm(time, sunriseDuration, sound) {
        return await request('POST', '/api/alarm/set', {
            time,
            sunrise_duration: sunriseDuration,
            sound,
        });
    }

    /**
     * Cancel the alarm.
     */
    async function cancelAlarm() {
        return await request('POST', '/api/alarm/cancel');
    }

    /**
     * Start polling for device status.
     * @param {function} callback - Called with status data every poll.
     * @param {number} intervalMs - Poll interval in milliseconds.
     */
    function startStatusPolling(callback, intervalMs = 5000) {
        stopStatusPolling();
        statusPollInterval = setInterval(async () => {
            try {
                const status = await getStatus();
                callback(status);
            } catch (err) {
                // silently ignore poll errors
            }
        }, intervalMs);
    }

    /**
     * Stop polling for device status.
     */
    function stopStatusPolling() {
        if (statusPollInterval) {
            clearInterval(statusPollInterval);
            statusPollInterval = null;
        }
    }

    // Convert hex colour to RGB
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
            ? {
                  r: parseInt(result[1], 16),
                  g: parseInt(result[2], 16),
                  b: parseInt(result[3], 16),
              }
            : { r: 0, g: 0, b: 0 };
    }

    return {
        configure,
        setDemoMode,
        isDemoMode,
        isConnected,
        connect,
        getStatus,
        setLight,
        startSunset,
        stopSunset,
        startSunrise,
        stopSunrise,
        setFocusMode,
        setAlarm,
        cancelAlarm,
        startStatusPolling,
        stopStatusPolling,
        hexToRgb,
    };
})();

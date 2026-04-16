# SleepHalo Web App

A companion web application for the **SleepHalo** smart circadian light system. SleepHalo helps you fall asleep with a sunset simulation and wake up gently with a sunrise simulation.

## What is SleepHalo?

SleepHalo is a smart lamp that uses light and sound to support a healthier sleep routine. The hardware prototype uses a **Raspberry Pi 5** with a **WS2812B LED strip** to create realistic sunset and sunrise light effects.

This web app connects to the SleepHalo device over your local network and lets you:

- **Set your bedtime** and start a sunset simulation that dims the light through warm colours.
- **Set an alarm** with a sunrise simulation that gradually brightens the room before wake-up time.
- **Play ambient sounds** like ocean waves, rain, forest, and more to help you relax.
- **Control the light** directly with colour presets and brightness controls.
- **Use Focus Mode** to block distractions during your wind-down routine.

## Features

- Sunset simulation with adjustable duration (5 to 120 minutes)
- Sunrise alarm with configurable wake-up light
- 8 built-in ambient sounds generated with Web Audio API (no files needed)
- Sound mixing — play multiple sounds at the same time
- Auto-stop timer for sounds
- Quick light colour presets
- Brightness control
- Sleep schedule overview with stats
- Demo mode for testing without the hardware
- Settings saved in the browser (localStorage)
- Works on phones, tablets, and desktops
- Dark theme designed for night-time use

## Project Structure

```
SleepHalo/
├── index.html              # Main web app (single-page application)
├── manifest.json           # PWA manifest
├── css/
│   └── style.css           # All styles
├── js/
│   ├── app.js              # Main app logic (UI, timers, navigation)
│   ├── api.js              # API client for Raspberry Pi communication
│   └── sounds.js           # Sound library (Web Audio API synthesis)
├── assets/
│   ├── logo.svg            # SleepHalo logo
│   └── sounds/             # Optional audio files
├── pi-server/
│   ├── server.py           # Flask server for Raspberry Pi
│   └── requirements.txt    # Python dependencies
└── README.md               # This file
```

## How to Use the Web App

### Quick Start (Demo Mode)

1. Open `index.html` in a web browser.
2. The app starts in **demo mode** by default — no hardware needed.
3. Try setting a bedtime, starting a sunset simulation, or playing sounds.

### Connect to the Hardware

1. Make sure the Raspberry Pi server is running (see below).
2. In the app, go to the **Sleep** tab.
3. Enter the Pi's IP address and port (default: 5000).
4. Click **Connect to Device**.
5. Once connected, all controls will send commands to the real LED strip.

## Raspberry Pi Server Setup

### Requirements

- Raspberry Pi 5 (or similar)
- WS2812B (NeoPixel) LED strip
- Python 3.9 or newer
- LED strip connected to GPIO 18

### Installation

1. Copy the `pi-server` folder to your Raspberry Pi.

2. Install the required Python packages:

   ```bash
   cd pi-server
   pip install -r requirements.txt
   ```

3. Start the server:

   ```bash
   sudo python server.py
   ```

4. The server will start on port 5000. You should see:

   ```
   ==================================================
     SleepHalo LED Controller Server
     Mode: Raspberry Pi
     LEDs: 30
     Port: 5000
   ==================================================
   ```

### Configuration

You can change these settings at the top of `server.py`:

- `LED_COUNT` — Number of LEDs on your strip (default: 30)
- `LED_BRIGHTNESS` — Default brightness from 0.0 to 1.0 (default: 0.7)
- `SERVER_PORT` — Server port (default: 5000)

## API Endpoints

The Pi server has these HTTP endpoints:

- `GET /api/status` — Get current device status
- `POST /api/light/set` — Set light colour `{ r, g, b, brightness }`
- `POST /api/sunset/start` — Start sunset `{ duration }` (minutes)
- `POST /api/sunset/stop` — Stop sunset simulation
- `POST /api/sunrise/start` — Start sunrise `{ duration }` (minutes)
- `POST /api/sunrise/stop` — Stop sunrise simulation
- `POST /api/focus` — Toggle focus mode `{ enabled }`
- `POST /api/alarm/set` — Set alarm `{ time, sunrise_duration, sound }`
- `POST /api/alarm/cancel` — Cancel the alarm

## Sound Library

The app includes 8 ambient sounds, all generated in real-time using the Web Audio API:

1. **Ocean Waves** — Layered noise with wave-like modulation
2. **Gentle Rain** — Filtered noise with raindrop texture
3. **Forest** — Ambient rustling with bird-like tones
4. **Wind** — Brown noise with gust modulation
5. **Campfire** — Crackling and low roar
6. **Night** — Crickets with calm background
7. **White Noise** — Steady pink noise
8. **Creek** — Flowing water with bubbling

You can play multiple sounds at the same time to create your own mix. The auto-stop timer will turn off all sounds after a set number of minutes.

## Technologies Used

- **HTML5 / CSS3 / JavaScript** — No frameworks, pure vanilla code
- **Web Audio API** — For real-time sound synthesis
- **Flask** (Python) — Lightweight server on the Raspberry Pi
- **NeoPixel** (Adafruit) — LED strip control library
- **localStorage** — For saving user settings in the browser

## Browser Support

The web app works in modern browsers:

- Chrome / Edge (recommended)
- Firefox
- Safari (iOS / macOS)

## Licence

This project was created as part of a university module (CM3141). The code is for educational purposes.

Sound generation uses the Web Audio API and does not include any third-party audio files.

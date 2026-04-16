"""
SleepHalo - Raspberry Pi LED Controller Server

This Flask server runs on the Raspberry Pi 5 and controls an LED strip
to simulate sunset and sunrise light sequences. The web app communicates
with this server over HTTP to control the light.

Hardware:
    - Raspberry Pi 5
    - WS2812B (NeoPixel) LED strip connected to GPIO 18

Usage:
    pip install -r requirements.txt
    sudo python server.py
"""

import time
import threading
import json
from flask import Flask, request, jsonify
from flask_cors import CORS

# Try to import neopixel (only works on Raspberry Pi)
try:
    import board
    import neopixel
    PI_MODE = True
except ImportError:
    PI_MODE = False
    print("[INFO] NeoPixel library not found. Running in simulation mode.")

# ---- Configuration ----
LED_COUNT = 30          # Number of LEDs on the strip
LED_PIN = board.D18 if PI_MODE else None
LED_BRIGHTNESS = 0.7    # Default brightness (0.0 to 1.0)
SERVER_PORT = 5000

# ---- App Setup ----
app = Flask(__name__)
CORS(app)  # Allow requests from the web app

# ---- LED Controller ----
class LEDController:
    """Controls the NeoPixel LED strip."""

    def __init__(self):
        self.pixels = None
        self.current_color = (0, 0, 0)
        self.brightness = LED_BRIGHTNESS
        self.simulation_active = False
        self.simulation_type = None  # 'sunset' or 'sunrise'
        self.simulation_thread = None
        self.focus_mode = False

        if PI_MODE:
            self.pixels = neopixel.NeoPixel(
                LED_PIN, LED_COUNT,
                brightness=LED_BRIGHTNESS,
                auto_write=False
            )
            self.clear()

    def set_color(self, r, g, b, brightness=None):
        """Set all LEDs to a specific colour."""
        self.current_color = (r, g, b)
        if brightness is not None:
            self.brightness = brightness / 100.0

        if self.pixels:
            self.pixels.brightness = self.brightness
            self.pixels.fill((r, g, b))
            self.pixels.show()

        print(f"[LED] Color: ({r}, {g}, {b}), Brightness: {self.brightness:.0%}")

    def clear(self):
        """Turn off all LEDs."""
        self.current_color = (0, 0, 0)
        if self.pixels:
            self.pixels.fill((0, 0, 0))
            self.pixels.show()

    def start_sunset(self, duration_minutes):
        """Start a sunset simulation that fades from warm to dark."""
        self.stop_simulation()
        self.simulation_active = True
        self.simulation_type = 'sunset'

        def run():
            total_steps = duration_minutes * 60  # one step per second
            # Sunset colour sequence: bright warm -> dim orange -> dim red -> off
            for step in range(total_steps):
                if not self.simulation_active:
                    break

                progress = step / total_steps  # 0.0 to 1.0

                if progress < 0.3:
                    # Phase 1: Warm white to golden
                    t = progress / 0.3
                    r = int(255 - t * 30)
                    g = int(200 - t * 100)
                    b = int(120 - t * 100)
                elif progress < 0.6:
                    # Phase 2: Golden to deep orange
                    t = (progress - 0.3) / 0.3
                    r = int(225 - t * 50)
                    g = int(100 - t * 60)
                    b = int(20 - t * 20)
                elif progress < 0.85:
                    # Phase 3: Deep orange to dim red
                    t = (progress - 0.6) / 0.25
                    r = int(175 - t * 100)
                    g = int(40 - t * 35)
                    b = int(0)
                else:
                    # Phase 4: Dim red to off
                    t = (progress - 0.85) / 0.15
                    r = int(75 * (1 - t))
                    g = int(5 * (1 - t))
                    b = 0

                brightness = max(0.05, 1.0 - progress * 0.95)
                self.set_color(r, g, b, brightness * 100)
                time.sleep(1)

            # Fully off at the end
            if self.simulation_active:
                self.clear()
                self.simulation_active = False
                self.simulation_type = None
                print("[LED] Sunset simulation complete.")

        self.simulation_thread = threading.Thread(target=run, daemon=True)
        self.simulation_thread.start()
        print(f"[LED] Sunset simulation started ({duration_minutes} min)")

    def start_sunrise(self, duration_minutes):
        """Start a sunrise simulation that gradually brightens."""
        self.stop_simulation()
        self.simulation_active = True
        self.simulation_type = 'sunrise'

        def run():
            total_steps = duration_minutes * 60
            for step in range(total_steps):
                if not self.simulation_active:
                    break

                progress = step / total_steps

                if progress < 0.3:
                    # Phase 1: Dark to dim red
                    t = progress / 0.3
                    r = int(t * 80)
                    g = int(t * 10)
                    b = int(t * 5)
                elif progress < 0.6:
                    # Phase 2: Dim red to orange
                    t = (progress - 0.3) / 0.3
                    r = int(80 + t * 140)
                    g = int(10 + t * 80)
                    b = int(5 + t * 15)
                elif progress < 0.85:
                    # Phase 3: Orange to warm white
                    t = (progress - 0.6) / 0.25
                    r = int(220 + t * 35)
                    g = int(90 + t * 110)
                    b = int(20 + t * 100)
                else:
                    # Phase 4: Warm white to bright daylight
                    t = (progress - 0.85) / 0.15
                    r = 255
                    g = int(200 + t * 55)
                    b = int(120 + t * 80)

                brightness = min(1.0, progress * 1.1)
                self.set_color(r, g, b, brightness * 100)
                time.sleep(1)

            if self.simulation_active:
                self.simulation_active = False
                self.simulation_type = None
                print("[LED] Sunrise simulation complete.")

        self.simulation_thread = threading.Thread(target=run, daemon=True)
        self.simulation_thread.start()
        print(f"[LED] Sunrise simulation started ({duration_minutes} min)")

    def stop_simulation(self):
        """Stop any running simulation."""
        self.simulation_active = False
        if self.simulation_thread:
            self.simulation_thread.join(timeout=2)
            self.simulation_thread = None
        self.simulation_type = None

    def get_status(self):
        """Return the current state."""
        return {
            "ok": True,
            "light": {
                "r": self.current_color[0],
                "g": self.current_color[1],
                "b": self.current_color[2],
                "brightness": int(self.brightness * 100)
            },
            "simulation": self.simulation_type,
            "focusMode": self.focus_mode,
        }


# Create the controller instance
led = LEDController()


# ---- API Routes ----

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get the current device status."""
    return jsonify(led.get_status())


@app.route('/api/light/set', methods=['POST'])
def set_light():
    """Set the LED colour and brightness."""
    data = request.get_json()
    r = data.get('r', 0)
    g = data.get('g', 0)
    b = data.get('b', 0)
    brightness = data.get('brightness', 70)
    led.set_color(r, g, b, brightness)
    return jsonify({"ok": True})


@app.route('/api/sunset/start', methods=['POST'])
def start_sunset():
    """Start a sunset simulation."""
    data = request.get_json()
    duration = data.get('duration', 30)
    led.start_sunset(duration)
    return jsonify({"ok": True, "message": "Sunset simulation started"})


@app.route('/api/sunset/stop', methods=['POST'])
def stop_sunset():
    """Stop the sunset simulation."""
    led.stop_simulation()
    led.clear()
    return jsonify({"ok": True, "message": "Sunset simulation stopped"})


@app.route('/api/sunrise/start', methods=['POST'])
def start_sunrise():
    """Start a sunrise simulation."""
    data = request.get_json()
    duration = data.get('duration', 20)
    led.start_sunrise(duration)
    return jsonify({"ok": True, "message": "Sunrise simulation started"})


@app.route('/api/sunrise/stop', methods=['POST'])
def stop_sunrise():
    """Stop the sunrise simulation."""
    led.stop_simulation()
    led.clear()
    return jsonify({"ok": True, "message": "Sunrise simulation stopped"})


@app.route('/api/focus', methods=['POST'])
def set_focus():
    """Toggle focus mode."""
    data = request.get_json()
    led.focus_mode = data.get('enabled', False)
    return jsonify({"ok": True, "focusMode": led.focus_mode})


@app.route('/api/alarm/set', methods=['POST'])
def set_alarm():
    """Set an alarm (handled mostly by the web app, stored here for reference)."""
    data = request.get_json()
    print(f"[ALARM] Set for {data.get('time')} with {data.get('sunrise_duration')} min sunrise")
    return jsonify({"ok": True})


@app.route('/api/alarm/cancel', methods=['POST'])
def cancel_alarm():
    """Cancel the alarm."""
    print("[ALARM] Cancelled")
    return jsonify({"ok": True})


# ---- Main ----
if __name__ == '__main__':
    print("=" * 50)
    print("  SleepHalo LED Controller Server")
    print(f"  Mode: {'Raspberry Pi' if PI_MODE else 'Simulation'}")
    print(f"  LEDs: {LED_COUNT}")
    print(f"  Port: {SERVER_PORT}")
    print("=" * 50)

    app.run(host='0.0.0.0', port=SERVER_PORT, debug=False)

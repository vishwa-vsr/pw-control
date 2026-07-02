# ⚡ PW Control — Playback Speed & Focus Extension

A premium, lightweight browser extension designed to enhance the learning experience on `pw.live`. It provides custom playback speed controls (up to 4.0x) and independent focus toggles to remove distracting elements from the video player interface.

---

## 🌟 Key Features

### ⏱️ Advanced Speed Control
- **Custom Playback Speed:** Go beyond default limits, adjusting speed from **0.5x up to 4.0x** (in increments of 0.1x).
- **Custom Snap Points:** Define 4 custom presets to quickly jump to your favorite speeds.
- **Scroll Wheel Speed Adjust:** Simply hover over the speed widget and scroll up/down to change speed instantly.
- **Dynamic Speed Toast:** A sleek on-screen overlay shows the updated speed when adjusted.

### 🎯 Tailored Focus Toggles (Independent Hiding)
- **Disable 'Ask AI':** Hide the floating AI helper capsule.
- **Disable Doubt Q&A:** Hide the Q&A question-bubble control.
- **Disable Live Chat:** Hide the standard live chat bubble.
- **Disable Study Notes:** Hide PDF attachments and notes panel controls.
- **Disable CC Subtitles:** Hide subtitles overlay and player caption settings.
- **Disable Speed Widget:** Hide the speedometer badge on the player toolbar.

### ⌨️ Hotkey Bindings
- Fully customizable keyboard shortcuts to **Speed Up**, **Slow Down**, and **Reset Speed** (defaults: `>`, `<`, `r`).

---

## 📂 File Architecture

This folder contains the core source files of the extension:

| File / Folder | Role & Description |
| :--- | :--- |
| 🛠️ **`manifest.json`** | Extension configuration (V3), permissions, and script registers. |
| 🎨 **`popup.html`** | HTML layout for the dashboard panel (Speed & Focus sections). |
| 🔮 **`popup.css`** | Premium interface styling featuring custom sliders, toggles, and modern typography. |
| 🧠 **`popup.js`** | Logic for popup state management, inputs, tab switching, and Chrome storage syncing. |
| 💉 **`content.js`** | Core content script injected into video frames to handle player layout adjustments and events. |
| 👁️ **`content.css`** | Injected styles for the custom speed controls and toast notifications. |
| 📦 **`build.py`** | Multi-platform build engine to minify, optimize, and bundle Chrome/Firefox packages. |
| 🖼️ **`icons/`** | Visual branding assets (16px, 48px, 128px png files). |

---

## 🛠️ How to Compile / Build

The build script automates minifying JS/CSS files, cleaning up directories, and packaging Gecko-compatible versions for Firefox.

1. Open your terminal in this `source code` directory.
2. Run the build script:
   ```bash
   python build.py -y
   ```
3. This creates two distribution-ready folders in the parent directory:
   - **`pw-dist`** (for Chrome, Brave, Edge, and Opera)
   - **`pw-firefox`** (fully tweaked for Firefox)

---

## 💻 Installation

### Chrome, Brave, or Edge (Developer Mode)
1. Go to `chrome://extensions/` or `brave://extensions/`.
2. Toggle on **Developer mode** (top-right).
3. Click **Load unpacked** (top-left).
4. Select the generated **`pw-dist`** directory.

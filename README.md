<div align="center">
  <img src="src/icons/icon128.png" width="96" height="96" alt="PW Control Logo" />
  
  # ⚡ PW Control
  ### Playback Speed & Focus Extension for Physics Wallah (`pw.live`)

  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
  [![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-blue?logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/pw-control/ibepglcdcaanmkledmpgfapaffkhbadj)
  [![Firefox Add-ons](https://img.shields.io/badge/Firefox-Add--on-orange?logo=firefox-browser&logoColor=white)](https://addons.mozilla.org/en-US/firefox/addon/pw-control/)
  [![Edge Add-ons](https://img.shields.io/badge/Edge-Add--on-green?logo=microsoft-edge&logoColor=white)](https://microsoftedge.microsoft.com/addons/detail/pw-control/cnoboofnelihfmnjfbpbelpfdmogfaan)

  A premium, lightweight browser extension designed to enhance the learning experience on `pw.live`. It provides custom playback speed controls (up to 4.0x) and independent focus toggles to remove distracting elements from the video player interface.

</div>

---

## 🚀 Installation & Download

### 🌐 Direct Store Downloads
* **Google Chrome:** [Download from Chrome Web Store](https://chromewebstore.google.com/detail/pw-control/ibepglcdcaanmkledmpgfapaffkhbadj)
* **Mozilla Firefox:** [Download from Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/pw-control/)
* **Microsoft Edge:** [Download from Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/pw-control/cnoboofnelihfmnjfbpbelpfdmogfaan)

### 🛠️ Local Developer Install (For Testing Changes)
1. Download or clone this repository to your computer.
2. Open your browser's extension manager page (e.g., `chrome://extensions` or `edge://extensions`).
3. Turn on **Developer mode** (usually a toggle in the top-right corner).
4. Click **Load unpacked** (top-left) and select the `dist/chrome` (or `dist/edge`) folder.

---

## 🌟 Key Features

| ⏱️ Advanced Speed Control | 🎯 Focus Mode Toggles |
| :--- | :--- |
| **Custom Playback Speeds:** Adjust speed from `0.5x` up to `4.0x` in steps of `0.1x`. | **Disable 'Ask AI':** Hide the floating AI helper capsule. |
| **Quick Presets:** Define 4 custom speed buttons to quickly switch to your favorite rates. | **Disable Doubt Q&A:** Hide the question-bubble doubt controls. |
| **Scroll to Adjust:** Hover over the speed widget and scroll your mouse wheel. | **Disable Live Chat:** Clean up the chat bubble area. |
| **Hold Space to Speed Up:** Hold <kbd>Spacebar</kbd> to play at a custom speed (default: `2.0x`). | **Disable Study Notes:** Hide attachments and note panels. |
| **Toast Speed HUD:** Sleek overlay showing your active speed when updated. | **Disable CC Subtitles:** Hide player caption controls. |

### ⌨️ Hotkey Bindings
You can configure keyboard shortcuts to control playback. (Defaults: <kbd>></kbd> to Speed Up, <kbd><</kbd> to Slow Down, and <kbd>r</kbd> to Reset).

---

## 📂 Project Architecture

```
pw-control/
├── src/                  # Extension source code
│   ├── manifest.json     # Configuration file
│   ├── popup.html/js/css # Extension popup controls
│   ├── content.js/css    # Injected video controllers
│   └── build.py          # Minifier compiler script
└── dist/                 # Compiled builds (ignored by Git)
    ├── chrome/           # Output for Chrome & Edge
    └── firefox/          # Output for Firefox
```

---

## 🛠️ How to Build

We use a Python script to automate minifying, optimizing, and packaging the extension.

1. Open your terminal in the root directory.
2. Run the build script:
   ```bash
   python src/build.py -y
   ```
   *(To package uploadable store zip files, add the `--zip` flag: `python src/build.py -y --zip`)*
3. The build folders will be generated inside the `dist/` directory.

---

## 🤝 How to Contribute

We welcome contributions! Here is how you can help:

1. **Find a Task:** Check out the project's GitHub Issues page for open tasks and feature ideas.
2. **Fork the Repo:** Create your own copy of this repository on GitHub.
3. **Create a Branch:** Create a branch for your feature (e.g., `git checkout -b feature/cool-new-setting`).
4. **Make Changes:** Keep your code neat, format your files, and test them locally.
5. **Submit a Pull Request:** Explain what you did and why, then submit it for review!

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

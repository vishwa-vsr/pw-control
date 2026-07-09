# Changelog

All notable changes to the **PW Control** extension project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.2] - 2026-07-09

### Added
- **Light & Dark Mode**: Added a sun/moon button in the top corner of the control panel to switch between a bright style and a dark slate style. Your selection is automatically saved.
- **Smart "Rate Us" Link**: Added a feedback button in the footer that automatically detects your web browser (Chrome, Firefox, or Edge) and opens the correct store page so you can rate the extension.
- **Direct Changelog Link**: Turned the version number in the footer into a link that opens the list of updates on GitHub.

### Changed
- **Dynamic Screen Refreshing**: Improved the extension to automatically trigger a page resize event when settings change. This forces the browser to refresh the video controls layout, preventing visual glitches or misaligned buttons.
- **Keyboard Shortcut Defaults**: Removed the default keyboard keys (`>` to speed up, `<` to slow down, `r` to reset) so shortcuts are empty by default, preventing unexpected button presses.
- **Enable Shortcuts Toggle**: Inverted the keyboard hotkey setting logic. Keyboard shortcuts are now "Enabled" rather than "Disabled" by default, so they will only work if you check the box to turn them on.
- **Hide Note Markers Option**: The distraction option that previously turned off subtitles now hides the note markers timeline on the video player instead.
- **Removed Static Speed Buttons**: Cleaned up the settings view by removing the quick-click speed preset buttons (1.0x, 1.5x, 1.8x, 2.0x), making the controls panel less cluttered.
- **Cleaner Dashboard Styles**: Refreshed the control panel styling with a clean slate gray design (with a "no glow" variation), smoother switching when toggling light/dark themes, and better spacing and text size for easier reading.
- **Chrome Build Folder Rename**: Updated the extension builder script to place Chrome files in a folder named `pw-chrome` instead of the generic name `pw-dist`.

### Fixed
- **Space Hold Focus Fix**: Fixed a bug where holding the Spacebar to speed up wouldn't work if you had just adjusted the video speed slider (because the slider kept focus and the extension thought you were typing in a text field). The key holds now work immediately even if the slider is focused.

---

## [1.0.1] - 2026-07-08

### Added
- **Hold Space to Speed Up**: Press and hold Spacebar to temporarily play at a custom speed (default `2.0x`). Releasing restores original speed. Custom rate is configurable in the popup Speed tab.
- **Hide Settings Gear Icon**: Option to hide the player settings/quality gear icon.
- **Hide Timeline Line**: Option to hide the horizontal seek/progress bar.
- **Hide Time Text**: Option to hide the duration, elapsed time, and remaining time display.
- **GitHub Repository Link**: Added a direct GitHub link in the footer.

### Changed
- **UI/UX Rebrand**: Updated design language to match the new Physics Wallah study portal (`study-v2/study`) using its signature Royal Blue (`#5A4BDA`) and obsidian slate-dark card layouts.
- **Minimalist Header**: Removed header subtitle and stripped the stroke/shadow frame around the logo, centering it at `32px`.
- **Footer Realignment**: Removed the "Focus Command Panel" text and aligned the GitHub link to the far-left and version display (`v1.0.1`) to the far-right.

### Fixed
- **Slash Separator Bug**: Resolved the layout bug where raw text slashes (`/`) remained visible when time text was disabled.
- **Space Double-Toggle Bug**: Resolved a race condition where tapping Space caused the video to play/pause for a microsecond by using capture-phase event listeners to isolate Spacebar interactions from page scripts.

---

## [1.0.0] - 2026-07-02

### Added
- **Speed Control Panel:** Adjustable speed from `0.5x` up to `4.0x` in steps of `0.1x`.
- **Keyboard Shortcuts:** Configurable shortcuts to speed up (`>`), slow down (`<`), and reset (`r`).
- **Scroll Wheel Support:** Scroll up/down over the speed badge to quickly tune playback rate.
- **Dynamic Snap Presets:** Custom presets (defaults `1.0x`, `2.0x`, `3.0x`, `4.0x`) for instant snapping.
- **Study Focus Toggles:** Independent options to disable individual distracting widgets:
  - **Disable 'Ask AI'**: Floating AI pill helper.
  - **Disable Doubt Q&A**: Doubt bubble icon (`💬` with Q).
  - **Disable Live Chat**: Live chat bubble icon (`💬`).
  - **Disable Study Notes**: Notes and PDF attachments.
  - **Disable CC Subtitles**: Captions display overlay and subtitle settings button.
  - **Disable Speed Widget**: Hide the custom speedometer panel itself.
- **Multitarget Build System:** Build script `build.py` compiles source to minified Chrome (`pw-dist`) and Firefox (`pw-firefox`) builds.

# Changelog

All notable changes to the **PW Control** extension project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.1] - 2026-07-06

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

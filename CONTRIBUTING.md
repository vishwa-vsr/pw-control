# Contributing to PW Control

We are excited that you want to help make **PW Control** better! Here is a simple guide to help you get started with contributing.

---

## 🛠️ Setting Up Your Development Environment

1. **Fork and Clone:**
   * Create a fork of this repository on GitHub, then clone your fork to your computer:
     ```bash
     git clone https://github.com/YOUR-USERNAME/pw-control.git
     ```
2. **Explore the Folders:**
   * `/src` — This is where all the active source code lives.
   * `/dist` — This is where compiled and minified versions are placed by the builder script (ignored by Git).

---

## ✏️ Making Changes

1. **Create a Branch:**
   * Always create a new branch for your feature or bug fix:
     ```bash
     git checkout -b feature/your-feature-name
     ```
2. **Edit the Code:**
   * Keep your changes clean and easy to read.
   * Add helpful comments to explain complex logic so other developers can follow your work.
3. **Local Testing:**
   * Before sending your changes, test them in your browser:
     1. Open the Extensions management page (e.g., `chrome://extensions` or `edge://extensions`).
     2. Enable **Developer Mode** in the top right.
     3. Click **Load unpacked** and select the `/dist/chrome` (or `/dist/edge`) folder.
     4. Go to `pw.live` and verify that everything works correctly.

---

## 📦 Building & Packaging

Whenever you edit files in `/src`, you need to compile them before testing. We use a Python script to minify the files and output them to `/dist`.

To run the builder:
```bash
python src/build.py -y
```

If you are preparing store packages for release, run it with the `--zip` flag to bundle the folders into ready-to-upload zip archives:
```bash
python src/build.py -y --zip
```

---

## 🚀 Submitting Your Changes

1. **Document Your Work:**
   * If you made visible updates, add a note under the `[Unreleased]` or new version section of the [CHANGELOG.md](CHANGELOG.md) file.
2. **Commit and Push:**
   * Commit your changes with a simple, clear message:
     ```bash
     git commit -m "Added a setting to customize space hold speed"
     git push origin feature/your-feature-name
     ```
3. **Open a Pull Request:**
   * Go to the main repository on GitHub and click **New Pull Request**.
   * Describe what your changes do and how to test them. We will review it as soon as possible!

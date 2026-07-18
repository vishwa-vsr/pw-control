document.addEventListener('DOMContentLoaded', () => {
  // Helper to safely access chrome.storage
  function safeStorageGet(keys, callback) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        chrome.storage.local.get(keys, (result) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            callback({});
          } else {
            callback(result || {});
          }
        });
      } catch (err) {
        callback({});
      }
    } else {
      callback({});
    }
  }

  function safeStorageSet(data) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(data);
    }
  }

  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const sunIcon = themeToggleBtn ? themeToggleBtn.querySelector('.sun-icon') : null;
  const moonIcon = themeToggleBtn ? themeToggleBtn.querySelector('.moon-icon') : null;

  function applyTheme(isLight) {
    if (isLight) {
      document.body.classList.add('light-theme');
      if (sunIcon) sunIcon.style.display = 'none';
      if (moonIcon) moonIcon.style.display = 'block';
    } else {
      document.body.classList.remove('light-theme');
      if (sunIcon) sunIcon.style.display = 'block';
      if (moonIcon) moonIcon.style.display = 'none';
    }
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isLight = document.body.classList.contains('light-theme');
      const nextLight = !isLight;
      applyTheme(nextLight);
      safeStorageSet({ themeMode: nextLight ? 'light' : 'dark' });
    });
  }

  const toggles = {
    hideAskAI: document.getElementById('hide-askai-toggle'),
    hideDoubt: document.getElementById('hide-doubt-toggle'),
    hideChat: document.getElementById('hide-chat-toggle'),
    hideNotes: document.getElementById('hide-notes-toggle'),
    hideNoteTimeline: document.getElementById('hide-notetimeline-toggle'),
    hideSpeed: document.getElementById('hide-speed-toggle'),
    hideSetting: document.getElementById('hide-setting-toggle'),
    hideTimeLine: document.getElementById('hide-timeline-toggle'),
    hideTimeText: document.getElementById('hide-timetext-toggle'),
    enableInstantHide: document.getElementById('enable-instant-hide-toggle'),
    enablePiP: document.getElementById('enable-pip-toggle')
  };

  const customToggles = {
    enableHotkeys: document.getElementById('enable-hotkeys-toggle'),
    disableScroll: document.getElementById('disable-scroll-toggle'),
    holdSpaceSpeedUp: document.getElementById('hold-space-toggle')
  };

  const holdSpaceSpeedInput = document.getElementById('hold-space-speed');

  const keyInputs = {
    keySpeedUp: document.getElementById('key-speedup'),
    keySlowDown: document.getElementById('key-slowdown'),
    keyReset: document.getElementById('key-reset')
  };

  const snapInputs = [
    document.getElementById('snap-pt1'),
    document.getElementById('snap-pt2'),
    document.getElementById('snap-pt3'),
    document.getElementById('snap-pt4')
  ];

  const speedSlider = document.getElementById('speed-slider');
  const speedDisplay = document.getElementById('speed-display');
  const presetBtns = document.querySelectorAll('.preset-btn');
  const loadingOverlay = document.getElementById('loading-overlay');
  const editorContainer = document.getElementById('hotkeys-editor-container');

  // Skip Silence element mappings
  const skipSilenceToggles = {
    enableSkipSilence: document.getElementById('enable-skipsilence-toggle')
  };

  const skipSilenceInputs = {
    silenceSpeed: document.getElementById('silence-speed'),
    silenceThreshold: document.getElementById('silence-threshold'),
    silenceDuration: document.getElementById('silence-duration'),
    skipIntroTime: document.getElementById('skip-intro')
  };

  const skipSilenceLabels = {
    silenceSpeed: document.getElementById('silence-speed-val'),
    silenceThreshold: document.getElementById('silence-threshold-val'),
    silenceDuration: document.getElementById('silence-duration-val'),
    skipIntroTime: document.getElementById('skip-intro-val')
  };

  const skipSilenceConfigContainer = document.getElementById('skipsilence-config-container');

  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const popupContainer = document.querySelector('.popup-container');

  function updateExtensionState(enabled) {
    if (enabled) {
      popupContainer.classList.remove('extension-disabled');
    } else {
      popupContainer.classList.add('extension-disabled');
    }
  }

  let snapPoints = [1.0, 2.0, 3.0, 4.0];

  function getDefaultKey(key) {
    if (key === 'keySpeedUp') return 'h';
    if (key === 'keySlowDown') return 'j';
    if (key === 'keyReset') return 'l';
    return '';
  }

  // Bind tab switching click handlers
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      
      // Update tab headers
      tabButtons.forEach(b => {
        const isActive = b === btn;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      // Update tab panels
      tabPanels.forEach(panel => {
        panel.classList.toggle('active', panel.id === targetTab);
      });
    });
  });

  // Toggle active styling of the keycap binder container
  function toggleEditorState(isDisabled) {
    if (editorContainer) {
      if (isDisabled) {
        editorContainer.classList.add('disabled');
      } else {
        editorContainer.classList.remove('disabled');
      }
    }
  }

  // Dynamically redraw tick labels and preset buttons based on custom snap points
  function updateTicksAndPresets(points) {
    const ticksRow = document.querySelector('.ticks-row');
    if (ticksRow) {
      ticksRow.textContent = '';
      points.forEach(pt => {
        // Calculate slider left percentage position (min: 0.5, max: 4.0, range: 3.5)
        const pct = ((pt - 0.5) / 3.5) * 100;
        const span = document.createElement('span');
        span.className = 'tick-label';
        span.style.left = `${pct}%`;
        span.textContent = `${pt.toFixed(1).replace(/\.0$/, '')}x`;
        ticksRow.appendChild(span);
      });
    }

    // Update data-speed values on preset buttons
    presetBtns.forEach((btn, index) => {
      if (points[index] !== undefined) {
        const pt = points[index];
        btn.setAttribute('data-speed', pt.toFixed(1));
        btn.textContent = `${pt.toFixed(1)}x`;
      }
    });
  }

  // Sync speed values to text labels and preset button classes
  function updateSpeedUI(speed) {
    const formattedSpeed = parseFloat(speed).toFixed(1);
    if (speedDisplay) {
      speedDisplay.textContent = `${formattedSpeed}x`;
    }
    if (speedSlider) {
      speedSlider.value = formattedSpeed;
      // Calculate and set CSS variable for visual slider progress fill (min 0.5, max 4.0)
      const percent = ((parseFloat(formattedSpeed) - 0.5) / 3.5) * 100;
      speedSlider.style.setProperty('--percent', `${percent}%`);
    }
    
    // Highlight the active preset chip
    presetBtns.forEach(btn => {
      const btnSpeed = parseFloat(btn.getAttribute('data-speed'));
      if (Math.abs(btnSpeed - speed) < 0.05) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // Save playback rate setting to extension storage
  function saveSpeed(speed) {
    safeStorageSet({ preferredSpeed: speed });
  }

  // Helper to dismiss loading overlay and remove from DOM after fade
  function dismissLoadingOverlay() {
    if (loadingOverlay) {
      loadingOverlay.classList.add('fade-out');
      loadingOverlay.addEventListener('transitionend', () => {
        loadingOverlay.remove();
      }, { once: true });
    }
  }

  const holdSpaceConfigRow = document.getElementById('hold-space-config-row');
  function toggleHoldSpaceConfig(isDisabled) {
    if (holdSpaceConfigRow) {
      if (isDisabled) {
        holdSpaceConfigRow.classList.add('disabled');
      } else {
        holdSpaceConfigRow.classList.remove('disabled');
      }
    }
  }

  function toggleSkipSilenceConfig(isDisabled) {
    if (skipSilenceConfigContainer) {
      if (isDisabled) {
        skipSilenceConfigContainer.classList.add('disabled');
      } else {
        skipSilenceConfigContainer.classList.remove('disabled');
      }
    }
  }

  safeStorageGet(
    ['preferredSpeed', 'hideAskAI', 'hideDoubt', 'hideChat', 'hideNotes', 'hideNoteTimeline', 'hideSpeed', 'hideSetting', 'hideTimeLine', 'hideTimeText', 'enableInstantHide', 'enableHotkeys', 'disableScroll', 'holdSpaceSpeedUp', 'holdSpaceSpeed', 'keySpeedUp', 'keySlowDown', 'keyReset', 'snapPoints', 'extensionEnabled', 'themeMode', 'enablePiP', 'enableSkipSilence', 'silenceSpeed', 'silenceThreshold', 'silenceDuration', 'skipIntroTime'],
    (result) => {
      applyTheme(result.themeMode === 'light');
      // Load focus toggles
      for (const key in toggles) {
        if (toggles[key]) {
          if (key === 'enablePiP') {
            toggles[key].checked = result[key] !== false;
          } else {
            toggles[key].checked = !!result[key];
          }
        }
      }

      // Load extension enabled state (always active)
      updateExtensionState(result.extensionEnabled !== false);

      // Load custom settings
      if (customToggles.enableHotkeys) {
        customToggles.enableHotkeys.checked = !!result.enableHotkeys;
        toggleEditorState(!result.enableHotkeys);
      }
      if (customToggles.disableScroll) {
        customToggles.disableScroll.checked = !!result.disableScroll;
      }
      if (customToggles.holdSpaceSpeedUp) {
        customToggles.holdSpaceSpeedUp.checked = !!result.holdSpaceSpeedUp;
        toggleHoldSpaceConfig(!result.holdSpaceSpeedUp);
      }
      if (holdSpaceSpeedInput) {
        holdSpaceSpeedInput.value = result.holdSpaceSpeed !== undefined ? parseFloat(result.holdSpaceSpeed).toFixed(1) : "2.0";
      }

      // Load custom snap points
      if (result.snapPoints && Array.isArray(result.snapPoints) && result.snapPoints.length === 4) {
        snapPoints = result.snapPoints.map(v => parseFloat(v));
      }
      snapInputs.forEach((input, index) => {
        if (input && snapPoints[index] !== undefined) {
          input.value = snapPoints[index].toFixed(1);
        }
      });
      updateTicksAndPresets(snapPoints);

      // Load key bindings (default to empty if uninitialized)
      if (keyInputs.keySpeedUp) keyInputs.keySpeedUp.value = result.keySpeedUp || getDefaultKey('keySpeedUp');
      if (keyInputs.keySlowDown) keyInputs.keySlowDown.value = result.keySlowDown || getDefaultKey('keySlowDown');
      if (keyInputs.keyReset) keyInputs.keyReset.value = result.keyReset || getDefaultKey('keyReset');

      // Load speed (default to 1.0x if uninitialized)
      const speed = result.preferredSpeed ? parseFloat(result.preferredSpeed) : 1.0;
      updateSpeedUI(speed);

      // Load Skip Silence settings
      if (skipSilenceToggles.enableSkipSilence) {
        const skipEnabled = !!result.enableSkipSilence;
        skipSilenceToggles.enableSkipSilence.checked = skipEnabled;
        toggleSkipSilenceConfig(!skipEnabled);
      }
      
      const sSpeed = result.silenceSpeed !== undefined ? parseFloat(result.silenceSpeed) : 5.0;
      if (skipSilenceInputs.silenceSpeed) {
        skipSilenceInputs.silenceSpeed.value = sSpeed;
        if (skipSilenceLabels.silenceSpeed) {
          skipSilenceLabels.silenceSpeed.textContent = sSpeed.toFixed(1) + "x";
        }
      }

      const sThreshold = result.silenceThreshold !== undefined ? parseInt(result.silenceThreshold) : -50;
      if (skipSilenceInputs.silenceThreshold) {
        skipSilenceInputs.silenceThreshold.value = sThreshold;
        if (skipSilenceLabels.silenceThreshold) {
          skipSilenceLabels.silenceThreshold.textContent = sThreshold + " dB";
        }
      }

      const sDuration = result.silenceDuration !== undefined ? parseFloat(result.silenceDuration) : 0.5;
      if (skipSilenceInputs.silenceDuration) {
        skipSilenceInputs.silenceDuration.value = sDuration;
        if (skipSilenceLabels.silenceDuration) {
          skipSilenceLabels.silenceDuration.textContent = sDuration.toFixed(1) + "s";
        }
      }

      const sIntro = result.skipIntroTime !== undefined ? parseInt(result.skipIntroTime) : 0;
      if (skipSilenceInputs.skipIntroTime) {
        skipSilenceInputs.skipIntroTime.value = sIntro;
        if (skipSilenceLabels.skipIntroTime) {
          skipSilenceLabels.skipIntroTime.textContent = sIntro === 0 ? "Off" : sIntro + "s";
        }
      }

      // Remove loading overlay
      dismissLoadingOverlay();
    }
  );

  // Save focus toggles changes
  for (const key in toggles) {
    if (toggles[key]) {
      toggles[key].addEventListener('change', (e) => {
        safeStorageSet({ [key]: e.target.checked });
      });
    }
  }



  // Save custom layout settings changes
  for (const key in customToggles) {
    if (customToggles[key]) {
      customToggles[key].addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        if (key === 'enableHotkeys') {
          toggleEditorState(!isChecked);
        }
        if (key === 'holdSpaceSpeedUp') {
          toggleHoldSpaceConfig(!isChecked);
        }
        safeStorageSet({ [key]: isChecked });
      });
    }
  }

  // Bind interactive hold space custom speed rate changes
  if (holdSpaceSpeedInput) {
    holdSpaceSpeedInput.addEventListener('change', () => {
      let val = parseFloat(holdSpaceSpeedInput.value);
      if (isNaN(val) || val < 1.1 || val > 4.0) {
        val = 2.0;
      }
      val = Math.round(val * 10) / 10;
      holdSpaceSpeedInput.value = val.toFixed(1);
      safeStorageSet({ holdSpaceSpeed: val });
    });
  }

  // Bind Skip Silence toggle and inputs
  if (skipSilenceToggles.enableSkipSilence) {
    skipSilenceToggles.enableSkipSilence.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      toggleSkipSilenceConfig(!isChecked);
      safeStorageSet({ enableSkipSilence: isChecked });
    });
  }

  if (skipSilenceInputs.silenceSpeed) {
    skipSilenceInputs.silenceSpeed.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (skipSilenceLabels.silenceSpeed) {
        skipSilenceLabels.silenceSpeed.textContent = val.toFixed(1) + "x";
      }
      safeStorageSet({ silenceSpeed: val });
    });
  }

  if (skipSilenceInputs.silenceThreshold) {
    skipSilenceInputs.silenceThreshold.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      if (skipSilenceLabels.silenceThreshold) {
        skipSilenceLabels.silenceThreshold.textContent = val + " dB";
      }
      safeStorageSet({ silenceThreshold: val });
    });
  }

  if (skipSilenceInputs.silenceDuration) {
    skipSilenceInputs.silenceDuration.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (skipSilenceLabels.silenceDuration) {
        skipSilenceLabels.silenceDuration.textContent = val.toFixed(1) + "s";
      }
      safeStorageSet({ silenceDuration: val });
    });
  }

  if (skipSilenceInputs.skipIntroTime) {
    skipSilenceInputs.skipIntroTime.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      if (skipSilenceLabels.skipIntroTime) {
        skipSilenceLabels.skipIntroTime.textContent = val === 0 ? "Off" : val + "s";
      }
      safeStorageSet({ skipIntroTime: val });
    });
  }

  // Bind interactive snap point input changes
  snapInputs.forEach((input, index) => {
    if (input) {
      input.addEventListener('change', () => {
        let val = parseFloat(input.value);
        if (isNaN(val) || val < 0.5 || val > 4.0) {
          // Reset to index default
          val = index + 1.0;
        }

        // Round to 1 decimal place
        val = Math.round(val * 10) / 10;
        input.value = val.toFixed(1);

        // Update snap point state
        snapPoints[index] = val;

        // Save array to storage
        safeStorageSet({ snapPoints: snapPoints });

        // Dynamically redraw tick marks and preset button attributes
        updateTicksAndPresets(snapPoints);
        updateSpeedUI(speedSlider ? parseFloat(speedSlider.value) : 1.0);
      });
    }
  });

  // Bind interactive key press recording with guide labels
  for (const key in keyInputs) {
    const input = keyInputs[key];
    if (input) {
      // Guide prompt on click/focus
      input.addEventListener('focus', () => {
        input.value = 'Press key...';
        input.style.color = 'var(--accent-focus)';
      });

      // Restore saved value on blur if no key was recorded
      input.addEventListener('blur', () => {
        input.style.removeProperty('color');
        safeStorageGet(key, (result) => {
          input.value = result[key] || getDefaultKey(key);
        });
      });

      // Keypress listener
      input.addEventListener('keydown', (e) => {
        e.preventDefault();
        
        // Ignore pure modifier keys
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
          return;
        }

        let boundKey = e.key;
        if (boundKey === ' ') boundKey = 'Space';

        input.value = boundKey;
        
        safeStorageSet({ [key]: boundKey });
        input.blur(); // exit focus state
      });
    }
  }

  // Bind slider drag changes
  if (speedSlider) {
    speedSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      updateSpeedUI(val);
      saveSpeed(val);
    });
  }

  // Bind preset button click events
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const speed = parseFloat(btn.getAttribute('data-speed'));
      updateSpeedUI(speed);
      saveSpeed(speed);
    });
  });

  // Bind settings gear panel expand/collapse events
  const settingsToggleBtn = document.getElementById('settings-toggle-btn');
  const presetsEditorContainer = document.getElementById('presets-editor-container');

  if (settingsToggleBtn && presetsEditorContainer) {
    settingsToggleBtn.addEventListener('click', () => {
      const isExpanded = presetsEditorContainer.classList.contains('expanded');
      if (isExpanded) {
        presetsEditorContainer.classList.remove('expanded');
        settingsToggleBtn.setAttribute('aria-expanded', 'false');
      } else {
        presetsEditorContainer.classList.add('expanded');
        settingsToggleBtn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  // Handle external links opening in a new tab
  const githubLink = document.querySelector('.github-link');
  if (githubLink) {
    githubLink.addEventListener('click', (e) => {
      e.preventDefault();
      const url = githubLink.getAttribute('href');
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: url });
      } else {
        window.open(url, '_blank');
      }
    });
  }

  const versionLink = document.querySelector('.version-link');
  if (versionLink) {
    versionLink.addEventListener('click', (e) => {
      e.preventDefault();
      const url = versionLink.getAttribute('href');
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: url });
      } else {
        window.open(url, '_blank');
      }
    });
  }
  const rateLink = document.querySelector('.rate-link');
  if (rateLink) {
    let rateUrl = 'https://chromewebstore.google.com/detail/pw-control/ibepglcdcaanmkledmpgfapaffkhbadj?authuser=0&hl=en-GB';
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('firefox')) {
      rateUrl = 'https://addons.mozilla.org/en-US/firefox/addon/pw-control/';
    } else if (ua.includes('edg')) {
      rateUrl = 'https://microsoftedge.microsoft.com/addons/detail/pw-control/cnoboofnelihfmnjfbpbelpfdmogfaan';
    }
    rateLink.setAttribute('href', rateUrl);
    rateLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: rateUrl });
      } else {
        window.open(rateUrl, '_blank');
      }
    });
  }

  // --- Live Visualizer Integration ---
  const visualizerBarFill = document.getElementById('visualizer-bar-fill');
  const visualizerThresholdMarker = document.getElementById('visualizer-threshold-marker');
  const visualizerDbVal = document.getElementById('visualizer-db-val');

  function dbToPercent(db) {
    if (db <= -80) return 0;
    if (db >= 0) return 100;
    return ((db + 80) / 80) * 100;
  }

  let visualizerPort = null;

  function connectVisualizer() {
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) return;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0] || !tabs[0].id) return;
      
      try {
        visualizerPort = chrome.tabs.connect(tabs[0].id, { name: "popup-connection" });
        
        visualizerPort.onMessage.addListener((msg) => {
          if (!msg) return;

          const { volumeDb, thresholdDb, isSilent, isScanning } = msg;

          // Update threshold marker position
          if (visualizerThresholdMarker) {
            const markerPct = dbToPercent(thresholdDb);
            visualizerThresholdMarker.style.left = `${markerPct}%`;
          }

          // Update visualizer fill bar
          if (visualizerBarFill) {
            if (isScanning) {
              const volumePct = dbToPercent(volumeDb);
              visualizerBarFill.style.width = `${volumePct}%`;
              
              if (isSilent) {
                visualizerBarFill.classList.add('silent');
              } else {
                visualizerBarFill.classList.remove('silent');
              }
            } else {
              visualizerBarFill.style.width = '0%';
              visualizerBarFill.classList.add('silent');
            }
          }

          // Update text label
          if (visualizerDbVal) {
            if (isScanning) {
              visualizerDbVal.textContent = isSilent 
                ? `SILENT (${Math.round(volumeDb)} dB)` 
                : `${Math.round(volumeDb)} dB`;
              visualizerDbVal.style.color = isSilent ? '#64748b' : '#10b981';
            } else {
              visualizerDbVal.textContent = 'PAUSED';
              visualizerDbVal.style.color = '#64748b';
            }
          }
        });

        visualizerPort.onDisconnect.addListener(() => {
          visualizerPort = null;
          setTimeout(connectVisualizer, 1000);
        });
      } catch (err) {
        // Suppress connection errors
      }
    });
  }

  // Initial connection
  connectVisualizer();
});

(function () {

  let currentSpeed = 1.0;
  let activeVideo = null;
  let isSettingRate = false;
  let toastTimeout = null;
  let isModifyingDOM = false;
  let extensionEnabled = true;

  // New Caching and Feature states
  let enableInstantHide = false;
  let enablePiP = true;
  let cachedVideo = null;
  let cachedSettingsBtn = null;
  let cachedFullscreenBtn = null;
  let cachedTimeline = null;
  let cachedTimeTexts = null;
  let cachedNativeSpeedBadges = null;
  let lastCollapsedTime = 0;

  // Custom hotkey and snap point configurations
  let enableHotkeys = false;
  let disableScroll = false;
  let keySpeedUp = 'h';
  let keySlowDown = 'j';
  let keyReset = 'l';
  let snapPoints = [1.0, 2.0, 3.0, 4.0];

  // Hold Space to Speed Up configuration
  let holdSpaceSpeedUp = false;
  let holdSpaceSpeed = 2.0;
  let spacePressTimer = null;
  let isHoldingSpace = false;
  let speedBeforeHold = 1.0;

  // Skip Silence and Skip Intro configuration states
  let enableSkipSilence = false;
  let silenceSpeed = 5.0;
  let silenceThreshold = -50;
  let silenceDuration = 0.5;
  let skipIntroTime = 0;

  // Skip Silence: Shared global AudioContext and per-element audio graph cache
  let sharedAudioCtx = null;
  const audioGraphCache = new WeakMap();
  let isSilentStateActive = false;
  let silenceMsCount = 0;
  let lastSkippedSrc = '';
  let silenceCheckInterval = null;
  let activeSilenceVideo = null;
  let currentVolumeDb = -100; // Live volume tracking for popup visualizer

  // Helper to step speed up or down by 0.1, clamped to 0.5–4.0
  function stepSpeed(direction) {
    let val = direction > 0
      ? Math.min(4.0, currentSpeed + 0.1)
      : Math.max(0.5, currentSpeed - 0.1);
    return Math.round(val * 10) / 10;
  }

  // Helper to hide or show an element with !important
  function setHidden(el, shouldHide) {
    if (shouldHide) {
      el.style.setProperty('display', 'none', 'important');
    } else {
      el.style.removeProperty('display');
    }
  }

  // Helper to check if a leaf element is a native speed badge (e.g. "1.1x" next to the timer)
  function isNativeSpeedBadge(el) {
    if (el.children.length !== 0) return false;
    const text = (el.textContent || '').trim();
    if (!/^\d+(\.\d+)?x$/i.test(text)) return false;
    const className = el.getAttribute('class') || '';
    const id = el.id || '';
    const isSelf = id.includes('pwc-') || className.includes('pwc-');
    return !isSelf && !isDrawingToolbarElement(el);
  }

  // Toggle mapping keys to documentElement class names
  const classMap = {
    hideAskAI: 'pwc-hide-askai',
    hideDoubt: 'pwc-hide-doubt',
    hideChat: 'pwc-hide-chat',
    hideNotes: 'pwc-hide-notes',
    hideNoteTimeline: 'pwc-hide-notetimeline',
    hideSpeed: 'pwc-hide-speed',
    hideSetting: 'pwc-hide-setting',
    hideTimeLine: 'pwc-hide-timeline',
    hideTimeText: 'pwc-hide-timetext'
  };

  // Hiding toggle states
  let hideSettings = {
    hideAskAI: false,
    hideDoubt: false,
    hideChat: false,
    hideNotes: false,
    hideNoteTimeline: false,
    hideSpeed: false,
    hideSetting: false,
    hideTimeLine: false,
    hideTimeText: false
  };

  // Helper to safely access chrome storage without throwing context invalidated exceptions
  function safeGetSettings(callback) {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id || !chrome.storage || !chrome.storage.local) {
      return;
    }
    try {
      chrome.storage.local.get(
        ['preferredSpeed', 'hideAskAI', 'hideDoubt', 'hideChat', 'hideNotes', 'hideNoteTimeline', 'hideSpeed', 'hideSetting', 'hideTimeLine', 'hideTimeText', 'enableInstantHide', 'enableHotkeys', 'disableScroll', 'holdSpaceSpeedUp', 'holdSpaceSpeed', 'keySpeedUp', 'keySlowDown', 'keyReset', 'snapPoints', 'extensionEnabled', 'enablePiP', 'enableSkipSilence', 'silenceSpeed', 'silenceThreshold', 'silenceDuration', 'skipIntroTime'], 
        function (result) {
          try {
            if (chrome.runtime && chrome.runtime.id) {
              callback(result);
            }
          } catch (e) {}
        }
      );
    } catch (err) {}
  }

  // Helper to safely write chrome storage without throwing context invalidated exceptions
  function safeSetSettings(data) {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id || !chrome.storage || !chrome.storage.local) {
      return;
    }
    try {
      chrome.storage.local.set(data, function () {
        // Read lastError to suppress orphaned context developer warnings in console
        const lastError = chrome.runtime.lastError;
      });
    } catch (err) {}
  }

  // Dynamically redraw tick marks inside player UI using safe DOM APIs
  function updatePlayerTicks(points) {
    document.querySelectorAll('.pwc-slider-ticks').forEach(ticksContainer => {
      ticksContainer.textContent = '';
      points.forEach(pt => {
        const pct = ((pt - 0.5) / 3.5) * 100;
        const tickLabel = document.createElement('span');
        tickLabel.className = 'pwc-tick-label';
        tickLabel.style.left = `${pct}%`;
        tickLabel.textContent = `${pt.toFixed(1).replace(/\.0$/, '')}x`;
        ticksContainer.appendChild(tickLabel);
      });
    });
  }

  // Load initial settings safely
  safeGetSettings(function (result) {
    extensionEnabled = result.extensionEnabled !== false;
    if (result.preferredSpeed) {
      currentSpeed = parseFloat(result.preferredSpeed);
      applySpeedToActiveVideo();
    }
    for (const key in hideSettings) {
      if (result.hasOwnProperty(key)) {
        hideSettings[key] = !!result[key];
      }
    }

    enablePiP = result.enablePiP !== false;
    enableInstantHide = !!result.enableInstantHide;
    enableHotkeys = !!result.enableHotkeys;
    disableScroll = !!result.disableScroll;
    holdSpaceSpeedUp = !!result.holdSpaceSpeedUp;
    holdSpaceSpeed = result.holdSpaceSpeed !== undefined ? parseFloat(result.holdSpaceSpeed) : 2.0;
    keySpeedUp = result.keySpeedUp || 'h';
    keySlowDown = result.keySlowDown || 'j';
    keyReset = result.keyReset || 'l';

    enableSkipSilence = !!result.enableSkipSilence;
    silenceSpeed = result.silenceSpeed !== undefined ? parseFloat(result.silenceSpeed) : 5.0;
    silenceThreshold = result.silenceThreshold !== undefined ? parseInt(result.silenceThreshold) : -50;
    silenceDuration = result.silenceDuration !== undefined ? parseFloat(result.silenceDuration) : 0.5;
    skipIntroTime = result.skipIntroTime !== undefined ? parseInt(result.skipIntroTime) : 0;

    if (result.snapPoints && Array.isArray(result.snapPoints) && result.snapPoints.length === 4) {
      snapPoints = result.snapPoints.map(v => parseFloat(v));
    }

    applySettingsHTML(hideSettings);
    applyDistractorsState();

    if (activeVideo) {
      setupAudioAnalysis(activeVideo);
      if (enableSkipSilence) {
        handleSkipIntro(activeVideo);
      }
    }
  });

  // Listen for storage changes from the settings popup
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.onChanged) {
    try {
      chrome.storage.onChanged.addListener(function (changes, area) {
        try {
          if (!chrome.runtime || !chrome.runtime.id) return;
          if (area === 'local') {
            let changed = false;
            if (changes.hasOwnProperty('extensionEnabled')) {
              extensionEnabled = changes.extensionEnabled.newValue !== false;
              changed = true;
            }
            for (const key in hideSettings) {
              if (changes.hasOwnProperty(key)) {
                hideSettings[key] = !!changes[key].newValue;
                changed = true;
              }
            }

            // Sync hotkey bindings in real-time
            if (changes.hasOwnProperty('enableInstantHide')) {
              enableInstantHide = !!changes.enableInstantHide.newValue;
              changed = true;
            }
            if (changes.hasOwnProperty('enablePiP')) {
              enablePiP = changes.enablePiP.newValue !== false;
              changed = true;
            }
            if (changes.hasOwnProperty('enableHotkeys')) {
              enableHotkeys = !!changes.enableHotkeys.newValue;
            }
            if (changes.hasOwnProperty('disableScroll')) {
              disableScroll = !!changes.disableScroll.newValue;
            }
            if (changes.hasOwnProperty('holdSpaceSpeedUp')) {
              holdSpaceSpeedUp = !!changes.holdSpaceSpeedUp.newValue;
            }
            if (changes.hasOwnProperty('holdSpaceSpeed')) {
              holdSpaceSpeed = changes.holdSpaceSpeed.newValue !== undefined ? parseFloat(changes.holdSpaceSpeed.newValue) : 2.0;
            }
            if (changes.hasOwnProperty('keySpeedUp')) {
              keySpeedUp = changes.keySpeedUp.newValue;
            }
            if (changes.hasOwnProperty('keySlowDown')) {
              keySlowDown = changes.keySlowDown.newValue;
            }
            if (changes.hasOwnProperty('keyReset')) {
              keyReset = changes.keyReset.newValue;
            }

            if (changes.hasOwnProperty('enableSkipSilence')) {
              enableSkipSilence = !!changes.enableSkipSilence.newValue;
              if (activeVideo) {
                setupAudioAnalysis(activeVideo);
                if (enableSkipSilence) {
                  handleSkipIntro(activeVideo);
                }
              }
            }
            if (changes.hasOwnProperty('silenceSpeed')) {
              silenceSpeed = parseFloat(changes.silenceSpeed.newValue);
              if (activeVideo && enableSkipSilence) {
                setupAudioAnalysis(activeVideo);
              }
            }
            if (changes.hasOwnProperty('silenceThreshold')) {
              silenceThreshold = parseInt(changes.silenceThreshold.newValue);
            }
            if (changes.hasOwnProperty('silenceDuration')) {
              silenceDuration = parseFloat(changes.silenceDuration.newValue);
              if (activeVideo && enableSkipSilence) {
                setupAudioAnalysis(activeVideo);
              }
            }
            if (changes.hasOwnProperty('skipIntroTime')) {
              skipIntroTime = parseInt(changes.skipIntroTime.newValue);
              if (activeVideo) {
                handleSkipIntro(activeVideo);
              }
            }

            // Sync custom snap points in real-time
            if (changes.hasOwnProperty('snapPoints')) {
              snapPoints = (changes.snapPoints.newValue || [1.0, 2.0, 3.0, 4.0]).map(v => parseFloat(v));
              updatePlayerTicks(snapPoints);
            }

            // Sync preferredSpeed value changes in real-time
            if (changes.hasOwnProperty('preferredSpeed')) {
              currentSpeed = parseFloat(changes.preferredSpeed.newValue);
              applySpeedToActiveVideo();
            }

            if (changed) {
              applySettingsHTML(hideSettings);
              applyDistractorsState();
              setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
              }, 50);
            }
          }
        } catch (e) {}
      });
    } catch (err) {}
  }

  // Apply layout class tags to documentElement for zero-flicker hiding
  function applySettingsHTML(settings) {
    const root = document.documentElement;

    Object.keys(classMap).forEach(key => {
      const className = classMap[key];
      const isEnabled = extensionEnabled && (settings[key] === true);
      if (isEnabled) {
        root.classList.add(className);
      } else {
        root.classList.remove(className);
      }
    });
  }

  // Helper to find video elements in the document
  function findVideos(root = document) {
    return Array.from(root.querySelectorAll('video'));
  }

  // Helper to find the active video element (selects the video with largest display area)
  function getActiveVideo() {
    // If a video is currently in Picture-in-Picture, it is definitely the active one!
    if (document.pictureInPictureElement) {
      cachedVideo = document.pictureInPictureElement;
      return document.pictureInPictureElement;
    }

    const videos = findVideos(document);
    if (videos.length === 0) {
      cachedVideo = null;
      return null;
    }
    if (videos.length === 1) {
      cachedVideo = videos[0];
      return videos[0];
    }
    
    let mainVideo = videos[0];
    let maxArea = -1;
    for (const v of videos) {
      const isVisible = v.offsetWidth > 0 && v.offsetHeight > 0;
      if (!isVisible) continue;

      const area = (v.videoWidth || v.clientWidth || 0) * (v.videoHeight || v.clientHeight || 0);
      if (area > maxArea) {
        maxArea = area;
        mainVideo = v;
      }
    }
    cachedVideo = mainVideo;
    return mainVideo;
  }

  // Helper to traverse up and find the actual clickable control button container
  function getControlButton(el) {
    if (!el) return null;
    let current = el;
    while (current && current !== document.body) {
      const tagName = current.tagName.toLowerCase();
      const role = current.getAttribute('role');
      const className = current.getAttribute('class') || '';
      
      if (
        tagName === 'button' || 
        role === 'button' || 
        (className.includes('btn') || className.includes('button') || className.includes('control'))
      ) {
        return current;
      }
      current = current.parentNode;
    }
    return el;
  }

  // Checks if an element is part of the custom whiteboard / drawing toolbar
  function isDrawingToolbarElement(el) {
    let current = el;
    while (current && current !== document.body) {
      const className = (current.getAttribute('class') || '').toLowerCase();
      const id = (current.id || '').toLowerCase();
      
      if (className.includes('dashboard') || id.includes('dashboard') || className.includes('page-manager')) {
        return false;
      }
      if (/canvas|draw|paint|board|palette/i.test(className + ' ' + id)) {
        return true;
      }
      current = current.parentNode || current.host;
    }
    return false;
  }

  // Find settings button recursively, piercing Shadow DOMs and ignoring drawing boards
  function findSettingsButton() {
    if (cachedSettingsBtn && cachedSettingsBtn.isConnected) {
      return cachedSettingsBtn;
    }
    const video = getActiveVideo();
    if (!video) return null;

    const exact = document.getElementById('setting-icon');
    if (exact) {
      cachedSettingsBtn = exact;
      return exact;
    }

    const playerContainer = document.getElementById('video-player-container') || video.closest('.video-player-app') || video.parentElement;
    if (!playerContainer) return null;

    let el = playerContainer.querySelector(
      '[class*="setting" i], [id*="setting" i], [title*="setting" i], ' +
      '[class*="gear" i], [class*="config" i], [class*="quality" i]'
    );
    if (el) {
      const btn = getControlButton(el);
      if (btn && !isDrawingToolbarElement(btn)) {
        cachedSettingsBtn = btn;
        return btn;
      }
    }

    const found = scanShadowForSettings(playerContainer);
    if (found) {
      cachedSettingsBtn = found;
    }
    return found;
  }

  function scanShadowForSettings(root) {
    const allElements = root.querySelectorAll('*');
    for (const item of allElements) {
      if (item.shadowRoot) {
        let el = item.shadowRoot.querySelector(
          '[class*="setting" i], [id*="setting" i], [title*="setting" i], ' +
          '[class*="gear" i], [class*="config" i], [class*="quality" i]'
        );
        if (el && !isDrawingToolbarElement(el)) return getControlButton(el);
        const found = scanShadowForSettings(item.shadowRoot);
        if (found) return found;
      }
    }
    return null;
  }

  // Find fullscreen button recursively, piercing Shadow DOMs and ignoring drawing boards
  function findFullscreenButton() {
    if (cachedFullscreenBtn && cachedFullscreenBtn.isConnected) {
      return cachedFullscreenBtn;
    }
    const video = getActiveVideo();
    if (!video) return null;

    const settingsBtn = findSettingsButton();
    if (settingsBtn) {
      const settingsWrapper = settingsBtn.closest('.flex-col') || settingsBtn.parentNode.parentNode;
      if (settingsWrapper && settingsWrapper.nextElementSibling) {
        const fsSvg = settingsWrapper.nextElementSibling.querySelector('svg');
        if (fsSvg) {
          cachedFullscreenBtn = fsSvg;
          return fsSvg;
        }
      }
    }

    const playerContainer = document.getElementById('video-player-container') || video.closest('.video-player-app') || video.parentElement;
    if (!playerContainer) return null;

    let el = playerContainer.querySelector(
      '[class*="fullscreen" i], [id*="fullscreen" i], [title*="fullscreen" i], ' +
      '[class*="full-screen" i], [id*="full-screen" i], [title*="full-screen" i]'
    );
    if (el) {
      const btn = getControlButton(el);
      if (btn && !isDrawingToolbarElement(btn)) {
        cachedFullscreenBtn = btn;
        return btn;
      }
    }

    const found = scanShadowForFullscreen(playerContainer);
    if (found) {
      cachedFullscreenBtn = found;
    }
    return found;
  }

  // Helper to scan shadow DOM recursively for fullscreen buttons
  function scanShadowForFullscreen(root) {
    const allElements = root.querySelectorAll('*');
    for (const item of allElements) {
      if (item.shadowRoot) {
        let el = item.shadowRoot.querySelector(
          '[class*="fullscreen" i], [id*="fullscreen" i], [title*="fullscreen" i], ' +
          '[class*="full-screen" i], [id*="full-screen" i], [title*="full-screen" i]'
        );
        if (el && !isDrawingToolbarElement(el)) return getControlButton(el);
        const found = scanShadowForFullscreen(item.shadowRoot);
        if (found) return found;
      }
    }
    return null;
  }

  // Helper to traverse up from a control button and find the actual main toolbar container
  function getToolbarContainer(el) {
    if (!el) return null;
    let current = el;
    while (current && current !== document.body) {
      const parent = current.parentNode;
      if (parent) {
        if (parent.children.length >= 3) {
          return parent;
        }
      }
      current = parent;
    }
    return el.parentNode;
  }


  // Find native speed pills (like "1.1x") located next to the time display
  function findNativeSpeedBadges() {
    if (cachedNativeSpeedBadges && cachedNativeSpeedBadges.length > 0 && cachedNativeSpeedBadges.every(el => el.isConnected)) {
      return cachedNativeSpeedBadges;
    }
    const video = getActiveVideo();
    if (!video) return [];

    const playerContainer = document.getElementById('video-player-container') || video.closest('.video-player-app') || video.parentElement;
    if (!playerContainer) return [];

    let list = [];
    const elements = playerContainer.querySelectorAll('*');
    for (const el of elements) {
      if (isNativeSpeedBadge(el)) {
        list.push(el);
      }
      if (el.shadowRoot) {
        list = list.concat(scanShadowForNativeSpeed(el.shadowRoot));
      }
    }
    cachedNativeSpeedBadges = list;
    return list;
  }

  // Helper to scan shadow DOM recursively for native speed labels
  function scanShadowForNativeSpeed(root) {
    let list = [];
    const elements = root.querySelectorAll('*');
    for (const el of elements) {
      if (isNativeSpeedBadge(el)) {
        list.push(el);
      }
      if (el.shadowRoot) {
        list = list.concat(scanShadowForNativeSpeed(el.shadowRoot));
      }
    }
    return list;
  }

  // Identify the category of any matched distractor element using structural attributes
  // IMPORTANT: We only match against class, id, title, aria-label, and short text labels.
  // We do NOT match against innerHTML or full textContent because those contain child
  // HTML tags (like <line>, <polyline>) and unrelated nested text that cause false matches.
  function getDistractorType(el) {
    // Use getAttribute instead of dot-property access because SVG elements
    // return weird objects for .className and .title in some browsers (like Brave).
    const className = (el.getAttribute('class') || '').toLowerCase();
    const id = (el.id || '').toLowerCase();
    const title = (el.getAttribute('title') || '').toLowerCase();
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    
    // Safety check: Never match the dashboard or main page manager layouts
    if (className.includes('dashboard') || id.includes('dashboard') || className.includes('page-manager')) {
      return null;
    }

    // Structural attributes are safe to match broadly
    const attrs = `${className} ${id} ${title} ${ariaLabel}`;
    
    // Only use textContent for leaf elements (no children) to avoid matching nested junk
    const isLeaf = el.children.length === 0;
    const leafText = isLeaf ? (el.textContent || '').trim().toLowerCase() : '';

    // 1. Ask AI feature
    if (attrs.includes('ask ai') || attrs.includes('askai') || attrs.includes('ask-ai') || /\bai\b/.test(attrs)) {
      return 'askai';
    }
    if (leafText === 'ask ai') return 'askai';

    // 2. Notes / Study materials — PW Live uses title="Add note" on its notes button
    if (/\bnote(s)?\b/.test(attrs) || attrs.includes('study') || attrs.includes('pdf') || attrs.includes('attachment')) {
      return 'notes';
    }
    if (isLeaf && (leafText === 'notes' || leafText === 'study notes' || leafText === 'add note')) return 'notes';



    // 4. Doubt / Q&A controls
    if (attrs.includes('doubt') || attrs.includes('qna') || attrs.includes('question')) {
      return 'doubt';
    }
    if (isLeaf && (leafText === 'doubt' || leafText === 'q&a')) return 'doubt';

    // 5. Chat / Comments
    if (attrs.includes('chat') || attrs.includes('comment')) {
      return 'chat';
    }
    if (isLeaf && leafText === 'chat') return 'chat';

    // 6. Note Timeline controls (avoid matching video progress timeline seekbar)
    if (!className.includes('progress') && !className.includes('play-progress') && !id.includes('video-progress')) {
      if (className.includes('timeline') || id.includes('timeline') || title.includes('timeline') || ariaLabel.includes('timeline')) {
        return 'notetimeline';
      }
    }

    return null;
  }

  // Helper to check the element and its shallow children for classification.
  // IMPORTANT: We only go 2 levels deep (children + grandchildren). Going deeper
  // with querySelectorAll('*') caused false positives because buried elements like
  // VideoJS's "Caption Settings Dialog" would match 'caption' and misclassify
  // unrelated toolbar buttons as CC controls.
  function checkElementOrChildType(el) {
    const type = getDistractorType(el);
    if (type) return type;
    
    // Check direct children (level 1)
    for (const child of el.children) {
      const t = getDistractorType(child);
      if (t) return t;
      // Check grandchildren (level 2)
      for (const grandchild of child.children) {
        const t2 = getDistractorType(grandchild);
        if (t2) return t2;
      }
    }
    return null;
  }

  // Programmatically construct the speedometer control without innerHTML
  function buildSpeedControl(container) {
    container.textContent = '';

    // Create button
    const btn = document.createElement('button');
    btn.className = 'pwc-speed-btn';
    btn.type = 'button';
    btn.setAttribute('title', 'Playback Speed');

    // Create SVG using document.createElementNS for SVGs
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', 'M6 18A8 8 0 1 1 18 18');
    svg.appendChild(path);

    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('class', 'pwc-needle');
    line.setAttribute('x1', '12');
    line.setAttribute('y1', '14');
    line.setAttribute('x2', '15');
    line.setAttribute('y2', '9');
    line.style.transformOrigin = '12px 14px';
    line.style.transition = 'transform 0.12s cubic-bezier(0.4, 0, 0.2, 1)';
    svg.appendChild(line);

    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '14');
    circle.setAttribute('r', '1.5');
    circle.setAttribute('fill', 'currentColor');
    svg.appendChild(circle);

    btn.appendChild(svg);

    // Create badge
    const badge = document.createElement('span');
    badge.className = 'pwc-speed-badge';
    badge.textContent = `${currentSpeed.toFixed(1)}x`;
    btn.appendChild(badge);

    container.appendChild(btn);

    // Create slider container
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'pwc-speed-slider-container';

    const sliderWrapper = document.createElement('div');
    sliderWrapper.className = 'pwc-slider-wrapper';

    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'pwc-speed-slider';
    input.min = '0.5';
    input.max = '4.0';
    input.step = '0.1';
    input.value = currentSpeed;
    sliderWrapper.appendChild(input);

    const ticks = document.createElement('div');
    ticks.className = 'pwc-slider-ticks';
    
    // Add ticks dynamically
    snapPoints.forEach(pt => {
      const pct = ((pt - 0.5) / 3.5) * 100;
      const tickLabel = document.createElement('span');
      tickLabel.className = 'pwc-tick-label';
      tickLabel.style.left = `${pct}%`;
      tickLabel.textContent = `${pt.toFixed(1).replace(/\.0$/, '')}x`;
      ticks.appendChild(tickLabel);
    });

    sliderWrapper.appendChild(ticks);
    sliderContainer.appendChild(sliderWrapper);
    container.appendChild(sliderContainer);
  }

  // Inject floating widget directly inside the player's controls container
  function injectSpeedControl() {
    if (!extensionEnabled) {
      const container = document.getElementById('pwc-speed-control');
      if (container) {
        container.remove();
      }
      return;
    }
    const footerRight = document.getElementById('footer-right-section');
    if (footerRight) {
      // 1. Primary path: PW Player overlay toolbar injection (placed as firstChild)
      if (!document.getElementById('pwc-speed-control')) {
        const container = document.createElement('div');
        container.id = 'pwc-speed-control';
        container.className = 'pwc-speed-container';
        buildSpeedControl(container);

        if (footerRight.firstChild) {
          footerRight.insertBefore(container, footerRight.firstChild);
        } else {
          footerRight.appendChild(container);
        }
        setupUIEventListeners(container);
      } else {
        const container = document.getElementById('pwc-speed-control');
        if (footerRight.firstChild && footerRight.firstChild !== container) {
          footerRight.insertBefore(container, footerRight.firstChild);
        }
      }

      applyDistractorsState();
      return;
    }

    // 2. Fallback path: VideoJS native player controls container injection (placed as firstChild)
    const settingsBtn = findSettingsButton();
    const fullscreenBtn = findFullscreenButton();
    const refBtn = settingsBtn || fullscreenBtn;

    if (refBtn) {
      const parent = getToolbarContainer(refBtn);
      if (parent) {
        if (!document.getElementById('pwc-speed-control')) {
          const container = document.createElement('div');
          container.id = 'pwc-speed-control';
          container.className = 'pwc-speed-container';
          buildSpeedControl(container);

          if (parent.firstChild) {
            parent.insertBefore(container, parent.firstChild);
          } else {
            parent.appendChild(container);
          }
          setupUIEventListeners(container);
        } else {
          const container = document.getElementById('pwc-speed-control');
          if (parent.firstChild && parent.firstChild !== container) {
            parent.insertBefore(container, parent.firstChild);
          }
        }

        applyDistractorsState();
      }
    }
  }

  // Display a visual speed toast overlay inside the player on change using safe DOM APIs
  function showSpeedToast(speed) {
    const video = getActiveVideo();
    if (!video) return;
    const playerContainer = video.parentElement;
    if (!playerContainer) return;

    let toast = playerContainer.querySelector('#pwc-speed-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pwc-speed-toast';
      toast.className = 'pwc-speed-toast';
      playerContainer.appendChild(toast);
    }

    toast.textContent = '';

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', 'M6 18A8 8 0 1 1 18 18');
    svg.appendChild(path);

    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', '12');
    line.setAttribute('y1', '14');
    line.setAttribute('x2', '15');
    line.setAttribute('y2', '9');
    svg.appendChild(line);

    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '14');
    circle.setAttribute('r', '1.5');
    circle.setAttribute('fill', 'currentColor');
    svg.appendChild(circle);

    toast.appendChild(svg);

    const span = document.createElement('span');
    span.textContent = `${speed.toFixed(1)}x`;
    toast.appendChild(span);

    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }

    toast.classList.remove('pwc-toast-visible');
    toast.offsetHeight; 
    toast.classList.add('pwc-toast-visible');

    toastTimeout = setTimeout(() => {
      toast.classList.remove('pwc-toast-visible');
    }, 800);
  }

  // Display a visual warning/info toast overlay inside the player using safe DOM APIs
  function showInfoToast(text) {
    const video = getActiveVideo();
    if (!video) return;
    const playerContainer = video.parentElement;
    if (!playerContainer) return;

    let toast = playerContainer.querySelector('#pwc-speed-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pwc-speed-toast';
      toast.className = 'pwc-speed-toast';
      playerContainer.appendChild(toast);
    }

    toast.textContent = '';

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', '#eaaa2e');
    svg.setAttribute('stroke-width', '2.2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z');
    svg.appendChild(path);

    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', '12');
    line.setAttribute('y1', '9');
    line.setAttribute('x2', '12');
    line.setAttribute('y2', '13');
    svg.appendChild(line);

    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '17');
    circle.setAttribute('r', '0.5');
    circle.setAttribute('fill', 'currentColor');
    svg.appendChild(circle);

    toast.appendChild(svg);

    const span = document.createElement('span');
    span.textContent = text;
    toast.appendChild(span);

    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }

    toast.classList.remove('pwc-toast-visible');
    toast.offsetHeight; 
    toast.classList.add('pwc-toast-visible');

    toastTimeout = setTimeout(() => {
      toast.classList.remove('pwc-toast-visible');
    }, 1800);
  }

  // Helper to find the video timeline progress bar
  function findTimeline() {
    if (cachedTimeline && cachedTimeline.isConnected) {
      return cachedTimeline;
    }
    const video = getActiveVideo();
    if (!video) return null;
    const playerContainer = document.getElementById('video-player-container') || video.closest('.video-player-app') || video.parentElement;
    if (!playerContainer) return null;
    const el = playerContainer.querySelector(
      '.vjs-progress-control, .vjs-progress-holder, ' +
      '[class*="progress-control" i], [class*="progress-bar" i], ' +
      '[class*="seekbar" i], [class*="seek-bar" i]'
    );
    if (el) {
      const className = el.getAttribute('class') || '';
      if (className.includes('pwc-')) return null;
      cachedTimeline = el;
      return el;
    }
    return null;
  }

  // Helper to find video time and duration texts
  function findTimeTexts() {
    if (cachedTimeTexts && cachedTimeTexts.length > 0 && cachedTimeTexts.every(el => el.isConnected)) {
      return cachedTimeTexts;
    }
    const video = getActiveVideo();
    if (!video) return [];
    const playerContainer = document.getElementById('video-player-container') || video.closest('.video-player-app') || video.parentElement;
    if (!playerContainer) return [];
    
    const elements = playerContainer.querySelectorAll(
      '.vjs-current-time, .vjs-duration, .vjs-time-divider, .vjs-remaining-time, .vjs-time-control, ' +
      '[class*="time-display" i], [class*="time-text" i], ' +
      '[class*="current-time" i], [class*="duration" i], [class*="video-time" i], ' +
      '.current-time, .duration, .time-display, .time-text'
    );

    const list = Array.from(elements).filter(el => {
      // 1. Exclude our own extension's speedometer UI elements
      const className = el.getAttribute('class') || '';
      const id = el.id || '';
      if (className.includes('pwc-') || id.includes('pwc-')) {
        return false;
      }

      // 2. Exclude elements that contain interactive buttons or SVGs
      // (Time texts are flat labels; they don't contain button icons or setting controls)
      if (el.querySelector('button') || el.querySelector('svg') || el.querySelector('[role="button"]')) {
        return false;
      }

      // 3. Exclude major layout/wrapper sections (we only want the leaf labels)
      if (el.querySelectorAll('div').length > 5) {
        return false;
      }

      // 4. Ensure it contains actual time numbers (e.g. "0:00", "2:31", "/ 2:06:36")
      // or it is a specific VideoJS time class
      const text = (el.textContent || '').trim();
      const isVjsTime = className.includes('vjs-current-time') || 
                        className.includes('vjs-duration') || 
                        className.includes('vjs-time-divider') || 
                        className.includes('vjs-remaining-time') || 
                        className.includes('vjs-time-control');

      if (isVjsTime) {
        return true;
      }

      // If it's a generic element, it must have text matching digit:digit or divider
      const hasTimePattern = /^\s*[\d\s:\-/|]+\s*$/.test(text) && /\d+:\d+/.test(text);
      const isDivider = text === '/' || text === '|' || text === '-';

      return hasTimePattern || isDivider;
    });

    cachedTimeTexts = list;
    return list;
  }

  // Helper to hide separators (like "/" text nodes or span dividers) next to time elements
  function hideTimeSeparators(timeElement, shouldHide) {
    if (!timeElement) return;
    const parent = timeElement.parentElement;
    if (!parent) return;

    const childNodes = Array.from(parent.childNodes);
    childNodes.forEach(node => {
      if (node.nodeType === 3) { // Text Node
        const text = node.textContent.trim();
        if (text === '/' || text === '|' || text === '-') {
          if (shouldHide) {
            if (node.originalText === undefined) {
              node.originalText = node.textContent;
            }
            node.textContent = '';
          } else {
            if (node.originalText !== undefined) {
              node.textContent = node.originalText;
            }
          }
        }
      } else if (node.nodeType === 1) { // Element Node
        const text = node.textContent.trim();
        const className = node.getAttribute('class') || '';
        const id = node.id || '';
        const isSelf = className.includes('pwc-') || id.includes('pwc-');
        
        if (!isSelf && (text === '/' || text === '|' || text === '-')) {
          setHidden(node, shouldHide);
        }
      }
    });
  }

  // Hide or restore distracting elements depending on settings.
  // We use a unified, robust settings-offset positional mapping to identify toolbar buttons,
  // falling back to attribute classification. This is highly reliable across all browsers.
  function applyDistractorsState() {
    const activeSettings = {};
    for (const key in hideSettings) {
      activeSettings[key] = extensionEnabled && hideSettings[key];
    }

    const video = getActiveVideo();
    if (video) {
      const settingsBtn = findSettingsButton();
      if (settingsBtn) {
        setHidden(settingsBtn, activeSettings.hideSetting);
      }
      const fullscreenBtn = findFullscreenButton();
      const refBtn = settingsBtn || fullscreenBtn;

      if (refBtn) {
        const parent = getToolbarContainer(refBtn);
        if (parent) {
          const siblings = Array.from(parent.children);
          
          // Filter out our own injected speed control, pip button, and non-element nodes
          const nativeButtons = siblings.filter(el => {
            return el.nodeType === 1 && el.id !== 'pwc-speed-control' && el.id !== 'pwc-pip-btn';
          });

          // Find settings button index in the native buttons list
          const settingsIdx = nativeButtons.findIndex(el => {
            return el === settingsBtn || el.id === 'setting-icon' || el.querySelector('#setting-icon');
          });

          if (settingsIdx !== -1) {
            nativeButtons.forEach((btn, index) => {
              const offset = settingsIdx - index;
              
              if (offset === 1) {
                // Notes (1 button left of Settings)
                setHidden(btn, activeSettings.hideNotes);
              } else if (offset === 2) {
                // Note Timeline (2 buttons left of Settings)
                setHidden(btn, activeSettings.hideNoteTimeline);
              } else if (offset === 3) {
                // Doubt Q&A (3 buttons left of Settings)
                setHidden(btn, activeSettings.hideDoubt);
              } else if (offset === 4) {
                // Live Chat (4 buttons left of Settings)
                setHidden(btn, activeSettings.hideChat);
              } else {
                // Fallback for other buttons (like Ask AI if inside toolbar)
                const type = checkElementOrChildType(btn);
                if (type === 'askai') {
                  setHidden(btn, activeSettings.hideAskAI);
                } else if (type === 'chat') {
                  setHidden(btn, activeSettings.hideChat);
                } else if (type === 'doubt') {
                  setHidden(btn, activeSettings.hideDoubt);
                } else if (type === 'notes') {
                  setHidden(btn, activeSettings.hideNotes);
                } else if (type === 'notetimeline') {
                  setHidden(btn, activeSettings.hideNoteTimeline);
                }
              }
            });
          } else {
            // Fallback if settings button is not found
            nativeButtons.forEach(btn => {
              const type = checkElementOrChildType(btn);
              if (type === 'chat') {
                setHidden(btn, activeSettings.hideChat);
              } else if (type === 'doubt') {
                setHidden(btn, activeSettings.hideDoubt);
              } else if (type === 'notes') {
                setHidden(btn, activeSettings.hideNotes);
              } else if (type === 'notetimeline') {
                setHidden(btn, activeSettings.hideNoteTimeline);
              } else if (type === 'askai') {
                setHidden(btn, activeSettings.hideAskAI);
              }
            });
          }
        }
      }
    }

    // Handle native Speed Badges next to the timer (dynamic — CSS can't target)
    const container = document.getElementById('pwc-speed-control');
    const nativeBadges = findNativeSpeedBadges();

    if (!extensionEnabled) {
      if (container) {
        setHidden(container, true);
      }
      for (const el of nativeBadges) {
        setHidden(el, false);
      }
    } else {
      if (activeSettings.hideSpeed) {
        if (container) {
          setHidden(container, true);
        }
        for (const el of nativeBadges) {
          setHidden(el, true);
        }
      } else {
        if (container) {
          setHidden(container, false);
        }
        for (const el of nativeBadges) {
          setHidden(el, false);
        }
      }
    }

    // Handle timeline hiding
    const timeline = findTimeline();
    if (timeline) {
      setHidden(timeline, activeSettings.hideTimeLine);
    }

    // Handle time display texts hiding
    const timeTexts = findTimeTexts();
    timeTexts.forEach(el => {
      setHidden(el, activeSettings.hideTimeText);
      hideTimeSeparators(el, activeSettings.hideTimeText);
    });
  }

  // Set the playback speed on the video element
  function applySpeedToActiveVideo() {
    const video = getActiveVideo();
    if (!video) return;

    if (video !== activeVideo) {
      setupVideoListeners(video);
    }

    const targetSpeed = extensionEnabled ? currentSpeed : 1.0;

    if (video.playbackRate !== targetSpeed) {
      isSettingRate = true;
      video.playbackRate = targetSpeed;
      setTimeout(() => {
        isSettingRate = false;
      }, 50);
    }
    updateUI();
  }

  // Listen to video events to sync our UI badge
  function setupVideoListeners(video) {
    if (activeVideo) {
      try {
        activeVideo.removeEventListener('ratechange', onRateChange);
        activeVideo.removeEventListener('play', onVideoPlay);
        activeVideo.removeEventListener('playing', onVideoPlaying);
        activeVideo.removeEventListener('loadedmetadata', onVideoLoadedMetadata);
        activeVideo.removeEventListener('enterpictureinpicture', onEnterPiP);
        activeVideo.removeEventListener('leavepictureinpicture', onLeavePiP);
      } catch (e) {}
    }

    activeVideo = video;

    // Reset cached player controls when switching active videos
    cachedSettingsBtn = null;
    cachedFullscreenBtn = null;
    cachedTimeline = null;
    cachedTimeTexts = null;
    cachedNativeSpeedBadges = null;

    activeVideo.addEventListener('ratechange', onRateChange);
    activeVideo.addEventListener('play', onVideoPlay);
    activeVideo.addEventListener('playing', onVideoPlaying);
    activeVideo.addEventListener('loadedmetadata', onVideoLoadedMetadata);
    activeVideo.addEventListener('enterpictureinpicture', onEnterPiP);
    activeVideo.addEventListener('leavepictureinpicture', onLeavePiP);

    if (activeVideo.readyState >= 1) {
      handleSkipIntro(activeVideo);
    }
    setupAudioAnalysis(activeVideo);
  }

  // Update speed UI when speed changes (syncs with native controls)
  function onRateChange() {
    if (isSettingRate || !activeVideo) return;
    if (isSilentStateActive || activeVideo.playbackRate === silenceSpeed) return; // Ignore speed changes while skipping silence
    currentSpeed = activeVideo.playbackRate;
    updateUI();
    showSpeedToast(currentSpeed);
  }

  // Delay applying speed on play to allow player init scripts to settle
  function onVideoPlay() {
    setTimeout(() => {
      applySpeedToActiveVideo();
    }, 200);
    setupAudioAnalysis(activeVideo);
  }

  function onVideoPlaying() {
    setupAudioAnalysis(activeVideo);
  }

  function onVideoLoadedMetadata() {
    handleSkipIntro(activeVideo);
    setupAudioAnalysis(activeVideo);
  }

  function onEnterPiP() {
    updatePiPButtonUI(true);
  }

  function onLeavePiP() {
    updatePiPButtonUI(false);
  }

  // Save the speed setting and apply it to the video
  function saveSpeed(speed) {
    const changed = (currentSpeed !== speed);
    currentSpeed = speed;
    applySpeedToActiveVideo();

    if (changed) {
      showSpeedToast(speed);
    }
    safeSetSettings({ preferredSpeed: speed });
  }

  // Update the progress track background of the range input dynamically
  function updateSliderBackground(slider, val) {
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    const pct = ((val - min) / (max - min)) * 100;
    slider.style.background = `linear-gradient(to right, #ffffff 0%, #ffffff ${pct}%, rgba(255, 255, 255, 0.25) ${pct}%, rgba(255, 255, 255, 0.25) 100%)`;
  }

  // Bind mouse drag and scroll wheel events to a speed control container
  function setupUIEventListeners(container) {
    const slider = container.querySelector('.pwc-speed-slider');

    updateSliderBackground(slider, currentSpeed);

    slider.addEventListener('input', (e) => {
      let val = parseFloat(e.target.value);
      
      // Magnetic snapping effect (snaps within 0.18 threshold to custom snap points)
      const threshold = 0.18;
      for (const snap of snapPoints) {
        if (Math.abs(val - snap) <= threshold) {
          val = snap;
          e.target.value = val;
          break;
        }
      }

      updateSliderBackground(slider, val);
      saveSpeed(val);
    });

    container.addEventListener('wheel', (e) => {
      if (!extensionEnabled || disableScroll) return;
      e.preventDefault();
      const val = stepSpeed(e.deltaY < 0 ? 1 : -1);
      slider.value = val;
      updateSliderBackground(slider, val);
      saveSpeed(val);
    }, { passive: false });
  }

  // Update speed badges, slider values, tick highlights, and needle angles in the UI
  function updateUI() {
    document.querySelectorAll('.pwc-speed-badge').forEach(badge => {
      badge.textContent = `${currentSpeed.toFixed(1)}x`;
    });

    document.querySelectorAll('.pwc-speed-slider').forEach(slider => {
      slider.value = currentSpeed;
      updateSliderBackground(slider, currentSpeed);
    });

    document.querySelectorAll('.pwc-tick-label').forEach(label => {
      const valText = label.textContent.replace('x', '');
      const val = parseFloat(valText);
      if (!isNaN(val) && Math.abs(currentSpeed - val) < 0.15) {
        label.classList.add('pwc-active-tick');
      } else {
        label.classList.remove('pwc-active-tick');
      }
    });

    // Update needle rotation based on current speed
    const pct = (currentSpeed - 0.5) / (4.0 - 0.5);
    const angle = -110 + pct * 220; // range from -110deg to 110deg
    document.querySelectorAll('.pwc-needle').forEach(needle => {
      needle.style.transform = `rotate(${angle}deg)`;
    });
  }

  // Helper function to match keys case-insensitively, supporting spacebar and shifts
  function matchKey(event, targetKey) {
    if (!targetKey) return false;
    
    if (targetKey === '>') {
      return event.key === '>' || (event.shiftKey && event.key === '.');
    }
    if (targetKey === '<') {
      return event.key === '<' || (event.shiftKey && event.key === ',');
    }
    if (targetKey === 'Space') {
      return event.key === ' ' || event.key === 'Space';
    }
    
    return event.key.toLowerCase() === targetKey.toLowerCase();
  }

  // Helper to toggle play/pause natively through player controls
  function togglePlayPause() {
    const video = getActiveVideo();
    if (!video) return;
    const playerContainer = document.getElementById('video-player-container') || video.closest('.video-player-app') || video.parentElement;
    if (playerContainer) {
      const playBtn = playerContainer.querySelector('.vjs-play-control, [class*="play-control" i], [class*="play-btn" i], .play-btn, .vjs-play-btn');
      if (playBtn) {
        playBtn.click();
        return;
      }
    }
    // Fallback 1: Toggle via HTML5 video API
    try {
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    } catch (e) {
      // Fallback 2: click the video element
      video.click();
    }
  }

  // Set temporary speed without saving it permanently to storage
  function applyTemporarySpeed(speed) {
    currentSpeed = speed;
    const video = getActiveVideo();
    if (video) {
      if (video.playbackRate !== speed) {
        isSettingRate = true;
        video.playbackRate = speed;
        setTimeout(() => {
          isSettingRate = false;
        }, 50);
      }
    }
    updateUI();
    showSpeedToast(speed);
  }

  // Helper to check if user is typing in a text entry field
  function isUserTyping() {
    const active = document.activeElement;
    if (!active) return false;
    const tagName = active.tagName.toLowerCase();
    if (tagName === 'textarea' || active.isContentEditable || active.getAttribute('role') === 'textbox') {
      return true;
    }
    if (tagName === 'input') {
      const type = (active.type || 'text').toLowerCase();
      const textTypes = ['text', 'search', 'email', 'number', 'password', 'tel', 'url'];
      return textTypes.includes(type);
    }
    return false;
  }

  // Dedicated capture-phase Spacebar interceptors to prevent double-toggling
  document.addEventListener('keydown', (e) => {
    if (!extensionEnabled) return;
    if (e.key !== ' ' && e.code !== 'Space') return;
    
    // Safety check: Ignore if typing in text fields
    if (isUserTyping()) return;

    if (holdSpaceSpeedUp) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      if (isHoldingSpace) return;
      if (!spacePressTimer) {
        speedBeforeHold = currentSpeed;
        spacePressTimer = setTimeout(() => {
          isHoldingSpace = true;
          applyTemporarySpeed(holdSpaceSpeed);
        }, 300);
      }
    }
  }, true); // useCapture = true

  document.addEventListener('keyup', (e) => {
    if (!extensionEnabled) return;
    if (e.key !== ' ' && e.code !== 'Space') return;

    if (holdSpaceSpeedUp) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if (spacePressTimer) {
        clearTimeout(spacePressTimer);
        spacePressTimer = null;
      }

      if (isHoldingSpace) {
        applyTemporarySpeed(speedBeforeHold);
        isHoldingSpace = false;
      } else {
        // Only toggle play/pause if user is not typing in a text field
        if (!isUserTyping()) {
          togglePlayPause();
        }
      }
    }
  }, true); // useCapture = true
  // Safety net: Reset hold-space state when tab loses focus
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && isHoldingSpace) {
      if (spacePressTimer) {
        clearTimeout(spacePressTimer);
        spacePressTimer = null;
      }
      applyTemporarySpeed(speedBeforeHold);
      isHoldingSpace = false;
    }
  });



  // Listen to keyboard shortcuts (bubble phase)
  document.addEventListener('keydown', (e) => {
    if (!extensionEnabled || !enableHotkeys) return;

    // Safety check: Ignore if typing in text fields
    if (isUserTyping()) return;

    if (matchKey(e, keySpeedUp)) {
      e.preventDefault();
      saveSpeed(stepSpeed(1));
    } else if (matchKey(e, keySlowDown)) {
      e.preventDefault();
      saveSpeed(stepSpeed(-1));
    } else if (matchKey(e, keyReset)) {
      e.preventDefault();
      saveSpeed(1.0);
    }
  });

  // Inject and manage the arrow hide button inside the controls bar
  function injectInstantHideButton() {
    const video = getActiveVideo();
    if (!video) return;

    const exactBtn = document.getElementById('pwc-instant-hide-btn');

    // If disabled, remove the button if it exists
    if (!extensionEnabled || !enableInstantHide) {
      if (exactBtn) {
        exactBtn.remove();
      }
      // Ensure we exit collapsed state if the feature is disabled
      if (document.documentElement.classList.contains('pwc-collapsed-state')) {
        document.documentElement.classList.remove('pwc-collapsed-state');
      }
      return;
    }

    // Determine the control bar container to inject into
    const footerRight = document.getElementById('footer-right-section');
    const controlBar = footerRight ? footerRight.parentElement : null;
    
    // Fallback: search for settings/fullscreen buttons and trace their parent container
    let fallbackControlBar = null;
    if (!controlBar) {
      const settingsBtn = findSettingsButton();
      const fullscreenBtn = findFullscreenButton();
      const refBtn = settingsBtn || fullscreenBtn;
      if (refBtn) {
        fallbackControlBar = getToolbarContainer(refBtn);
      }
    }

    // Prioritize the full-width control bar container so absolute centering works relative to the entire player width!
    const parent = controlBar || fallbackControlBar || footerRight;
    if (!parent) return;

    // Create and inject the button if it doesn't exist
    if (!exactBtn) {
      const btn = document.createElement('button');
      btn.id = 'pwc-instant-hide-btn';
      btn.className = 'pwc-instant-hide-btn';
      btn.type = 'button';
      btn.setAttribute('title', 'Instant Focus Mode (Hide controls & cursor)');

      // Custom SVG Chevron down
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2.3');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');

      const polyline = document.createElementNS(svgNS, 'polyline');
      polyline.setAttribute('points', '6 9 12 15 18 9');
      svg.appendChild(polyline);
      btn.appendChild(svg);

      // Insert at the beginning of footerRight (or control bar) so it aligns naturally
      if (parent.firstChild) {
        parent.insertBefore(btn, parent.firstChild);
      } else {
        parent.appendChild(btn);
      }

      // Add event listeners
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();

        // Collapse the entire page's player controls and cursor
        document.documentElement.classList.add('pwc-collapsed-state');
        lastCollapsedTime = Date.now();

        // Bind root event listeners to reveal controls on mouse move or screen touch
        if (!document.documentElement.pwcHasMouseMoveListener) {
          document.documentElement.pwcHasMouseMoveListener = true;

          const revealControls = () => {
            // Ignore movements within 400ms of clicking to avoid micro-movements cancelling focus mode
            if (Date.now() - lastCollapsedTime < 400) {
              return;
            }
            if (document.documentElement.classList.contains('pwc-collapsed-state')) {
              document.documentElement.classList.remove('pwc-collapsed-state');
            }
          };

          document.addEventListener('mousemove', revealControls);
          document.addEventListener('touchstart', revealControls);
        }
      });
    } else {
      // Ensure it is in the correct parent
      if (exactBtn.parentElement !== parent) {
        if (parent.firstChild) {
          parent.insertBefore(exactBtn, parent.firstChild);
        } else {
          parent.appendChild(exactBtn);
        }
      }
    }
  }

  function stylePiPButton(btn) {
    btn.style.setProperty('height', '100%', 'important');
    btn.style.setProperty('width', '36px', 'important');
    btn.style.setProperty('display', 'inline-flex', 'important');
    btn.style.setProperty('align-items', 'center', 'important');
    btn.style.setProperty('justify-content', 'center', 'important');
    btn.style.setProperty('z-index', '1000', 'important');
    btn.style.setProperty('background', 'transparent', 'important');
    btn.style.setProperty('border', 'none', 'important');
    btn.style.setProperty('color', 'rgba(255, 255, 255, 0.75)', 'important');
    btn.style.setProperty('cursor', 'pointer', 'important');
    btn.style.setProperty('padding', '0', 'important');
    btn.style.setProperty('margin', '0 6px', 'important');
    btn.style.setProperty('transition', 'color 0.2s ease, transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.25s ease', 'important');

    if (!btn.pwcHasHoverListeners) {
      btn.pwcHasHoverListeners = true;
      btn.addEventListener('mouseenter', () => {
        btn.style.setProperty('color', '#ffffff', 'important');
        btn.style.setProperty('transform', 'scale(1.15)', 'important');
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.setProperty('color', 'rgba(255, 255, 255, 0.75)', 'important');
        btn.style.setProperty('transform', 'scale(1)', 'important');
      });
    }
  }

  function setupPiPButtonListeners(btn) {
    if (btn.pwcHasClickEventListener) return;
    btn.pwcHasClickEventListener = true;

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      // Do NOT call e.preventDefault() here! In some Chromium browsers, preventDefault() on user
      // gestures flags the activation as consumed/cancelled, blocking video.requestPictureInPicture().

      const video = getActiveVideo();
      if (!video) return;

      // Force-enable Picture-in-Picture in case the player script locked it
      video.disablePictureInPicture = false;

      if (video.readyState === 0) {
        showInfoToast("Video still loading... Try again.");
        return;
      }

      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await video.requestPictureInPicture();
        }
      } catch (err) {
        console.error("PW Control: Failed to toggle Picture-in-Picture:", err);
        showInfoToast("Failed to enter Picture-in-Picture.");
      }
    }, true);
  }

  // Inject and manage the Picture-in-Picture button inside the controls bar
  function injectPiPButton() {
    const video = getActiveVideo();
    if (!video) return;

    if (typeof video.requestPictureInPicture !== 'function') return;

    const exactBtn = document.getElementById('pwc-pip-btn');

    // If disabled, remove the button if it exists
    if (!extensionEnabled || !enablePiP) {
      if (exactBtn) {
        exactBtn.remove();
      }
      return;
    }

    // Determine the control bar container to inject into
    const footerRight = document.getElementById('footer-right-section');
    const controlBar = footerRight ? footerRight.parentElement : null;
    
    // Fallback: search for settings/fullscreen buttons and trace their parent container
    let fallbackControlBar = null;
    if (!controlBar) {
      const settingsBtn = findSettingsButton();
      const fullscreenBtn = findFullscreenButton();
      const refBtn = settingsBtn || fullscreenBtn;
      if (refBtn) {
        fallbackControlBar = getToolbarContainer(refBtn);
      }
    }

    const parent = controlBar || fallbackControlBar || footerRight;
    if (!parent) return;

    // Target the light DOM container so getElementById can find the button in subsequent runs!
    const targetContainer = footerRight || parent;

    // Create and inject the button if it doesn't exist
    if (!exactBtn) {
      const btn = document.createElement('button');
      btn.id = 'pwc-pip-btn';
      btn.className = 'pwc-pip-btn';
      btn.type = 'button';
      stylePiPButton(btn);

      // Insert right before fullscreen button if found inside the same parent, otherwise append
      const fullscreenBtn = findFullscreenButton();
      if (fullscreenBtn && fullscreenBtn.parentElement === targetContainer) {
        targetContainer.insertBefore(btn, fullscreenBtn);
      } else {
        targetContainer.appendChild(btn);
      }

      
      setupPiPButtonListeners(btn);
      // Initial UI draw
      updatePiPButtonUI(document.pictureInPictureElement === video);
    } else {
      stylePiPButton(exactBtn);
      // Ensure it is in the correct position if the toolbar rebuilt
      if (exactBtn.parentElement !== targetContainer) {
        const fullscreenBtn = findFullscreenButton();
        if (fullscreenBtn && fullscreenBtn.parentElement === targetContainer) {
          targetContainer.insertBefore(exactBtn, fullscreenBtn);
        } else {
          targetContainer.appendChild(exactBtn);
        }
      }
      setupPiPButtonListeners(exactBtn);
      // Update UI state based on current PiP state
      updatePiPButtonUI(document.pictureInPictureElement === video);
    }
  }

  function updatePiPButtonUI(isInPiP) {
    const btn = document.getElementById('pwc-pip-btn');
    if (!btn) return;

    btn.textContent = '';
    btn.setAttribute('title', isInPiP ? 'Exit Picture-in-Picture' : 'Picture-in-Picture');

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.3');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    // Inline style for SVG to make sure it renders even inside Shadow DOM
    svg.style.setProperty('width', '22px', 'important');
    svg.style.setProperty('height', '22px', 'important');
    svg.style.setProperty('stroke', 'currentColor', 'important');
    svg.style.setProperty('stroke-width', '2.3', 'important');
    svg.style.setProperty('fill', 'none', 'important');
    svg.style.setProperty('transition', 'transform 0.2s ease', 'important');

    if (isInPiP) {
      // Exit PiP Icon
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', '2');
      rect.setAttribute('y', '4');
      rect.setAttribute('width', '20');
      rect.setAttribute('height', '16');
      rect.setAttribute('rx', '2');
      rect.setAttribute('ry', '2');
      svg.appendChild(rect);

      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M10 10l-4-4m0 0h3m-3 0v3');
      svg.appendChild(path);
    } else {
      // Enter PiP Icon
      const rect1 = document.createElementNS(svgNS, 'rect');
      rect1.setAttribute('x', '2');
      rect1.setAttribute('y', '4');
      rect1.setAttribute('width', '20');
      rect1.setAttribute('height', '16');
      rect1.setAttribute('rx', '2');
      rect1.setAttribute('ry', '2');
      svg.appendChild(rect1);

      const rect2 = document.createElementNS(svgNS, 'rect');
      rect2.setAttribute('x', '13');
      rect2.setAttribute('y', '12');
      rect2.setAttribute('width', '7');
      rect2.setAttribute('height', '6');
      rect2.setAttribute('rx', '1');
      rect2.setAttribute('fill', 'currentColor');
      rect2.style.setProperty('fill', 'currentColor', 'important');
      svg.appendChild(rect2);
    }
    btn.appendChild(svg);
  }

  // Throttled execution of DOM monitoring to optimize performance
  let monitorTimeout = null;
  let monitorIntervalId = null;

  function throttledMonitor() {
    if (monitorTimeout) return;
    monitorTimeout = setTimeout(() => {
      monitorTimeout = null;
      monitor();
      manageMonitorInterval();
    }, 150);
  }

  // Start or stop the safety-net interval based on whether a video exists
  function manageMonitorInterval() {
    const hasVideo = !!(cachedVideo && cachedVideo.isConnected);
    if (hasVideo && !monitorIntervalId) {
      // Video found — start the safety-net interval
      monitorIntervalId = setInterval(throttledMonitor, 1000);
    } else if (!hasVideo && monitorIntervalId) {
      // No video — stop the interval to save CPU
      clearInterval(monitorIntervalId);
      monitorIntervalId = null;
    }
  }

  // ── Skip Silence Scanner ──────────────────────────────────────────────
  // Uses a shared global AudioContext + AnalyserNode (no external files needed).
  // No crossorigin attribute (blob: URLs don't support CORS).
  // Audio graph cached per video element in a WeakMap.

  function getSharedAudioCtx() {
    if (!sharedAudioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      sharedAudioCtx = new AudioContextClass();
    }
    return sharedAudioCtx;
  }

  function resumeAudioCtx(ctx) {
    if (ctx.state === 'suspended') {
      ctx.resume();
      const handler = () => ctx.resume();
      document.addEventListener('pointerdown', handler, { once: true, capture: true });
      document.addEventListener('keydown', handler, { once: true, capture: true });
    }
  }

  function getAudioGraph(video) {
    let cached = audioGraphCache.get(video);
    if (cached) {
      // Reconnect the analyser to destination if disconnected
      try {
        const ctx = getSharedAudioCtx();
        cached.analyser.connect(ctx.destination);
      } catch (e) {}
      return cached;
    }

    const ctx = getSharedAudioCtx();
    const source   = ctx.createMediaElementSource(video);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;

    // source -> analyser -> destination (keeps audio playing through speakers)
    source.connect(analyser);
    analyser.connect(ctx.destination);

    const graph = { analyser };
    audioGraphCache.set(video, graph);
    return graph;
  }

  function setupAudioAnalysis(video) {
    if (!video) return;
    if (!enableSkipSilence) {
      cleanupAudioAnalysis();
      return;
    }

    // Don't re-setup for the same video
    if (activeSilenceVideo === video && silenceCheckInterval) return;

    try {
      const ctx = getSharedAudioCtx();
      resumeAudioCtx(ctx);

      const graph = getAudioGraph(video);
      activeSilenceVideo = video;

      // Start the polling loop
      startSilenceCheckLoop(video, graph);
    } catch (e) {
      console.warn('PW Control: Skip Silence setup failed:', e);
    }
  }

  function cleanupAudioAnalysis() {
    if (silenceCheckInterval) {
      clearInterval(silenceCheckInterval);
      silenceCheckInterval = null;
    }

    if (isSilentStateActive) {
      isSilentStateActive = false;
      const video = activeSilenceVideo || getActiveVideo();
      if (video) {
        isSettingRate = true;
        video.playbackRate = currentSpeed;
        setTimeout(() => {
          isSettingRate = false;
        }, 150);
      }
    }

    // Disconnect the analyser to stop audio graph processing and allow GC
    if (activeSilenceVideo) {
      const graph = audioGraphCache.get(activeSilenceVideo);
      if (graph && graph.analyser) {
        try {
          graph.analyser.disconnect();
        } catch (e) {}
      }
    }

    activeSilenceVideo = null;
    silenceMsCount = 0;
    currentVolumeDb = -100;
  }

  function startSilenceCheckLoop(video, graph) {
    if (silenceCheckInterval) {
      clearInterval(silenceCheckInterval);
    }

    const analyser = graph.analyser;
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    const checkIntervalMs = 100;

    silenceCheckInterval = setInterval(() => {
      // Stop checking if video element was removed/disconnected from DOM
      if (!video || !video.isConnected) {
        cleanupAudioAnalysis();
        return;
      }

      if (!enableSkipSilence || video.paused || video.ended || video.readyState < 2) {
        return;
      }

      const ctx = getSharedAudioCtx();
      if (ctx.state !== 'running') {
        resumeAudioCtx(ctx);
        return;
      }

      // Read time-domain waveform and compute RMS
      analyser.getByteTimeDomainData(dataArray);

      let sumSquares = 0;
      for (let i = 0; i < bufferLength; i++) {
        const sample = (dataArray[i] - 128) / 128;
        sumSquares += sample * sample;
      }
      const rms = Math.sqrt(sumSquares / bufferLength);
      currentVolumeDb = rms > 0 ? 20 * Math.log10(rms) : -100;

      // Silence detection logic
      const isCurrentlySilent = currentVolumeDb < silenceThreshold;

      if (isCurrentlySilent) {
        silenceMsCount += checkIntervalMs;
        const requiredSilenceMs = silenceDuration * 1000;

        if (silenceMsCount >= requiredSilenceMs && !isSilentStateActive) {
          isSilentStateActive = true;
          isSettingRate = true;
          video.playbackRate = silenceSpeed;
          setTimeout(() => {
            isSettingRate = false;
          }, 150);
        }
      } else {
        silenceMsCount = 0;
        if (isSilentStateActive) {
          isSilentStateActive = false;
          isSettingRate = true;
          video.playbackRate = currentSpeed;
          setTimeout(() => {
            isSettingRate = false;
          }, 150);
        }
      }
    }, checkIntervalMs);
  }

  // Skip Intro Logic
  function handleSkipIntro(video) {
    if (!enableSkipSilence || skipIntroTime <= 0 || !video.currentSrc || lastSkippedSrc === video.currentSrc) {
      return;
    }
    
    if (video.currentTime < skipIntroTime) {
      video.currentTime = skipIntroTime;
      showInfoToast("Skipped intro (" + skipIntroTime + "s)");
    }
    lastSkippedSrc = video.currentSrc;
  }

  // Main monitoring function
  function monitor() {
    if (isModifyingDOM) return;
    const video = getActiveVideo();
    if (video) {
      if (video !== activeVideo) {
        setupVideoListeners(video);
      }
      isModifyingDOM = true;
      try {
        injectSpeedControl();
        injectInstantHideButton();
        injectPiPButton();
      } finally {
        isModifyingDOM = false;
      }
    }
  }

  // Setup DOM Observer for dynamic injections and visibility synchronization
  const observer = new MutationObserver((mutations) => {
    if (isModifyingDOM) return;
    throttledMonitor();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // Initial execution
  monitor();
  manageMonitorInterval();

  // Listen for popup connections to send real-time visualizer stats
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onConnect) {
    chrome.runtime.onConnect.addListener((port) => {
      if (port.name !== "popup-connection") return;

      const interval = setInterval(() => {
        const isScanning = !!(enableSkipSilence && sharedAudioCtx && sharedAudioCtx.state === 'running' && activeSilenceVideo && !activeSilenceVideo.paused);
        port.postMessage({
          volumeDb: currentVolumeDb,
          thresholdDb: silenceThreshold,
          isSilent: isSilentStateActive,
          isScanning: isScanning
        });
      }, 50);

      port.onDisconnect.addListener(() => {
        clearInterval(interval);
      });
    });
  }
})();

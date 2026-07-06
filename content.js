(function () {
  let currentSpeed = 1.0;
  let activeVideo = null;
  let isSettingRate = false;
  let toastTimeout = null;
  let isModifyingDOM = false;

  // Custom hotkey and snap point configurations
  let disableHotkeys = false;
  let disableScroll = false;
  let keySpeedUp = '>';
  let keySlowDown = '<';
  let keyReset = 'r';
  let snapPoints = [1.0, 2.0, 3.0, 4.0];

  // Hold Space to Speed Up configuration
  let holdSpaceSpeedUp = false;
  let holdSpaceSpeed = 2.0;
  let spacePressTimer = null;
  let isHoldingSpace = false;
  let speedBeforeHold = 1.0;

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
    hideCC: 'pwc-hide-cc',
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
    hideCC: false,
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
        ['preferredSpeed', 'hideAskAI', 'hideDoubt', 'hideChat', 'hideNotes', 'hideCC', 'hideSpeed', 'hideSetting', 'hideTimeLine', 'hideTimeText', 'disableHotkeys', 'disableScroll', 'holdSpaceSpeedUp', 'holdSpaceSpeed', 'keySpeedUp', 'keySlowDown', 'keyReset', 'snapPoints'], 
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
    if (result.preferredSpeed) {
      currentSpeed = parseFloat(result.preferredSpeed);
      applySpeedToActiveVideo();
    }
    for (const key in hideSettings) {
      if (result.hasOwnProperty(key)) {
        hideSettings[key] = !!result[key];
      }
    }

    disableHotkeys = !!result.disableHotkeys;
    disableScroll = !!result.disableScroll;
    holdSpaceSpeedUp = !!result.holdSpaceSpeedUp;
    holdSpaceSpeed = result.holdSpaceSpeed !== undefined ? parseFloat(result.holdSpaceSpeed) : 2.0;
    keySpeedUp = result.keySpeedUp || '>';
    keySlowDown = result.keySlowDown || '<';
    keyReset = result.keyReset || 'r';

    if (result.snapPoints && Array.isArray(result.snapPoints) && result.snapPoints.length === 4) {
      snapPoints = result.snapPoints.map(v => parseFloat(v));
    }

    applySettingsHTML(hideSettings);
    applyDistractorsState();
  });

  // Listen for storage changes from the settings popup
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.onChanged) {
    try {
      chrome.storage.onChanged.addListener(function (changes, area) {
        try {
          if (!chrome.runtime || !chrome.runtime.id) return;
          if (area === 'local') {
            let changed = false;
            for (const key in hideSettings) {
              if (changes.hasOwnProperty(key)) {
                hideSettings[key] = !!changes[key].newValue;
                changed = true;
              }
            }

            // Sync hotkey bindings in real-time
            if (changes.hasOwnProperty('disableHotkeys')) {
              disableHotkeys = !!changes.disableHotkeys.newValue;
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
      const isEnabled = settings[key] === true;
      if (isEnabled) {
        root.classList.add(className);
      } else {
        root.classList.remove(className);
      }
    });
  }

  // Helper to find video elements, including those nested inside Shadow DOMs
  function findVideos(root = document) {
    let list = Array.from(root.querySelectorAll('video'));
    const elements = root.querySelectorAll('*');
    for (const el of elements) {
      if (el.shadowRoot) {
        list = list.concat(findVideos(el.shadowRoot));
      }
    }
    return list;
  }

  // Helper to find the active video element (selects the video with largest display area)
  function getActiveVideo() {
    const videos = findVideos(document);
    if (videos.length === 0) return null;
    if (videos.length === 1) return videos[0];
    
    let mainVideo = videos[0];
    let maxArea = 0;
    for (const v of videos) {
      const area = (v.videoWidth || v.clientWidth || 0) * (v.videoHeight || v.clientHeight || 0);
      if (area > maxArea) {
        maxArea = area;
        mainVideo = v;
      }
    }
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
    const video = getActiveVideo();
    if (!video) return null;

    const exact = document.getElementById('setting-icon');
    if (exact) return exact;

    const playerContainer = document.getElementById('video-player-container') || video.closest('.video-player-app') || video.parentElement;
    if (!playerContainer) return null;

    let el = playerContainer.querySelector(
      '[class*="setting" i], [id*="setting" i], [title*="setting" i], ' +
      '[class*="gear" i], [class*="config" i], [class*="quality" i]'
    );
    if (el) {
      const btn = getControlButton(el);
      if (btn && !isDrawingToolbarElement(btn)) {
        return btn;
      }
    }

    return scanShadowForSettings(playerContainer);
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
    const video = getActiveVideo();
    if (!video) return null;

    const settingsBtn = document.getElementById('setting-icon');
    if (settingsBtn) {
      const settingsWrapper = settingsBtn.closest('.flex-col') || settingsBtn.parentNode.parentNode;
      if (settingsWrapper && settingsWrapper.nextElementSibling) {
        const fsSvg = settingsWrapper.nextElementSibling.querySelector('svg');
        if (fsSvg) return fsSvg;
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
        return btn;
      }
    }

    return scanShadowForFullscreen(playerContainer);
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

  // Check if a child element is an interactive control (ignoring structural divs/spacers)
  function isInteractiveControl(el) {
    const tagName = el.tagName.toLowerCase();
    if (
      tagName === 'button' || 
      el.querySelector('svg') || 
      el.getAttribute('role') === 'button' || 
      (el.getAttribute('class') || '').includes('btn') || 
      (el.getAttribute('class') || '').includes('button')
    ) {
      return true;
    }
    return false;
  }

  // Find native speed pills (like "1.1x") located next to the time display
  function findNativeSpeedBadges() {
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

    // 3. CC / Subtitles — use VideoJS-specific classes and exact keyword matches only.
    //    AVOID matching 'caption' — it appears 200+ times in VideoJS settings dialogs
    //    and causes every toolbar button to be falsely classified as CC.
    if (/\bcc\b/.test(attrs) || className.includes('vjs-setting-subtitles') || className.includes('vjs-icon-subtitles') || attrs.includes('closed-caption')) {
      return 'cc';
    }
    if (isLeaf && (leafText === 'cc' || leafText === 'subtitles' || leafText === 'captions' || leafText === 'subtitle')) return 'cc';

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

  // Helper to find the video timeline progress bar
  function findTimeline() {
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
      return el;
    }
    return null;
  }

  // Helper to find video time and duration texts
  function findTimeTexts() {
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

    return Array.from(elements).filter(el => {
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
    const video = getActiveVideo();
    if (video) {
      const settingsBtn = findSettingsButton();
      if (settingsBtn) {
        setHidden(settingsBtn, hideSettings.hideSetting);
      }
      const fullscreenBtn = findFullscreenButton();
      const refBtn = settingsBtn || fullscreenBtn;

      if (refBtn) {
        const parent = getToolbarContainer(refBtn);
        if (parent) {
          const siblings = Array.from(parent.children);
          
          // Filter out our own injected speed control and non-element nodes
          const nativeButtons = siblings.filter(el => {
            return el.nodeType === 1 && el.id !== 'pwc-speed-control';
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
                setHidden(btn, hideSettings.hideNotes);
              } else if (offset === 2) {
                // CC Subtitles (2 buttons left of Settings)
                setHidden(btn, hideSettings.hideCC);
              } else if (offset === 3) {
                // Doubt Q&A (3 buttons left of Settings / 1 left of CC)
                setHidden(btn, hideSettings.hideDoubt);
              } else if (offset === 4) {
                // Live Chat (4 buttons left of Settings / 2 left of CC)
                setHidden(btn, hideSettings.hideChat);
              } else {
                // Fallback for other buttons (like Ask AI if inside toolbar)
                const type = checkElementOrChildType(btn);
                if (type === 'askai') {
                  setHidden(btn, hideSettings.hideAskAI);
                } else if (type === 'chat') {
                  setHidden(btn, hideSettings.hideChat);
                } else if (type === 'doubt') {
                  setHidden(btn, hideSettings.hideDoubt);
                } else if (type === 'notes') {
                  setHidden(btn, hideSettings.hideNotes);
                } else if (type === 'cc') {
                  setHidden(btn, hideSettings.hideCC);
                }
              }
            });
          } else {
            // Fallback if settings button is not found
            nativeButtons.forEach(btn => {
              const type = checkElementOrChildType(btn);
              if (type === 'chat') {
                setHidden(btn, hideSettings.hideChat);
              } else if (type === 'doubt') {
                setHidden(btn, hideSettings.hideDoubt);
              } else if (type === 'notes') {
                setHidden(btn, hideSettings.hideNotes);
              } else if (type === 'cc') {
                setHidden(btn, hideSettings.hideCC);
              } else if (type === 'askai') {
                setHidden(btn, hideSettings.hideAskAI);
              }
            });
          }
        }
      }
    }

    // Handle native Speed Badges next to the timer (dynamic — CSS can't target)
    const container = document.getElementById('pwc-speed-control');
    const nativeBadges = findNativeSpeedBadges();

    if (hideSettings.hideSpeed) {
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

    // Handle timeline hiding
    const timeline = findTimeline();
    if (timeline) {
      setHidden(timeline, hideSettings.hideTimeLine);
    }

    // Handle time display texts hiding
    const timeTexts = findTimeTexts();
    timeTexts.forEach(el => {
      setHidden(el, hideSettings.hideTimeText);
      hideTimeSeparators(el, hideSettings.hideTimeText);
    });
  }

  // Set the playback speed on the video element
  function applySpeedToActiveVideo() {
    const video = getActiveVideo();
    if (!video) return;

    if (video !== activeVideo) {
      setupVideoListeners(video);
    }

    if (video.playbackRate !== currentSpeed) {
      isSettingRate = true;
      video.playbackRate = currentSpeed;
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
      } catch (e) {}
    }

    activeVideo = video;
    activeVideo.addEventListener('ratechange', onRateChange);
    activeVideo.addEventListener('play', onVideoPlay);
  }

  // Update speed UI when speed changes (syncs with native controls)
  function onRateChange() {
    if (isSettingRate || !activeVideo) return;
    currentSpeed = activeVideo.playbackRate;
    updateUI();
    showSpeedToast(currentSpeed);
  }

  // Delay applying speed on play to allow player init scripts to settle
  function onVideoPlay() {
    setTimeout(() => {
      applySpeedToActiveVideo();
    }, 200);
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
      if (disableScroll) return;
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

  // Dedicated capture-phase Spacebar interceptors to prevent double-toggling
  document.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.code !== 'Space') return;
    
    // Safety check: Ignore if typing
    const active = document.activeElement;
    if (active) {
      const tagName = active.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || active.isContentEditable || active.getAttribute('role') === 'textbox') {
        return;
      }
    }

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
    if (e.key !== ' ' && e.code !== 'Space') return;

    // Safety check: Ignore if typing
    const active = document.activeElement;
    if (active) {
      const tagName = active.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || active.isContentEditable || active.getAttribute('role') === 'textbox') {
        return;
      }
    }

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
        togglePlayPause();
      }
    }
  }, true); // useCapture = true

  // Listen to keyboard shortcuts (bubble phase)
  document.addEventListener('keydown', (e) => {
    if (disableHotkeys) return;

    // Safety check: Ignore if typing in text inputs or editable areas
    const active = document.activeElement;
    if (active) {
      const tagName = active.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || active.isContentEditable || active.getAttribute('role') === 'textbox') {
        return;
      }
    }

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
        applyDistractorsState();
      } finally {
        isModifyingDOM = false;
      }
    }
  }

  // Setup DOM Observer for dynamic injections and visibility synchronization
  const observer = new MutationObserver((mutations) => {
    if (isModifyingDOM) return;
    monitor();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // Safety net interval check
  setInterval(monitor, 1000);

  // Initial execution
  monitor();
})();

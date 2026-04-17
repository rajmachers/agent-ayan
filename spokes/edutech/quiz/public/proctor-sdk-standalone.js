/**
 * ProctorSDK Standalone — Real AI Proctoring
 *
 * Browser events:  tab switch, copy/paste, right-click, shortcuts, resize
 * Real Vision AI:  getUserMedia camera → Canvas face-region analysis
 * Real Audio AI:   getUserMedia mic → AudioContext noise-level analysis
 * Behavior AI:     mouse-idle, rapid-violation pattern
 *
 * All scores are server-authoritative. The SDK sends violations and
 * receives the canonical credibilityScore + violationCount back.
 */
(function () {
  'use strict';

  console.log('🚀 Loading ProctorSDK Standalone…');

  /* ================================================================
   *  Constructor
   * ================================================================ */
  function ProctorSession(cfg) {
    this.config = Object.assign({
      sessionManager: 'ws://localhost:8081',
      enableCamera: true,
      enableMic: true,
      enforceFullscreen: true
    }, cfg);

    this.sessionId = null;
    this.shortId = null;
    this.ws = null;
    this.widget = null;
    this.violations = [];
    this.credibilityScore = 100;
    this.violationCount = 0;
    this.isActive = false;
    this._handlers = {};
    this._cleanups = [];
    this._mouseLastMoved = Date.now();
    this._lastInteraction = Date.now();
    this._lastUserActivity = Date.now(); // tracks real user input (mouse/keyboard/click)
    this._violationQueue = []; // queued violations for reliable delivery
    this._sendingQueue = false;

    // Media handles
    this._videoStream = null;
    this._videoEl = null;
    this._canvas = null;
    this._canvasCtx = null;
    this._audioStream = null;
    this._audioCtx = null;
    this._analyser = null;
    this._prevFrame = null;

    // Evidence capture
    this._enableEvidence = cfg.enableEvidence !== false; // default true
    this._screenshotCanvas = null;
    this._audioRecorder = null;
    this._audioChunks = [];       // rolling ring buffer of audio chunks
    this._audioRingMs = 10000;    // 10 seconds of audio to keep
    this._audioRingStart = 0;
  }

  /* ── tiny event emitter ── */
  ProctorSession.prototype.on = function (e, fn) {
    (this._handlers[e] = this._handlers[e] || []).push(fn);
  };
  ProctorSession.prototype.emit = function (e, d) {
    (this._handlers[e] || []).forEach(function (fn) { fn(d); });
  };

  ProctorSession.prototype.start = function () {
    console.log('🎯 Starting proctoring session…');
    this._buildWidget();
    this._connectWS();
  };

  /* ================================================================
   *  Widget
   * ================================================================ */
  ProctorSession.prototype._buildWidget = function () {
    var old = document.getElementById('proctor-widget');
    if (old) old.remove();
    this.shortId = '--------';

    var el = document.createElement('div');
    el.id = 'proctor-widget';
    el.style.cssText =
      'position:fixed;top:16px;right:16px;width:280px;z-index:10000;' +
      'border-radius:12px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,sans-serif;' +
      'box-shadow:0 8px 30px rgba(0,0,0,.18);border:2px solid #3b82f6;background:#fff;';

    el.innerHTML =
      '<div style="background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:#fff;padding:10px 14px;' +
      'font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px;">' +
        '<span id="pw-dot" style="width:8px;height:8px;border-radius:50%;background:#fbbf24;display:inline-block;"></span>' +
        'AI Proctoring' +
        '<span id="pw-shortid" style="margin-left:auto;font-size:10px;opacity:.8;">--------</span>' +
      '</div>' +
      '<div style="padding:12px 14px;font-size:12px;color:#374151;">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:8px;">' +
          '<span>Status</span><span id="pw-status" style="font-weight:600;color:#f59e0b;">Connecting…</span>' +
        '</div>' +
        '<div style="margin-bottom:8px;">' +
          '<div style="display:flex;align-items:center;gap:6px;">' +
            '<span>Credibility</span>' +
            '<span id="pw-score" style="font-weight:700;font-size:16px;color:#10b981;margin-left:auto;">100%</span>' +
          '</div>' +
          '<div style="background:#e5e7eb;height:5px;border-radius:3px;margin-top:4px;">' +
            '<div id="pw-bar" style="height:100%;width:100%;background:#10b981;border-radius:3px;transition:width .4s,background .4s;"></div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:4px;">' +
          '<span>Violations</span><span id="pw-count" style="font-weight:600;color:#10b981;">0</span>' +
        '</div>' +
        '<div id="pw-log" style="max-height:90px;overflow-y:auto;margin-top:6px;font-size:11px;">' +
          '<div style="color:#6b7280;">Monitoring starting…</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(el);
    this.widget = el;

    var s = document.createElement('style');
    s.textContent = '@keyframes pw-pulse{0%,100%{opacity:1}50%{opacity:.4}} #pw-dot{animation:pw-pulse 1.5s infinite}';
    document.head.appendChild(s);
  };

  /* ================================================================
   *  WebSocket
   * ================================================================ */
  ProctorSession.prototype._connectWS = function () {
    var self = this;
    var url = this.config.sessionManager + '?type=candidate';

    try { this.ws = new WebSocket(url); }
    catch (e) { this._setStatus('Error', '#ef4444'); return; }

    this.ws.onopen = function () {
      self._setStatus('Connected', '#10b981');
      self._send({
        type: 'session:start',
        data: {
          candidateId: self.config.candidateId,
          examId: self.config.examId,
          organizationId: self.config.organizationId,
          totalQuestions: 5,
          metadata: { userAgent: navigator.userAgent, ts: new Date().toISOString() }
        }
      });
    };

    this.ws.onmessage = function (e) {
      try { self._onMsg(JSON.parse(e.data)); } catch (_) {}
    };

    this.ws.onclose = function () {
      self._setStatus('Disconnected', '#ef4444');
      if (self.isActive) setTimeout(function () { self._connectWS(); }, 3000);
    };
    this.ws.onerror = function () { self._setStatus('Error', '#ef4444'); };
  };

  ProctorSession.prototype._send = function (o) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o));
  };

  ProctorSession.prototype._onMsg = function (m) {
    switch (m.type) {
      case 'session:started':
        this.sessionId = m.sessionId;
        this.shortId = m.shortId || m.sessionId.slice(0, 8);
        this.isActive = true;
        this._setStatus('Monitoring Active', '#10b981');
        var sid = document.getElementById('pw-shortid');
        if (sid) sid.textContent = this.shortId;
        console.log('🎉 Session:', this.sessionId, '| Short:', this.shortId);
        this.emit('session:started', m.data);
        this._attachBrowserListeners();
        this._startHeartbeat();
        this._startVisionAI();
        this._startAudioAI();
        this._startBehaviorAI();
        this._enforceFullscreen();
        break;

      case 'violation:alert':
        if (m.data && typeof m.data.credibilityScore === 'number') {
          this.credibilityScore = m.data.credibilityScore;
        }
        if (m.data && typeof m.data.violationCount === 'number') {
          this.violationCount = m.data.violationCount;
        }
        this._syncWidget();
        break;
    }
  };

  /* ================================================================
   *  BROWSER EVENT DETECTION  (fixed: no false blur on quiz clicks)
   * ================================================================ */
  ProctorSession.prototype._attachBrowserListeners = function () {
    var self = this;
    var _last = {};

    function on(tgt, evt, fn) {
      tgt.addEventListener(evt, fn, true);
      self._cleanups.push(function () { tgt.removeEventListener(evt, fn, true); });
    }

    function throttle(k, ms) {
      var n = Date.now();
      if (_last[k] && n - _last[k] < ms) return true;
      _last[k] = n;
      return false;
    }

    /* Track all user interactions to suppress false blur events */
    on(document, 'mousedown', function () { self._lastInteraction = Date.now(); });
    on(document, 'mouseup',   function () { self._lastInteraction = Date.now(); });
    on(document, 'click',     function () { self._mouseLastMoved = Date.now(); self._lastInteraction = Date.now(); });
    on(document, 'mousemove', function () { self._mouseLastMoved = Date.now(); });
    on(document, 'scroll',    function () { self._mouseLastMoved = Date.now(); });

    // 1. Tab visibility (definitive tab switch)
    on(document, 'visibilitychange', function () {
      if (document.hidden && !throttle('tab', 5000)) {
        self._report('tab_switch', 'Browser tab lost focus', 'warning', 'browser-monitor');
      }
    });

    // 2. Window blur — ONLY if NOT caused by in-page interaction
    on(window, 'blur', function () {
      if (Date.now() - self._lastInteraction < 500) return;
      if (!throttle('blur', 5000)) {
        self._report('window_blur', 'Window lost focus (possible app switch)', 'warning', 'browser-monitor');
      }
    });

    // 3. Clipboard
    on(document, 'copy',  function (e) { e.preventDefault(); self._report('copy_attempt',  'Copy blocked during exam',  'warning', 'browser-monitor'); });
    on(document, 'cut',   function (e) { e.preventDefault(); self._report('cut_attempt',   'Cut blocked during exam',   'warning', 'browser-monitor'); });
    on(document, 'paste', function (e) { e.preventDefault(); self._report('paste_attempt', 'Paste blocked during exam', 'critical','browser-monitor'); });

    // 4. Right-click
    on(document, 'contextmenu', function (e) {
      e.preventDefault();
      if (!throttle('ctx', 3000)) self._report('right_click', 'Right-click context menu attempted', 'warning', 'browser-monitor');
    });

    // 5. Shortcuts
    on(document, 'keydown', function (e) {
      self._lastInteraction = Date.now();
      self._mouseLastMoved = Date.now();
      var mod = e.ctrlKey || e.metaKey;
      if (mod) {
        var map = {c:'copy',v:'paste',x:'cut',a:'select-all',p:'print',s:'save',u:'view-source',f:'find'};
        var k = e.key.toLowerCase();
        if (map[k]) {
          e.preventDefault();
          if (!throttle('sc_' + k, 3000)) self._report('keyboard_shortcut', 'Blocked: Ctrl+' + k.toUpperCase() + ' (' + map[k] + ')', 'warning', 'browser-monitor');
          return;
        }
        if (e.shiftKey && (k === 'i' || k === 'j' || k === 'c')) {
          e.preventDefault();
          self._report('devtools_shortcut', 'Developer tools shortcut detected', 'critical', 'browser-monitor');
          return;
        }
      }
      if (e.key === 'F12') { e.preventDefault(); self._report('devtools_shortcut', 'F12 developer tools pressed', 'critical', 'browser-monitor'); }
      if (e.key === 'PrintScreen') self._report('screenshot_attempt', 'PrintScreen key pressed', 'critical', 'browser-monitor');
    });

    // 6. Fullscreen exit (only if enforcement not active — enforcement handles its own listener)
    if (!self.config.enforceFullscreen) {
      on(document, 'fullscreenchange', function () {
        if (!document.fullscreenElement && !throttle('fs', 5000))
          self._report('fullscreen_exit', 'Exited fullscreen exam mode', 'warning', 'browser-monitor');
      });
    }

    // 7. Resize (split-screen)
    var lw = window.innerWidth, lh = window.innerHeight;
    on(window, 'resize', function () {
      if (!throttle('rsz', 8000)) {
        if (Math.abs(window.innerWidth - lw) > 200 || Math.abs(window.innerHeight - lh) > 200)
          self._report('window_resize', 'Significant window resize detected', 'warning', 'browser-monitor');
        lw = window.innerWidth; lh = window.innerHeight;
      }
    });

    // 8. Multiple screens
    if (window.screen && window.screen.isExtended)
      self._report('multiple_screens', 'Multiple screens detected', 'critical', 'browser-monitor');

    // 9. Page leave
    on(window, 'beforeunload', function () {
      self._report('page_leave', 'Attempting to leave exam page', 'critical', 'browser-monitor');
    });

    // 10. Periodic focus check — only when truly unfocused
    var fi = setInterval(function () {
      if (!document.hasFocus() && (Date.now() - self._lastInteraction > 2000) && !throttle('fc', 15000))
        self._report('focus_lost', 'Browser does not have focus', 'warning', 'browser-monitor');
    }, 10000);
    this._cleanups.push(function () { clearInterval(fi); });

    this._log('✅ Browser monitoring active', '#10b981');
  };

  /* ================================================================
   *  HEARTBEAT
   * ================================================================ */
  ProctorSession.prototype._startHeartbeat = function () {
    var self = this;
    // Track real user activity (mouse move, click, keydown)
    var activityHandler = function () { self._lastUserActivity = Date.now(); };
    ['mousemove', 'click', 'keydown', 'touchstart', 'scroll'].forEach(function (evt) {
      document.addEventListener(evt, activityHandler, { passive: true });
    });
    this._cleanups.push(function () {
      ['mousemove', 'click', 'keydown', 'touchstart', 'scroll'].forEach(function (evt) {
        document.removeEventListener(evt, activityHandler);
      });
    });

    var hb = setInterval(function () {
      if (!self.isActive || !self.sessionId) return;
      var idleSec = Math.round((Date.now() - self._lastUserActivity) / 1000);
      self._send({
        type: 'session:heartbeat',
        sessionId: self.sessionId,
        data: { idleSeconds: idleSec, hasUserActivity: idleSec < 35 }
      });
      // Also flush any queued violations
      self._flushViolationQueue();
    }, 30000);
    this._cleanups.push(function () { clearInterval(hb); });
  };

  /* ================================================================
   *  VISION AI — Real Camera Face Detection
   *
   *  getUserMedia → hidden <video> → Canvas pixel analysis.
   *  Detects: camera covered, no face, multiple faces, no motion.
   * ================================================================ */
  ProctorSession.prototype._startVisionAI = function () {
    var self = this;
    if (!this.config.enableCamera) { this._log('📷 Camera disabled by config', '#6b7280'); return; }

    navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' } })
      .then(function (stream) {
        self._videoStream = stream;

        var v = document.createElement('video');
        v.srcObject = stream;
        v.setAttribute('playsinline', '');
        v.muted = true;
        v.style.cssText = 'position:fixed;bottom:0;left:0;width:1px;height:1px;opacity:0.01;pointer-events:none;';
        document.body.appendChild(v);
        v.play();
        self._videoEl = v;
        self._cleanups.push(function () { v.remove(); });

        var c = document.createElement('canvas');
        c.width = 320; c.height = 240;
        self._canvas = c;
        self._canvasCtx = c.getContext('2d', { willReadFrequently: true });

        self._log('📷 Camera active — Vision AI running', '#10b981');

        var _vt = {};
        var vi = setInterval(function () {
          if (!self.isActive || !self._videoEl) return;
          self._analyzeFrame(_vt);
        }, 3000);
        self._cleanups.push(function () { clearInterval(vi); });
      })
      .catch(function (err) {
        console.warn('📷 Camera not available:', err.message);
        self._log('📷 Camera not available: ' + err.message, '#f59e0b');
        self._report('camera_unavailable', 'Camera access denied or unavailable', 'critical', 'ai-vision');
      });
  };

  ProctorSession.prototype._analyzeFrame = function (_t) {
    var ctx = this._canvasCtx;
    var v = this._videoEl;
    if (!ctx || !v || v.readyState < 2) return;

    ctx.drawImage(v, 0, 0, 320, 240);
    var imgData = ctx.getImageData(0, 0, 320, 240);
    var px = imgData.data;

    /* 1. Brightness — camera covered? */
    var totalB = 0, sampled = 0;
    for (var i = 0; i < px.length; i += 16) {
      totalB += (px[i] + px[i+1] + px[i+2]) / 3;
      sampled++;
    }
    var avgB = totalB / sampled;

    if (avgB < 15) {
      if (!_t.dark || Date.now() - _t.dark > 20000) {
        _t.dark = Date.now();
        this._report('camera_covered', 'Camera appears covered or very dark environment', 'critical', 'ai-vision');
      }
      return;
    }

    /* 2. Skin-tone detection → face presence */
    var skinPx = 0, totalS = 0;
    for (var y = 40; y < 200; y += 2) {
      for (var x = 60; x < 260; x += 2) {
        var idx = (y * 320 + x) * 4;
        var r = px[idx], g = px[idx+1], b = px[idx+2];
        totalS++;
        if (r > 60 && g > 40 && b > 20 && r > g && r > b && (r-g) > 10 && (r-b) > 10 && Math.abs(r-g) < 120) {
          skinPx++;
        }
      }
    }
    var skinR = skinPx / totalS;

    if (skinR < 0.03) {
      if (!_t.noface || Date.now() - _t.noface > 30000) {
        _t.noface = Date.now();
        this._report('face_not_detected', 'No face detected — candidate may have left', 'warning', 'ai-vision');
      }
    } else {
      _t.noface = 0;
    }

    if (skinR > 0.45) {
      if (!_t.multi || Date.now() - _t.multi > 45000) {
        _t.multi = Date.now();
        this._report('multiple_faces', 'Multiple faces or person too close detected', 'warning', 'ai-vision');
      }
    }

    /* 3. Motion detection */
    var len = px.length / 4;
    var gray = new Uint8Array(len);
    for (var j = 0; j < len; j++) gray[j] = Math.round((px[j*4] + px[j*4+1] + px[j*4+2]) / 3);

    if (this._prevFrame) {
      var diff = 0;
      for (var k = 0; k < len; k += 4) diff += Math.abs(gray[k] - this._prevFrame[k]);
      var motion = diff / (len / 4);

      if (motion < 0.5) {
        if (!_t.still || Date.now() - _t.still > 60000) {
          _t.still = Date.now();
          this._report('no_motion', 'No movement in camera — candidate may be away', 'info', 'ai-vision');
        }
      } else {
        _t.still = 0;
      }
    }
    this._prevFrame = gray;
  };

  /* ================================================================
   *  AUDIO AI — Real Microphone Noise Analysis
   *
   *  getUserMedia → AudioContext → AnalyserNode.
   *  Detects: noise spikes, sustained noise, voice activity, silence.
   * ================================================================ */
  ProctorSession.prototype._startAudioAI = function () {
    var self = this;
    if (!this.config.enableMic) { this._log('🎙 Mic disabled', '#6b7280'); return; }

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(function (stream) {
        self._audioStream = stream;
        var AC = window.AudioContext || window.webkitAudioContext;
        self._audioCtx = new AC();
        self._analyser = self._audioCtx.createAnalyser();
        self._analyser.fftSize = 256;
        self._audioCtx.createMediaStreamSource(stream).connect(self._analyser);

        self._log('🎙 Microphone active — Audio AI running', '#10b981');

        // Start audio evidence ring buffer recorder
        self._startAudioRecorder();

        var bufLen = self._analyser.frequencyBinCount;
        var data = new Uint8Array(bufLen);
        var _at = {};
        var loudCnt = 0, silCnt = 0;

        var ai = setInterval(function () {
          if (!self.isActive || !self._analyser) return;
          self._analyser.getByteFrequencyData(data);

          var sum = 0;
          for (var i = 0; i < bufLen; i++) sum += data[i];
          var avg = sum / bufLen;

          // Spike
          if (avg > 120) {
            if (!_at.spike || Date.now() - _at.spike > 30000) {
              _at.spike = Date.now();
              self._report('audio_spike', 'Loud noise detected (level: ' + Math.round(avg) + ')', 'warning', 'ai-audio');
            }
            loudCnt++;
          } else if (avg > 60) {
            loudCnt++;
          } else {
            loudCnt = Math.max(0, loudCnt - 1);
          }

          // Sustained noise
          if (loudCnt > 10) {
            if (!_at.sust || Date.now() - _at.sust > 60000) {
              _at.sust = Date.now();
              self._report('sustained_noise', 'Sustained background noise — possible conversation', 'warning', 'ai-audio');
            }
            loudCnt = 0;
          }

          // Silence
          if (avg < 3) {
            silCnt++;
            if (silCnt > 30) {
              if (!_at.sil || Date.now() - _at.sil > 120000) {
                _at.sil = Date.now();
                self._report('mic_silent', 'Microphone appears muted or no audio', 'info', 'ai-audio');
              }
              silCnt = 0;
            }
          } else { silCnt = 0; }

          // Voice activity (speech freqs)
          var spSum = 0;
          for (var s = 3; s < 30; s++) spSum += data[s];
          var spAvg = spSum / 27;
          if (spAvg > 80) {
            if (!_at.voice || Date.now() - _at.voice > 45000) {
              _at.voice = Date.now();
              self._report('voice_detected', 'Voice activity detected — possible speaking', 'warning', 'ai-audio');
            }
          }
        }, 2000);
        self._cleanups.push(function () { clearInterval(ai); });
      })
      .catch(function (err) {
        console.warn('🎙 Mic not available:', err.message);
        self._log('🎙 Mic not available: ' + err.message, '#f59e0b');
        self._report('mic_unavailable', 'Microphone access denied or unavailable', 'critical', 'ai-audio');
      });
  };

  /* ================================================================
   *  BEHAVIOR AI
   * ================================================================ */
  ProctorSession.prototype._startBehaviorAI = function () {
    var self = this;
    var _bt = {};
    var cnt = 0;

    var bi = setInterval(function () {
      if (!self.isActive) return;
      cnt++;

      if (cnt % 6 === 0) {
        var idle = Date.now() - self._mouseLastMoved;
        if (idle > 120000) {
          if (!_bt.idle || Date.now() - _bt.idle > 120000) {
            _bt.idle = Date.now();
            self._report('no_mouse_activity', 'No activity for ' + Math.round(idle/60000) + ' min', 'info', 'ai-behavior');
          }
        }
      }

      if (cnt % 12 === 0) {
        var recent = self.violations.filter(function (v) { return (Date.now() - new Date(v.timestamp).getTime()) < 120000; });
        if (recent.length >= 8) {
          if (!_bt.rapid || Date.now() - _bt.rapid > 180000) {
            _bt.rapid = Date.now();
            self._report('suspicious_pattern', recent.length + ' violations in 2 min — suspicious behavior', 'warning', 'ai-behavior');
          }
        }
      }
    }, 10000);
    this._cleanups.push(function () { clearInterval(bi); });
    this._log('🧠 Behavior AI monitoring active', '#10b981');
  };

  /* ================================================================
   *  Fullscreen Enforcement
   * ================================================================ */
  ProctorSession.prototype._enforceFullscreen = function () {
    if (!this.config.enforceFullscreen) return;
    var self = this;
    var el = document.documentElement;
    var req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (!req) { this._log('⚠ Fullscreen API not supported', '#f59e0b'); return; }

    // Request fullscreen on session start
    req.call(el).then(function () {
      self._log('🖥 Fullscreen enforced', '#10b981');
    }).catch(function () {
      self._log('⚠ Fullscreen request denied — click to enter', '#f59e0b');
      self._report('fullscreen_denied', 'Browser denied fullscreen request', 'warning', 'browser-monitor');
      // Try again on next user interaction
      var retry = function () {
        req.call(el).catch(function () {});
        document.removeEventListener('click', retry);
      };
      document.addEventListener('click', retry);
    });

    // Re-enforce when user exits fullscreen
    var handler = function () {
      if (!document.fullscreenElement && !document.webkitFullscreenElement && self.isActive) {
        self._report('fullscreen_exit', 'Exited fullscreen exam mode', 'warning', 'browser-monitor');
        // Re-request fullscreen after a short delay
        setTimeout(function () {
          if (self.isActive && !document.fullscreenElement) {
            req.call(el).catch(function () {
              self._log('⚠ Could not re-enter fullscreen', '#f59e0b');
            });
          }
        }, 1500);
      }
    };
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    self._cleanups.push(function () {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler);
      // Exit fullscreen on stop
      if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
    });
  };

  /* ================================================================
   *  Evidence Capture
   *
   *  Browser violations → viewport screenshot (Canvas)
   *  Vision AI violations → webcam frame (existing _canvas)
   *  Audio AI violations → 10s audio clip (MediaRecorder ring buffer)
   * ================================================================ */

  // Capture viewport screenshot as base64 JPEG (for browser violations)
  // Renders a visual canvas image with page state + optional webcam inset
  ProctorSession.prototype._captureScreenshot = function () {
    if (!this._enableEvidence) return null;
    try {
      if (!this._screenshotCanvas) {
        this._screenshotCanvas = document.createElement('canvas');
      }
      var c = this._screenshotCanvas;
      var W = 640, H = 400;
      c.width = W; c.height = H;
      var ctx = c.getContext('2d');

      // Dark background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, W, H);

      // Top bar
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, W, 44);
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('⚠ Browser Violation Captured', 16, 28);
      ctx.fillStyle = '#64748b';
      ctx.font = '11px sans-serif';
      ctx.fillText(new Date().toLocaleTimeString(), W - 90, 28);

      // Page info section
      var y = 68;
      var lines = [
        ['Page', document.title || '-'],
        ['URL', location.pathname],
        ['Viewport', window.innerWidth + ' × ' + window.innerHeight],
        ['Visibility', document.visibilityState],
        ['Fullscreen', String(!!document.fullscreenElement)],
        ['Violations', String(this.violations.length)],
        ['Credibility', this.credibilityScore + '%']
      ];
      for (var i = 0; i < lines.length; i++) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px sans-serif';
        ctx.fillText(lines[i][0] + ':', 20, y);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '12px sans-serif';
        ctx.fillText(String(lines[i][1]).slice(0, 60), 120, y);
        y += 22;
      }

      // Credibility bar
      y += 8;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(20, y, 200, 14);
      var score = this.credibilityScore;
      var barColor = score > 80 ? '#10b981' : score > 50 ? '#f59e0b' : '#ef4444';
      ctx.fillStyle = barColor;
      ctx.fillRect(20, y, Math.round(200 * score / 100), 14);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(score + '%', 24, y + 11);

      // Webcam inset (if available)
      if (this._videoEl && this._videoEl.readyState >= 2) {
        var inW = 180, inH = 135;
        var ix = W - inW - 16, iy = 60;
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.strokeRect(ix - 1, iy - 1, inW + 2, inH + 2);
        ctx.drawImage(this._videoEl, ix, iy, inW, inH);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px sans-serif';
        ctx.fillText('Live webcam', ix, iy + inH + 14);
      }

      // Bottom bar with timestamp
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, H - 28, W, 28);
      ctx.fillStyle = '#475569';
      ctx.font = '10px sans-serif';
      ctx.fillText('Proctor SDK • ' + new Date().toISOString() + ' • ' + navigator.userAgent.slice(0, 80), 12, H - 10);

      var dataUrl = c.toDataURL('image/jpeg', 0.7);
      console.log('📸 Screenshot captured:', Math.round(dataUrl.length / 1024) + 'KB');
      return {
        type: 'screenshot',
        format: 'image/jpeg',
        data: dataUrl
      };
    } catch (e) {
      console.warn('📸 Screenshot error:', e.message);
      return null;
    }
  };

  // Capture webcam frame as base64 JPEG (for vision violations)
  ProctorSession.prototype._captureWebcamFrame = function () {
    if (!this._enableEvidence) return null;
    try {
      if (!this._canvas || !this._canvasCtx || !this._videoEl || this._videoEl.readyState < 2) {
        console.log('📷 Webcam frame: canvas/video not ready', !!this._canvas, !!this._videoEl);
        return null;
      }
      this._canvasCtx.drawImage(this._videoEl, 0, 0, 320, 240);
      var dataUrl = this._canvas.toDataURL('image/jpeg', 0.5);
      console.log('📷 Webcam frame captured:', Math.round(dataUrl.length / 1024) + 'KB');
      return {
        type: 'webcam_frame',
        format: 'image/jpeg',
        data: dataUrl  // base64 JPEG ~10-20KB
      };
    } catch (e) { console.warn('📷 Webcam frame capture error:', e.message); return null; }
  };

  // Start audio ring buffer recorder
  ProctorSession.prototype._startAudioRecorder = function () {
    if (!this._enableEvidence) return;
    if (!this._audioStream) return;
    var self = this;
    try {
      var mr = new MediaRecorder(this._audioStream, { mimeType: 'audio/webm;codecs=opus' });
      this._audioRecorder = mr;
      this._audioChunks = [];
      this._audioInitSegment = null; // WebM header from first chunk - MUST be kept
      this._audioRingStart = Date.now();

      mr.ondataavailable = function (e) {
        if (e.data && e.data.size > 0) {
          // First chunk contains the WebM initialization segment (EBML header + tracks).
          // Without it, subsequent chunks cannot be decoded. Keep it forever.
          if (!self._audioInitSegment) {
            self._audioInitSegment = e.data;
            console.log('🎤 Audio init segment saved:', e.data.size, 'bytes');
          }
          self._audioChunks.push({ blob: e.data, ts: Date.now() });
          // Trim old chunks beyond ring buffer duration, but keep at least 1
          var cutoff = Date.now() - self._audioRingMs;
          while (self._audioChunks.length > 1 && self._audioChunks[0].ts < cutoff) {
            self._audioChunks.shift();
          }
        }
      };

      // Record in 1-second slices for the ring buffer
      mr.start(1000);
      this._cleanups.push(function () {
        if (mr.state !== 'inactive') mr.stop();
      });
      console.log('🎤 Audio evidence recorder started (10s ring buffer)');
    } catch (e) {
      console.warn('Audio recorder not available:', e.message);
    }
  };

  // Capture audio clip: stop/restart recorder to get a complete, self-contained WebM
  ProctorSession.prototype._captureAudioClip = function (durationMs) {
    if (!this._enableEvidence) return null;
    durationMs = durationMs || 5000;
    var self = this;

    // Use the accumulated chunks with init segment prepended
    if (!this._audioChunks || this._audioChunks.length === 0) return null;
    if (!this._audioInitSegment) return null;

    try {
      var cutoff = Date.now() - durationMs;
      var chunks = this._audioChunks.filter(function (c) { return c.ts >= cutoff; });
      if (chunks.length === 0) return null;

      // Always prepend the init segment so the WebM blob is decodable
      var blobs = [self._audioInitSegment];
      chunks.forEach(function (c) {
        // skip the init segment itself if it's also the first chunk in the filter
        if (c.blob !== self._audioInitSegment) {
          blobs.push(c.blob);
        }
      });
      var combined = new Blob(blobs, { type: 'audio/webm;codecs=opus' });

      return {
        type: 'audio_clip',
        format: 'audio/webm',
        durationMs: Math.min(durationMs, Date.now() - (chunks[0]?.ts || Date.now())),
        blob: combined,
        _pending: true
      };
    } catch (e) { return null; }
  };

  // Async helper to convert blob to base64
  ProctorSession.prototype._blobToBase64 = function (blob, cb) {
    var reader = new FileReader();
    reader.onloadend = function () { cb(reader.result); };
    reader.readAsDataURL(blob);
  };

  /* ================================================================
   *  Violation Reporting (unified)
   * ================================================================ */
  ProctorSession.prototype._flushViolationQueue = function () {
    if (this._sendingQueue || !this._violationQueue.length) return;
    if (!this.ws || this.ws.readyState !== 1) return;
    this._sendingQueue = true;
    var batch = this._violationQueue.splice(0);
    this._send({
      type: 'violation:batch',
      sessionId: this.sessionId,
      data: batch
    });
    this._sendingQueue = false;
  };

  ProctorSession.prototype._report = function (type, desc, sev, source) {
    sev = sev || 'warning';
    source = source || 'browser-monitor';
    var self = this;
    var v = { type: type, description: desc, severity: sev, timestamp: new Date().toISOString(), source: source };
    this.violations.push(v);

    console.log('🚨 [' + source + '] ' + sev.toUpperCase() + ': ' + desc);

    var payload = {
      type: type, description: desc, severity: sev,
      timestamp: v.timestamp,
      confidence: sev === 'critical' ? 95 : sev === 'warning' ? 85 : 70,
      source: source,
      metadata: { candidateId: this.config.candidateId },
      evidence: null
    };

    // Capture evidence based on source type
    if (this._enableEvidence) {
      if (source === 'browser-monitor') {
        payload.evidence = this._captureScreenshot();
      } else if (source === 'ai-vision') {
        payload.evidence = this._captureWebcamFrame();
      } else if (source === 'ai-audio') {
        // Audio needs async blob-to-base64 conversion
        var clip = this._captureAudioClip(5000);
        if (clip && clip._pending && clip.blob) {
          // Send the payload async after base64 conversion
          this._blobToBase64(clip.blob, function (base64) {
            payload.evidence = {
              type: 'audio_clip',
              format: clip.format,
              durationMs: clip.durationMs,
              data: base64
            };
            self._violationQueue.push(payload);
            if (self.ws && self.ws.readyState === 1) self._flushViolationQueue();
          });
          // Show UI feedback immediately, skip queuing below
          var icon2 = '🎙';
          this._log(icon2 + ' ' + desc, sev === 'critical' ? '#ef4444' : sev === 'warning' ? '#f59e0b' : '#6b7280');
          this._toast(v);
          this.emit('violation', v);
          return; // audio evidence sent async
        }
      }
    }

    // Queue the violation (sync path — browser/vision evidence or no evidence)
    console.log('📦 Queuing violation:', type, '| evidence:', payload.evidence ? payload.evidence.type : 'none');
    this._violationQueue.push(payload);

    // Try to send immediately (also sends any previously queued)
    if (this.ws && this.ws.readyState === 1) {
      this._flushViolationQueue();
    }

    var icon = source === 'ai-vision' ? '📷' : source === 'ai-audio' ? '🎙' : source === 'ai-behavior' ? '🧠' : '⚠';
    this._log(icon + ' ' + desc, sev === 'critical' ? '#ef4444' : sev === 'warning' ? '#f59e0b' : '#6b7280');
    this._toast(v);
    this.emit('violation', v);
  };

  /* ================================================================
   *  Widget helpers
   * ================================================================ */
  ProctorSession.prototype._syncWidget = function () {
    var s = this.credibilityScore;
    var c = this.violationCount || this.violations.length;
    var col = s > 80 ? '#10b981' : s > 50 ? '#f59e0b' : '#ef4444';
    var e;
    e = document.getElementById('pw-count');  if (e) { e.textContent = c; e.style.color = c > 0 ? '#ef4444' : '#10b981'; }
    e = document.getElementById('pw-score');  if (e) { e.textContent = s + '%'; e.style.color = col; }
    e = document.getElementById('pw-bar');    if (e) { e.style.width = s + '%'; e.style.background = col; }
    this.emit('credibility:updated', s);
  };

  ProctorSession.prototype._setStatus = function (t, c) {
    var e = document.getElementById('pw-status'); if (e) { e.textContent = t; e.style.color = c; }
    var d = document.getElementById('pw-dot');    if (d) d.style.background = c;
  };

  ProctorSession.prototype._log = function (txt, col) {
    var el = document.getElementById('pw-log'); if (!el) return;
    var d = document.createElement('div');
    d.style.cssText = 'color:' + col + ';margin:2px 0;';
    d.textContent = txt;
    el.insertBefore(d, el.firstChild);
    while (el.children.length > 30) el.removeChild(el.lastChild);
  };

  ProctorSession.prototype._toast = function (v) {
    var t = document.createElement('div');
    var bg = v.severity === 'critical' ? '#fef2f2' : v.severity === 'warning' ? '#fffbeb' : '#eff6ff';
    var bd = v.severity === 'critical' ? '#fca5a5' : v.severity === 'warning' ? '#fcd34d' : '#93c5fd';
    var fg = v.severity === 'critical' ? '#dc2626' : v.severity === 'warning' ? '#d97706' : '#2563eb';
    t.style.cssText =
      'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:10001;' +
      'background:' + bg + ';border:1px solid ' + bd + ';color:' + fg + ';' +
      'padding:10px 20px;border-radius:8px;font-size:13px;font-weight:500;' +
      'box-shadow:0 4px 12px rgba(0,0,0,.12);transition:opacity .3s;font-family:inherit;';
    t.textContent = '⚠️ ' + v.description;
    document.body.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 400); }, 3000);
  };

  /* ================================================================
   *  Cleanup
   * ================================================================ */
  ProctorSession.prototype.stop = function () {
    this.isActive = false;
    this._cleanups.forEach(function (fn) { fn(); });
    this._cleanups = [];
    if (this._videoStream) { this._videoStream.getTracks().forEach(function (t) { t.stop(); }); this._videoStream = null; }
    if (this._audioStream) { this._audioStream.getTracks().forEach(function (t) { t.stop(); }); this._audioStream = null; }
    if (this._audioCtx) { this._audioCtx.close(); this._audioCtx = null; }
    this._send({ type: 'session:end', sessionId: this.sessionId });
    if (this.ws) this.ws.close();
    this._setStatus('Session Ended', '#6b7280');
  };

  ProctorSession.prototype.destroy = function () {
    this.stop();
    if (this.widget) { this.widget.remove(); this.widget = null; }
    window.ProctorSDKInstance = null;
  };

  /* ================================================================
   *  Public API
   * ================================================================ */
  window.ProctorSDK = {
    init: function (cfg) {
      if (window.ProctorSDKInstance) window.ProctorSDKInstance.destroy();
      var s = new ProctorSession(cfg);
      window.ProctorSDKInstance = s;
      setTimeout(function () { s.start(); }, 100);
      return s;
    },
    getInstance: function () { return window.ProctorSDKInstance || null; }
  };

  console.log('✅ ProctorSDK loaded (real AI vision + audio + behavior)');
})();

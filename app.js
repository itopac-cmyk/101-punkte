(function () {
  'use strict';

  var KEY = '101-punkte-v1';
  var DEFAULT_PLAYERS = [
    ['Spieler 1', 'Spieler 2'],
    ['Spieler 3', 'Spieler 4']
  ];
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var speechSupported = typeof SR === 'function';
  var COUNT = [null, 'einer', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf'];

  var announcedTen = false;
  var listening = false;
  var listenGen = 0;
  var rec = null;
  var quickEnds = 0;
  var lastCommit = { key: '', at: 0 };
  var flash = '';
  var flashKind = '';
  var preview = '';
  var keypadOpen = false;
  var dialogOpen = false;
  var entry = '';
  var buffer = '';
  var speechMode = speechSupported ? 'ready' : 'unsupported';
  var sheetSig = '';
  var prevTotals = [null, null];
  var statusTimer = 0;
  var speakTimer = 0;
  var speakKick = 0;
  var keyboardNav = false;
  var resumeAfterSpeak = false;
  var cachedVoice;

  var state = load();
  if (state.migrated) {
    delete state.migrated;
    save();
  }
  announcedTen = Score.firstTenComplete(state.scores);

  function $(id) { return document.getElementById(id); }

  function defaultScores() {
    var rows = [];
    for (var i = 0; i < Score.ROUNDS; i++) rows.push([null, null]);
    return rows;
  }

  function defaultPlayers() {
    return DEFAULT_PLAYERS.map(function (pair) { return pair.slice(); });
  }

  function defaultState() {
    return {
      players: defaultPlayers(),
      scores: defaultScores(),
      round: 0,
      team: 0,
      theme: null
    };
  }

  function cleanName(value, fallback) {
    if (typeof value !== 'string') return fallback;
    var trimmed = value.trim().slice(0, 30);
    return trimmed || fallback;
  }

  function pairFromLegacy(value, team) {
    var fallback = DEFAULT_PLAYERS[team];
    if (typeof value !== 'string') return fallback.slice();
    var text = value.trim();
    if (!text || (team === 0 && text === 'Team A') || (team === 1 && text === 'Team B')) return fallback.slice();
    var parts = text.split(/\s*&\s*/);
    if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
      return [
        cleanName(parts[0], fallback[0]),
        cleanName(parts.slice(1).join(' & '), fallback[1])
      ];
    }
    return [cleanName(text, fallback[0]), fallback[1]];
  }

  function readPlayers(data) {
    if (data.players && Array.isArray(data.players) && data.players.length === 2) {
      return [0, 1].map(function (team) {
        var pair = data.players[team];
        var fallback = DEFAULT_PLAYERS[team];
        if (!Array.isArray(pair)) return pairFromLegacy(typeof pair === 'string' ? pair : '', team);
        return [cleanName(pair[0], fallback[0]), cleanName(pair[1], fallback[1])];
      });
    }
    if (Array.isArray(data.names)) {
      return [0, 1].map(function (team) { return pairFromLegacy(data.names[team], team); });
    }
    return defaultPlayers();
  }

  function teamLabel(team) {
    return state.players[team][0] + ' & ' + state.players[team][1];
  }

  function playerInput(team, index) {
    return $('player-' + team + '-' + index);
  }

  function load() {
    var fresh = defaultState();
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return fresh;
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.scores) || data.scores.length !== Score.ROUNDS) return fresh;
      var scores = defaultScores();
      for (var r = 0; r < Score.ROUNDS; r++) {
        var row = data.scores[r];
        if (!Array.isArray(row)) return fresh;
        for (var t = 0; t < 2; t++) {
          var value = row[t];
          if (value == null) scores[r][t] = null;
          else if (typeof value === 'number' && Number.isInteger(value) && Math.abs(value) <= 999999) scores[r][t] = value;
          else return fresh;
        }
      }
      var hadPlayers = data.players && Array.isArray(data.players);
      return {
        players: readPlayers(data),
        scores: scores,
        round: Number.isInteger(data.round) && data.round >= 0 && data.round <= 10 ? data.round : 0,
        team: data.team === 1 ? 1 : 0,
        theme: data.theme === 'light' || data.theme === 'dark' ? data.theme : null,
        migrated: !hadPlayers
      };
    } catch (err) {
      return fresh;
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {}
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  var fmt = new Intl.NumberFormat('de-DE');

  function formatPoints(n) {
    if (n == null || Number.isNaN(n)) return '–';
    var abs = fmt.format(Math.abs(n));
    return n < 0 ? '−' + abs : abs;
  }

  function punkt(n) {
    return Math.abs(n) === 1 ? 'Punkt' : 'Punkte';
  }

  function pointsPhrase(n) {
    return (n < 0 ? 'minus ' : '') + Math.abs(n) + ' ' + punkt(n);
  }

  function currentTheme() {
    var set = document.documentElement.getAttribute('data-theme');
    if (set === 'light' || set === 'dark') return set;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    var dark = currentTheme() === 'dark';
    var meta = $('theme-color');
    if (meta) meta.setAttribute('content', dark ? '#0c1915' : '#d5e3db');
    var sun = $('icon-sun');
    var moon = $('icon-moon');
    if (sun && moon) {
      sun.hidden = !dark;
      moon.hidden = dark;
    }
    var btn = $('theme');
    if (btn) btn.setAttribute('aria-label', dark ? 'Helles Design' : 'Dunkles Design');
  }

  function whereText() {
    return 'Runde ' + (state.round + 1) + ' · ' + teamLabel(state.team);
  }

  function statusText() {
    if (flash) return flash;
    if (preview) return '„' + preview + '“';
    if (buffer) return whereText() + ' · ' + buffer;
    if (listening) return 'Höre zu · ' + whereText();
    return whereText();
  }

  function setFlash(text, kind) {
    flash = text;
    flashKind = kind || '';
    renderStatus();
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(function () {
      flash = '';
      flashKind = '';
      renderStatus();
    }, 1700);
  }

  function renderStatus() {
    var status = $('status');
    status.textContent = statusText();
    status.classList.toggle('a', !flash && state.team === 0);
    status.classList.toggle('b', !flash && state.team === 1);
    status.classList.toggle('is-error', flashKind === 'error');
    var done = 0;
    for (var r = 0; r < Score.ROUNDS; r++) {
      if (state.scores[r][0] != null && state.scores[r][1] != null) done++;
    }
    $('progress').textContent = done + '/11';
    var hint = $('hint');
    if (speechMode === 'denied') hint.textContent = 'Mikrofon blockiert. Die Tastatur funktioniert weiter.';
    else if (speechMode === 'unsupported') hint.textContent = 'Spracheingabe ist in diesem Browser nicht verfügbar.';
    else hint.textContent = '';
    renderChrome();
  }

  function renderChrome() {
    var mic = $('mic');
    var unsupported = speechMode !== 'ready';
    document.body.classList.toggle('no-speech', unsupported);
    $('mic-icon').hidden = unsupported || listening;
    $('mic-stop').hidden = unsupported || !listening;
    $('mic-keys').hidden = !unsupported;
    mic.classList.toggle('listening', listening && !unsupported);
    var caption = $('mic-caption');
    if (unsupported) {
      mic.setAttribute('aria-label', 'Zahl eingeben');
      mic.setAttribute('aria-pressed', 'false');
      caption.textContent = 'Eingeben';
    } else if (listening) {
      mic.setAttribute('aria-label', 'Mikrofon ausschalten');
      mic.setAttribute('aria-pressed', 'true');
      caption.textContent = 'Stopp';
    } else {
      mic.setAttribute('aria-label', 'Mikrofon einschalten');
      mic.setAttribute('aria-pressed', 'false');
      caption.textContent = 'Sagen';
    }
    document.body.classList.toggle('locked', keypadOpen || dialogOpen);
  }

  function renderBoard() {
    var totals = [Score.total(state.scores, 0), Score.total(state.scores, 1)];
    var counts = [Score.countFilled(state.scores, 0), Score.countFilled(state.scores, 1)];
    var win = Score.winner(state.scores);
    for (var i = 0; i < 2; i++) {
      var totalEl = $('total-' + (i === 0 ? 'a' : 'b'));
      totalEl.textContent = formatPoints(totals[i]);
      totalEl.classList.toggle('is-neg', totals[i] < 0);
      if (prevTotals[i] != null && prevTotals[i] !== totals[i]) {
        totalEl.classList.remove('pop');
        void totalEl.offsetWidth;
        totalEl.classList.add('pop');
      }
      for (var p = 0; p < 2; p++) {
        var input = playerInput(i, p);
        if (document.activeElement !== input && input.value !== state.players[i][p]) input.value = state.players[i][p];
      }
      var card = document.querySelector('[data-team-card="' + i + '"]');
      var playing = !win;
      card.classList.toggle('active', playing && state.team === i);
      card.classList.toggle('winner-card', !!(win && win.kind === 'win' && win.team === i));
    }
    prevTotals = totals;

    var lead = $('lead');
    var box = $('winner');
    if (win) {
      lead.hidden = true;
      box.hidden = false;
      if (win.kind === 'tie') {
        box.innerHTML = '<strong>Unentschieden</strong><span>beide ' + formatPoints(win.a) + ' Punkte</span>';
      } else {
        box.innerHTML = '<strong>' + esc(teamLabel(win.team)) + ' gewinnt</strong><span>'
          + formatPoints(totals[0]) + ' zu ' + formatPoints(totals[1]) + ' · '
          + win.margin + ' ' + punkt(win.margin) + ' weniger</span>';
      }
    } else {
      box.hidden = true;
      box.innerHTML = '';
      lead.hidden = false;
      if (counts[0] === 0 && counts[1] === 0) {
        lead.textContent = 'Niedrigste Summe gewinnt';
        lead.classList.add('hintish');
      } else if (totals[0] === totals[1]) {
        lead.textContent = 'Gleichstand · ' + formatPoints(totals[0]);
        lead.classList.remove('hintish');
      } else {
        var leader = totals[0] < totals[1] ? 0 : 1;
        var margin = Math.abs(totals[0] - totals[1]);
        lead.textContent = teamLabel(leader) + ' führt mit ' + margin + ' ' + punkt(margin);
        lead.classList.remove('hintish');
      }
    }

    var titleTotals = (counts[0] || counts[1])
      ? formatPoints(totals[0]) + ' : ' + formatPoints(totals[1]) + ' · '
      : '';
    document.title = titleTotals + '101 Punkte';
  }

  function cellButton(round, team, isRun) {
    var value = isRun ? Score.running(state.scores, team, round) : state.scores[round][team];
    var empty = value == null;
    var active = state.round === round && state.team === team;
    var cls = [isRun ? 'run' : 'cell', team === 0 ? 'a' : 'b'];
    if (empty) cls.push('is-empty');
    if (active) cls.push('active');
    if (!empty && value < 0) cls.push('is-neg');
    var label = 'Runde ' + (round + 1) + ', ' + teamLabel(team) + ', ';
    if (isRun) label += empty ? 'noch keine Summe' : 'Summe ' + formatPoints(value);
    else label += empty ? 'keine Punkte' : formatPoints(value) + ' Punkte';
    return '<button type="button" class="' + cls.join(' ') + '" data-round="' + round + '" data-team="' + team
      + '" aria-label="' + esc(label) + '"' + (active && !isRun ? ' aria-current="true"' : '') + '>'
      + (empty ? '–' : formatPoints(value)) + '</button>';
  }

  function sepHtml(start, end) {
    var a = Score.blockSum(state.scores, 0, start, end);
    var b = Score.blockSum(state.scores, 1, start, end);
    var label = 'Zwischensumme · Runden ' + (start + 1) + '–' + end;
    var aText = a == null ? '–' : formatPoints(a);
    var bText = b == null ? '–' : formatPoints(b);
    var aria = label + '. ' + teamLabel(0) + ' ' + aText + ', ' + teamLabel(1) + ' ' + bText + '.';
    return '<div class="sep" role="separator" aria-label="' + esc(aria) + '">'
      + '<div class="sep-label">' + label + '</div>'
      + '<div class="subline"><span></span>'
      + '<span class="subn a' + (a != null && a < 0 ? ' is-neg' : '') + '">' + aText + '</span>'
      + '<span class="subn b' + (b != null && b < 0 ? ' is-neg' : '') + '">' + bText + '</span>'
      + '</div></div>';
  }

  function renderSheet() {
    var sig = JSON.stringify(state.scores) + '|' + state.round + '|' + state.team + '|' + state.players.map(function (pair) { return pair.join('\n'); }).join('\n');
    if (sig === sheetSig) return;
    sheetSig = sig;
    var html = '<div class="hh rn-h"><span class="sr">Runde</span>R</div>';
    html += head(0) + head(1);
    for (var r = 0; r < Score.ROUNDS; r++) {
      html += '<button type="button" class="rn' + (state.round === r ? ' is-active' : '') + '" data-round="' + r
        + '" aria-label="Runde ' + (r + 1) + '">' + (r + 1) + '</button>';
      html += cellButton(r, 0, false) + cellButton(r, 0, true) + cellButton(r, 1, false) + cellButton(r, 1, true);
      if (r === 3) html += sepHtml(0, 4);
      if (r === 7) html += sepHtml(4, 8);
    }
    $('sheet').innerHTML = html;
    if (keyboardNav) {
      var active = document.querySelector('.cell.active');
      if (active) active.focus({ preventScroll: true });
    }
  }

  function head(team) {
    var cls = team === 0 ? 'a' : 'b';
    var label = teamLabel(team);
    return '<div class="hh team ' + cls + '"><div class="tname" title="' + esc(label) + '">' + esc(label)
      + '</div><div class="hlabel">Pkt</div><div class="hlabel">Summe</div></div>';
  }

  function scrollActive() {
    var el = document.querySelector('.cell.active');
    if (!el) return;
    var rect = el.getBoundingClientRect();
    var topLimit = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--board-h')) || 0;
    var bottomLimit = window.innerHeight - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dock-h')) || 0);
    if (rect.top >= topLimit + 4 && rect.bottom <= bottomLimit - 4) return;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }

  var lastActive = '';
  function maybeScroll() {
    var key = state.round + ':' + state.team;
    if (key === lastActive) return;
    lastActive = key;
    scrollActive();
  }

  function syncHeights() {
    var board = document.querySelector('.scoreboard');
    var dock = document.querySelector('.dock');
    if (board) document.documentElement.style.setProperty('--board-h', board.offsetHeight + 'px');
    if (dock) document.documentElement.style.setProperty('--dock-h', dock.offsetHeight + 'px');
  }

  function renderAll() {
    renderBoard();
    renderSheet();
    renderStatus();
    syncHeights();
    maybeScroll();
  }

  function advance() {
    if (state.team === 0) {
      state.team = 1;
      return;
    }
    if (state.round < 10) {
      state.round += 1;
      state.team = 0;
      return;
    }
    stopListening(true);
  }

  function tenText() {
    var a = Score.sumFirstTen(state.scores, 0);
    var b = Score.sumFirstTen(state.scores, 1);
    return 'Nach zehn Runden: ' + teamLabel(0) + ' ' + pointsPhrase(a) + ', ' + teamLabel(1) + ' ' + pointsPhrase(b) + '.';
  }

  function teamSpoken(team) {
    if (Score.countFilled(state.scores, team) === 0) return teamLabel(team) + ' noch keine Punkte';
    return teamLabel(team) + ' ' + pointsPhrase(Score.total(state.scores, team));
  }

  function standText() {
    var counts = [Score.countFilled(state.scores, 0), Score.countFilled(state.scores, 1)];
    if (counts[0] === 0 && counts[1] === 0) return 'Noch keine Punkte.';
    var win = Score.winner(state.scores);
    if (win) {
      var end = 'Endstand: ' + teamLabel(0) + ' ' + pointsPhrase(win.a) + ', ' + teamLabel(1) + ' ' + pointsPhrase(win.b) + '. ';
      return end + (win.kind === 'tie' ? 'Unentschieden.' : teamLabel(win.team) + ' gewinnt.');
    }
    var prefix = Score.cleanPrefix(state.scores);
    if (prefix === 10) return tenText();
    if (prefix === 1) return 'Nach einer Runde: ' + teamSpoken(0) + ', ' + teamSpoken(1) + '.';
    if (prefix > 1) return 'Nach ' + COUNT[prefix] + ' Runden: ' + teamSpoken(0) + ', ' + teamSpoken(1) + '.';
    return 'Zwischenstand: ' + teamSpoken(0) + ', ' + teamSpoken(1) + '.';
  }

  function maybeAnnounceTen(shouldSpeak) {
    var done = Score.firstTenComplete(state.scores);
    if (!done) {
      announcedTen = false;
      return;
    }
    if (!shouldSpeak || announcedTen) {
      announcedTen = true;
      return;
    }
    announcedTen = true;
    speak(tenText(), true);
  }

  function commitValue(value) {
    if (!Number.isInteger(value)) return;
    if (value === 0) value = 0;
    buffer = '';
    preview = '';
    state.scores[state.round][state.team] = value;
    if (navigator.vibrate) navigator.vibrate(12);
    advance();
    save();
    setFlash(formatPoints(value) + ' gespeichert');
    renderAll();
    maybeAnnounceTen(true);
  }

  function germanVoice() {
    var synth = window.speechSynthesis;
    if (!synth) return null;
    if (cachedVoice !== undefined && cachedVoice !== null) return cachedVoice;
    var voices = synth.getVoices();
    if (!voices.length) return null;
    cachedVoice = voices.filter(function (v) { return /^de-DE/i.test(v.lang || ''); })[0]
      || voices.filter(function (v) { return /^de/i.test(v.lang || ''); })[0]
      || null;
    return cachedVoice;
  }

  var speakGen = 0;

  function speak(text, resume) {
    var synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance !== 'function') {
      setFlash('Vorlesen wird hier nicht unterstützt.', 'error');
      return;
    }
    var gen = ++speakGen;
    resumeAfterSpeak = !!resume && listening;
    if (listening) stopListening(true);
    window.clearInterval(speakKick);
    window.clearTimeout(speakTimer);
    try { synth.cancel(); } catch (err) {}
    var utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 0.98;
    var voice = germanVoice();
    if (voice) {
      try { utterance.voice = voice; } catch (err) {}
    }
    var finished = false;
    function finish(allowResume) {
      if (finished || gen !== speakGen) return;
      finished = true;
      window.clearInterval(speakKick);
      window.clearTimeout(speakTimer);
      if (allowResume && resumeAfterSpeak) {
        resumeAfterSpeak = false;
        startListening();
      } else {
        resumeAfterSpeak = false;
      }
    }
    utterance.onend = function () { finish(true); };
    utterance.onerror = function () { finish(false); };
    try { synth.resume(); } catch (err) {}
    synth.speak(utterance);
    speakKick = window.setInterval(function () {
      if (!synth.speaking) {
        window.clearInterval(speakKick);
        return;
      }
      try { synth.resume(); } catch (err) {}
    }, 4000);
    speakTimer = window.setTimeout(function () {
      if (!synth.speaking) finish(true);
      else speakTimer = window.setTimeout(function () { finish(false); }, 12000);
    }, 9000);
  }

  function stopListening(silent) {
    listening = false;
    listenGen++;
    preview = '';
    var old = rec;
    rec = null;
    if (old) {
      old.onend = null;
      old.onerror = null;
      old.onresult = null;
      try { old.abort(); } catch (err) {}
    }
    if (!silent) renderStatus();
    else renderChrome();
  }

  function startListening() {
    if (!speechSupported || speechMode === 'denied') {
      openKeypad();
      return;
    }
    stopListening(true);
    listening = true;
    var gen = ++listenGen;
    var recognition = new SR();
    rec = recognition;
    recognition.lang = 'de-DE';
    recognition.interimResults = true;
    recognition.maxAlternatives = 5;
    recognition.continuous = true;
    var startedAt = Date.now();
    recognition.onstart = function () {
      speechMode = 'ready';
      renderStatus();
    };
    recognition.onresult = function (event) {
      if (gen !== listenGen) return;
      var interim = '';
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var result = event.results[i];
        if (result.isFinal) takeFinal(result);
        else if (result[0]) interim += result[0].transcript;
      }
      if (interim && listening && gen === listenGen) {
        preview = interim.trim().slice(0, 48);
        renderStatus();
      }
    };
    recognition.onerror = function (event) {
      if (gen !== listenGen) return;
      var code = event.error;
      if (code === 'aborted' || code === 'no-speech') return;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        speechMode = 'denied';
        listening = false;
        listenGen++;
        setFlash('Mikrofon blockiert. Nutze die Tastatur.', 'error');
        openKeypad();
        return;
      }
      if (code === 'network') {
        listening = false;
        listenGen++;
        setFlash('Spracheingabe braucht eine Internetverbindung.', 'error');
        renderChrome();
      }
    };
    recognition.onend = function () {
      if (!listening || gen !== listenGen || rec !== recognition) return;
      if (Date.now() - startedAt < 280) {
        quickEnds++;
        if (quickEnds >= 4) {
          listening = false;
          rec = null;
          setFlash('Mikrofon konnte nicht starten. Nutze die Tastatur.', 'error');
          renderChrome();
          return;
        }
      }
      window.setTimeout(function () {
        if (listening && gen === listenGen) startListening();
      }, 160);
    };
    try {
      recognition.start();
    } catch (err) {
      try {
        recognition.continuous = false;
        recognition.start();
      } catch (err2) {
        speechMode = 'unsupported';
        listening = false;
        rec = null;
        openKeypad();
        return;
      }
    }
    renderStatus();
  }

  function bestAlternative(result) {
    var fallback = result[0] ? String(result[0].transcript || '') : '';
    for (var i = 0; i < result.length; i++) {
      var text = String(result[i].transcript || '');
      var value = GermanNumbers.parse(text);
      if (value != null) return { text: text, value: value };
    }
    return { text: fallback, value: null };
  }

  function takeFinal(result) {
    var picked = bestAlternative(result);
    preview = '';
    if (!picked.text || !picked.text.trim()) return;
    if (picked.value == null) {
      setFlash('Nicht verstanden: „' + picked.text.trim().slice(0, 40) + '“', 'error');
      return;
    }
    var key = picked.text.trim() + '@' + state.round + ':' + state.team;
    var now = Date.now();
    if (key === lastCommit.key && now - lastCommit.at < 800) return;
    lastCommit = { key: key, at: now };
    commitValue(picked.value);
  }

  function openKeypad() {
    if (listening) stopListening(true);
    keypadOpen = true;
    var value = state.scores[state.round][state.team];
    entry = value == null ? '' : String(value);
    buffer = '';
    $('keypad').hidden = false;
    $('backdrop').hidden = false;
    renderKeypad();
    renderChrome();
    var ok = document.querySelector('#keypad [data-key="ok"]');
    if (ok) ok.focus();
  }

  function closeKeypad() {
    keypadOpen = false;
    $('keypad').hidden = true;
    if (!dialogOpen) $('backdrop').hidden = true;
    renderChrome();
    renderStatus();
  }

  function renderKeypad() {
    var where = $('keypad-where');
    where.textContent = whereText();
    where.className = 'where ' + (state.team === 0 ? 'a' : 'b');
    var valueEl = $('keypad-value');
    if (entry === '' || entry === '-') {
      valueEl.textContent = entry === '-' ? '−' : '–';
      valueEl.className = entry === '-' ? 'is-neg' : 'is-empty';
      return;
    }
    var n = Number(entry);
    valueEl.textContent = entry.charAt(0) === '-' && n === 0 ? '−0' : formatPoints(n);
    valueEl.className = n < 0 || entry.charAt(0) === '-' ? 'is-neg' : '';
  }

  function typeDigit(digit) {
    var neg = entry.charAt(0) === '-';
    var digits = neg ? entry.slice(1) : entry;
    if (digits.length >= 6) return;
    if (digits === '0') digits = '';
    digits += digit;
    entry = (neg ? '-' : '') + (digits === '' ? '0' : digits);
    renderKeypad();
  }

  function toggleSign() {
    entry = entry.charAt(0) === '-' ? entry.slice(1) : '-' + entry;
    renderKeypad();
  }

  function backspace() {
    entry = entry.slice(0, -1);
    renderKeypad();
  }

  function shakeKeypad() {
    var pad = $('keypad');
    pad.classList.remove('shake');
    void pad.offsetWidth;
    pad.classList.add('shake');
  }

  function acceptKeypad() {
    if (entry === '' || entry === '-' || entry === '-0') {
      if (entry === '-0') {
        closeKeypad();
        commitValue(0);
        return;
      }
      shakeKeypad();
      return;
    }
    var n = Number(entry);
    if (!Number.isInteger(n)) {
      shakeKeypad();
      return;
    }
    closeKeypad();
    commitValue(n);
  }

  function clearCell() {
    state.scores[state.round][state.team] = null;
    save();
    maybeAnnounceTen(false);
    closeKeypad();
    setFlash('Feld geleert');
    renderAll();
  }

  function openDialog() {
    if (listening) stopListening(true);
    if (keypadOpen) closeKeypad();
    dialogOpen = true;
    $('dialog').hidden = false;
    $('backdrop').hidden = false;
    renderChrome();
    $('cancel-reset').focus();
  }

  function closeDialog() {
    dialogOpen = false;
    $('dialog').hidden = true;
    if (!keypadOpen) $('backdrop').hidden = true;
    renderChrome();
  }

  function confirmReset() {
    var players = state.players.map(function (pair) { return pair.slice(); });
    var theme = state.theme;
    stopListening(true);
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (err) {}
    }
    resumeAfterSpeak = false;
    state = defaultState();
    state.players = players;
    state.theme = theme;
    announcedTen = false;
    buffer = '';
    entry = '';
    preview = '';
    sheetSig = '';
    lastActive = '';
    prevTotals = [null, null];
    save();
    closeDialog();
    renderAll();
    setFlash('Neues Spiel');
  }

  function move(key) {
    if (key === 'ArrowRight') state.team = 1;
    if (key === 'ArrowLeft') state.team = 0;
    if (key === 'ArrowDown') state.round = Math.min(10, state.round + 1);
    if (key === 'ArrowUp') state.round = Math.max(0, state.round - 1);
    buffer = '';
    keyboardNav = true;
    save();
    renderAll();
  }

  function bindNames() {
    for (var team = 0; team < 2; team++) {
      for (var index = 0; index < 2; index++) {
        (function (team, index) {
          var input = playerInput(team, index);
          input.value = state.players[team][index];
          input.addEventListener('input', function () {
            state.players[team][index] = input.value.slice(0, 30);
            save();
            renderBoard();
            sheetSig = '';
            renderSheet();
            renderStatus();
          });
          input.addEventListener('blur', function () {
            state.players[team][index] = cleanName(input.value, DEFAULT_PLAYERS[team][index]);
            input.value = state.players[team][index];
            save();
            sheetSig = '';
            renderAll();
          });
          input.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
              event.preventDefault();
              input.blur();
            }
          });
        })(team, index);
      }
    }
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      if (keypadOpen) { closeKeypad(); return; }
      if (dialogOpen) { closeDialog(); return; }
      if (listening) { stopListening(); return; }
      if (buffer) { buffer = ''; renderStatus(); return; }
    }
    if (dialogOpen) return;
    if (keypadOpen) {
      if (/^[0-9]$/.test(event.key)) { typeDigit(event.key); event.preventDefault(); return; }
      if (event.key === '-' || event.key === '+') { toggleSign(); event.preventDefault(); return; }
      if (event.key === 'Backspace') { backspace(); event.preventDefault(); return; }
      if (event.key === 'Enter') { acceptKeypad(); event.preventDefault(); return; }
      return;
    }
    if (event.target && event.target.closest && event.target.closest('input, textarea')) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (/^[0-9]$/.test(event.key)) {
      buffer = (buffer + event.key).slice(0, 8);
      keyboardNav = true;
      renderStatus();
      event.preventDefault();
      return;
    }
    if (event.key === '-') {
      buffer = buffer.charAt(0) === '-' ? buffer.slice(1) : '-' + buffer;
      renderStatus();
      event.preventDefault();
      return;
    }
    if (event.key === 'Backspace') {
      buffer = buffer.slice(0, -1);
      renderStatus();
      event.preventDefault();
      return;
    }
    if (event.key === 'Enter') {
      if (buffer) {
        var parsed = GermanNumbers.parse(buffer);
        buffer = '';
        if (parsed == null) setFlash('Nicht verstanden', 'error');
        else commitValue(parsed);
      } else {
        openKeypad();
      }
      event.preventDefault();
      return;
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      move(event.key);
      event.preventDefault();
    }
  }

  $('mic').addEventListener('click', function () {
    if (speechMode !== 'ready') {
      openKeypad();
      return;
    }
    if (listening) stopListening();
    else {
      quickEnds = 0;
      startListening();
    }
  });

  $('speak').addEventListener('click', function () {
    speak(standText(), listening);
  });

  $('theme').addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    state.theme = next;
    applyTheme(next);
    save();
    syncHeights();
  });

  $('keypad-open').addEventListener('click', openKeypad);
  $('new-game').addEventListener('click', openDialog);
  $('cancel-reset').addEventListener('click', closeDialog);
  $('confirm-reset').addEventListener('click', confirmReset);
  $('backdrop').addEventListener('click', function () {
    if (dialogOpen) closeDialog();
    else if (keypadOpen) closeKeypad();
  });

  $('keypad').addEventListener('click', function (event) {
    var key = event.target.closest('[data-key]');
    if (!key) return;
    var which = key.getAttribute('data-key');
    if (which === 'ok') acceptKeypad();
    else if (which === 'clear') clearCell();
    else if (which === 'sign') toggleSign();
    else if (which === 'back') backspace();
    else if (which === 'close') closeKeypad();
    else typeDigit(which);
  });

  $('sheet').addEventListener('click', function (event) {
    var button = event.target.closest('[data-round]');
    if (!button) return;
    var round = Number(button.getAttribute('data-round'));
    if (!button.hasAttribute('data-team')) {
      state.round = round;
      buffer = '';
      save();
      renderAll();
      return;
    }
    var team = Number(button.getAttribute('data-team'));
    if (state.round === round && state.team === team) {
      openKeypad();
      return;
    }
    state.round = round;
    state.team = team;
    buffer = '';
    save();
    renderAll();
  });

  document.addEventListener('keydown', onKeydown);
  document.addEventListener('pointerdown', function () { keyboardNav = false; }, true);
  window.addEventListener('resize', syncHeights);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
    if (!state.theme) applyTheme(null);
  });
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = function () { cachedVoice = undefined; };
  }

  bindNames();
  applyTheme(state.theme);
  renderAll();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }
})();

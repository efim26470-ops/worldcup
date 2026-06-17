(() => {
  'use strict';

  const CONFIG = window.WC26_CONFIG;
  const DEMO = window.WC26_DEMO_DATA;
  if (!CONFIG) throw new Error('WC26_CONFIG is missing');

  const ROUTES = [
    ['today', 'Сегодня', 'home'],
    ['schedule', 'Матчи', 'calendar'],
    ['standings', 'Таблицы', 'table'],
    ['players', 'Игроки', 'players'],
    ['favorites', 'Избранное', 'star']
  ];

  const THEME_ORDER = ['system', 'dark', 'light'];
  const THEME_LABELS = { system: 'Системная', dark: 'Тёмная', light: 'Светлая' };
  const STAT_LABELS = {
    possession: 'Владение мячом', shots: 'Удары', shotsOnTarget: 'Удары в створ',
    corners: 'Угловые', fouls: 'Фолы', passes: 'Передачи'
  };

  const state = {
    route: routeFromHash(),
    snapshot: null,
    loading: true,
    refreshing: false,
    error: '',
    sourceMode: 'loading',
    selectedDate: null,
    favorites: loadSet(CONFIG.favoritesStorageKey),
    theme: localStorage.getItem(CONFIG.themeStorageKey) || 'system',
    modalMatch: null,
    modalTab: 'overview',
    modalLoading: false,
    refreshTimer: null,
    deferredInstall: null
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function safeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function nullableNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function routeFromHash() {
    const route = location.hash.replace(/^#/, '');
    return ROUTES.some(item => item[0] === route) ? route : 'today';
  }

  function loadSet(key) {
    try { return new Set(JSON.parse(localStorage.getItem(key) || '[]').map(String)); }
    catch { return new Set(); }
  }

  function saveFavorites() {
    localStorage.setItem(CONFIG.favoritesStorageKey, JSON.stringify([...state.favorites]));
  }

  function icon(name, className = 'icon') {
    const paths = {
      home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V21h13V10.5"/><path d="M9.5 21v-6h5v6"/>',
      calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
      table: '<path d="M4 5h16M4 12h16M4 19h16M8 5v14M16 5v14"/>',
      players: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
      star: '<path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.7l6.2-.9L12 3Z"/>',
      refresh: '<path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6.1 8A7 7 0 0 1 18.5 6L20 7M4 17l1.5 1A7 7 0 0 0 17.9 16"/>',
      close: '<path d="M6 6l12 12M18 6 6 18"/>',
      install: '<path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 18v3h14v-3"/>',
      system: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
      dark: '<path d="M20.5 14.2A8 8 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"/>',
      light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
      wifi: '<path d="M5 12.6a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01"/>',
      heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>'
    };
    return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.home}</svg>`;
  }

  function formatDateTime(iso, options) {
    try { return new Intl.DateTimeFormat('ru-RU', options).format(new Date(iso)); }
    catch { return '—'; }
  }

  function formatDayKey(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'unknown';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDayTitle(dayKey) {
    return formatDateTime(`${dayKey}T12:00:00`, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function formatShortDay(dayKey) {
    return formatDateTime(`${dayKey}T12:00:00`, { day: 'numeric', month: 'short' });
  }

  function formatTime(iso) {
    return formatDateTime(iso, { hour: '2-digit', minute: '2-digit' });
  }

  function normalizeStatus(value) {
    const status = String(value || '').toLowerCase();
    if (['live', '1h', '2h', 'ht', 'et', 'p', 'int', 'susp'].includes(status)) return 'live';
    if (['finished', 'ft', 'aet', 'pen', 'complete', 'completed'].includes(status)) return 'finished';
    if (['postponed', 'pst', 'canc', 'cancelled', 'abd'].includes(status)) return 'postponed';
    return 'upcoming';
  }

  function normalizeTeam(team = {}, alternateScore = null) {
    const name = team.name || team.displayName || 'Будет определено';
    return {
      id: String(team.id || name),
      name,
      short: team.short || team.code || team.abbreviation || name.slice(0, 3).toUpperCase(),
      countryCode: String(team.countryCode || team.flagCode || '').toLowerCase(),
      logo: team.logo || team.badge || '',
      score: nullableNumber(team.score ?? alternateScore)
    };
  }

  function normalizeMatch(match = {}) {
    const score = match.score || match.goals || {};
    const home = normalizeTeam(match.home || match.teams?.home || {}, score.home ?? match.homeScore);
    const away = normalizeTeam(match.away || match.teams?.away || {}, score.away ?? match.awayScore);
    return {
      id: String(match.id || match.fixtureId || match.fixture?.id || cryptoRandomId()),
      startingAt: match.startingAt || match.date || match.kickoff || match.fixture?.date || new Date().toISOString(),
      status: normalizeStatus(match.status || match.fixture?.status?.short),
      minute: safeNumber(match.minute ?? match.fixture?.status?.elapsed, 0),
      stage: match.stage || match.group || match.round || match.league?.round || 'Чемпионат мира 2026',
      venue: match.venue?.name || match.venue || match.fixture?.venue?.name || '',
      city: match.city || match.fixture?.venue?.city || '',
      home, away,
      events: Array.isArray(match.events) ? match.events : [],
      stats: match.stats && typeof match.stats === 'object' ? match.stats : {},
      h2h: match.h2h && typeof match.h2h === 'object' ? match.h2h : { homeWins: 0, draws: 0, awayWins: 0 },
      lineups: match.lineups && typeof match.lineups === 'object' ? match.lineups : { home: [], away: [] }
    };
  }

  function normalizeStandingTeam(row = {}) {
    const team = row.team || row;
    return {
      pos: safeNumber(row.pos ?? row.rank, 0),
      id: String(team.id || row.id || team.name || ''),
      name: row.name || team.name || 'Команда',
      short: row.short || team.short || team.code || '',
      countryCode: String(row.countryCode || team.countryCode || '').toLowerCase(),
      logo: row.logo || team.logo || '',
      played: safeNumber(row.played ?? row.all?.played, 0),
      won: safeNumber(row.won ?? row.win ?? row.all?.win, 0),
      drawn: safeNumber(row.drawn ?? row.draw ?? row.all?.draw, 0),
      lost: safeNumber(row.lost ?? row.lose ?? row.all?.lose, 0),
      gf: safeNumber(row.gf ?? row.all?.goals?.for, 0),
      ga: safeNumber(row.ga ?? row.all?.goals?.against, 0),
      gd: safeNumber(row.gd ?? row.goalsDiff, 0),
      points: safeNumber(row.points, 0),
      form: Array.isArray(row.form) ? row.form : String(row.form || '').split('').filter(item => /[WDL]/.test(item))
    };
  }

  function normalizePlayer(player = {}, type = 'value') {
    const statistics = player.statistics?.[0] || {};
    const rawValue = player.value ?? player.total ?? player.goals ?? player.rating ??
      (type === 'assists' ? statistics.goals?.assists : statistics.goals?.total) ?? 0;
    return {
      id: String(player.id || player.player?.id || player.name || ''),
      name: player.name || player.player?.name || 'Игрок',
      team: player.team || statistics.team?.name || 'Сборная',
      countryCode: String(player.countryCode || player.flagCode || '').toLowerCase(),
      photo: player.photo || player.player?.photo || '',
      value: type === 'ratings' ? Number(rawValue || 0).toFixed(2) : safeNumber(rawValue, 0),
      label: player.label || (type === 'assists' ? 'ассистов' : type === 'ratings' ? 'рейтинг' : 'голов')
    };
  }

  function normalizeSnapshot(raw = {}) {
    const matches = (raw.matches || raw.fixtures || []).map(normalizeMatch).sort((a, b) => new Date(a.startingAt) - new Date(b.startingAt));
    const standings = (raw.standings || []).map((group, index) => ({
      group: String(group.group || group.name || String.fromCharCode(65 + index)).replace(/^Group\s*/i, ''),
      teams: (group.teams || group.rows || []).map(normalizeStandingTeam)
    }));
    const leaders = raw.leaders || {};
    return {
      source: raw.source || 'live',
      provider: raw.provider || 'API-Football',
      freshness: raw.freshness || '',
      notice: raw.notice || '',
      lastUpdated: raw.lastUpdated || new Date().toISOString(),
      matches,
      standings,
      leaders: {
        scorers: (leaders.scorers || leaders.goals || []).map(item => normalizePlayer(item, 'scorers')),
        assists: (leaders.assists || []).map(item => normalizePlayer(item, 'assists')),
        ratings: (leaders.ratings || []).map(item => normalizePlayer(item, 'ratings'))
      }
    };
  }

  function cryptoRandomId() {
    return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function mediaProxy(url) {
    if (!url) return '';
    if (url.startsWith(CONFIG.apiBase)) return url;
    return `${CONFIG.apiBase}/api/image?url=${encodeURIComponent(url)}`;
  }

  function localFlagUrl(code) {
    const clean = String(code || '').toLowerCase().replace(/[^a-z-]/g, '');
    return clean ? `./assets/flags/${clean}.svg` : '';
  }

  function flagMarkup(team, small = false) {
    const code = String(team?.countryCode || '').toLowerCase();
    const local = localFlagUrl(code);
    const remote = team?.logo ? mediaProxy(team.logo) : '';
    const initials = escapeHtml(team?.short || team?.name?.slice(0, 3) || 'WC');
    const className = small ? 'mini-flag' : '';
    if (small) {
      if (local) return `<img class="${className}" src="${escapeHtml(local)}" alt="" loading="lazy" onerror="this.onerror=null;${remote ? `this.src='${escapeHtml(remote)}'` : 'this.hidden=true'}">`;
      if (remote) return `<img class="${className}" src="${escapeHtml(remote)}" alt="" loading="lazy" onerror="this.hidden=true">`;
      return '';
    }
    const source = local || remote;
    return `<span class="flag-frame">${source ? `<img src="${escapeHtml(source)}" alt="Флаг ${escapeHtml(team?.name || '')}" loading="lazy" onerror="this.onerror=null;${local && remote ? `this.src='${escapeHtml(remote)}'` : 'this.hidden=true'}">` : ''}<span class="flag-fallback">${initials}</span></span>`;
  }

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2).map(word => word[0] || '').join('').toUpperCase();
  }

  function avatarMarkup(player, compact = false) {
    const photo = player?.photo ? mediaProxy(player.photo) : '';
    return `<span class="player-avatar${compact ? ' compact' : ''}"><span>${escapeHtml(initials(player?.name))}</span>${photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(player?.name || 'Игрок')}" loading="lazy" onerror="this.hidden=true">` : ''}</span>`;
  }

  function scoreText(match) {
    const home = match.home.score;
    const away = match.away.score;
    if (home === null || away === null) return '—';
    return `${home} : ${away}`;
  }

  function statusMarkup(match) {
    if (match.status === 'live') return `<span class="live-badge"><span class="status-dot ok"></span>${match.minute ? `${match.minute}′` : 'LIVE'}</span>`;
    if (match.status === 'finished') return '<span class="status-badge">Завершён</span>';
    if (match.status === 'postponed') return '<span class="status-badge">Перенесён</span>';
    return escapeHtml(formatTime(match.startingAt));
  }

  function navMarkup() {
    return ROUTES.map(([id, label, iconName]) => `
      <button class="nav-button${state.route === id ? ' active' : ''}" data-route="${id}" type="button">
        ${icon(iconName)}<span>${escapeHtml(label)}</span>
      </button>`).join('');
  }

  function applyTheme() {
    let resolved = state.theme;
    if (resolved === 'system') resolved = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.dataset.theme = resolved;
    $('#themeLabel').textContent = THEME_LABELS[state.theme];
    $('#themeIcon').innerHTML = icon(state.theme, 'icon');
  }

  function updateClock() {
    $('#currentClock').textContent = formatDateTime(new Date().toISOString(), {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  function setRoute(route) {
    if (!ROUTES.some(item => item[0] === route)) return;
    state.route = route;
    location.hash = route;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderNavigation() {
    $('#desktopNav').innerHTML = navMarkup();
    $('#mobileNav').innerHTML = navMarkup();
    $$('[data-route]').forEach(button => button.addEventListener('click', () => setRoute(button.dataset.route)));
  }

  function renderConnection() {
    const dot = $('#connectionDot');
    const mini = $('#connectionMiniText');
    const banner = $('#connectionBanner');
    dot.className = 'status-dot';
    banner.className = 'connection-banner';

    if (state.loading) {
      mini.textContent = 'Подключение…';
      banner.innerHTML = `<span class="loader" style="width:17px;height:17px;border-width:2px"></span><span>Подключение к live-API…</span>`;
      return;
    }

    const snapshot = state.snapshot;
    if (state.sourceMode === 'live') {
      dot.classList.add('ok');
      mini.textContent = 'Live-API подключён';
      banner.classList.add(snapshot?.notice ? 'warning' : 'ok');
      banner.innerHTML = `${icon('wifi')}<span><strong>Live-режим работает.</strong> ${escapeHtml(snapshot?.provider || '')}${snapshot?.freshness ? ` · ${escapeHtml(snapshot.freshness)}` : ''}${snapshot?.notice ? `<br><span class="muted">${escapeHtml(snapshot.notice)}</span>` : ''}</span>`;
      return;
    }

    if (state.sourceMode === 'cache') {
      dot.classList.add('error');
      mini.textContent = 'Показан сохранённый кэш';
      banner.classList.add('warning');
      banner.innerHTML = `${icon('wifi')}<span><strong>Live-API сейчас не отвечает.</strong> Показаны последние сохранённые данные. ${escapeHtml(state.error)}</span>`;
      return;
    }

    dot.classList.add('error');
    mini.textContent = 'Демо-режим';
    banner.classList.add('error');
    banner.innerHTML = `${icon('wifi')}<span><strong>Live-API недоступен.</strong> Включён локальный резерв. ${escapeHtml(state.error)}</span>`;
  }

  function renderSummary() {
    const matches = state.snapshot?.matches || [];
    const live = matches.filter(match => match.status === 'live').length;
    const finished = matches.filter(match => match.status === 'finished').length;
    const todayKey = formatDayKey(new Date().toISOString());
    const today = matches.filter(match => formatDayKey(match.startingAt) === todayKey).length;
    const teams = new Set(matches.flatMap(match => [match.home.name, match.away.name]).filter(Boolean)).size;
    const cards = [
      [matches.length, 'Матчей в базе'], [today, 'Матчей сегодня'], [live, 'Сейчас live'], [teams || 48, 'Сборных']
    ];
    $('#summaryCards').innerHTML = cards.map(([value, label]) => `<div class="summary-card glass"><strong>${value}</strong><span>${label}</span></div>`).join('');
  }

  function matchCard(match, options = {}) {
    const favorite = state.favorites.has(String(match.id));
    return `<div class="match-wrap">
      <button class="match-card" type="button" data-open-match="${escapeHtml(match.id)}">
        <span class="team-block">${flagMarkup(match.home)}<span class="team-text"><span class="team-name">${escapeHtml(match.home.name)}</span><span class="team-code">${escapeHtml(match.home.short)}</span></span></span>
        <span class="match-center"><span class="match-score">${escapeHtml(scoreText(match))}</span><span class="match-meta">${statusMarkup(match)} · ${escapeHtml(match.stage || '')}</span></span>
        <span class="team-block away"><span class="team-text"><span class="team-name">${escapeHtml(match.away.name)}</span><span class="team-code">${escapeHtml(match.away.short)}</span></span>${flagMarkup(match.away)}</span>
      </button>
      ${options.hideFavorite ? '' : `<button type="button" class="favorite-button${favorite ? ' active' : ''}" data-favorite="${escapeHtml(match.id)}" aria-label="${favorite ? 'Удалить из избранного' : 'Добавить в избранное'}">${icon('star', 'icon')}</button>`}
    </div>`;
  }

  function matchList(matches, options = {}) {
    if (!matches.length) return '<div class="empty">Матчей здесь пока нет.</div>';
    return `<div class="match-list">${matches.map(match => matchCard(match, options)).join('')}</div>`;
  }

  function nearestMatchDate(matches) {
    if (!matches.length) return null;
    const today = formatDayKey(new Date().toISOString());
    if (matches.some(match => formatDayKey(match.startingAt) === today)) return today;
    const now = Date.now();
    const future = matches.find(match => new Date(match.startingAt).getTime() >= now);
    return formatDayKey((future || matches[matches.length - 1]).startingAt);
  }

  function renderToday() {
    const matches = state.snapshot.matches;
    const today = formatDayKey(new Date().toISOString());
    let selected = matches.filter(match => formatDayKey(match.startingAt) === today);
    let title = 'Сегодня';

    if (!selected.length) {
      const live = matches.filter(match => match.status === 'live');
      if (live.length) {
        selected = live;
        title = 'Сейчас в эфире';
      } else {
        const nearestKey = nearestMatchDate(matches);
        selected = matches.filter(match => formatDayKey(match.startingAt) === nearestKey);
        title = nearestKey ? `Ближайший игровой день · ${formatShortDay(nearestKey)}` : 'Ближайшие матчи';
      }
    }

    $('#mainPanel').innerHTML = `<div class="panel-header"><div><h2>${escapeHtml(title)}</h2><div class="panel-subtitle">Время показано в часовом поясе устройства</div></div></div>${matchList(selected)}`;
  }

  function renderSchedule() {
    const matches = state.snapshot.matches;
    const grouped = new Map();
    for (const match of matches) {
      const key = formatDayKey(match.startingAt);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(match);
    }
    const keys = [...grouped.keys()].sort();
    if (!state.selectedDate || !grouped.has(state.selectedDate)) state.selectedDate = nearestMatchDate(matches) || keys[0] || null;
    const active = state.selectedDate ? grouped.get(state.selectedDate) || [] : [];
    $('#mainPanel').innerHTML = `
      <div class="panel-header"><div><h2>Расписание</h2><div class="panel-subtitle">Все матчи ЧМ‑2026</div></div></div>
      <div class="chip-row">${keys.map(key => `<button class="chip${key === state.selectedDate ? ' active' : ''}" type="button" data-date="${key}">${escapeHtml(formatShortDay(key))}</button>`).join('')}</div>
      <h3 class="section-heading">${state.selectedDate ? escapeHtml(formatDayTitle(state.selectedDate)) : 'Нет данных'}</h3>
      ${matchList(active)}
    `;
    $$('[data-date]', $('#mainPanel')).forEach(button => button.addEventListener('click', () => { state.selectedDate = button.dataset.date; renderMainPanel(); bindDynamicEvents(); }));
  }

  function formMarkup(form) {
    if (!form?.length) return '<span class="muted">—</span>';
    return `<span class="form">${form.slice(-5).map(result => `<span class="${escapeHtml(result)}">${escapeHtml(result)}</span>`).join('')}</span>`;
  }

  function renderStandings() {
    const groups = state.snapshot.standings;
    if (!groups.length) {
      $('#mainPanel').innerHTML = '<div class="panel-header"><h2>Таблицы групп</h2></div><div class="empty">Поставщик данных пока не вернул таблицы. Они появятся после обновления турнира.</div>';
      return;
    }
    $('#mainPanel').innerHTML = `<div class="panel-header"><div><h2>Таблицы групп</h2><div class="panel-subtitle">Положение команд обновляется через live-API</div></div></div>` + groups.map(group => `
      <h3 class="section-heading">Группа ${escapeHtml(group.group)}</h3>
      <div class="table-scroll"><table class="standings-table"><thead><tr><th>#</th><th>Команда</th><th>И</th><th>В</th><th>Н</th><th>П</th><th>М</th><th>РМ</th><th>О</th><th>Форма</th></tr></thead><tbody>
        ${group.teams.map(team => `<tr><td class="position">${team.pos || ''}</td><td><span class="table-team">${flagMarkup(team)}<strong>${escapeHtml(team.name)}</strong></span></td><td>${team.played}</td><td>${team.won}</td><td>${team.drawn}</td><td>${team.lost}</td><td>${team.gf}:${team.ga}</td><td>${team.gd > 0 ? '+' : ''}${team.gd}</td><td><strong>${team.points}</strong></td><td>${formMarkup(team.form)}</td></tr>`).join('')}
      </tbody></table></div>`).join('');
  }

  function playerRows(players, valueLabel) {
    if (!players.length) return '<div class="empty">Статистика появится после публикации данных поставщиком.</div>';
    return `<div class="leader-list">${players.map(player => `<div class="player-row">${avatarMarkup(player)}<div><div class="player-name">${escapeHtml(player.name)}</div><div class="player-team">${flagMarkup({ countryCode: player.countryCode, name: player.team, short: '' }, true)}<span>${escapeHtml(player.team)}</span></div></div><div class="player-value">${escapeHtml(player.value)}<small>${escapeHtml(player.label || valueLabel)}</small></div></div>`).join('')}</div>`;
  }

  function renderPlayers() {
    const leaders = state.snapshot.leaders;
    $('#mainPanel').innerHTML = `
      <div class="panel-header"><div><h2>Статистика игроков</h2><div class="panel-subtitle">Фотографии, голы, ассисты и средние оценки</div></div></div>
      <h3 class="section-heading">Бомбардиры</h3>${playerRows(leaders.scorers.slice(0, 20), 'голов')}
      <h3 class="section-heading">Ассистенты</h3>${playerRows(leaders.assists.slice(0, 20), 'ассистов')}
      <h3 class="section-heading">Лучшие оценки</h3>${playerRows(leaders.ratings.slice(0, 20), 'рейтинг')}
    `;
  }

  function renderFavorites() {
    const matches = state.snapshot.matches.filter(match => state.favorites.has(String(match.id)));
    $('#mainPanel').innerHTML = `<div class="panel-header"><div><h2>Избранные матчи</h2><div class="panel-subtitle">Хранятся только на этом устройстве</div></div></div>${matchList(matches)}`;
  }

  function renderMainPanel() {
    if (state.loading && !state.snapshot) {
      $('#mainPanel').innerHTML = '<div class="state-box"><div><span class="loader"></span><p>Получаю расписание и статистику…</p></div></div>';
      return;
    }
    if (!state.snapshot) {
      $('#mainPanel').innerHTML = '<div class="state-box">Данные недоступны.</div>';
      return;
    }
    if (state.route === 'schedule') renderSchedule();
    else if (state.route === 'standings') renderStandings();
    else if (state.route === 'players') renderPlayers();
    else if (state.route === 'favorites') renderFavorites();
    else renderToday();
  }

  function renderSidePanel() {
    if (!state.snapshot) {
      $('#sidePanel').innerHTML = '<div class="state-box">Загрузка…</div>';
      return;
    }
    const now = Date.now();
    const matches = state.snapshot.matches;
    const nearest = matches.filter(match => match.status === 'live' || new Date(match.startingAt).getTime() >= now).slice(0, 4);
    const players = state.snapshot.leaders.scorers.slice(0, 5);
    $('#sidePanel').innerHTML = `
      <div class="panel-header"><div><h2>Ближайшее</h2><div class="panel-subtitle">По времени устройства</div></div></div>
      ${matchList(nearest, { hideFavorite: true })}
      <hr class="divider">
      <div class="panel-header"><div><h2>Топ игроков</h2><div class="panel-subtitle">Голы на турнире</div></div></div>
      ${playerRows(players, 'голов')}
    `;
  }

  function bindDynamicEvents() {
    $$('[data-open-match]').forEach(button => button.addEventListener('click', () => openMatch(button.dataset.openMatch)));
    $$('[data-favorite]').forEach(button => button.addEventListener('click', event => {
      event.stopPropagation();
      const id = String(button.dataset.favorite);
      if (state.favorites.has(id)) state.favorites.delete(id); else state.favorites.add(id);
      saveFavorites();
      renderMainPanel();
      renderSidePanel();
      bindDynamicEvents();
    }));
  }

  function render() {
    applyTheme();
    renderNavigation();
    renderConnection();
    renderSummary();
    renderMainPanel();
    renderSidePanel();
    bindDynamicEvents();
    $('#buildLabel').textContent = `Сборка ${CONFIG.build}`;
  }

  async function fetchJson(url, timeout = CONFIG.requestTimeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { mode: 'cors', cache: 'no-store', headers: { Accept: 'application/json' }, signal: controller.signal });
      const text = await response.text();
      let payload;
      try { payload = text ? JSON.parse(text) : {}; }
      catch { payload = { detail: text.slice(0, 260) }; }
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${payload.detail || payload.error || 'ошибка сервера'}`);
      return payload;
    } finally {
      clearTimeout(timer);
    }
  }

  function loadCachedSnapshot() {
    try {
      const value = localStorage.getItem(CONFIG.cacheStorageKey);
      if (!value) return null;
      return normalizeSnapshot(JSON.parse(value));
    } catch { return null; }
  }

  function saveSnapshot(snapshot) {
    try { localStorage.setItem(CONFIG.cacheStorageKey, JSON.stringify(snapshot)); }
    catch { /* storage can be unavailable in private mode */ }
  }

  async function loadSnapshot({ manual = false } = {}) {
    if (state.refreshing) return;
    state.refreshing = true;
    if (!state.snapshot) state.loading = true;
    state.error = '';
    $('#refreshButton').classList.add('loading');
    renderConnection();

    try {
      const raw = await fetchJson(`${CONFIG.apiBase}/api/snapshot?build=${encodeURIComponent(CONFIG.build)}`);
      const snapshot = normalizeSnapshot(raw);
      if (!snapshot.matches.length) throw new Error('Сервер вернул пустое расписание');
      state.snapshot = snapshot;
      state.sourceMode = 'live';
      state.error = '';
      saveSnapshot(snapshot);
      if (manual) showToast('Live-данные обновлены');
    } catch (error) {
      const message = error.name === 'AbortError' ? 'Сервер не ответил за отведённое время.' : error.message || 'Failed to fetch';
      state.error = message;
      const cached = loadCachedSnapshot();
      if (cached?.matches?.length) {
        state.snapshot = cached;
        state.sourceMode = 'cache';
      } else {
        state.snapshot = normalizeSnapshot(DEMO);
        state.sourceMode = 'demo';
      }
      if (manual) showToast(`Не удалось обновить: ${message}`);
    } finally {
      state.loading = false;
      state.refreshing = false;
      $('#refreshButton').classList.remove('loading');
      render();
      scheduleRefresh();
    }
  }

  function scheduleRefresh() {
    clearTimeout(state.refreshTimer);
    const hasLive = state.snapshot?.matches.some(match => match.status === 'live');
    state.refreshTimer = setTimeout(() => loadSnapshot(), hasLive ? CONFIG.snapshotRefreshLiveMs : CONFIG.snapshotRefreshIdleMs);
  }

  function renderModalScoreboard(match) {
    return `<div class="modal-scoreboard">
      <div class="modal-team">${flagMarkup(match.home)}<strong>${escapeHtml(match.home.name)}</strong><span class="muted">${escapeHtml(match.home.short)}</span></div>
      <div class="modal-score"><strong>${escapeHtml(scoreText(match))}</strong><div class="match-meta">${statusMarkup(match)}</div></div>
      <div class="modal-team away">${flagMarkup(match.away)}<strong>${escapeHtml(match.away.name)}</strong><span class="muted">${escapeHtml(match.away.short)}</span></div>
    </div>`;
  }

  function renderModalOverview(match) {
    return `<div class="detail-grid">
      <div class="detail-card"><h3>Информация</h3><p><strong>Стадия:</strong> ${escapeHtml(match.stage || '—')}</p><p><strong>Начало:</strong> ${escapeHtml(formatDateTime(match.startingAt, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))}</p><p><strong>Стадион:</strong> ${escapeHtml([match.venue, match.city].filter(Boolean).join(', ') || 'Уточняется')}</p></div>
      <div class="detail-card"><h3>Личные встречи</h3>${renderH2H(match)}</div>
    </div>`;
  }

  function renderH2H(match) {
    const h2h = match.h2h || {};
    return `<div class="h2h-grid"><div class="h2h-item"><strong>${safeNumber(h2h.homeWins)}</strong><span class="muted">Победы ${escapeHtml(match.home.short)}</span></div><div class="h2h-item"><strong>${safeNumber(h2h.draws)}</strong><span class="muted">Ничьи</span></div><div class="h2h-item"><strong>${safeNumber(h2h.awayWins)}</strong><span class="muted">Победы ${escapeHtml(match.away.short)}</span></div></div>`;
  }

  function renderEvents(match) {
    const events = match.events || [];
    if (!events.length) return '<div class="empty">События появятся после начала матча.</div>';
    return `<div class="event-list">${events.map(event => `<div class="event-row"><span class="event-minute">${escapeHtml(event.minute ?? event.time ?? '')}′</span><span class="event-icon">${escapeHtml(event.icon || '•')}</span><span>${escapeHtml(event.text || event.type || '')}</span></div>`).join('')}</div>`;
  }

  function renderStats(match) {
    const stats = match.stats || {};
    const rows = Object.entries(STAT_LABELS).map(([key, label]) => {
      const pair = Array.isArray(stats[key]) ? stats[key] : [0, 0];
      const home = safeNumber(pair[0]);
      const away = safeNumber(pair[1]);
      const total = Math.max(home + away, 1);
      const homeWidth = Math.max(2, (home / total) * 100);
      const awayWidth = Math.max(2, (away / total) * 100);
      const suffix = key === 'possession' ? '%' : '';
      return `<div class="stat-line"><div class="stat-labels"><strong>${home}${suffix}</strong><span>${escapeHtml(label)}</span><strong>${away}${suffix}</strong></div><div class="dual-bar"><span class="home" style="width:${homeWidth}%"></span><span class="away" style="width:${awayWidth}%"></span></div></div>`;
    });
    if (!Object.keys(stats).length) return '<div class="empty">Статистика появится во время матча.</div>';
    return `<div class="stat-bars">${rows.join('')}</div>`;
  }

  function lineupPlayerMarkup(player) {
    return `<div class="lineup-player">${avatarMarkup(player, true)}<div><div class="player-name">${player.number ? `${escapeHtml(player.number)} · ` : ''}${escapeHtml(player.name)}</div><div class="player-team">${escapeHtml(player.pos || (player.starter ? 'Старт' : 'Запас'))}</div></div>${player.rating ? `<span class="rating-badge">${escapeHtml(player.rating)}</span>` : ''}</div>`;
  }

  function renderLineups(match) {
    const home = match.lineups?.home || [];
    const away = match.lineups?.away || [];
    if (!home.length && !away.length) return '<div class="empty">Составы и оценки игроков появятся ближе к началу матча.</div>';
    return `<div class="lineup-columns"><div class="detail-card"><h3>${escapeHtml(match.home.name)}</h3><div class="lineup-list">${home.map(lineupPlayerMarkup).join('')}</div></div><div class="detail-card"><h3>${escapeHtml(match.away.name)}</h3><div class="lineup-list">${away.map(lineupPlayerMarkup).join('')}</div></div></div>`;
  }

  function renderModal() {
    const modal = $('#matchModal');
    const match = state.modalMatch;
    if (!match) return;
    $('#modalTitle').textContent = `${match.home.name} — ${match.away.name}`;
    const tabs = [
      ['overview', 'Обзор'], ['events', 'События'], ['stats', 'Статистика'], ['lineups', 'Составы'], ['h2h', 'Личные встречи']
    ];
    let body = '';
    if (state.modalLoading) body = '<div class="state-box"><div><span class="loader"></span><p>Загружаю подробности матча…</p></div></div>';
    else if (state.modalTab === 'events') body = renderEvents(match);
    else if (state.modalTab === 'stats') body = renderStats(match);
    else if (state.modalTab === 'lineups') body = renderLineups(match);
    else if (state.modalTab === 'h2h') body = renderH2H(match);
    else body = renderModalOverview(match);

    $('#modalContent').innerHTML = `${renderModalScoreboard(match)}<div class="modal-tabs">${tabs.map(([id, label]) => `<button class="modal-tab${state.modalTab === id ? ' active' : ''}" type="button" data-modal-tab="${id}">${label}</button>`).join('')}</div>${body}`;
    $$('[data-modal-tab]').forEach(button => button.addEventListener('click', () => { state.modalTab = button.dataset.modalTab; renderModal(); }));
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  async function openMatch(id) {
    const base = state.snapshot.matches.find(match => String(match.id) === String(id));
    if (!base) return;
    state.modalMatch = base;
    state.modalTab = 'overview';
    state.modalLoading = true;
    renderModal();
    try {
      const payload = await fetchJson(`${CONFIG.apiBase}/api/match?id=${encodeURIComponent(id)}`);
      if (payload.match) state.modalMatch = normalizeMatch(payload.match);
    } catch (error) {
      showToast(`Подробная статистика недоступна: ${error.message}`);
    } finally {
      state.modalLoading = false;
      renderModal();
    }
  }

  function closeModal() {
    $('#matchModal').classList.remove('open');
    $('#matchModal').setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    $('#toastRegion').append(toast);
    setTimeout(() => toast.remove(), 4200);
  }

  function cycleTheme() {
    const index = THEME_ORDER.indexOf(state.theme);
    state.theme = THEME_ORDER[(index + 1) % THEME_ORDER.length];
    localStorage.setItem(CONFIG.themeStorageKey, state.theme);
    applyTheme();
  }

  async function installPwa() {
    if (!state.deferredInstall) return;
    state.deferredInstall.prompt();
    await state.deferredInstall.userChoice;
    state.deferredInstall = null;
    $('#installButton').classList.add('hidden');
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register(`./service-worker.js?v=${encodeURIComponent(CONFIG.build)}`);
      registration.update();
    } catch (error) {
      console.warn('Service worker registration failed', error);
    }
  }

  function initializeUi() {
    $('#refreshIcon').innerHTML = icon('refresh');
    $('#closeModalButton').innerHTML = icon('close');
    $('#installButton').innerHTML = icon('install');
    $('#refreshButton').addEventListener('click', () => loadSnapshot({ manual: true }));
    $('#themeButton').addEventListener('click', cycleTheme);
    $('#installButton').addEventListener('click', installPwa);
    $('#closeModalButton').addEventListener('click', closeModal);
    $$('[data-close-modal]').forEach(element => element.addEventListener('click', closeModal));
    window.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
    window.addEventListener('hashchange', () => { state.route = routeFromHash(); render(); });
    window.addEventListener('online', () => { showToast('Интернет-соединение восстановлено'); loadSnapshot(); });
    window.addEventListener('offline', () => showToast('Нет соединения с интернетом — будет использован кэш'));
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      state.deferredInstall = event;
      $('#installButton').classList.remove('hidden');
    });
    matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => { if (state.theme === 'system') applyTheme(); });
    updateClock();
    setInterval(updateClock, 30_000);
  }

  async function start() {
    initializeUi();
    applyTheme();
    state.snapshot = loadCachedSnapshot();
    if (state.snapshot) {
      state.sourceMode = 'cache';
      state.loading = false;
    }
    render();
    registerServiceWorker();
    await loadSnapshot();
  }

  start();
})();

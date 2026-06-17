(() => {
  'use strict';

  const CONFIG = window.WC26_CONFIG;
  const DEMO = window.WC26_DEMO_DATA;
  if (!CONFIG) throw new Error('WC26_CONFIG is missing');

  const ROUTES = [
    ['today', 'Сегодня', 'home'],
    ['schedule', 'Матчи', 'calendar'],
    ['standings', 'Таблицы', 'table'],
    ['teams', 'Сборные', 'shield'],
    ['players', 'Игроки', 'players'],
    ['favorites', 'Избранное', 'star']
  ];
  const THEME_ORDER = ['system', 'dark', 'light', 'mexico2026', 'qatar2022', 'russia2018'];
  const THEME_LABELS = {
    system: 'Системная',
    dark: 'Тёмная',
    light: 'Светлая',
    mexico2026: 'Тема Mexico 2026',
    qatar2022: 'Тема Qatar 2022',
    russia2018: 'Тема Russia 2018'
  };
  const THEME_META = {
    dark: '#071522',
    light: '#eef5ff',
    mexico2026: '#0b2c28',
    qatar2022: '#5e0c2e',
    russia2018: '#0e2f7a'
  };
  const THEME_ICONS = {
    system: 'system', dark: 'dark', light: 'light',
    mexico2026: 'palette', qatar2022: 'palette', russia2018: 'palette'
  };
  const STAT_LABELS = {
    possession: 'Владение мячом', shots: 'Удары', shotsOnTarget: 'Удары в створ',
    corners: 'Угловые', fouls: 'Фолы', passes: 'Передачи'
  };
  const VERIFIED_CURRENT_CLUBS = new Map(Object.entries({
    'lionel messi': 'Inter Miami CF', 'erling haaland': 'Manchester City', 'erling braut haaland': 'Manchester City',
    'raphinha': 'FC Barcelona', 'raphael dias belloli': 'FC Barcelona', 'kylian mbappe': 'Real Madrid',
    'vinicius junior': 'Real Madrid', 'vinicius jr': 'Real Madrid', 'lamine yamal': 'FC Barcelona',
    'cristiano ronaldo': 'Al-Nassr', 'julian alvarez': 'Atlético de Madrid', 'jude bellingham': 'Real Madrid',
    'harry kane': 'Bayern Munich', 'jamal musiala': 'Bayern Munich', 'bukayo saka': 'Arsenal',
    'pedri': 'FC Barcelona', 'gavi': 'FC Barcelona', 'achraf hakimi': 'Paris Saint-Germain',
    'ousmane dembele': 'Paris Saint-Germain', 'lautaro martinez': 'Inter Milan'
  }));

  const parsedHash = parseHash();
  const state = {
    route: parsedHash.route,
    teamKey: parsedHash.teamKey,
    snapshot: null,
    loading: true,
    refreshing: false,
    error: '',
    sourceMode: 'loading',
    selectedDate: null,
    favoriteMatches: loadSet(CONFIG.favoritesStorageKey),
    favoriteTeams: loadSet(CONFIG.favoriteTeamsStorageKey),
    notificationsEnabled: localStorage.getItem(CONFIG.notificationStorageKey) === 'true',
    theme: localStorage.getItem(CONFIG.themeStorageKey) || 'system',
    modalMatch: null,
    modalTab: 'overview',
    modalLoading: false,
    notificationModalOpen: false,
    refreshTimer: null,
    kickoffTimers: new Map(),
    deferredInstall: null,
    teamDetails: new Map(),
    teamLoading: new Set(),
    playerProfile: null,
    playerSeed: null,
    playerLoading: false,
    playerStatsLoading: false,
    playerTab: 'overview',
    playerHistorySeason: 2026,
    playerHistory: new Map(),
    playerHistoryLoading: false,
    changedMatchIds: new Set(),
    leadersLoading: false,
    leadersLoaded: false,
    teamPhotosLoading: new Set(),
    matchPhotosLoading: new Set()
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


  function normalizeHeightText(value) {
    if (value === null || value === undefined || value === '') return '—';
    const text = String(value).trim().toLowerCase().replace(',', '.');
    const feet = text.match(/(\d+)\s*['′]\s*(\d+)?/);
    if (feet) return `${Math.round((Number(feet[1]) * 12 + Number(feet[2] || 0)) * 2.54)} см`;
    const number = Number((text.match(/-?\d+(?:\.\d+)?/) || [])[0]);
    if (!Number.isFinite(number)) return '—';
    let cm = null;
    if (/mm|миллимет/.test(text)) cm = number / 10;
    else if (/inch|in\b|дюйм/.test(text)) cm = number * 2.54;
    else if (/\bm\b|meter|метр/.test(text) && number < 10) cm = number * 100;
    else if (/cm|см|centimeter/.test(text)) cm = number;
    else if (number >= 1.35 && number <= 2.3) cm = number * 100;
    else if (number >= 135 && number <= 230) cm = number;
    else if (number >= 1350 && number <= 2300) cm = number / 10;
    return cm && cm >= 135 && cm <= 230 ? `${Math.round(cm)} см` : '—';
  }

  function normalizeWeightText(value) {
    if (value === null || value === undefined || value === '') return '—';
    const text = String(value).trim().toLowerCase().replace(',', '.');
    const number = Number((text.match(/-?\d+(?:\.\d+)?/) || [])[0]);
    if (!Number.isFinite(number)) return '—';
    let kg = null;
    if (/lb|lbs|pound|фунт/.test(text)) kg = number * 0.453592;
    else if (/gram|\bg\b|грам/.test(text) && number > 1000) kg = number / 1000;
    else if (number >= 45 && number <= 180) kg = number;
    else if (number >= 45000 && number <= 180000) kg = number / 1000;
    return kg && kg >= 45 && kg <= 180 ? `${Math.round(kg)} кг` : '—';
  }

  function slug(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, '');
  }

  function verifiedClubForName(name) {
    const key = slug(name).replace(/-/g, ' ');
    if (VERIFIED_CURRENT_CLUBS.has(key)) return VERIFIED_CURRENT_CLUBS.get(key);
    for (const [knownName, club] of VERIFIED_CURRENT_CLUBS) {
      if (key.includes(knownName) || knownName.includes(key)) return club;
    }
    return '';
  }

  function teamKey(team) {
    return String(team?.countryCode || '').toLowerCase() || slug(team?.name || team?.id || 'team');
  }

  function parseHash() {
    const hash = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (hash.startsWith('team/')) return { route: 'team', teamKey: hash.slice(5) };
    return { route: ROUTES.some(item => item[0] === hash) ? hash : 'today', teamKey: '' };
  }

  function loadSet(key) {
    try { return new Set(JSON.parse(localStorage.getItem(key) || '[]').map(String)); }
    catch { return new Set(); }
  }

  function saveSet(key, value) {
    localStorage.setItem(key, JSON.stringify([...value]));
  }

  function icon(name, className = 'icon') {
    const paths = {
      home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V21h13V10.5"/><path d="M9.5 21v-6h5v6"/>',
      calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
      table: '<path d="M4 5h16M4 12h16M4 19h16M8 5v14M16 5v14"/>',
      players: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
      shield: '<path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-5"/>',
      star: '<path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.7l6.2-.9L12 3Z"/>',
      refresh: '<path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6.1 8A7 7 0 0 1 18.5 6L20 7M4 17l1.5 1A7 7 0 0 0 17.9 16"/>',
      close: '<path d="M6 6l12 12M18 6 6 18"/>',
      back: '<path d="m15 18-6-6 6-6"/>',
      install: '<path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 18v3h14v-3"/>',
      system: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
      dark: '<path d="M20.5 14.2A8 8 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"/>',
      light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
      bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
      bellOff: '<path d="M13.73 21a2 2 0 0 1-3.46 0M18.63 18H3c0-2 3-2 3-9 0-.92.2-1.8.57-2.57M8.1 4.3A6 6 0 0 1 18 9c0 2.47.37 4.1.86 5.22M3 3l18 18"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      arrow: '<path d="m9 18 6-6-6-6"/>',
      trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 13v5M8 21h8M9 18h6"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      palette: '<path d="M12 3a9 9 0 1 0 0 18h1.2a2.8 2.8 0 0 0 0-5.6h-.36a1.64 1.64 0 0 1 0-3.28H17A4 4 0 0 0 17 4h-5Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="9.7" cy="7.6" r="1"/><circle cx="14.4" cy="7.5" r="1"/><circle cx="16.7" cy="11.2" r="1"/>'
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
    if (['live', '1h', '2h', 'ht', 'et', 'p', 'int', 'susp', 'in'].includes(status)) return 'live';
    if (['finished', 'ft', 'aet', 'pen', 'complete', 'completed', 'post'].includes(status)) return 'finished';
    if (['postponed', 'pst', 'canc', 'cancelled', 'abd'].includes(status)) return 'postponed';
    return 'upcoming';
  }

  function normalizeTeam(team = {}, alternateScore = null) {
    const name = team.name || team.displayName || 'Будет определено';
    return {
      id: String(team.id || team.providerId || name),
      apiId: team.apiId ? String(team.apiId) : '',
      espnId: team.espnId ? String(team.espnId) : (String(team.id || '').match(/^\d+$/) ? String(team.id) : ''),
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
      group: match.group || String(match.stage || '').match(/Группа\s+([A-L])/i)?.[1] || '',
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
      apiId: team.apiId ? String(team.apiId) : '',
      espnId: team.espnId ? String(team.espnId) : '',
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
      apiId: String(player.apiId || player.player?.id || ''),
      espnId: String(player.espnId || ''),
      name: player.name || player.player?.name || 'Игрок',
      team: player.team || statistics.team?.name || 'Сборная',
      countryCode: String(player.countryCode || player.flagCode || '').toLowerCase(),
      photo: player.photo || player.player?.photo || '',
      photoCandidates: Array.isArray(player.photoCandidates) ? player.photoCandidates : [],
      wikidataId: String(player.wikidataId || ''),
      number: player.number ?? player.jersey ?? null,
      pos: player.pos || player.position || statistics.games?.position || '',
      age: player.age ?? player.player?.age ?? null,
      rating: player.rating || '',
      starter: Boolean(player.starter),
      nationality: player.nationality || player.player?.nationality || '',
      birth: player.birth || player.player?.birth || null,
      height: normalizeHeightText(player.height || player.player?.height || ''),
      weight: normalizeWeightText(player.weight || player.player?.weight || ''),
      value: type === 'ratings' ? Number(rawValue || 0).toFixed(2) : safeNumber(rawValue, 0),
      label: player.label || (type === 'assists' ? 'ассистов' : type === 'ratings' ? 'расчётная оценка' : 'голов')
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
      provider: raw.provider || '',
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

  function normalizeTeamDetails(raw = {}, fallbackTeam) {
    const team = normalizeTeam(raw.team || fallbackTeam || {});
    return {
      team,
      coach: raw.coach || '',
      formation: raw.formation || '',
      fifaRank: raw.fifaRank || null,
      source: raw.source || '',
      squad: (raw.squad || raw.players || []).map(player => normalizePlayer({
        ...player,
        team: player.team || raw.team?.name || fallbackTeam?.name || 'Сборная',
        countryCode: player.countryCode || raw.team?.countryCode || fallbackTeam?.countryCode || ''
      })),
      updatedAt: raw.updatedAt || new Date().toISOString()
    };
  }

  function cryptoRandomId() {
    return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function mediaProxy(url) {
    return url || '';
  }

  function localFlagUrl(code) {
    const clean = String(code || '').toLowerCase().replace(/[^a-z-]/g, '');
    return clean ? `./assets/flags/${clean}.svg` : '';
  }

  function encodedCandidates(candidates) {
    return escapeHtml(encodeURIComponent(JSON.stringify([...new Set(candidates.filter(Boolean))])));
  }

  function flagMarkup(team, small = false) {
    const local = localFlagUrl(team?.countryCode);
    const remote = team?.logo || '';
    const candidates = [local, remote, remote ? mediaProxy(remote) : ''];
    const initials = escapeHtml(team?.short || team?.name?.slice(0, 3) || 'WC');
    if (small) {
      return `<span class="mini-flag-wrap"><img class="mini-flag media-fallback" alt="" data-media-candidates="${encodedCandidates(candidates)}"><span>${initials.slice(0, 2)}</span></span>`;
    }
    return `<span class="flag-frame"><img class="media-fallback" alt="Флаг ${escapeHtml(team?.name || '')}" data-media-candidates="${encodedCandidates(candidates)}"><span class="flag-fallback">${initials}</span></span>`;
  }

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2).map(word => word[0] || '').join('').toUpperCase();
  }

  function playerPhotoCandidates(player) {
    const result = [];
    for (const candidate of (player?.photoCandidates || [])) {
      if (candidate) result.push(candidate, mediaProxy(candidate));
    }
    const addRemote = (url) => {
      if (!url) return;
      result.push(url, mediaProxy(url));
    };
    const photo = player?.photo || '';
    addRemote(photo);
    const espnId = String(player?.espnId || '');
    const id = String(player?.id || '');
    if (/^\d+$/.test(espnId)) {
      addRemote(`https://a.espncdn.com/i/headshots/soccer/players/full/${espnId}.png`);
      addRemote(`https://a.espncdn.com/i/headshots/soccer/players/large/${espnId}.png`);
    }
    if (!espnId && /^\d+$/.test(id)) {
      addRemote(`https://a.espncdn.com/i/headshots/soccer/players/full/${id}.png`);
      addRemote(`https://a.espncdn.com/i/headshots/soccer/players/large/${id}.png`);
    }
    return [...new Set(result.filter(Boolean))];
  }

  function localTrophyAssets(item = {}) {
    const text = `${item.title || ''} ${item.competition || ''} ${item.tournament || ''}`.toLowerCase();
    if (/u[- ]?20/.test(text) && /world cup|чемпионат мира/.test(text)) return ['./assets/trophies/u20-world-cup.svg'];
    if (/world cup|чемпион мира|чемпионат мира/.test(text) && !/golden|золот|young|молод|glove|перчат|boot|бутс/.test(text)) {
      return ['./assets/trophies/photos/world-cup.jpg', './assets/trophies/world-cup.svg'];
    }
    if (/copa am[eé]rica|кубок америки/.test(text)) return ['./assets/trophies/photos/copa-america.jpg', './assets/trophies/copa-america.svg'];
    if (/european championship|euro|чемпион европ/.test(text)) return ['./assets/trophies/photos/euro.jpg', './assets/trophies/euro.svg'];
    if (/nations league|лига наций/.test(text)) return ['./assets/trophies/photos/nations-league.jpg', './assets/trophies/nations-league.svg'];
    if (/olympic|олимп/.test(text)) return ['./assets/trophies/olympic.svg'];
    if (/finalissima|финалиссима|conmebol.*uefa/.test(text)) return ['./assets/trophies/finalissima.svg'];
    if (/golden ball|золотой мяч/.test(text)) return ['./assets/trophies/golden-ball.svg'];
    if (/golden boot|золотая бутс/.test(text)) return ['./assets/trophies/golden-boot.svg'];
    if (/golden glove|золотая перчат/.test(text)) return ['./assets/trophies/golden-glove.svg'];
    if (/young player|молодой игрок/.test(text)) return ['./assets/trophies/young-player.svg'];
    return ['./assets/trophies/international-award.svg'];
  }

  function mergePlayerMedia(player, media = {}) {
    if (!media) return player;
    return normalizePlayer({
      ...player,
      id: player.id || media.id,
      espnId: player.espnId || media.espnId,
      wikidataId: player.wikidataId || media.wikidataId,
      photo: media.photo || player.photo,
      photoCandidates: [
        media.photo,
        ...(media.photoCandidates || []),
        player.photo,
        ...(player.photoCandidates || [])
      ].filter(Boolean)
    });
  }

  async function fetchPlayerMediaBatch(players, teamName = '') {
    const compact = (players || []).filter(Boolean).map(player => ({
      id: player.id || '',
      espnId: player.espnId || '',
      name: player.name || '',
      team: player.team || teamName || '',
      countryCode: player.countryCode || '',
      photo: player.photo || '',
      photoCandidates: player.photoCandidates || []
    })).filter(player => player.name);
    if (!compact.length) return [];
    const url = new URL(`${CONFIG.apiBase}/api/media/players`);
    url.searchParams.set('players', JSON.stringify(compact));
    if (teamName) url.searchParams.set('team', teamName);
    url.searchParams.set('v', CONFIG.build);
    const payload = await fetchJson(url.toString(), 7500);
    return Array.isArray(payload.players) ? payload.players : [];
  }

  function avatarMarkup(player, compact = false, large = false) {
    const classes = ['player-avatar', compact ? 'compact' : '', large ? 'large' : ''].filter(Boolean).join(' ');
    return `<span class="${classes}"><span>${escapeHtml(initials(player?.name))}</span><img class="media-fallback" loading="lazy" decoding="async" referrerpolicy="no-referrer" alt="${escapeHtml(player?.name || 'Игрок')}" data-media-candidates="${encodedCandidates(playerPhotoCandidates(player))}"></span>`;
  }


  function playerData(player) {
    const safe = normalizePlayer(player || {});
    const payload = {
      id: safe.id, apiId: safe.apiId, espnId: safe.espnId, name: safe.name,
      team: safe.team, countryCode: safe.countryCode, photo: safe.photo, photoCandidates: safe.photoCandidates,
      number: safe.number, pos: safe.pos, age: safe.age, nationality: safe.nationality
    };
    return escapeHtml(encodeURIComponent(JSON.stringify(payload)));
  }

  function metricValue(value, fallback = '—') {
    if (value === null || value === undefined || value === '') return fallback;
    return escapeHtml(value);
  }

  function pluralMatches(value) {
    const number = safeNumber(value);
    const mod10 = number % 10;
    const mod100 = number % 100;
    if (mod10 === 1 && mod100 !== 11) return 'матч';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'матча';
    return 'матчей';
  }

  function bindMediaFallbacks(root = document) {
    $$('.media-fallback', root).forEach(img => {
      if (img.dataset.bound === '1') return;
      img.dataset.bound = '1';
      let candidates = [];
      try { candidates = JSON.parse(decodeURIComponent(img.dataset.mediaCandidates || '[]')); } catch { candidates = []; }
      candidates = [...new Set(candidates.filter(Boolean))];
      let index = 0;
      let timer = null;
      const holder = img.closest('.player-avatar, .flag-frame, .mini-flag-wrap, .club-logo, .trophy-photo');
      const clearTimer = () => { if (timer) clearTimeout(timer); timer = null; };
      const next = () => {
        clearTimer();
        if (index >= candidates.length) {
          img.hidden = true;
          holder?.classList.add('fallback-only');
          holder?.classList.remove('media-loading');
          return;
        }
        img.hidden = false;
        holder?.classList.add('media-loading');
        holder?.classList.remove('image-loaded');
        img.src = candidates[index++];
        timer = setTimeout(next, 4500);
      };
      img.addEventListener('error', next);
      img.addEventListener('load', () => {
        clearTimer();
        if (!img.naturalWidth || !img.naturalHeight) { next(); return; }
        holder?.classList.add('image-loaded');
        holder?.classList.remove('fallback-only', 'media-loading');
      });
      next();
    });
  }

  function scoreText(match) {
    if (match.home.score === null || match.away.score === null) return '—';
    return `${match.home.score} : ${match.away.score}`;
  }

  function statusMarkup(match) {
    if (match.status === 'live') return `<span class="live-badge"><span class="live-pulse"></span>${match.minute ? `${match.minute}′` : 'LIVE'}</span>`;
    if (match.status === 'finished') return '<span class="status-badge">Завершён</span>';
    if (match.status === 'postponed') return '<span class="status-badge">Перенесён</span>';
    return `<span class="kickoff-time">${icon('clock', 'tiny-icon')}${escapeHtml(formatTime(match.startingAt))}</span>`;
  }

  function applyTheme() {
    let resolved = state.theme;
    if (resolved === 'system') resolved = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.dataset.theme = resolved;
    $('#themeLabel').textContent = THEME_LABELS[state.theme];
    $('#themeIcon').innerHTML = icon(THEME_ICONS[state.theme] || state.theme, 'icon');
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = THEME_META[resolved] || (resolved === 'light' ? '#eef5ff' : '#071522');
  }

  function updateClock() {
    $('#currentClock').textContent = formatDateTime(new Date().toISOString(), {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
    });
  }

  function viewTransition(callback) {
    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.startViewTransition(callback);
    } else callback();
  }

  function setRoute(route) {
    if (!ROUTES.some(item => item[0] === route)) return;
    viewTransition(() => {
      state.route = route;
      state.teamKey = '';
      location.hash = route;
      render();
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openTeam(team) {
    const key = teamKey(team);
    if (!key) return;
    viewTransition(() => {
      state.route = 'team';
      state.teamKey = key;
      location.hash = `team/${encodeURIComponent(key)}`;
      render();
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function navMarkup() {
    return ROUTES.map(([id, label, iconName]) => `
      <button class="nav-button${state.route === id ? ' active' : ''}" data-route="${id}" type="button">
        ${icon(iconName)}<span>${escapeHtml(label)}</span>
      </button>`).join('');
  }

  function renderNavigation() {
    $('#desktopNav').innerHTML = navMarkup();
    $('#mobileNav').innerHTML = navMarkup();
  }

  function renderConnection() {
    const dot = $('#connectionDot');
    const mini = $('#connectionMiniText');
    const sync = $('#syncStatus');
    dot.className = 'status-dot';
    sync.className = 'sync-pill';

    if (state.loading) {
      mini.textContent = 'Обновление данных';
      sync.innerHTML = '<span class="loader mini-loader"></span><span>Синхронизация</span>';
      return;
    }
    const updated = state.snapshot?.lastUpdated ? formatTime(state.snapshot.lastUpdated) : '';
    if (state.sourceMode === 'live') {
      dot.classList.add('ok');
      mini.textContent = `Обновлено ${updated}`;
      sync.innerHTML = `<span class="status-dot ok"></span><span>Данные обновлены ${escapeHtml(updated)}</span>`;
    } else if (state.sourceMode === 'cache') {
      dot.classList.add('warning');
      mini.textContent = 'Последние сохранённые данные';
      sync.classList.add('warning');
      sync.innerHTML = '<span class="status-dot warning"></span><span>Показаны последние данные</span>';
    } else {
      dot.classList.add('warning');
      mini.textContent = 'Резервные данные';
      sync.classList.add('warning');
      sync.innerHTML = '<span class="status-dot warning"></span><span>Резервный режим</span>';
    }
  }

  function allTeams() {
    const map = new Map();
    const add = team => {
      if (!team?.name || team.name === 'Будет определено') return;
      const key = teamKey(team);
      const current = map.get(key) || {};
      map.set(key, { ...current, ...team, id: team.id || current.id, name: team.name || current.name, countryCode: team.countryCode || current.countryCode });
    };
    (state.snapshot?.matches || []).forEach(match => { add(match.home); add(match.away); });
    (state.snapshot?.standings || []).forEach(group => group.teams.forEach(add));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }

  function findTeam(key) {
    return allTeams().find(team => teamKey(team) === key) || null;
  }

  function renderSummary() {
    const matches = state.snapshot?.matches || [];
    const liveMatches = matches.filter(match => match.status === 'live');
    const live = liveMatches.length;
    const todayKey = formatDayKey(new Date().toISOString());
    const today = matches.filter(match => formatDayKey(match.startingAt) === todayKey).length;
    const teams = allTeams().length;
    const cards = [
      { value: matches.length, label: 'Матчей' },
      { value: today, label: 'Сегодня' },
      { value: live, label: 'Сейчас live', liveMatch: liveMatches[0] || null },
      { value: teams || 48, label: 'Сборных' }
    ];
    $('#summaryCards').innerHTML = cards.map((card, index) => {
      const content = `<strong>${card.value}</strong><span>${card.label}</span>${card.liveMatch ? `<small class="summary-live-hint">Открыть матч ${icon('arrow', 'tiny-icon')}</small>` : ''}`;
      if (card.liveMatch) return `<button type="button" class="summary-card glass reveal summary-live-card" style="--delay:${index * 45}ms" data-open-match="${escapeHtml(card.liveMatch.id)}" aria-label="Открыть live-матч ${escapeHtml(card.liveMatch.home.name)} — ${escapeHtml(card.liveMatch.away.name)}">${content}</button>`;
      return `<div class="summary-card glass reveal" style="--delay:${index * 45}ms">${content}</div>`;
    }).join('');
  }

  function teamButtonMarkup(team, side = '') {
    return `<button class="team-block team-link ${side}" type="button" data-open-team="${escapeHtml(teamKey(team))}" aria-label="Открыть сборную ${escapeHtml(team.name)}">
      ${side === 'away' ? `<span class="team-text"><span class="team-name">${escapeHtml(team.name)}</span><span class="team-code">${escapeHtml(team.short)}</span></span>${flagMarkup(team)}` : `${flagMarkup(team)}<span class="team-text"><span class="team-name">${escapeHtml(team.name)}</span><span class="team-code">${escapeHtml(team.short)}</span></span>`}
    </button>`;
  }

  function matchCard(match, options = {}) {
    const favorite = state.favoriteMatches.has(String(match.id));
    const changed = state.changedMatchIds.has(String(match.id));
    return `<article class="match-wrap reveal${match.status === 'live' ? ' is-live' : ''}${changed ? ' score-changed' : ''}">
      <div class="match-card">
        ${teamButtonMarkup(match.home)}
        <button class="match-center" type="button" data-open-match="${escapeHtml(match.id)}" aria-label="Открыть матч ${escapeHtml(match.home.name)} — ${escapeHtml(match.away.name)}">
          <span class="match-score">${escapeHtml(scoreText(match))}</span>
          <span class="match-meta">${statusMarkup(match)}<span class="stage-text">${escapeHtml(match.stage || '')}</span></span>
        </button>
        ${teamButtonMarkup(match.away, 'away')}
      </div>
      ${options.hideFavorite ? '' : `<button type="button" class="favorite-button${favorite ? ' active' : ''}" data-favorite-match="${escapeHtml(match.id)}" aria-label="${favorite ? 'Удалить матч из избранного' : 'Добавить матч в избранное'}">${icon('star', 'icon')}</button>`}
    </article>`;
  }

  function matchList(matches, options = {}) {
    if (!matches.length) return '<div class="empty"><span class="empty-icon">○</span><strong>Матчей нет</strong><span>На выбранную дату игры не запланированы.</span></div>';
    return `<div class="match-list stagger-list">${matches.map(match => matchCard(match, options)).join('')}</div>`;
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
      if (live.length) { selected = live; title = 'Сейчас в эфире'; }
      else {
        const nearest = nearestMatchDate(matches);
        selected = matches.filter(match => formatDayKey(match.startingAt) === nearest);
        title = nearest ? `Ближайший игровой день · ${formatShortDay(nearest)}` : 'Ближайшие матчи';
      }
    }
    $('#mainPanel').innerHTML = `<div class="panel-header reveal"><div><div class="eyebrow accent">Matchday</div><h2>${escapeHtml(title)}</h2><div class="panel-subtitle">Время показано в часовом поясе устройства</div></div></div>${matchList(selected)}`;
  }

  function renderSchedule() {
    const matches = state.snapshot.matches;
    const grouped = new Map();
    matches.forEach(match => {
      const key = formatDayKey(match.startingAt);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(match);
    });
    const keys = [...grouped.keys()].sort();
    if (!state.selectedDate) state.selectedDate = nearestMatchDate(matches) || formatDayKey(new Date().toISOString());
    const active = grouped.get(state.selectedDate) || [];
    const nearbyKeys = keys.filter(key => Math.abs(new Date(`${key}T12:00:00`) - new Date(`${state.selectedDate}T12:00:00`)) <= 5 * 86400000).slice(0, 9);
    $('#mainPanel').innerHTML = `
      <div class="panel-header reveal schedule-header"><div><div class="eyebrow accent">Календарь</div><h2>Расписание</h2><div class="panel-subtitle">Выбери любую дату и проверь, есть ли матч</div></div>
        <label class="date-picker-wrap">${icon('calendar')}<input id="datePicker" type="date" value="${escapeHtml(state.selectedDate)}" aria-label="Выбрать дату"></label>
      </div>
      <div class="chip-row">${nearbyKeys.map(key => `<button class="chip${key === state.selectedDate ? ' active' : ''}" type="button" data-date="${key}">${escapeHtml(formatShortDay(key))}<small>${grouped.get(key)?.length || 0}</small></button>`).join('')}</div>
      <div class="selected-date-title"><div><h3>${escapeHtml(formatDayTitle(state.selectedDate))}</h3><span>${active.length ? `${active.length} ${active.length === 1 ? 'матч' : 'матча'}` : 'матчей нет'}</span></div><button class="text-button" type="button" data-jump-today>Сегодня</button></div>
      ${matchList(active)}
    `;
  }

  function formMarkup(form) {
    if (!form?.length) return '<span class="muted">—</span>';
    return `<span class="form">${form.slice(-5).map(result => `<span class="${escapeHtml(result)}">${escapeHtml(result)}</span>`).join('')}</span>`;
  }

  function renderStandings() {
    const groups = state.snapshot.standings;
    if (!groups.length) {
      $('#mainPanel').innerHTML = '<div class="panel-header"><h2>Таблицы групп</h2></div><div class="empty"><strong>Таблицы ещё формируются</strong><span>Данные появятся после матчей группового этапа.</span></div>';
      return;
    }
    $('#mainPanel').innerHTML = `<div class="panel-header reveal"><div><div class="eyebrow accent">Групповой этап</div><h2>Таблицы</h2><div class="panel-subtitle">Нажми на сборную, чтобы открыть её страницу</div></div></div>` + groups.map(group => `
      <section class="standing-group reveal"><h3 class="section-heading">Группа ${escapeHtml(group.group)}</h3>
      <div class="table-scroll"><table class="standings-table"><thead><tr><th>#</th><th>Команда</th><th>И</th><th>В</th><th>Н</th><th>П</th><th>М</th><th>РМ</th><th>О</th><th>Форма</th></tr></thead><tbody>
        ${group.teams.map(team => `<tr data-open-team="${escapeHtml(teamKey(team))}" tabindex="0"><td class="position">${team.pos || ''}</td><td><span class="table-team">${flagMarkup(team)}<strong>${escapeHtml(team.name)}</strong></span></td><td>${team.played}</td><td>${team.won}</td><td>${team.drawn}</td><td>${team.lost}</td><td>${team.gf}:${team.ga}</td><td>${team.gd > 0 ? '+' : ''}${team.gd}</td><td><strong>${team.points}</strong></td><td>${formMarkup(team.form)}</td></tr>`).join('')}
      </tbody></table></div></section>`).join('');
  }

  function playerRows(players, valueLabel) {
    if (!players.length) return '<div class="empty compact"><strong>Статистика появится после матчей</strong></div>';
    return `<div class="leader-list stagger-list">${players.map((player, index) => `<article class="player-row reveal interactive-player" data-open-player="${playerData(player)}" tabindex="0" role="button" aria-label="Открыть профиль ${escapeHtml(player.name)}"><span class="rank-number">${index + 1}</span>${avatarMarkup(player)}<div class="player-copy"><div class="player-name">${escapeHtml(player.name)}</div><button class="player-team team-inline" type="button" data-open-team="${escapeHtml(teamKey({ name: player.team, countryCode: player.countryCode }))}">${flagMarkup({ countryCode: player.countryCode, name: player.team, short: '' }, true)}<span>${escapeHtml(player.team)}</span></button></div><div class="player-value">${escapeHtml(player.value)}<small>${escapeHtml(player.label || valueLabel)}</small></div></article>`).join('')}</div>`;
  }

  function renderPlayers() {
    const leaders = state.snapshot.leaders;
    const loading = state.leadersLoading && !state.leadersLoaded;
    const loadingBlock = '<div class="leader-loading"><span class="loader"></span><span>Уточняю авторов голов и ассистов…</span></div>';
    $('#mainPanel').innerHTML = `
      <div class="panel-header reveal"><div><div class="eyebrow accent">Player hub</div><h2>Игроки</h2><div class="panel-subtitle">Голы, ассисты и фотографии футболистов</div></div></div>
      <div class="leader-section"><h3 class="section-heading">Бомбардиры</h3>${loading && !leaders.scorers.length ? loadingBlock : playerRows(leaders.scorers.slice(0, 20), 'голов')}</div>
      <div class="leader-section"><h3 class="section-heading">Ассистенты</h3>${loading && !leaders.assists.length ? loadingBlock : playerRows(leaders.assists.slice(0, 20), 'ассистов')}</div>
      ${leaders.ratings.length ? `<div class="leader-section"><h3 class="section-heading">Расчётные оценки</h3>${playerRows(leaders.ratings.slice(0, 20), 'расчётная оценка')}</div>` : ''}
    `;
  }

  function teamRecord(team) {
    const matches = (state.snapshot?.matches || []).filter(match => teamKey(match.home) === teamKey(team) || teamKey(match.away) === teamKey(team));
    const result = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0, form: [], matches };
    for (const match of matches) {
      if (match.status !== 'finished') continue;
      const isHome = teamKey(match.home) === teamKey(team);
      const gf = nullableNumber(isHome ? match.home.score : match.away.score);
      const ga = nullableNumber(isHome ? match.away.score : match.home.score);
      if (gf === null || ga === null) continue;
      result.played += 1; result.gf += gf; result.ga += ga;
      if (gf > ga) { result.won += 1; result.points += 3; result.form.push('W'); }
      else if (gf < ga) { result.lost += 1; result.form.push('L'); }
      else { result.drawn += 1; result.points += 1; result.form.push('D'); }
    }
    return result;
  }

  function nextMatchForTeam(team) {
    const now = Date.now();
    return (state.snapshot?.matches || []).find(match => (teamKey(match.home) === teamKey(team) || teamKey(match.away) === teamKey(team)) && (match.status === 'live' || new Date(match.startingAt).getTime() >= now));
  }

  function teamCard(team) {
    const record = teamRecord(team);
    const next = nextMatchForTeam(team);
    const favorite = state.favoriteTeams.has(teamKey(team));
    return `<button class="team-card reveal" type="button" data-open-team="${escapeHtml(teamKey(team))}">
      <span class="team-card-flag">${flagMarkup(team)}</span>
      <span class="team-card-copy"><strong>${escapeHtml(team.name)}</strong><small>${escapeHtml(team.short || '')}${record.played ? ` · ${record.points} оч.` : ''}</small></span>
      <span class="team-card-next">${next ? `${next.status === 'live' ? 'LIVE' : formatShortDay(formatDayKey(next.startingAt))} · ${formatTime(next.startingAt)}` : 'Расписание'}${favorite ? '<span class="favorite-dot">★</span>' : ''}</span>
      ${icon('arrow', 'icon arrow-icon')}
    </button>`;
  }

  function renderTeams() {
    const teams = allTeams();
    $('#mainPanel').innerHTML = `
      <div class="panel-header reveal teams-heading"><div><div class="eyebrow accent">48 сборных</div><h2>Сборные</h2><div class="panel-subtitle">Составы, матчи и статистика каждой команды</div></div>
      <label class="team-search">${icon('search')}<input id="teamSearch" type="search" placeholder="Найти сборную" autocomplete="off"></label></div>
      <div id="teamGrid" class="team-grid stagger-list">${teams.map(teamCard).join('')}</div>
    `;
  }

  function teamHero(team, record, details) {
    const favorite = state.favoriteTeams.has(teamKey(team));
    return `<section class="team-hero reveal">
      <button class="back-button" type="button" data-route="teams">${icon('back')}<span>Все сборные</span></button>
      <div class="team-hero-main">
        <div class="team-hero-flag">${flagMarkup(team)}</div>
        <div class="team-hero-copy"><div class="eyebrow accent">Национальная сборная</div><h2>${escapeHtml(team.name)}</h2><p>${escapeHtml(team.short || '')}${details?.coach ? ` · Главный тренер: ${escapeHtml(details.coach)}` : ''}</p></div>
        <button class="favorite-team-button${favorite ? ' active' : ''}" type="button" data-favorite-team="${escapeHtml(teamKey(team))}">${icon(favorite ? 'check' : 'star')}<span>${favorite ? 'В избранном' : 'Следить'}</span></button>
      </div>
      <div class="team-stat-strip">
        <span><strong>${record.played}</strong><small>матчей</small></span><span><strong>${record.won}</strong><small>побед</small></span><span><strong>${record.drawn}</strong><small>ничьих</small></span><span><strong>${record.lost}</strong><small>поражений</small></span><span><strong>${record.gf}:${record.ga}</strong><small>мячи</small></span>${details?.fifaRank ? `<span><strong>${details.fifaRank}</strong><small>рейтинг FIFA</small></span>` : ''}
      </div>
    </section>`;
  }

  function squadGrid(details) {
    if (!details) return `<div class="squad-grid">${Array.from({ length: 12 }, () => '<div class="squad-card skeleton-card"><span class="skeleton avatar-skeleton"></span><span class="skeleton line-skeleton"></span><span class="skeleton short-skeleton"></span></div>').join('')}</div>`;
    if (!details.squad.length) return '<div class="empty"><strong>Состав пока не опубликован</strong><span>Он появится после обновления данных поставщиком.</span></div>';
    const groups = new Map();
    details.squad.forEach(player => {
      const position = /GK|Goal/i.test(player.pos) ? 'Вратари' : /DF|Def/i.test(player.pos) ? 'Защитники' : /MF|Mid/i.test(player.pos) ? 'Полузащитники' : /FW|Att|For/i.test(player.pos) ? 'Нападающие' : 'Игроки';
      if (!groups.has(position)) groups.set(position, []);
      groups.get(position).push(player);
    });
    return [...groups.entries()].map(([position, players]) => `<div class="position-group"><h4>${position}</h4><div class="squad-grid stagger-list">${players.map(player => `<button class="squad-card reveal interactive-player" type="button" data-open-player="${playerData(player)}" aria-label="Профиль ${escapeHtml(player.name)}">${avatarMarkup(player, false, true)}<div><strong>${player.number ? `${escapeHtml(player.number)} · ` : ''}${escapeHtml(player.name)}</strong><span>${escapeHtml(player.pos || position)}${player.age ? ` · ${escapeHtml(player.age)} лет` : ''}</span></div>${player.rating ? `<b class="rating-badge">${escapeHtml(player.rating)}</b>` : ''}<span class="squad-card-arrow">${icon('arrow', 'tiny-icon')}</span></button>`).join('')}</div></div>`).join('');
  }

  function renderTeamPage() {
    const team = findTeam(state.teamKey);
    if (!team) {
      $('#mainPanel').innerHTML = `<div class="empty"><strong>Сборная не найдена</strong><button class="hero-button" type="button" data-route="teams">Вернуться к списку</button></div>`;
      return;
    }
    const record = teamRecord(team);
    const details = state.teamDetails.get(teamKey(team));
    const finished = record.matches.filter(match => match.status === 'finished').slice(-4).reverse();
    const upcoming = record.matches.filter(match => match.status === 'live' || match.status === 'upcoming').slice(0, 6);
    $('#mainPanel').innerHTML = `${teamHero(team, record, details)}
      <section class="team-page-section reveal"><div class="panel-header"><div><h3>Матчи сборной</h3><div class="panel-subtitle">Ближайшие игры и последние результаты</div></div></div>
        ${upcoming.length ? `<h4 class="subheading">Ближайшие</h4>${matchList(upcoming)}` : ''}
        ${finished.length ? `<h4 class="subheading">Последние результаты</h4>${matchList(finished)}` : ''}
        ${!upcoming.length && !finished.length ? '<div class="empty"><strong>Матчи пока не найдены</strong></div>' : ''}
      </section>
      <section class="team-page-section reveal"><div class="panel-header"><div><h3>Состав</h3><div class="panel-subtitle">Фотографии и позиции игроков</div></div>${state.teamLoading.has(teamKey(team)) ? '<span class="loader mini-loader"></span>' : ''}</div>${squadGrid(details)}</section>
    `;
    ensureTeamDetails(team);
  }

  function renderFavorites() {
    const matches = state.snapshot.matches.filter(match => state.favoriteMatches.has(String(match.id)));
    const teams = allTeams().filter(team => state.favoriteTeams.has(teamKey(team)));
    $('#mainPanel').innerHTML = `<div class="panel-header reveal"><div><div class="eyebrow accent">Персональный центр</div><h2>Избранное</h2><div class="panel-subtitle">Любимые сборные и матчи на этом устройстве</div></div></div>
      <h3 class="section-heading">Сборные</h3>${teams.length ? `<div class="team-grid">${teams.map(teamCard).join('')}</div>` : '<div class="empty compact"><strong>Добавь любимую сборную</strong><span>Открой страницу команды и нажми «Следить».</span></div>'}
      <h3 class="section-heading">Матчи</h3>${matchList(matches)}
    `;
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
    else if (state.route === 'teams') renderTeams();
    else if (state.route === 'team') renderTeamPage();
    else if (state.route === 'players') renderPlayers();
    else if (state.route === 'favorites') renderFavorites();
    else renderToday();
  }

  function renderSidePanel() {
    if (!state.snapshot) { $('#sidePanel').innerHTML = '<div class="state-box">Загрузка…</div>'; return; }
    const now = Date.now();
    const nearest = state.snapshot.matches.filter(match => match.status === 'live' || new Date(match.startingAt).getTime() >= now).slice(0, 3);
    const favorites = allTeams().filter(team => state.favoriteTeams.has(teamKey(team))).slice(0, 5);
    const players = state.snapshot.leaders.scorers.slice(0, 4);
    $('#sidePanel').innerHTML = `
      <div class="panel-header"><div><div class="eyebrow accent">Далее</div><h2>Ближайшее</h2></div></div>${matchList(nearest, { hideFavorite: true })}
      ${favorites.length ? `<hr class="divider"><div class="panel-header"><div><h2>Мои сборные</h2></div></div><div class="compact-team-list">${favorites.map(team => `<button type="button" data-open-team="${escapeHtml(teamKey(team))}">${flagMarkup(team, true)}<span>${escapeHtml(team.name)}</span>${icon('arrow', 'tiny-icon')}</button>`).join('')}</div>` : ''}
      ${players.length ? `<hr class="divider"><div class="panel-header"><div><h2>Бомбардиры</h2></div></div>${playerRows(players, 'голов')}` : ''}
    `;
  }

  function render() {
    applyTheme();
    renderNavigation();
    renderConnection();
    renderSummary();
    renderMainPanel();
    renderSidePanel();
    $('#buildLabel').textContent = `Сборка ${CONFIG.build}`;
    updateNotificationUi();
    bindDynamicEvents();
    bindMediaFallbacks();
    activateRevealAnimations();
  }

  function bindDynamicEvents() {
    $$('[data-route]').forEach(button => button.addEventListener('click', () => setRoute(button.dataset.route)));
    $$('[data-open-match]').forEach(button => button.addEventListener('click', () => openMatch(button.dataset.openMatch)));
    $$('[data-open-player]').forEach(element => {
      const action = () => {
        let seed = {};
        try { seed = JSON.parse(decodeURIComponent(element.dataset.openPlayer || '')); } catch { seed = {}; }
        openPlayer(seed);
      };
      element.addEventListener('click', event => { if (event.target.closest('[data-open-team]')) return; action(); });
      element.addEventListener('keydown', event => { if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('[data-open-team]')) { event.preventDefault(); action(); } });
    });
    $$('[data-open-team]').forEach(element => {
      const action = () => {
        const team = findTeam(element.dataset.openTeam);
        if (team) openTeam(team);
      };
      element.addEventListener('click', event => { event.stopPropagation(); action(); });
      if (element.tagName === 'TR') element.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') action(); });
    });
    $$('[data-favorite-match]').forEach(button => button.addEventListener('click', event => {
      event.stopPropagation();
      const id = String(button.dataset.favoriteMatch);
      if (state.favoriteMatches.has(id)) state.favoriteMatches.delete(id); else state.favoriteMatches.add(id);
      saveSet(CONFIG.favoritesStorageKey, state.favoriteMatches);
      render();
    }));
    $$('[data-favorite-team]').forEach(button => button.addEventListener('click', () => {
      toggleFavoriteTeam(button.dataset.favoriteTeam);
    }));
    $$('[data-date]').forEach(button => button.addEventListener('click', () => { state.selectedDate = button.dataset.date; render(); }));
    $('[data-jump-today]')?.addEventListener('click', () => { state.selectedDate = formatDayKey(new Date().toISOString()); render(); });
    $('#datePicker')?.addEventListener('change', event => { if (event.target.value) { state.selectedDate = event.target.value; render(); } });
    $('#teamSearch')?.addEventListener('input', event => {
      const query = event.target.value.trim().toLowerCase();
      const teams = allTeams().filter(team => `${team.name} ${team.short}`.toLowerCase().includes(query));
      $('#teamGrid').innerHTML = teams.length ? teams.map(teamCard).join('') : '<div class="empty compact"><strong>Ничего не найдено</strong></div>';
      bindDynamicEvents(); bindMediaFallbacks($('#teamGrid')); activateRevealAnimations($('#teamGrid'));
    });
  }

  function activateRevealAnimations(root = document) {
    const elements = $$('.reveal:not(.revealed)', root);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      elements.forEach(element => element.classList.add('revealed'));
      return;
    }
    if (!('IntersectionObserver' in window)) {
      elements.forEach(element => element.classList.add('revealed'));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '40px' });
    elements.forEach((element, index) => {
      element.style.transitionDelay = element.style.getPropertyValue('--delay') || `${Math.min(index * 22, 180)}ms`;
      observer.observe(element);
    });
  }

  async function fetchJson(url, timeout = CONFIG.requestTimeoutMs) {
    if (String(url).startsWith('direct://wc26')) {
      if (!window.WC26_DIRECT_API) throw new Error('Direct data module is unavailable');
      let timer;
      try {
        return await Promise.race([
          window.WC26_DIRECT_API.request(url),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new DOMException('Timeout', 'AbortError')), timeout); })
        ]);
      } finally { clearTimeout(timer); }
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { mode: 'cors', cache: 'no-store', headers: { Accept: 'application/json' }, signal: controller.signal });
      const text = await response.text();
      let payload;
      try { payload = text ? JSON.parse(text) : {}; } catch { payload = { detail: text.slice(0, 240) }; }
      if (!response.ok) throw new Error(payload.detail || payload.error || `HTTP ${response.status}`);
      return payload;
    } finally { clearTimeout(timer); }
  }

  function loadCachedSnapshot() {
    try {
      const value = localStorage.getItem(CONFIG.cacheStorageKey);
      return value ? normalizeSnapshot(JSON.parse(value)) : null;
    } catch { return null; }
  }

  function saveSnapshot(snapshot) {
    try { localStorage.setItem(CONFIG.cacheStorageKey, JSON.stringify(snapshot)); } catch { /* private mode */ }
  }

  function matchSignature(match) {
    return `${formatDayKey(match.startingAt)}|${teamKey(match.home)}|${teamKey(match.away)}`;
  }

  function monitoredMatch(match) {
    return state.favoriteMatches.has(String(match.id)) || state.favoriteTeams.has(teamKey(match.home)) || state.favoriteTeams.has(teamKey(match.away));
  }

  function detectMatchChanges(previous, current) {
    state.changedMatchIds.clear();
    if (!previous?.matches?.length || !current?.matches?.length) return;
    const oldMap = new Map(previous.matches.map(match => [matchSignature(match), match]));
    for (const match of current.matches) {
      const old = oldMap.get(matchSignature(match));
      if (!old) continue;
      const scoreChanged = safeNumber(match.home.score, -1) !== safeNumber(old.home.score, -1) || safeNumber(match.away.score, -1) !== safeNumber(old.away.score, -1);
      if (scoreChanged) state.changedMatchIds.add(String(match.id));
      if (!state.notificationsEnabled || !monitoredMatch(match)) continue;
      if (old.status !== 'live' && match.status === 'live') {
        sendSystemNotification(`Матч начался: ${match.home.name} — ${match.away.name}`, `Счёт ${scoreText(match)}. Нажмите, чтобы открыть Match Center.`, `start-${matchSignature(match)}`, `#today`);
      }
      const oldHome = nullableNumber(old.home.score) ?? 0;
      const oldAway = nullableNumber(old.away.score) ?? 0;
      const newHome = nullableNumber(match.home.score) ?? 0;
      const newAway = nullableNumber(match.away.score) ?? 0;
      if (newHome > oldHome || newAway > oldAway) {
        const scorerTeam = newHome > oldHome ? match.home.name : match.away.name;
        sendSystemNotification(`Гол! ${scorerTeam}`, `${match.home.name} ${newHome}:${newAway} ${match.away.name}`, `goal-${matchSignature(match)}-${newHome}-${newAway}`, `#today`);
      }
    }
  }

  async function loadLeaders() {
    if (!state.snapshot || state.leadersLoading) return;
    state.leadersLoading = true;
    if (state.route === 'players') render();
    try {
      const payload = await fetchJson(`${CONFIG.apiBase}/api/leaders?v=${encodeURIComponent(CONFIG.build)}`, 12000);
      const normalized = normalizeSnapshot({ matches: state.snapshot.matches, standings: state.snapshot.standings, leaders: payload });
      state.snapshot.leaders = normalized.leaders;
      state.leadersLoaded = true;
      saveSnapshot(state.snapshot);
      void ensureLeaderPhotos();
    } catch { /* quick snapshot leaders remain available */ }
    finally {
      state.leadersLoading = false;
      if (state.route === 'players' || state.route === 'today') render();
    }
  }

  async function loadSnapshot({ manual = false } = {}) {
    if (state.refreshing) return;
    state.refreshing = true;
    if (!state.snapshot) state.loading = true;
    $('#refreshButton').classList.add('loading');
    renderConnection();
    const previous = state.snapshot;
    try {
      const raw = await fetchJson(`${CONFIG.apiBase}/api/snapshot?v=${encodeURIComponent(CONFIG.build)}`);
      const snapshot = normalizeSnapshot(raw);
      if (!snapshot.matches.length) throw new Error('Пустое расписание');
      state.snapshot = snapshot;
      state.sourceMode = 'live';
      state.error = '';
      detectMatchChanges(previous, snapshot);
      saveSnapshot(snapshot);
      void loadLeaders();
      if (manual) showToast('Данные обновлены');
    } catch (error) {
      state.error = error.name === 'AbortError' ? 'timeout' : String(error.message || 'network');
      const cached = loadCachedSnapshot();
      if (cached?.matches?.length) { state.snapshot = cached; state.sourceMode = 'cache'; }
      else { state.snapshot = normalizeSnapshot(DEMO); state.sourceMode = 'demo'; }
      if (manual) showToast('Не удалось обновить данные. Показана сохранённая версия.');
    } finally {
      state.loading = false;
      state.refreshing = false;
      $('#refreshButton').classList.remove('loading');
      render();
      scheduleRefresh();
      scheduleKickoffNotifications();
      setTimeout(() => state.changedMatchIds.clear(), 2200);
    }
  }

  function scheduleRefresh() {
    clearTimeout(state.refreshTimer);
    const hasLive = state.snapshot?.matches.some(match => match.status === 'live');
    state.refreshTimer = setTimeout(() => loadSnapshot(), hasLive ? CONFIG.snapshotRefreshLiveMs : CONFIG.snapshotRefreshIdleMs);
  }

  function loadTeamCache() {
    try { return JSON.parse(localStorage.getItem(CONFIG.teamCacheStorageKey) || '{}'); } catch { return {}; }
  }

  function saveTeamCache(cache) {
    try { localStorage.setItem(CONFIG.teamCacheStorageKey, JSON.stringify(cache)); } catch { /* ignore */ }
  }

  async function ensureTeamDetails(team) {
    const key = teamKey(team);
    if (state.teamDetails.has(key) || state.teamLoading.has(key)) return;
    const cache = loadTeamCache();
    const cached = cache[key];
    if (cached && Date.now() - safeNumber(cached.cachedAt) < 12 * 60 * 60 * 1000) {
      const details = normalizeTeamDetails(cached.data, team);
      state.teamDetails.set(key, details);
      render();
      void ensureTeamPhotos(team, details);
      return;
    }
    state.teamLoading.add(key);
    try {
      const url = new URL(`${CONFIG.apiBase}/api/team`);
      url.searchParams.set('name', team.name);
      url.searchParams.set('id', team.id || '');
      url.searchParams.set('code', team.countryCode || '');
      url.searchParams.set('v', CONFIG.build);
      const raw = await fetchJson(url.toString(), 12000);
      const details = normalizeTeamDetails(raw, team);
      state.teamDetails.set(key, details);
      cache[key] = { cachedAt: Date.now(), data: raw };
      saveTeamCache(cache);
      void ensureTeamPhotos(team, details);
    } catch {
      state.teamDetails.set(key, normalizeTeamDetails({ team, squad: [] }, team));
      showToast('Состав этой сборной пока недоступен. Расписание и статистика сохранены.');
    } finally {
      state.teamLoading.delete(key);
      if (state.route === 'team' && state.teamKey === key) render();
    }
  }

  async function ensureTeamPhotos(team, details = state.teamDetails.get(teamKey(team))) {
    const key = teamKey(team);
    if (!details?.squad?.length || state.teamPhotosLoading.has(key)) return;
    state.teamPhotosLoading.add(key);
    try {
      const needsMedia = details.squad.slice();
      if (!needsMedia.length) return;
      const chunks = [];
      for (let index = 0; index < needsMedia.length; index += 6) chunks.push(needsMedia.slice(index, index + 6));
      const queue = chunks.slice();
      const workers = Array.from({ length: Math.min(1, queue.length) }, async () => {
        while (queue.length) {
          const chunk = queue.shift();
          let rows = [];
          try { rows = await fetchPlayerMediaBatch(chunk, team.name || ''); } catch { rows = []; }
          if (!rows.length) continue;
          const byName = new Map(rows.map(row => [slug(row.name), row]));
          let changed = false;
          details.squad = details.squad.map(player => {
            const media = byName.get(slug(player.name));
            if (!media) return player;
            changed = true;
            return mergePlayerMedia(player, media);
          });
          if (changed) {
            state.teamDetails.set(key, details);
            if (state.route === 'team' && state.teamKey === key) render();
          }
        }
      });
      await Promise.allSettled(workers);
    } finally {
      state.teamPhotosLoading.delete(key);
    }
  }

  async function ensureLeaderPhotos() {
    if (!state.snapshot?.leaders) return;
    const groups = ['scorers', 'assists', 'ratings'];
    const all = groups.flatMap(group => state.snapshot.leaders[group] || []);
    const missing = all.slice();
    if (!missing.length) return;
    const unique = [];
    const seen = new Set();
    for (const player of missing) {
      const key = `${slug(player.name)}|${slug(player.team)}`;
      if (!seen.has(key)) { seen.add(key); unique.push(player); }
    }
    const chunks = [];
    for (let index = 0; index < unique.length; index += 8) chunks.push(unique.slice(index, index + 8));
    for (const chunk of chunks) {
      let rows = [];
      try { rows = await fetchPlayerMediaBatch(chunk); } catch { rows = []; }
      if (!rows.length) continue;
      const byKey = new Map(rows.map(row => [`${slug(row.name)}|${slug(row.team || '')}`, row]));
      const byName = new Map(rows.map(row => [slug(row.name), row]));
      for (const group of groups) {
        state.snapshot.leaders[group] = (state.snapshot.leaders[group] || []).map(player => {
          const media = byKey.get(`${slug(player.name)}|${slug(player.team)}`) || byName.get(slug(player.name));
          return media ? mergePlayerMedia(player, media) : player;
        });
      }
      saveSnapshot(state.snapshot);
      if (state.route === 'players' || state.route === 'today') render();
    }
  }

  async function ensureMatchPhotos(match = state.modalMatch) {
    if (!match?.id || state.matchPhotosLoading.has(String(match.id))) return;
    const players = [...(match.lineups?.home || []), ...(match.lineups?.away || [])];
    if (!players.length) return;
    state.matchPhotosLoading.add(String(match.id));
    try {
      const chunks = [];
      for (let index = 0; index < players.length; index += 8) chunks.push(players.slice(index, index + 8));
      for (const chunk of chunks) {
        let rows = [];
        try { rows = await fetchPlayerMediaBatch(chunk); } catch { rows = []; }
        if (!rows.length) continue;
        const byName = new Map(rows.map(row => [slug(row.name), row]));
        for (const side of ['home', 'away']) {
          match.lineups[side] = (match.lineups[side] || []).map(player => {
            const media = byName.get(slug(player.name));
            return media ? mergePlayerMedia(player, media) : player;
          });
        }
        if (state.modalMatch && String(state.modalMatch.id) === String(match.id)) {
          state.modalMatch = match;
          renderModal();
        }
      }
    } finally {
      state.matchPhotosLoading.delete(String(match.id));
    }
  }

  function renderModalScoreboard(match) {
    return `<div class="modal-scoreboard">
      <button class="modal-team" type="button" data-open-team="${escapeHtml(teamKey(match.home))}">${flagMarkup(match.home)}<strong>${escapeHtml(match.home.name)}</strong><span class="muted">${escapeHtml(match.home.short)}</span></button>
      <div class="modal-score"><strong>${escapeHtml(scoreText(match))}</strong><div class="match-meta">${statusMarkup(match)}</div></div>
      <button class="modal-team away" type="button" data-open-team="${escapeHtml(teamKey(match.away))}">${flagMarkup(match.away)}<strong>${escapeHtml(match.away.name)}</strong><span class="muted">${escapeHtml(match.away.short)}</span></button>
    </div>`;
  }

  function renderH2H(match) {
    const h2h = match.h2h || {};
    const rows = Array.isArray(h2h.matches) ? h2h.matches : [];
    if (!rows.length) return '<div class="empty compact"><strong>Подтверждённые личные встречи не найдены</strong><span>Вместо нулевой статистики показываем только реально найденные матчи из открытых источников.</span></div>';
    const summary = `<div class="h2h-grid"><div class="h2h-item"><strong>${safeNumber(h2h.homeWins)}</strong><span>Победы ${escapeHtml(match.home.short)}</span></div><div class="h2h-item"><strong>${safeNumber(h2h.draws)}</strong><span>Ничьи</span></div><div class="h2h-item"><strong>${safeNumber(h2h.awayWins)}</strong><span>Победы ${escapeHtml(match.away.short)}</span></div></div>`;
    const list = `<div class="h2h-match-list">${rows.map(row => `<article class="h2h-match-row"><div><strong>${escapeHtml(row.home || '—')} — ${escapeHtml(row.away || '—')}</strong><span>${escapeHtml(row.competition || 'Международный матч')}</span></div><b>${escapeHtml(row.homeScore ?? '—')} : ${escapeHtml(row.awayScore ?? '—')}</b><time>${escapeHtml(formatDateTime(row.date, { day: '2-digit', month: 'short', year: 'numeric' }))}</time></article>`).join('')}</div>`;
    return `${summary}<div class="h2h-scope">${escapeHtml(h2h.scope || 'Найденные встречи')}</div>${list}`;
  }

  function renderModalOverview(match) {
    return `<div class="detail-grid"><div class="detail-card"><h3>Информация</h3><p><strong>Стадия:</strong> ${escapeHtml(match.stage || '—')}</p><p><strong>Начало:</strong> ${escapeHtml(formatDateTime(match.startingAt, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))}</p><p><strong>Стадион:</strong> ${escapeHtml([match.venue, match.city].filter(Boolean).join(', ') || 'Уточняется')}</p></div><div class="detail-card"><h3>Личные встречи</h3>${renderH2H(match)}</div></div>`;
  }

  function renderEvents(match) {
    const events = match.events || [];
    if (!events.length) return '<div class="empty compact"><strong>События появятся после начала матча</strong></div>';
    return `<div class="event-list">${events.map(event => {
      const playerName = String(event.playerName || '').trim();
      let text = String(event.text || event.type || '').trim();
      if (/^Гол\s*[—-]\s*(игрок|player)$/i.test(text)) text = playerName ? `Гол — ${playerName}` : 'Гол';
      if (!text) text = event.scoringPlay ? (playerName ? `Гол — ${playerName}` : 'Гол') : 'Событие';
      const player = normalizePlayer({
        id: event.playerId || '', apiId: event.apiId || '', espnId: event.espnId || event.playerId || '',
        name: playerName || 'Игрок', photo: event.photo || ''
      });
      const side = event.team === 'away' ? ' away' : ' home';
      return `<div class="event-row${side}${playerName ? ' interactive-player' : ''}"${playerName ? ` data-open-player="${playerData({ ...player, team: event.teamName || '' })}" tabindex="0" role="button"` : ''}><span class="event-minute">${escapeHtml(event.minute ?? event.time ?? '')}′</span><span class="event-icon">${escapeHtml(event.icon || '•')}</span>${playerName || event.photo ? avatarMarkup(player, true) : '<span class="event-avatar-placeholder"></span>'}<span class="event-copy"><strong>${escapeHtml(text)}</strong>${event.teamName ? `<small>${escapeHtml(event.teamName)}</small>` : ''}</span></div>`;
    }).join('')}</div>`;
  }

  function renderStats(match) {
    const stats = match.stats || {};
    if (!Object.keys(stats).length) return '<div class="empty compact"><strong>Статистика появится во время матча</strong></div>';
    const rows = Object.entries(STAT_LABELS).map(([key, label]) => {
      const pair = Array.isArray(stats[key]) ? stats[key] : [0, 0];
      const home = safeNumber(pair[0]); const away = safeNumber(pair[1]); const total = Math.max(home + away, 1);
      const suffix = key === 'possession' ? '%' : '';
      return `<div class="stat-line"><div class="stat-labels"><strong>${home}${suffix}</strong><span>${escapeHtml(label)}</span><strong>${away}${suffix}</strong></div><div class="dual-bar"><span class="home" style="width:${Math.max(2, home / total * 100)}%"></span><span class="away" style="width:${Math.max(2, away / total * 100)}%"></span></div></div>`;
    });
    return `<div class="stat-bars">${rows.join('')}</div>`;
  }

  function lineupPlayerMarkup(player) {
    const normalized = normalizePlayer(player);
    return `<div class="lineup-player interactive-player" data-open-player="${playerData(normalized)}" tabindex="0" role="button">${avatarMarkup(normalized, true)}<div><div class="player-name">${normalized.number ? `${escapeHtml(normalized.number)} · ` : ''}${escapeHtml(normalized.name)}</div><div class="player-team">${escapeHtml(normalized.pos || (normalized.starter ? 'Старт' : 'Запас'))}</div></div>${normalized.rating ? `<span class="rating-badge" title="Расчётная оценка по доступной статистике">${escapeHtml(normalized.rating)}</span>` : ''}${icon('arrow', 'tiny-icon lineup-arrow')}</div>`;
  }

  function renderLineups(match) {
    const home = match.lineups?.home || []; const away = match.lineups?.away || [];
    if (!home.length && !away.length) return '<div class="empty compact"><strong>Составы появятся ближе к началу матча</strong></div>';
    return `<div class="lineup-columns"><div class="detail-card"><h3>${escapeHtml(match.home.name)}</h3><div class="lineup-list">${home.map(lineupPlayerMarkup).join('')}</div></div><div class="detail-card"><h3>${escapeHtml(match.away.name)}</h3><div class="lineup-list">${away.map(lineupPlayerMarkup).join('')}</div></div></div>`;
  }

  function renderModal() {
    const modal = $('#matchModal');
    const match = state.modalMatch;
    if (!match) return;
    $('#modalTitle').textContent = `${match.home.name} — ${match.away.name}`;
    const tabs = [['overview', 'Обзор'], ['events', 'События'], ['stats', 'Статистика'], ['lineups', 'Составы'], ['h2h', 'Личные встречи']];
    let body = '';
    if (state.modalLoading) body = '<div class="state-box"><div><span class="loader"></span><p>Загружаю подробности матча…</p></div></div>';
    else if (state.modalTab === 'events') body = renderEvents(match);
    else if (state.modalTab === 'stats') body = renderStats(match);
    else if (state.modalTab === 'lineups') body = renderLineups(match);
    else if (state.modalTab === 'h2h') body = renderH2H(match);
    else body = renderModalOverview(match);
    $('#modalContent').innerHTML = `${renderModalScoreboard(match)}<div class="modal-tabs">${tabs.map(([id, label]) => `<button class="modal-tab${state.modalTab === id ? ' active' : ''}" type="button" data-modal-tab="${id}">${label}</button>`).join('')}</div>${body}`;
    $$('[data-modal-tab]').forEach(button => button.addEventListener('click', () => { state.modalTab = button.dataset.modalTab; renderModal(); bindMediaFallbacks($('#modalContent')); if (state.modalTab === 'lineups') void ensureMatchPhotos(state.modalMatch); }));
    $$('[data-open-team]', $('#modalContent')).forEach(button => button.addEventListener('click', event => { event.stopPropagation(); closeMatchModal(); const team = findTeam(button.dataset.openTeam); if (team) openTeam(team); }));
    $$('[data-open-player]', $('#modalContent')).forEach(element => {
      const action = () => { let seed = {}; try { seed = JSON.parse(decodeURIComponent(element.dataset.openPlayer || '')); } catch { seed = {}; } closeMatchModal(); openPlayer(seed); };
      element.addEventListener('click', event => { if (event.target.closest('[data-open-team]')) return; action(); });
      element.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); } });
    });
    bindMediaFallbacks($('#modalContent'));
    modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
  }

  async function openMatch(id) {
    const base = state.snapshot.matches.find(match => String(match.id) === String(id));
    if (!base) return;
    state.modalMatch = base; state.modalTab = 'overview'; state.modalLoading = true; renderModal();
    try {
      const payload = await fetchJson(`${CONFIG.apiBase}/api/match?id=${encodeURIComponent(id)}&v=${encodeURIComponent(CONFIG.build)}`);
      if (payload.match) state.modalMatch = normalizeMatch(payload.match);
    } catch { showToast('Подробные данные матча пока недоступны.'); }
    finally { state.modalLoading = false; renderModal(); void ensureMatchPhotos(state.modalMatch); }
  }

  function closeMatchModal() {
    $('#matchModal').classList.remove('open'); $('#matchModal').setAttribute('aria-hidden', 'true');
    if (!state.notificationModalOpen) document.body.style.overflow = '';
  }


  function statCard(label, value, hint = '') {
    return `<div class="player-stat-card"><strong>${metricValue(value)}</strong><span>${escapeHtml(label)}</span>${hint ? `<small>${escapeHtml(hint)}</small>` : ''}</div>`;
  }

  function formatPlayerPosition(position) {
    const value = String(position || '').toUpperCase();
    if (/GK|GOAL/.test(value)) return 'Вратарь';
    if (/DF|DEF/.test(value)) return 'Защитник';
    if (/MF|MID/.test(value)) return 'Полузащитник';
    if (/FW|ATT|FOR/.test(value)) return 'Нападающий';
    return position || 'Футболист';
  }

  function renderPlayerHero(profile) {
    const player = normalizePlayer({ ...state.playerSeed, ...(profile?.player || {}), photoCandidates: profile?.player?.photoCandidates || state.playerSeed?.photoCandidates || [] });
    const verifiedClubName = verifiedClubForName(player.name);
    const club = verifiedClubName ? { ...(profile?.currentClub || {}), name: verifiedClubName } : (profile?.currentClub || {});
    const status = profile?.status || (club.name ? 'Действующий игрок' : 'Статус клуба уточняется');
    const clubLogo = club.logo ? `<span class="club-logo"><img class="media-fallback" alt="" data-media-candidates="${encodedCandidates([mediaProxy(club.logo), club.logo])}"></span>` : '<span class="club-logo fallback-club">FC</span>';
    return `<section class="player-profile-hero">
      <div class="player-profile-photo">${avatarMarkup(player, false, true)}</div>
      <div class="player-profile-copy"><div class="eyebrow accent">Профиль футболиста</div><h2>${escapeHtml(player.name)}</h2><div class="player-meta-line"><span>${escapeHtml(formatPlayerPosition(player.pos || profile?.position))}</span>${player.number ? `<span>№ ${escapeHtml(player.number)}</span>` : ''}${profile?.player?.age ? `<span>${escapeHtml(profile.player.age)} лет</span>` : ''}</div>
        <div class="current-club-card">${clubLogo}<div><small>Текущий клуб / статус</small><strong>${escapeHtml(club.name || status)}</strong><span>${club.name && status ? escapeHtml(status) : ''}</span></div></div>
      </div>
      <div class="player-bio-grid"><span><small>Гражданство</small><strong>${escapeHtml(profile?.player?.nationality || player.nationality || player.team || '—')}</strong></span><span><small>Дата рождения</small><strong>${escapeHtml(profile?.player?.birth?.date || player.birth?.date || '—')}</strong></span><span><small>Рост</small><strong>${escapeHtml(normalizeHeightText(profile?.player?.height || player.height))}</strong></span><span><small>Вес</small><strong>${escapeHtml(normalizeWeightText(profile?.player?.weight || player.weight))}</strong></span></div>
    </section>`;
  }

  function renderPlayerOverview(profile) {
    const total = profile?.nationalCareer || {};
    const wc = profile?.worldCup2026 || {};
    const biography = profile?.biography ? `<div class="player-biography"><h4>О футболисте</h4><p>${escapeHtml(profile.biography)}</p></div>` : '';
    const links = (profile?.externalLinks || []).filter(item => /^https:\/\//.test(item.url || ''));
    return `<div class="player-profile-section"><div class="profile-section-heading"><div><div class="eyebrow">Карьера в сборной</div><h3>Главные показатели</h3></div></div>
      <div class="player-stat-grid">${statCard('Матчи за сборную', total.appearances ?? wc.appearances)}${statCard('Минуты на ЧМ‑2026', wc.minutes ?? total.minutes)}${statCard('Голы за сборную', total.goals ?? wc.goals)}${statCard('Ассисты на ЧМ‑2026', wc.assists ?? total.assists)}${statCard('Средняя оценка', total.rating)}${statCard('Турниры', total.tournaments)}</div>
      <div class="profile-callout"><span class="profile-callout-icon">${icon('trophy')}</span><div><strong>ЧМ‑2026</strong><span>${metricValue(wc.appearances)} матчей · ${metricValue(wc.goals)} голов · ${metricValue(wc.assists)} ассистов${wc.cleanSheets !== null && wc.cleanSheets !== undefined ? ` · ${metricValue(wc.cleanSheets)} сухих матчей` : ''}</span></div></div>
      ${biography}
      ${links.length ? `<div class="player-source-links">${links.map(item => `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.label)}${icon('arrow','tiny-icon')}</a>`).join('')}</div>` : ''}
    </div>`;
  }

  function renderWorldCupPlayerStats(profile) {
    const stats = profile?.worldCup2026 || {};
    const goalkeeper = Boolean(stats.isGoalkeeper);
    const cards = [
      ['Матчи', stats.appearances], ['В старте', stats.lineups], ['Минуты', stats.minutes],
      ['Голы', stats.goals], ['Ассисты', stats.assists], ['Удары', stats.shots],
      ['Удары в створ', stats.shotsOnTarget], ['Точные передачи', stats.passes], ['Ключевые передачи', stats.keyPasses],
      ['Отборы', stats.tackles], ['Перехваты', stats.interceptions], ['Успешные обводки', stats.dribbles],
      ['Жёлтые карточки', stats.yellowCards], ['Красные карточки', stats.redCards], ['Расчётная оценка', stats.rating]
    ];
    if (goalkeeper) cards.splice(5, 0, ['Сейвы', stats.saves], ['Пропущено', stats.conceded], ['Сухие матчи', stats.cleanSheets]);
    return `<div class="player-profile-section"><div class="profile-section-heading"><div><div class="eyebrow">FIFA World Cup 2026</div><h3>Статистика на турнире</h3></div>${goalkeeper ? '<span class="position-pill">Вратарь</span>' : ''}</div>
      <div class="player-stat-grid extended">${cards.map(([label, value]) => statCard(label, value)).join('')}</div>
      ${state.playerStatsLoading ? '<div class="profile-data-loading"><span class="loader mini-loader"></span><span>Уточняем расширенную статистику в фоне…</span></div>' : (!safeNumber(stats.appearances) ? '<div class="empty compact"><strong>На турнире пока нет подтверждённых минут</strong><span>Показатели обновятся после публикации протоколов.</span></div>' : '')}
    </div>`;
  }

  function renderHistory(profile) {
    const years = Array.from({ length: 17 }, (_, index) => 2026 - index);
    const history = state.playerHistory.get(state.playerHistorySeason);
    return `<div class="player-profile-section"><div class="profile-section-heading"><div><div class="eyebrow">Сборная по сезонам</div><h3>Турниры и показатели</h3></div><label class="history-year-select">Сезон<select id="playerHistoryYear">${years.map(year => `<option value="${year}"${year === state.playerHistorySeason ? ' selected' : ''}>${year}</option>`).join('')}</select></label></div>
      ${state.playerHistoryLoading ? '<div class="state-box compact-state"><span class="loader"></span><p>Загружаю сезон…</p></div>' : history ? renderHistoryRows(history) : '<div class="empty compact"><strong>Выбери сезон</strong><span>Статистика загрузится по запросу и сохранится в кэше.</span></div>'}
    </div>`;
  }

  function renderHistoryRows(history) {
    const tournaments = history?.tournaments || [];
    if (!tournaments.length) return '<div class="empty compact"><strong>Выступления за сборную не найдены</strong><span>Для этого сезона структурированная статистика не найдена. Проверь другой год.</span></div>';
    return `<div class="history-timeline">${tournaments.map(item => `<article class="history-card"><div class="history-season-mark">${escapeHtml(history.season)}</div><div class="history-card-main"><strong>${escapeHtml(item.competition || 'Турнир')}</strong><span>${escapeHtml(item.team || profileTeamName())}</span></div><div class="history-mini-stats"><span><b>${metricValue(item.appearances)}</b> матчей</span><span><b>${metricValue(item.goals)}</b> голов</span><span><b>${metricValue(item.assists)}</b> ассистов</span><span><b>${metricValue(item.rating)}</b> оценка</span></div>${item.note ? `<small class="history-note">${escapeHtml(item.note)}</small>` : ''}</article>`).join('')}</div>`;
  }

  function profileTeamName() {
    return state.playerProfile?.player?.nationality || state.playerSeed?.team || 'Сборная';
  }


  function renderTrophyShelf(profile) {
    const teamTrophies = profile?.trophies || [];
    const awards = profile?.individualAwards || [];
    if (!teamTrophies.length && !awards.length) return '<div class="empty"><strong>Международные награды пока не найдены</strong><span>Клубные трофеи намеренно не учитываются.</span></div>';
    const trophyMedia = item => {
      const local = localTrophyAssets(item);
      const candidates = [...local, item.image, item.image ? mediaProxy(item.image) : ''].filter(Boolean);
      return `<span class="trophy-photo"><img class="media-fallback" src="${escapeHtml(local[0])}" loading="eager" fetchpriority="high" decoding="async" alt="${escapeHtml(item.title || item.competition || 'Международный трофей')}" data-media-candidates="${encodedCandidates(candidates)}"><span class="trophy-vector-fallback">${icon('trophy')}</span></span>`;
    };
    return `<div class="player-profile-section"><div class="profile-section-heading"><div><div class="eyebrow">Витрина достижений</div><h3>Трофеи со сборной</h3></div><span class="data-quality-badge">Только международные достижения</span></div>
      ${teamTrophies.length ? `<div class="trophy-shelf">${teamTrophies.map(item => `<article class="trophy-card">${trophyMedia(item)}<div><strong>${escapeHtml(item.title || item.competition)}</strong><span>${escapeHtml(item.competition || '')}${item.season ? ` · ${escapeHtml(item.season)}` : ''}</span><small>${escapeHtml(item.place || 'Победитель')}</small></div></article>`).join('')}</div>` : '<div class="empty compact"><strong>Подтверждённые трофеи сборной не найдены</strong><span>Мы не показываем случайные клубные награды.</span></div>'}
      <div class="profile-section-heading secondary-heading"><div><div class="eyebrow">Личные достижения</div><h3>Награды на турнирах сборных</h3></div></div>
      ${awards.length ? `<div class="individual-awards">${awards.map(item => `<article>${trophyMedia(item)}<div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.tournament || '')}${item.year ? ` · ${escapeHtml(item.year)}` : ''}</small></div></article>`).join('')}</div>` : '<div class="empty compact"><strong>Международные индивидуальные награды не найдены</strong></div>'}
    </div>`;
  }

  function renderPlayerModal() {
    const modal = $('#playerModal');
    if (!modal || !state.playerSeed) return;
    const profile = state.playerProfile;
    $('#playerModalTitle').textContent = state.playerSeed.name || profile?.player?.name || 'Футболист';
    const tabs = [['overview', 'Обзор'], ['worldcup', 'ЧМ‑2026'], ['history', 'Сборная по годам'], ['trophies', 'Трофеи']];
    let body = '';
    if (state.playerLoading) body = '<div class="player-profile-loading"><div class="profile-skeleton-photo skeleton"></div><div class="profile-skeleton-lines"><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span></div></div>';
    else if (!profile) body = '<div class="empty"><strong>Подробный профиль пока недоступен</strong><span>Базовая карточка игрока сохранена, попробуй обновить позже.</span></div>';
    else if (state.playerTab === 'worldcup') body = renderWorldCupPlayerStats(profile);
    else if (state.playerTab === 'history') body = renderHistory(profile);
    else if (state.playerTab === 'trophies') body = renderTrophyShelf(profile);
    else body = renderPlayerOverview(profile);
    $('#playerModalContent').innerHTML = `${renderPlayerHero(profile)}<div class="modal-tabs player-tabs">${tabs.map(([id, label]) => `<button class="modal-tab${state.playerTab === id ? ' active' : ''}" type="button" data-player-tab="${id}">${label}</button>`).join('')}</div>${body}`;
    $$('[data-player-tab]', $('#playerModalContent')).forEach(button => button.addEventListener('click', async () => { state.playerTab = button.dataset.playerTab; renderPlayerModal(); if (state.playerTab === 'history') await ensurePlayerHistory(state.playerHistorySeason); }));
    $('#playerHistoryYear')?.addEventListener('change', async event => { state.playerHistorySeason = Number(event.target.value) || 2026; await ensurePlayerHistory(state.playerHistorySeason); });
    bindMediaFallbacks($('#playerModalContent'));
    modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
  }

  function loadPlayerCache() {
    try { return JSON.parse(localStorage.getItem(CONFIG.playerCacheStorageKey) || '{}'); } catch { return {}; }
  }

  function savePlayerCache(cache) {
    try { localStorage.setItem(CONFIG.playerCacheStorageKey, JSON.stringify(cache)); } catch { /* ignore */ }
  }

  async function openPlayer(seed) {
    state.playerSeed = normalizePlayer(seed || {});
    state.playerProfile = null;
    state.playerLoading = true;
    state.playerTab = 'overview';
    state.playerHistorySeason = 2026;
    state.playerHistory = new Map();
    const cacheKey = slug(`${state.playerSeed.name}-${state.playerSeed.team}`);
    const cache = loadPlayerCache();
    const cached = cache[cacheKey];
    if (cached && Date.now() - safeNumber(cached.cachedAt) < 24 * 60 * 60 * 1000) {
      state.playerProfile = cached.data;
      state.playerLoading = false;
    }
    renderPlayerModal();
    if (state.playerProfile) void ensurePlayerStats(cacheKey, cache);
    try {
      const url = new URL(`${CONFIG.apiBase}/api/player`);
      url.searchParams.set('id', state.playerSeed.id || '');
      url.searchParams.set('apiId', state.playerSeed.apiId || '');
      url.searchParams.set('espnId', state.playerSeed.espnId || '');
      url.searchParams.set('name', state.playerSeed.name || '');
      url.searchParams.set('team', state.playerSeed.team || '');
      url.searchParams.set('country', state.playerSeed.nationality || state.playerSeed.team || '');
      url.searchParams.set('v', CONFIG.build);
      const fresh = await fetchJson(url.toString(), 8000);
      state.playerProfile = fresh;
      cache[cacheKey] = { cachedAt: Date.now(), data: fresh };
      savePlayerCache(cache);
      void ensurePlayerStats(cacheKey, cache);
    } catch {
      if (!state.playerProfile) state.playerProfile = { player: state.playerSeed, currentClub: null, status: 'Подробные данные временно недоступны', worldCup2026: {}, nationalCareer: {}, trophies: [], individualAwards: [] };
    } finally {
      state.playerLoading = false;
      renderPlayerModal();
    }
  }

  async function ensurePlayerStats(cacheKey, cache) {
    if (!state.playerProfile || state.playerStatsLoading || !state.playerSeed) return;
    const current = state.playerProfile.worldCup2026 || {};
    const hasUsefulStats = safeNumber(current.appearances) > 0 || safeNumber(current.goals) > 0 || safeNumber(current.assists) > 0;
    if (hasUsefulStats && !state.playerProfile.statsPending) return;
    state.playerStatsLoading = true;
    try {
      const player = state.playerProfile.player || state.playerSeed;
      const url = new URL(`${CONFIG.apiBase}/api/player/stats`);
      url.searchParams.set('id', player.id || '');
      url.searchParams.set('apiId', player.apiId || '');
      url.searchParams.set('espnId', player.espnId || '');
      url.searchParams.set('name', player.name || state.playerSeed.name || '');
      url.searchParams.set('team', state.playerSeed.team || player.nationality || '');
      url.searchParams.set('country', player.nationality || state.playerSeed.team || '');
      url.searchParams.set('v', CONFIG.build);
      const payload = await fetchJson(url.toString(), 9000);
      if (payload?.worldCup2026) {
        state.playerProfile.worldCup2026 = payload.worldCup2026;
        state.playerProfile.national2026 = payload.worldCup2026;
        const career = state.playerProfile.nationalCareer || {};
        const tournament = payload.worldCup2026 || {};
        state.playerProfile.nationalCareer = {
          ...career,
          appearances: Math.max(safeNumber(career.appearances), safeNumber(tournament.appearances)),
          minutes: Math.max(safeNumber(career.minutes), safeNumber(tournament.minutes)),
          goals: Math.max(safeNumber(career.goals), safeNumber(tournament.goals)),
          assists: Math.max(safeNumber(career.assists), safeNumber(tournament.assists)),
          rating: tournament.rating ?? career.rating
        };
        state.playerProfile.statsPending = false;
        cache[cacheKey] = { cachedAt: Date.now(), data: state.playerProfile };
        savePlayerCache(cache);
      }
    } catch { /* profile remains usable without deep metrics */ }
    finally {
      state.playerStatsLoading = false;
      if ($('#playerModal')?.classList.contains('open')) renderPlayerModal();
    }
  }

  async function ensurePlayerHistory(season) {
    if (!(state.playerProfile?.player?.id || state.playerProfile?.player?.apiId || state.playerProfile?.player?.espnId || state.playerProfile?.player?.name) || state.playerHistory.has(season) || state.playerHistoryLoading) { renderPlayerModal(); return; }
    state.playerHistoryLoading = true; renderPlayerModal();
    try {
      const url = new URL(`${CONFIG.apiBase}/api/player/history`);
      url.searchParams.set('id', state.playerProfile.player.id || '');
      url.searchParams.set('apiId', state.playerProfile.player.apiId || '');
      url.searchParams.set('espnId', state.playerProfile.player.espnId || '');
      url.searchParams.set('name', state.playerProfile.player.name || state.playerSeed?.name || '');
      url.searchParams.set('season', season);
      url.searchParams.set('country', state.playerProfile.player.nationality || state.playerSeed?.team || '');
      url.searchParams.set('v', CONFIG.build);
      state.playerHistory.set(season, await fetchJson(url.toString(), 12000));
    } catch {
      state.playerHistory.set(season, { season, tournaments: [] });
    } finally {
      state.playerHistoryLoading = false; renderPlayerModal();
    }
  }

  function closePlayerModal() {
    $('#playerModal')?.classList.remove('open');
    $('#playerModal')?.setAttribute('aria-hidden', 'true');
    state.playerSeed = null; state.playerProfile = null; state.playerLoading = false;
    if (!state.notificationModalOpen && !$('#matchModal').classList.contains('open')) document.body.style.overflow = '';
  }

  function notificationPermissionLabel() {
    if (!('Notification' in window)) return 'Не поддерживаются';
    if (Notification.permission === 'denied') return 'Запрещены в браузере';
    return state.notificationsEnabled && Notification.permission === 'granted' ? 'Включены' : 'Выключены';
  }

  function updateNotificationUi() {
    const enabled = state.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted';
    $('#notificationLabel').textContent = notificationPermissionLabel();
    $('#notificationIcon').innerHTML = icon(enabled ? 'bell' : 'bellOff');
    $('#topNotificationButton').innerHTML = icon(enabled ? 'bell' : 'bellOff');
    $('#topNotificationButton').classList.toggle('active', enabled);
  }

  function renderNotificationModal() {
    const teams = allTeams().filter(team => state.favoriteTeams.has(teamKey(team)));
    const supported = 'Notification' in window && 'serviceWorker' in navigator;
    const granted = supported && Notification.permission === 'granted';
    $('#notificationContent').innerHTML = `<div class="notification-card">
      <div class="notification-status-icon ${granted && state.notificationsEnabled ? 'active' : ''}">${icon(granted && state.notificationsEnabled ? 'bell' : 'bellOff')}</div>
      <div><h3>${notificationPermissionLabel()}</h3><p>Получай уведомления о начале матчей и голах любимых сборных.</p></div>
    </div>
    ${supported ? `<button class="notification-toggle-button${granted && state.notificationsEnabled ? ' active' : ''}" type="button" data-toggle-notifications>${granted && state.notificationsEnabled ? 'Выключить уведомления' : 'Включить уведомления'}</button>` : '<div class="empty compact"><strong>Браузер не поддерживает уведомления</strong></div>'}
    <div class="notification-info"><strong>Любимые сборные</strong><span>${teams.length ? teams.map(team => team.name).join(', ') : 'Пока не выбраны'}</span></div>
    <p class="notification-footnote">Уведомления срабатывают при обновлении live-данных, пока сайт или установленное PWA активно. На iPhone сначала добавь сайт на экран «Домой».</p>`;
    $('[data-toggle-notifications]')?.addEventListener('click', toggleNotifications);
  }

  function openNotificationModal() {
    state.notificationModalOpen = true;
    renderNotificationModal();
    $('#notificationModal').classList.add('open'); $('#notificationModal').setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
  }

  function closeNotificationModal() {
    state.notificationModalOpen = false;
    $('#notificationModal').classList.remove('open'); $('#notificationModal').setAttribute('aria-hidden', 'true');
    if (!$('#matchModal').classList.contains('open')) document.body.style.overflow = '';
  }

  async function toggleNotifications() {
    if (!('Notification' in window)) return;
    if (state.notificationsEnabled && Notification.permission === 'granted') {
      state.notificationsEnabled = false;
      localStorage.setItem(CONFIG.notificationStorageKey, 'false');
    } else {
      const permission = await Notification.requestPermission();
      state.notificationsEnabled = permission === 'granted';
      localStorage.setItem(CONFIG.notificationStorageKey, String(state.notificationsEnabled));
      if (state.notificationsEnabled) sendSystemNotification('Уведомления включены', 'Теперь ты узнаешь о начале матчей и голах любимых сборных.', 'notifications-enabled', '#favorites');
    }
    updateNotificationUi(); renderNotificationModal();
  }

  function toggleFavoriteTeam(key) {
    if (state.favoriteTeams.has(key)) state.favoriteTeams.delete(key); else state.favoriteTeams.add(key);
    saveSet(CONFIG.favoriteTeamsStorageKey, state.favoriteTeams);
    showToast(state.favoriteTeams.has(key) ? 'Сборная добавлена в избранное' : 'Сборная удалена из избранного');
    render();
  }

  async function sendSystemNotification(title, body, tag, url = '#today') {
    if (!state.notificationsEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body, tag, renotify: true, icon: './assets/icons/icon-192.png', badge: './assets/icons/favicon-32.png',
        vibrate: [160, 80, 160], data: { url: `${location.pathname}${url}` }
      });
    } catch {
      try { new Notification(title, { body, tag, icon: './assets/icons/icon-192.png' }); } catch { /* ignored */ }
    }
  }

  function scheduleKickoffNotifications() {
    state.kickoffTimers.forEach(timer => clearTimeout(timer)); state.kickoffTimers.clear();
    if (!state.notificationsEnabled) return;
    const now = Date.now();
    for (const match of state.snapshot?.matches || []) {
      if (match.status !== 'upcoming' || !monitoredMatch(match)) continue;
      const delay = new Date(match.startingAt).getTime() - now;
      if (delay < 0 || delay > 6 * 60 * 60 * 1000) continue;
      const timer = setTimeout(() => {
        const marker = `wc26-kickoff-${matchSignature(match)}`;
        if (sessionStorage.getItem(marker)) return;
        sessionStorage.setItem(marker, '1');
        sendSystemNotification(`Скоро матч: ${match.home.name} — ${match.away.name}`, `Начало в ${formatTime(match.startingAt)}.`, `kickoff-${matchSignature(match)}`, '#schedule');
        loadSnapshot();
      }, Math.max(1000, delay));
      state.kickoffTimers.set(match.id, timer);
    }
  }

  function showToast(message) {
    const toast = document.createElement('div'); toast.className = 'toast'; toast.textContent = message; $('#toastRegion').append(toast);
    setTimeout(() => toast.remove(), 3600);
  }

  function cycleTheme() {
    state.theme = THEME_ORDER[(THEME_ORDER.indexOf(state.theme) + 1) % THEME_ORDER.length];
    localStorage.setItem(CONFIG.themeStorageKey, state.theme); applyTheme();
  }

  function installPlatform() {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    if (/Windows/i.test(ua)) return 'windows';
    if (/Macintosh|Mac OS X/i.test(ua)) return 'mac';
    if (/Android/i.test(ua)) return 'android';
    return 'desktop';
  }

  function renderInstallModal() {
    const platform = installPlatform();
    const ready = Boolean(state.deferredInstall);
    const instructions = {
      windows: ['Установка на Windows', 'Microsoft Edge: меню «…» → «Приложения» → «Установить World Cup 26». Google Chrome: значок установки справа в адресной строке или меню «⋮» → «Сохранить и поделиться» → «Установить страницу как приложение».'],
      ios: ['Добавить на iPhone', 'Открой сайт именно в Safari → «Поделиться» → «На экран Домой» → «Добавить».'],
      mac: ['Установка на macOS', 'Safari: «Файл» → «Добавить в Dock». Chrome/Edge: используй значок установки в адресной строке.'],
      android: ['Установка на Android', 'Chrome: меню «⋮» → «Установить приложение» или «Добавить на главный экран».'],
      desktop: ['Установка приложения', 'Открой меню браузера и выбери установку сайта как приложения.']
    }[platform];
    const diagnostics = `<div class="install-diagnostics"><span><b>HTTPS</b><small>${location.protocol === 'https:' ? 'готово' : 'нужен HTTPS'}</small></span><span><b>Manifest</b><small>подключён</small></span><span><b>Service Worker</b><small>${'serviceWorker' in navigator ? 'поддерживается' : 'не поддерживается'}</small></span><span><b>Системный prompt</b><small>${ready ? 'готов' : 'может появиться позже'}</small></span></div>`;
    $('#installContent').innerHTML = `<div class="install-visual">${icon('install','install-big-icon')}</div><h3>${instructions[0]}</h3><p>${instructions[1]}</p>${diagnostics}<div class="install-benefits"><span>✓ отдельное окно</span><span>✓ офлайн-оболочка</span><span>✓ уведомления</span><span>✓ адаптация под экран</span></div><button class="primary-button install-confirm" type="button" data-confirm-install>${ready ? 'Установить сейчас' : 'Проверить готовность'}</button>`;
    $('[data-confirm-install]', $('#installContent'))?.addEventListener('click', async () => {
      if (state.deferredInstall) {
        state.deferredInstall.prompt();
        await state.deferredInstall.userChoice;
        state.deferredInstall = null;
        closeInstallModal();
        updateInstallUi();
        return;
      }
      try {
        await navigator.serviceWorker?.ready;
        showToast('Приложение готово. Открой меню браузера и выбери установку сайта как приложения.');
      } catch {
        showToast('Браузер пока не подтвердил установку. Обнови страницу и проверь меню браузера.');
      }
      renderInstallModal();
    });
  }

  function openInstallModal() {
    renderInstallModal();
    $('#installModal').classList.add('open');
    $('#installModal').setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeInstallModal() {
    $('#installModal')?.classList.remove('open');
    $('#installModal')?.setAttribute('aria-hidden', 'true');
    if (!$('#playerModal').classList.contains('open') && !$('#matchModal').classList.contains('open') && !state.notificationModalOpen) document.body.style.overflow = '';
  }

  function updateInstallUi() {
    const platform = installPlatform();
    const label = platform === 'windows' ? 'Установить на Windows' : platform === 'ios' ? 'На экран iPhone' : platform === 'mac' ? 'Установить на Mac' : 'Установить приложение';
    $('#sidebarInstallLabel').textContent = label;
    $('#heroInstallButton').textContent = label;
    $('#installButton').classList.toggle('install-ready', Boolean(state.deferredInstall));
  }

  async function installPwa() {
    if (!state.deferredInstall) { openInstallModal(); return; }
    state.deferredInstall.prompt();
    await state.deferredInstall.userChoice;
    state.deferredInstall = null;
    updateInstallUi();
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try { const registration = await navigator.serviceWorker.register(`./service-worker.js?v=${encodeURIComponent(CONFIG.build)}`); registration.update(); }
    catch (error) { console.warn('Service worker registration failed', error); }
  }

  function initializeUi() {
    $('#refreshIcon').innerHTML = icon('refresh');
    $('#closeModalButton').innerHTML = icon('close');
    $('#closeNotificationButton').innerHTML = icon('close');
    $('#closePlayerModalButton').innerHTML = icon('close');
    $('#closeInstallButton').innerHTML = icon('close');
    $('#installButton').innerHTML = icon('install');
    $('#sidebarInstallIcon').innerHTML = icon('install');
    $('#refreshButton').addEventListener('click', () => loadSnapshot({ manual: true }));
    $('#themeButton').addEventListener('click', cycleTheme);
    $('#notificationButton').addEventListener('click', openNotificationModal);
    $('#topNotificationButton').addEventListener('click', openNotificationModal);
    $('#installButton').addEventListener('click', installPwa);
    $('#sidebarInstallButton').addEventListener('click', installPwa);
    $('#heroInstallButton').addEventListener('click', installPwa);
    $('#closeModalButton').addEventListener('click', closeMatchModal);
    $('#closeNotificationButton').addEventListener('click', closeNotificationModal);
    $('#closePlayerModalButton').addEventListener('click', closePlayerModal);
    $('#closeInstallButton').addEventListener('click', closeInstallModal);
    $$('[data-close-match-modal]').forEach(element => element.addEventListener('click', closeMatchModal));
    $$('[data-close-notification-modal]').forEach(element => element.addEventListener('click', closeNotificationModal));
    $$('[data-close-player-modal]').forEach(element => element.addEventListener('click', closePlayerModal));
    $$('[data-close-install-modal]').forEach(element => element.addEventListener('click', closeInstallModal));
    window.addEventListener('keydown', event => { if (event.key === 'Escape') { closeMatchModal(); closeNotificationModal(); closePlayerModal(); closeInstallModal(); } });
    window.addEventListener('hashchange', () => { const parsed = parseHash(); state.route = parsed.route; state.teamKey = parsed.teamKey; render(); });
    window.addEventListener('online', () => loadSnapshot());
    window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); state.deferredInstall = event; updateInstallUi(); });
    window.addEventListener('appinstalled', () => { state.deferredInstall = null; updateInstallUi(); showToast('World Cup 26 установлен.'); });
    matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => { if (state.theme === 'system') applyTheme(); });
    updateInstallUi();
    updateClock(); setInterval(updateClock, 30000);
  }

  async function start() {
    initializeUi(); applyTheme(); updateNotificationUi();
    state.snapshot = loadCachedSnapshot();
    if (state.snapshot) { state.sourceMode = 'cache'; state.loading = false; }
    render(); registerServiceWorker();
    if (state.snapshot) { void loadLeaders(); void ensureLeaderPhotos(); }
    await loadSnapshot();
  }

  start();
})();

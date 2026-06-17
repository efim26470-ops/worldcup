const API_ROOT = "https://api.sportmonks.com/v3/football";
const WORLD_CUP_LEAGUE_ID = 732;
const TOURNAMENT_START = "2026-06-11";
const TOURNAMENT_END = "2026-07-19";

const FLAG_BY_CODE = {
  ARG: "🇦🇷", ALG: "🇩🇿", AUT: "🇦🇹", JOR: "🇯🇴", GHA: "🇬🇭", PAN: "🇵🇦",
  ENG: "🏴", CRO: "🇭🇷", POR: "🇵🇹", COD: "🇨🇩", DRC: "🇨🇩", UZB: "🇺🇿",
  COL: "🇨🇴", CZE: "🇨🇿", RSA: "🇿🇦", SUI: "🇨🇭", KOR: "🇰🇷", USA: "🇺🇸",
  AUS: "🇦🇺", MEX: "🇲🇽", CAN: "🇨🇦", BIH: "🇧🇦", QAT: "🇶🇦", BRA: "🇧🇷",
  FRA: "🇫🇷", GER: "🇩🇪", ESP: "🇪🇸", NOR: "🇳🇴", MAR: "🇲🇦", SEN: "🇸🇳",
  BEL: "🇧🇪", EGY: "🇪🇬", URU: "🇺🇾", NZL: "🇳🇿", JPN: "🇯🇵", TUN: "🇹🇳"
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env.ALLOWED_ORIGINS);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, cors);

    try {
      if (url.pathname === "/api/health") {
        return json({ ok: true, provider: "sportmonks", leagueId: WORLD_CUP_LEAGUE_ID }, 200, cors);
      }

      if (!env.SPORTMONKS_TOKEN) {
        return json({ error: "SPORTMONKS_TOKEN is not configured" }, 503, cors);
      }

      if (url.pathname === "/api/snapshot") {
        return cachedJson(request, ctx, 12, cors, () => buildSnapshot(env.SPORTMONKS_TOKEN));
      }

      if (url.pathname === "/api/match") {
        const id = url.searchParams.get("id");
        if (!/^\d+$/.test(id || "")) return json({ error: "Valid match id is required" }, 400, cors);
        return cachedJson(request, ctx, 8, cors, () => buildMatch(env.SPORTMONKS_TOKEN, id));
      }

      return json({ error: "Not found" }, 404, cors);
    } catch (error) {
      console.error(error);
      return json({ error: "Upstream request failed", detail: error.message }, 502, cors);
    }
  }
};

async function buildSnapshot(token) {
  const fixtureInclude = "participants;scores;state;venue;round;stage;group";
  const fixturePath = `/fixtures/between/${TOURNAMENT_START}/${TOURNAMENT_END}`;

  const [fixturesRaw, liveRaw, standingsRaw] = await Promise.all([
    fetchAllPages(fixturePath, token, {
      include: fixtureInclude,
      filters: `fixtureLeagues:${WORLD_CUP_LEAGUE_ID}`,
      per_page: "100"
    }),
    sportmonks("/livescores/inplay", token, {
      include: "participants;scores;state;venue;round;stage;group;events;statistics.type",
      filters: `fixtureLeagues:${WORLD_CUP_LEAGUE_ID}`
    }).catch(() => ({ data: [] })),
    fetchLiveStandings(token).catch(() => ({ data: [] }))
  ]);

  const fixtures = Array.isArray(fixturesRaw) ? fixturesRaw : [];
  const liveById = new Map((liveRaw.data || []).map((item) => [String(item.id), item]));
  const mergedFixtures = fixtures.map((fixture) => liveById.get(String(fixture.id)) || fixture);
  const seasonId = mergedFixtures.find((fixture) => fixture.season_id)?.season_id;
  const topRaw = seasonId ? await fetchTopscorers(token, seasonId).catch(() => ({ data: [] })) : { data: [] };

  return {
    source: "live",
    provider: "Sportmonks",
    lastUpdated: new Date().toISOString(),
    matches: mergedFixtures.filter((fixture) => !fixture.placeholder).map(normalizeFixture),
    standings: normalizeStandings(standingsRaw.data || []),
    leaders: normalizeTopscorers(topRaw.data || [])
  };
}

async function buildMatch(token, id) {
  const raw = await sportmonks(`/fixtures/${id}`, token, {
    include: "participants;scores;state;venue;round;stage;group;events.type;statistics.type;lineups.player;lineups.position;lineups.details.type"
  });
  return { match: normalizeFixture(raw.data, true), lastUpdated: new Date().toISOString() };
}

async function fetchTopscorers(token, seasonId) {
  return sportmonks(`/topscorers/seasons/${seasonId}`, token, {
    include: "team;player;type",
    per_page: "100"
  });
}

async function fetchLiveStandings(token) {
  try {
    return await sportmonks(`/standings/live/leagues/${WORLD_CUP_LEAGUE_ID}`, token, {
      include: "participant;details.type;group",
      per_page: "100"
    });
  } catch {
    return sportmonks(`/standings/live/league/${WORLD_CUP_LEAGUE_ID}`, token, {
      include: "participant;details.type;group",
      per_page: "100"
    });
  }
}

async function fetchAllPages(path, token, params) {
  const rows = [];
  for (let page = 1; page <= 4; page += 1) {
    const payload = await sportmonks(path, token, { ...params, page: String(page) });
    rows.push(...(payload.data || []));
    const pagination = payload.pagination || {};
    const hasMore = pagination.has_more === true || (pagination.current_page && pagination.current_page < pagination.last_page);
    if (!hasMore || !(payload.data || []).length) break;
  }
  return rows;
}

async function sportmonks(path, token, params = {}) {
  const url = new URL(`${API_ROOT}${path}`);
  url.searchParams.set("api_token", token);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Sportmonks ${response.status}: ${detail.slice(0, 220)}`);
  }
  return response.json();
}

function normalizeFixture(fixture, detailed = false) {
  const participants = fixture.participants || [];
  const homeRaw = participants.find((team) => team.meta?.location === "home") || participants[0] || {};
  const awayRaw = participants.find((team) => team.meta?.location === "away") || participants[1] || {};
  const scores = fixture.scores || [];
  const status = normalizeStatus(fixture.state);

  const match = {
    id: String(fixture.id),
    startingAt: normalizeDate(fixture.starting_at),
    status,
    minute: currentMinute(fixture),
    stage: fixture.group?.name || fixture.round?.name || fixture.stage?.name || "Чемпионат мира 2026",
    venue: fixture.venue?.name || "Стадион уточняется",
    city: fixture.venue?.city_name || fixture.venue?.city?.name || "",
    home: normalizeTeam(homeRaw, scoreFor(scores, homeRaw.id)),
    away: normalizeTeam(awayRaw, scoreFor(scores, awayRaw.id)),
    events: [],
    stats: {},
    h2h: { homeWins: 0, draws: 0, awayWins: 0 },
    lineups: { home: [], away: [] }
  };

  if (detailed || fixture.events || fixture.statistics || fixture.lineups) {
    match.events = normalizeEvents(fixture.events || [], homeRaw.id);
    match.stats = normalizeStats(fixture.statistics || [], homeRaw.id, awayRaw.id);
    match.lineups = normalizeLineups(fixture.lineups || [], homeRaw.id, awayRaw.id);
  }

  return match;
}

function normalizeTeam(team, score) {
  const code = String(team.short_code || team.name || "TBD").toUpperCase();
  return {
    id: String(team.id || code),
    name: team.name || "Будет определено",
    short: code.slice(0, 3),
    flag: FLAG_BY_CODE[code] || "⚽",
    logo: team.image_path || "",
    score
  };
}

function normalizeDate(value) {
  if (!value) return new Date().toISOString();
  if (/Z$|[+-]\d\d:\d\d$/.test(value)) return value;
  return value.replace(" ", "T") + "Z";
}

function normalizeStatus(state = {}) {
  const code = String(state.short_name || state.developer_name || state.name || "").toUpperCase();
  if (/LIVE|INPLAY|1ST|2ND|HT|ET|BREAK|PEN/.test(code)) return "live";
  if (/FT|AET|AFTER|FINISH|ENDED/.test(code)) return "finished";
  if (/POSTP|CANCEL|ABAND/.test(code)) return "postponed";
  return "upcoming";
}

function currentMinute(fixture) {
  const stateMinute = Number(fixture.state?.minute || fixture.state?.clock?.minute);
  if (Number.isFinite(stateMinute)) return stateMinute;
  const periods = fixture.periods || [];
  const minute = Math.max(0, ...periods.map((period) => Number(period.minutes || period.ticking || 0)));
  return Number.isFinite(minute) ? minute : 0;
}

function scoreFor(scores, participantId) {
  const relevant = scores.filter((score) => String(score.participant_id) === String(participantId));
  if (!relevant.length) return null;
  const priority = ["CURRENT", "2ND_HALF", "ET", "PENALTIES", "1ST_HALF"];
  for (const description of priority) {
    const found = relevant.find((score) => String(score.description || "").toUpperCase() === description);
    const value = found?.score?.goals ?? found?.score?.score ?? found?.score;
    if (Number.isFinite(Number(value))) return Number(value);
  }
  const values = relevant.map((score) => Number(score.score?.goals ?? score.score?.score ?? score.score)).filter(Number.isFinite);
  return values.length ? Math.max(...values) : null;
}

function normalizeEvents(events, homeId) {
  return [...events]
    .sort((a, b) => Number(a.minute || 0) - Number(b.minute || 0))
    .map((event) => {
      const name = event.type?.name || event.type?.developer_name || event.addition || event.result || "Событие";
      const lowered = String(name).toLowerCase();
      const icon = lowered.includes("goal") ? "⚽" : lowered.includes("yellow") ? "🟨" : lowered.includes("red") ? "🟥" : lowered.includes("sub") ? "⇄" : "•";
      const player = event.player_name || event.player?.display_name || event.player?.name || "";
      return {
        minute: Number(event.minute || 0),
        icon,
        text: player ? `${name} — ${player}` : name,
        team: String(event.participant_id) === String(homeId) ? "home" : "away"
      };
    });
}

function normalizeStats(statistics, homeId, awayId) {
  const result = {};
  const mapping = {
    possession: /possession/i,
    shots: /shots[-_ ]?total|total shots/i,
    shotsOnTarget: /shots[-_ ]?on[-_ ]?target|shots on target/i,
    corners: /corners/i,
    fouls: /fouls/i,
    passes: /passes(?!.*accuracy)/i
  };

  for (const [key, regex] of Object.entries(mapping)) {
    const rows = statistics.filter((row) => regex.test(`${row.type?.code || ""} ${row.type?.name || ""} ${row.type?.developer_name || ""}`));
    const home = rows.find((row) => String(row.participant_id) === String(homeId));
    const away = rows.find((row) => String(row.participant_id) === String(awayId));
    result[key] = [numericStat(home?.data?.value ?? home?.value), numericStat(away?.data?.value ?? away?.value)];
  }
  return result;
}

function numericStat(value) {
  if (value && typeof value === "object") value = value.total ?? value.value ?? value.count ?? 0;
  const parsed = Number(String(value ?? 0).replace("%", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLineups(lineups, homeId, awayId) {
  const format = (participantId) => lineups
    .filter((entry) => String(entry.participant_id) === String(participantId) && entry.type_id !== 12)
    .sort((a, b) => Number(a.formation_position || a.position_id || 99) - Number(b.formation_position || b.position_id || 99))
    .slice(0, 18)
    .map((entry) => entry.player?.display_name || entry.player?.name || `Игрок ${entry.jersey_number || ""}`.trim());
  return { home: format(homeId), away: format(awayId) };
}

function normalizeStandings(rows) {
  const groups = new Map();
  for (const row of rows) {
    const groupName = row.group?.name || row.group_name || row.group_id || "—";
    const key = String(groupName).replace(/^Group\s*/i, "");
    if (!groups.has(key)) groups.set(key, []);
    const participant = row.participant || {};
    const detail = (pattern, fallback = 0) => {
      const found = (row.details || []).find((item) => pattern.test(`${item.type?.name || ""} ${item.type?.code || ""} ${item.type?.developer_name || ""}`));
      return numericStat(found?.value ?? found?.data?.value ?? fallback);
    };
    const played = detail(/played/i);
    const won = detail(/won|wins/i);
    const drawn = detail(/draw/i);
    const lost = detail(/lost|loss/i);
    const gf = detail(/goals.*for|goals scored/i);
    const ga = detail(/goals.*against|goals conceded/i);
    const points = Number(row.points ?? detail(/points/i));
    const code = String(participant.short_code || "").toUpperCase();
    groups.get(key).push({
      pos: Number(row.position || 0),
      id: String(participant.id || row.participant_id || ""),
      name: participant.name || "Команда",
      flag: FLAG_BY_CODE[code] || "⚽",
      played, won, drawn, lost, gf, ga, gd: gf - ga, points,
      form: []
    });
  }
  return [...groups.entries()].map(([group, teams]) => ({ group, teams: teams.sort((a, b) => a.pos - b.pos) }));
}

function normalizeTopscorers(rows) {
  const format = (typeId, label) => rows
    .filter((row) => Number(row.type_id) === typeId)
    .sort((a, b) => Number(a.position || 999) - Number(b.position || 999))
    .slice(0, 12)
    .map((row, index) => {
      const team = row.team || row.participant || {};
      const code = String(team.short_code || "").toUpperCase();
      return {
        rank: Number(row.position || index + 1),
        name: row.player?.display_name || row.player?.name || "Игрок",
        team: team.name || "Сборная",
        flag: FLAG_BY_CODE[code] || "⚽",
        value: Number(row.total || 0),
        label
      };
    });

  return {
    scorers: format(208, "голов"),
    assists: format(209, "ассистов"),
    ratings: []
  };
}

async function cachedJson(request, ctx, ttl, cors, producer) {
  const cache = caches.default;
  const cacheKey = new Request(request.url, request);
  const cached = await cache.match(cacheKey);
  if (cached) return withCors(cached, cors);

  const payload = await producer();
  const response = json(payload, 200, {
    ...cors,
    "Cache-Control": `public, max-age=${ttl}, s-maxage=${ttl}, stale-while-revalidate=30`
  });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

function corsHeaders(origin, allowList = "*") {
  const allowed = String(allowList || "*").split(",").map((item) => item.trim()).filter(Boolean);
  const allowOrigin = allowed.includes("*") || !origin ? "*" : allowed.includes(origin) ? origin : "null";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers }
  });
}

function withCors(response, cors) {
  const headers = new Headers(response.headers);
  Object.entries(cors).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

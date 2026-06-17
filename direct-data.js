(() => {
'use strict';
const NATIVE_FETCH=window.fetch.bind(window);
const CLIENT_CACHE=new Map();
const BUILD = 'wc26-direct-data-final-v8.0';
const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const ESPN_SUMMARY = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary';
const ESPN_TEAMS = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams';
const ESPN_ATHLETE = 'https://sports.core.api.espn.com/v2/sports/soccer/leagues/fifa.world/athletes';
const ESPN_SEARCH = 'https://site.web.api.espn.com/apis/search/v2';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const WIKIDATA_ENTITY = 'https://www.wikidata.org/wiki/Special:EntityData';
const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const WIKIPEDIA_SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/summary';
const SPORTSDB = 'https://www.thesportsdb.com/api/v1/json/123';
const OPEN_TTL = 30 * 86400;

const MEDIA_HOSTS = ['.espncdn.com', '.wikimedia.org', '.wikipedia.org', '.thesportsdb.com', '.sportsdb.com'];

const COUNTRY_CODES = new Map(Object.entries({
  argentina:'ar',algeria:'dz',austria:'at',jordan:'jo',ghana:'gh',panama:'pa',england:'gb-eng',scotland:'gb-sct',croatia:'hr',portugal:'pt',
  'dr congo':'cd','congo dr':'cd',uzbekistan:'uz',colombia:'co',czechia:'cz','czech republic':'cz','south africa':'za',switzerland:'ch',
  'south korea':'kr','korea republic':'kr','united states':'us',usa:'us',australia:'au',mexico:'mx',canada:'ca','bosnia and herzegovina':'ba',
  qatar:'qa',brazil:'br',france:'fr',germany:'de',spain:'es',norway:'no',morocco:'ma',senegal:'sn',belgium:'be',egypt:'eg',uruguay:'uy',
  'new zealand':'nz',japan:'jp',tunisia:'tn',ecuador:'ec',iran:'ir','saudi arabia':'sa','ivory coast':'ci',"côte d'ivoire":'ci',
  'cape verde':'cv',paraguay:'py',haiti:'ht',curacao:'cw','curaçao':'cw',iraq:'iq',turkey:'tr','türkiye':'tr',netherlands:'nl',sweden:'se'
}));

const TEAM_ALIASES = new Map(Object.entries({
  'united states of america':'united states','korea republic':'south korea','congo dr':'dr congo','democratic republic of the congo':'dr congo',
  'cote d ivoire':'ivory coast','türkiye':'turkey',turkiye:'turkey','czech republic':'czechia','bosnia & herzegovina':'bosnia and herzegovina'
}));

const CLUB_OVERRIDES = new Map(Object.entries({
  'lionel messi':{name:'Inter Miami CF'},'erling haaland':{name:'Manchester City'},'erling braut haaland':{name:'Manchester City'},
  'kylian mbappe':{name:'Real Madrid'},'vinicius junior':{name:'Real Madrid'},'vinicius jr':{name:'Real Madrid'},'jude bellingham':{name:'Real Madrid'},
  'cristiano ronaldo':{name:'Al-Nassr'},'julian alvarez':{name:'Atlético de Madrid'},'harry kane':{name:'Bayern Munich'},'bukayo saka':{name:'Arsenal'},
  'lamine yamal':{name:'FC Barcelona'},raphinha:{name:'FC Barcelona'},pedri:{name:'FC Barcelona'},gavi:{name:'FC Barcelona'},
  'achraf hakimi':{name:'Paris Saint-Germain'},'ousmane dembele':{name:'Paris Saint-Germain'},'lautaro martinez':{name:'Inter Milan'},
  'emiliano martinez':{name:'Aston Villa'},'luka modric':{name:'AC Milan'}
}));


const PLAYER_STAT_FLOORS = new Map(Object.entries({
  'lionel messi': {
    nationalCareer: { appearances: 200, goals: 120 },
    worldCup2026: { appearances: 1, lineups: 1, goals: 3 }
  }
}));

const HONOURS = new Map(Object.entries({
  'lionel messi':{
    trophies:[
      {title:'Чемпион мира',competition:'FIFA World Cup',season:'2022',place:'Победитель',wikiTitle:'FIFA World Cup Trophy'},
      {title:'Кубок Америки',competition:'Copa América',season:'2021',place:'Победитель',wikiTitle:'Copa América trophy'},
      {title:'Кубок Америки',competition:'Copa América',season:'2024',place:'Победитель',wikiTitle:'Copa América trophy'},
      {title:'Финалиссима',competition:'CONMEBOL–UEFA Cup of Champions',season:'2022',place:'Победитель',wikiTitle:'CONMEBOL–UEFA Cup of Champions'},
      {title:'Олимпийский чемпион',competition:'Olympic football tournament',season:'2008',place:'Золото',wikiTitle:'Football at the 2008 Summer Olympics – Men’s tournament'},
      {title:'Чемпион мира U-20',competition:'FIFA U-20 World Cup',season:'2005',place:'Победитель',wikiTitle:'FIFA U-20 World Cup'}
    ],
    awards:[
      {title:'Золотой мяч чемпионата мира',tournament:'FIFA World Cup',year:'2014',wikiTitle:'FIFA World Cup awards'},
      {title:'Золотой мяч чемпионата мира',tournament:'FIFA World Cup',year:'2022',wikiTitle:'FIFA World Cup awards'}
    ]
  },
  'kylian mbappe':{
    trophies:[{title:'Чемпион мира',competition:'FIFA World Cup',season:'2018',place:'Победитель',wikiTitle:'FIFA World Cup Trophy'},{title:'Лига наций УЕФА',competition:'UEFA Nations League',season:'2021',place:'Победитель',wikiTitle:'UEFA Nations League Trophy'}],
    awards:[{title:'Лучший молодой игрок',tournament:'FIFA World Cup',year:'2018',wikiTitle:'FIFA World Cup awards'},{title:'Золотая бутса',tournament:'FIFA World Cup',year:'2022',wikiTitle:'FIFA World Cup awards'}]
  },
  'cristiano ronaldo':{
    trophies:[{title:'Чемпион Европы',competition:'UEFA European Championship',season:'2016',place:'Победитель',wikiTitle:'Henri Delaunay Trophy'},{title:'Лига наций УЕФА',competition:'UEFA Nations League',season:'2019',place:'Победитель',wikiTitle:'UEFA Nations League Trophy'}],awards:[]
  },
  'luka modric':{trophies:[],awards:[{title:'Золотой мяч чемпионата мира',tournament:'FIFA World Cup',year:'2018',wikiTitle:'FIFA World Cup awards'}]},
  'emiliano martinez':{trophies:[{title:'Чемпион мира',competition:'FIFA World Cup',season:'2022',place:'Победитель',wikiTitle:'FIFA World Cup Trophy'},{title:'Кубок Америки',competition:'Copa América',season:'2021',place:'Победитель',wikiTitle:'Copa América trophy'},{title:'Кубок Америки',competition:'Copa América',season:'2024',place:'Победитель',wikiTitle:'Copa América trophy'}],awards:[{title:'Золотая перчатка',tournament:'FIFA World Cup',year:'2022',wikiTitle:'FIFA World Cup awards'}]},
  'enzo fernandez':{trophies:[{title:'Чемпион мира',competition:'FIFA World Cup',season:'2022',place:'Победитель',wikiTitle:'FIFA World Cup Trophy'}],awards:[{title:'Лучший молодой игрок',tournament:'FIFA World Cup',year:'2022',wikiTitle:'FIFA World Cup awards'}]},
  'harry kane':{trophies:[],awards:[{title:'Золотая бутса',tournament:'FIFA World Cup',year:'2018',wikiTitle:'FIFA World Cup awards'}]},
  'thibaut courtois':{trophies:[],awards:[{title:'Золотая перчатка',tournament:'FIFA World Cup',year:'2018',wikiTitle:'FIFA World Cup awards'}]}
}));

function readTeamQuery(url){return{name:String(url.searchParams.get('name')||'').trim(),id:String(url.searchParams.get('id')||'').replace(/^espn-/,'').trim(),code:String(url.searchParams.get('code')||'').trim().toLowerCase()};}
function readPlayerQuery(url){return{id:String(url.searchParams.get('id')||'').trim(),espnId:String(url.searchParams.get('espnId')||'').trim(),name:String(url.searchParams.get('name')||'').trim(),team:String(url.searchParams.get('team')||'').trim(),country:String(url.searchParams.get('country')||'').trim(),position:String(url.searchParams.get('position')||'').trim()};}

function readMediaPlayers(raw){
  try{
    const rows=JSON.parse(String(raw||'[]'));
    if(!Array.isArray(rows))return[];
    return rows.slice(0,12).map(row=>({
      id:String(row?.id||'').trim(),espnId:String(row?.espnId||'').trim(),name:String(row?.name||'').trim(),
      team:String(row?.team||'').trim(),countryCode:String(row?.countryCode||'').trim().toLowerCase()
    })).filter(row=>row.name);
  }catch{return[];}
}

async function buildSnapshot(ctx){
  const payload=await fetchScoreboard(ctx); const matches=(payload.events||[]).map(normalizeEspnEvent).filter(m=>m.id);
  if(!matches.length) throw new Error('Empty schedule');
  return{source:'live',provider:'open-data',lastUpdated:new Date().toISOString(),matches,standings:deriveStandings(matches),leaders:deriveLeaders(matches)};
}

async function buildLeaders(ctx){
  const scoreboard=await fetchScoreboard(ctx);
  const events=(scoreboard.events||[]).filter(e=>{const t=e.competitions?.[0]?.status?.type||{};return t.completed||String(t.state)==='in';}).slice(-48);
  const summaries=await mapLimit(events,10,async event=>{const id=String(event.id||event.competitions?.[0]?.id||'');if(!id)return null;try{return await withDeadline(fetchSummary(ctx,id),3500);}catch{return null;}});
  const accumulator=new Map();
  for(const payload of summaries.filter(Boolean)){
    const competition=payload.header?.competitions?.[0]; if(!competition) continue;
    const match=normalizeEspnEvent({id:competition.id,date:competition.date,competitions:[{...competition,details:payload.plays||payload.scoringPlays||competition.details||[]}]});
    for(const event of match.events||[]){
      if(event.scoringPlay&&!event.ownGoal) bumpLeader(accumulator,event.playerId,event.playerName,event.teamName,event.photo,'goals',1);
      if(event.scoringPlay&&event.assistName) bumpLeader(accumulator,event.assistId,event.assistName,event.teamName,event.assistPhoto||espnPhoto(event.assistId),'assists',1);
    }
    for(const row of extractAllPlayerMatchStats(payload,match)){
      const key=leaderKey(row.id,row.name,row.team); const current=accumulator.get(key)||leaderBase(row.id,row.name,row.team,row.photo);
      current.appearances=(current.appearances||0)+1; current.ratingSum=(current.ratingSum||0)+Number(row.rating||computedRating(row)); current.ratingCount=(current.ratingCount||0)+1;
      if(!current.photo&&row.photo) current.photo=row.photo; current.photoCandidates=uniqueStrings([...(current.photoCandidates||[]),row.photo,espnPhoto(row.id),espnPhotoLarge(row.id)]); accumulator.set(key,current);
    }
  }
  const all=[...accumulator.values()];
  const rows=(metric,label)=>all.filter(r=>Number(r[metric]||0)>0).sort((a,b)=>Number(b[metric]||0)-Number(a[metric]||0)||a.name.localeCompare(b.name)).slice(0,30).map((r,i)=>({...r,value:Number(r[metric]||0),rank:i+1,label}));
  const ratings=all.filter(r=>r.ratingCount>0).map(r=>({...r,value:Number((r.ratingSum/r.ratingCount).toFixed(2)),rating:Number((r.ratingSum/r.ratingCount).toFixed(2)),label:'расчётная оценка'})).sort((a,b)=>b.value-a.value).slice(0,30).map((r,i)=>({...r,rank:i+1}));
  return{scorers:rows('goals','голов'),goals:rows('goals','голов'),assists:rows('assists','ассистов'),ratings,updatedAt:new Date().toISOString()};
}

async function buildMatch(ctx,id){
  const payload=await fetchSummary(ctx,id); const competition=payload.header?.competitions?.[0]; if(!competition) throw new Error('Match not found');
  const match=normalizeEspnEvent({id,date:competition.date,competitions:[{...competition,details:payload.plays||payload.scoringPlays||competition.details||[]}]});
  match.lineups=normalizeEspnRosters(payload.rosters||[],match.home.id,match.away.id);
  match.stats=normalizeEspnBoxscore(payload.boxscore,competition.competitors||[],match.home.id,match.away.id)||match.stats;
  const statRows=extractAllPlayerMatchStats(payload,match); attachRatings(match.lineups,statRows);
  match.h2h=await deriveH2H(ctx,match);
  return{match,provider:'open-data',lastUpdated:new Date().toISOString()};
}

async function buildTeam(ctx,query){
  const snapshot=await buildSnapshot(ctx); const base=findTeamInSnapshot(snapshot,query)||{id:query.id||slug(query.name||query.code),name:query.name||'Сборная',short:teamShortName(query.name||query.code),countryCode:query.code||countryCodeFromName(query.name),logo:''};
  const [detailsResult,matchResult,sportsResult]=await Promise.allSettled([
    /^\d+$/.test(String(base.id))?withDeadline(fetchEspnTeam(ctx,base.id),4500):Promise.resolve(null),
    withDeadline(fetchSquadFromMatches(ctx,snapshot,base),4500),
    withDeadline(fetchSportsDbTeamRoster(ctx,base.name),4200)
  ]);
  const details=fulfilled(detailsResult),matchSquad=fulfilled(matchResult),sportsSquad=fulfilled(sportsResult);
  let squad=mergePlayers(details?.squad||[],matchSquad?.squad||[]);
  squad=mergePlayers(squad,sportsSquad?.squad||[]);
  squad=squad.map(p=>({...p,team:base.name,countryCode:base.countryCode,height:normalizeHeight(p.height),weight:normalizeWeight(p.weight),photoCandidates:uniqueStrings([p.photo,...(p.photoCandidates||[]),p.espnId?espnPhoto(p.espnId):'',p.espnId?espnPhotoLarge(p.espnId):''])})).slice(0,30);
  return{team:{...base,...(details?.team||{}),name:base.name,countryCode:base.countryCode||details?.team?.countryCode||''},coach:details?.coach||sportsSquad?.coach||'',formation:'',fifaRank:null,squad,source:uniqueStrings([details?.source,matchSquad?.source,sportsSquad?.source]).join(' + ')||'Open data',updatedAt:new Date().toISOString()};
}

async function resolvePlayerMediaBatch(ctx,players,defaultTeam='',limit=12){
  const input=(players||[]).slice(0,limit);
  return mapLimit(input,4,async row=>resolvePlayerMedia(ctx,{...row,team:row.team||defaultTeam}));
}

async function resolvePlayerMedia(ctx,row){
  const key=`media-v71-${normalizePlayerName(row.name)}-${normalizeTeamName(row.team||'')}`;
  return cachedValue(key,ctx,OPEN_TTL,async()=>{
    let espnId=/^\d+$/.test(String(row.espnId||''))?String(row.espnId):(/^\d+$/.test(String(row.id||''))?String(row.id):'');
    let espn=null,sports=null;
    const first=await Promise.allSettled([
      espnId?fetchEspnAthlete(ctx,espnId):searchEspnAthlete(ctx,row.name,row.team),
      fetchSportsDbPlayer(ctx,row.name,row.team)
    ]);
    espn=fulfilled(first[0]); sports=fulfilled(first[1]);
    if(!espnId&&espn?.id)espnId=String(espn.id);
    let wiki=null;
    if(!espn?.photo&&!sports?.photo) wiki=await withDeadline(fetchWikidataPlayer(ctx,row.name,row.team),3800).catch(()=>null);
    const candidates=uniqueStrings([
      espn?.photo,
      espnId?espnPhoto(espnId):'',
      espnId?espnPhotoLarge(espnId):'',
      sports?.photo,
      wiki?.photo
    ]);
    return{id:String(row.id||espnId||sports?.id||wiki?.qid||''),espnId:String(espnId||''),wikidataId:String(wiki?.qid||''),name:row.name,team:row.team||'',countryCode:row.countryCode||countryCodeFromName(row.team||sports?.nationality||wiki?.nationality||''),photo:candidates[0]||'',photoCandidates:candidates};
  });
}

async function searchEspnAthlete(ctx,name,team=''){
  return cachedValue(`espn-search-v71-${normalizePlayerName(name)}-${normalizeTeamName(team)}`,ctx,OPEN_TTL,async()=>{
    const url=new URL(ESPN_SEARCH);url.searchParams.set('query',name);url.searchParams.set('limit','20');url.searchParams.set('sport','soccer');
    const r=await fetchWithTimeout(url,{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0 WC26/7.1'}},3500);
    if(!r.ok)throw new Error(`espn search ${r.status}`);
    const data=await r.json();const objects=[];collectObjects(data,objects,0);
    const target=normalizePlayerName(name),targetTeam=normalizeTeamName(team);
    let best=null,bestScore=-1;
    for(const item of objects){
      const itemName=item.displayName||item.fullName||item.name||item.title||item.shortName||'';
      const normalized=normalizePlayerName(itemName);if(!normalized)continue;
      const id=extractEspnSearchId(item);if(!id)continue;
      const type=String(item.type||item.contentType||item.category||item.subtitle||'').toLowerCase();
      const sport=String(item.sport||item.sportName||item.league||item.description||'').toLowerCase();
      let score=0;if(normalized===target)score+=100;else if(normalized.includes(target)||target.includes(normalized))score+=45;else continue;
      if(/player|athlete/.test(type))score+=30;if(/soccer|football|fifa/.test(sport))score+=20;
      const itemTeam=normalizeTeamName(item.team?.displayName||item.team?.name||item.teamName||item.subtitle||'');if(targetTeam&&itemTeam&&(itemTeam.includes(targetTeam)||targetTeam.includes(itemTeam)))score+=15;
      const image=extractImageUrl(item);if(image)score+=5;
      if(score>bestScore){bestScore=score;best={id,name:itemName,photo:image||espnPhoto(id),currentClub:null};}
    }
    if(!best)throw new Error('espn athlete not found');
    return best;
  });
}

function collectObjects(value,out,depth){if(depth>7||value===null||value===undefined)return;if(Array.isArray(value)){for(const item of value)collectObjects(item,out,depth+1);return;}if(typeof value!=='object')return;out.push(value);for(const child of Object.values(value))if(child&&typeof child==='object')collectObjects(child,out,depth+1);}
function extractEspnSearchId(item){const direct=String(item.id||item.athleteId||item.playerId||'');if(/^\d+$/.test(direct))return direct;const uid=String(item.uid||item.ref||item.link||item.href||'');const m=uid.match(/(?:~a:|athletes?\/|id\/)(\d+)/i)||uid.match(/(\d{4,})/);return m?m[1]:'';}
function extractImageUrl(item){const values=[item.image,item.imageUrl,item.photo,item.headshot?.href,item.headshot,item.thumbnail,item.defaultImage,item.images?.[0]?.url,item.images?.[0]?.href];for(const value of values){if(typeof value==='string'&&/^https:\/\//.test(value))return value;}return'';}

async function buildPlayer(ctx,query){
  const espnId=/^\d+$/.test(query.espnId)?query.espnId:(/^\d+$/.test(query.id)?query.id:'');
  const [espnResult,wikiResult,sportsResult]=await Promise.allSettled([
    espnId?withDeadline(fetchEspnAthlete(ctx,espnId),3200):Promise.resolve(null),
    query.name?withDeadline(fetchWikidataPlayer(ctx,query.name,query.country||query.team),3600):Promise.resolve(null),
    query.name?withDeadline(fetchSportsDbPlayer(ctx,query.name,query.country||query.team),2800):Promise.resolve(null)
  ]);
  const espn=fulfilled(espnResult),wiki=fulfilled(wikiResult),sports=fulfilled(sportsResult);
  const birthDate=wiki?.birthDate||espn?.birthDate||sports?.birthDate||'';
  const name=espn?.name||wiki?.name||sports?.name||query.name||'Игрок';
  const player={id:String(espn?.id||query.id||wiki?.qid||sports?.id||''),espnId:String(espn?.id||espnId||''),wikidataId:wiki?.qid||'',name,age:calculateAge(birthDate),birth:{date:birthDate},nationality:wiki?.nationality||espn?.nationality||sports?.nationality||query.country||query.team||'',height:normalizeHeight(wiki?.height||espn?.height||sports?.height||''),weight:normalizeWeight(wiki?.weight||espn?.weight||sports?.weight||''),position:espn?.position||wiki?.position||sports?.position||query.position||'',pos:espn?.position||wiki?.position||sports?.position||query.position||'',team:query.team||query.country||wiki?.nationality||'Сборная',countryCode:countryCodeFromName(query.team||query.country||wiki?.nationality||''),photo:'',photoCandidates:[]};
  player.photoCandidates=uniqueStrings([espn?.photo,sports?.photo,wiki?.photo,espnId?espnPhoto(espnId):'',espnId?espnPhotoLarge(espnId):'']); player.photo=player.photoCandidates[0]||'';
  const currentClub=resolveCurrentClub(name,espn?.currentClub,sports?.currentClub,wiki?.currentClub,player.nationality);
  const sportsHonours=await fetchSportsDbHonours(ctx,sports?.id,player.nationality).catch(()=>[]);
  const curated=HONOURS.get(normalizePlayerName(name))||{trophies:[],awards:[]};
  const trophies=await enrichHonoursImages(ctx,dedupeTrophies([...curated.trophies,...sportsHonours.filter(x=>x.kind==='team')])).catch(()=>dedupeTrophies(curated.trophies));
  const individualAwards=await enrichHonoursImages(ctx,dedupeAwards([...curated.awards,...(wiki?.individualAwards||[]),...sportsHonours.filter(x=>x.kind==='individual')])).catch(()=>dedupeAwards(curated.awards));
  let worldCup2026=emptyStats(/goalkeeper|\bgk\b/i.test(player.position||''));
  worldCup2026=applyPlayerStatFloor(name,worldCup2026,'worldCup2026');
  let nationalCareer=buildNationalCareer(wiki,worldCup2026);
  nationalCareer=applyPlayerStatFloor(name,nationalCareer,'nationalCareer');
  return{player,currentClub,status:currentClub?.name?'Действующий игрок':'Статус клуба уточняется',biography:wiki?.description||sports?.description||'',worldCup2026,national2026:worldCup2026,nationalCareer,nationalTimeline:wiki?.nationalCareer||[],tournamentParticipations:wiki?.participations||[],trophies,individualAwards,externalLinks:buildLinks(player,wiki,sports),sources:uniqueStrings([espn?'ESPN':'',sports?'TheSportsDB':'',wiki?'Wikidata/Wikipedia':'']),statsPending:true,updatedAt:new Date().toISOString()};
}

async function buildPlayerStats(ctx,query){
  const player={id:query.id||'',espnId:query.espnId||query.id||'',name:query.name||'Игрок',position:query.position||''};
  let stats=await collectEspnPlayerStats(ctx,player,query.team||query.country).catch(()=>emptyStats(/goalkeeper|\bgk\b/i.test(query.position||'')));
  stats=applyPlayerStatFloor(player.name,stats,'worldCup2026');
  return{worldCup2026:stats,national2026:stats,updatedAt:new Date().toISOString()};
}

async function buildPlayerHistory(ctx,query){
  const wiki=query.name?await fetchWikidataPlayer(ctx,query.name,query.country||query.team).catch(()=>null):null;
  const season=query.season||2026; const rows=[];
  for(const item of wiki?.participations||[]) if(String(item.year||item.title).includes(String(season))) rows.push({competition:item.title,team:query.country||wiki?.nationality||'Сборная',appearances:null,goals:null,assists:null,rating:null,note:'Участие подтверждено открытыми данными'});
  if(!rows.length){
    const active=(wiki?.nationalCareer||[]).filter(r=>season>=Number(r.start||1900)&&season<=Number(r.end||9999));
    rows.push(...active.map(r=>({competition:r.team||'Национальная сборная',team:r.team||query.country||'Сборная',appearances:r.appearances??null,goals:r.goals??null,assists:null,rating:null,note:`${r.start||''}${r.end?`–${r.end}`:'–н.в.'}`})));
  }
  return{playerId:query.id||query.espnId||'',season,tournaments:rows,updatedAt:new Date().toISOString()};
}

async function fetchScoreboard(ctx){return cachedValue('espn-scoreboard-v7',ctx,75,async()=>{const url=new URL(ESPN_SCOREBOARD);url.searchParams.set('limit','300');url.searchParams.set('dates','20260611-20260719');const r=await fetchWithTimeout(url,{headers:{Accept:'application/json'}},6500);if(!r.ok)throw new Error(`ESPN scoreboard ${r.status}`);return r.json();});}
async function fetchSummary(ctx,id){return cachedValue(`espn-summary-v7-${id}`,ctx,600,async()=>{const url=new URL(ESPN_SUMMARY);url.searchParams.set('event',id);const r=await fetchWithTimeout(url,{headers:{Accept:'application/json'}},6500);if(!r.ok)throw new Error(`ESPN summary ${r.status}`);return r.json();});}

function normalizeEspnEvent(event){
  const competition=event.competitions?.[0]||{},competitors=competition.competitors||[]; const homeRaw=competitors.find(r=>r.homeAway==='home')||competitors[0]||{},awayRaw=competitors.find(r=>r.homeAway==='away')||competitors[1]||{};
  const type=competition.status?.type||{}; const state=String(type.state||'pre').toLowerCase(); const desc=String(type.description||type.detail||'').toLowerCase(); const status=type.completed?'finished':state==='in'?'live':/(postpon|cancel|abandon|suspend)/.test(desc)?'postponed':'upcoming';
  const note=competition.altGameNote||competition.notes?.[0]?.headline||'FIFA World Cup'; const group=(String(note).match(/Group\s+([A-L])/i)||[])[1]?.toUpperCase()||'';
  return{id:`espn-${event.id||competition.id||''}`,startingAt:competition.date||event.date||new Date().toISOString(),status,minute:parseMinute(competition.status?.displayClock||type.shortDetail||'0'),stage:group?`Группа ${group}`:translateRound(note),group,venue:competition.venue?.fullName||'',city:competition.venue?.address?.city||'',home:normalizeEspnTeam(homeRaw,status),away:normalizeEspnTeam(awayRaw,status),events:normalizeEspnEvents(competition.details||[],homeRaw.team?.id,homeRaw.team?.displayName,awayRaw.team?.displayName),stats:normalizeEspnStats(homeRaw,awayRaw),h2h:{homeWins:0,draws:0,awayWins:0,matches:[]},lineups:{home:[],away:[]}};
}
function normalizeEspnTeam(row,status){const team=row.team||{},name=team.displayName||team.shortDisplayName||team.name||'Будет определено';return{id:String(team.id||slug(name)),espnId:String(team.id||''),name,short:team.abbreviation||teamShortName(name),countryCode:countryCodeFromName(name),logo:team.logo||team.logos?.[0]?.href||'',score:status==='upcoming'?null:nullableNumber(row.score)};}

function normalizeEspnEvents(details,homeId,homeName,awayName){
  return(details||[]).map(detail=>{
    const involved=[...(Array.isArray(detail.athletesInvolved)?detail.athletesInvolved:[]),...(Array.isArray(detail.participants)?detail.participants:[]),...(Array.isArray(detail.athletes)?detail.athletes:[])].map(r=>r?.athlete||r?.player||r).filter(Boolean);
    const athlete=involved[0]||detail.athlete||detail.player||detail.scorer||{},assist=involved[1]||detail.assist||{}; const typeText=String(detail.type?.text||detail.type?.description||detail.type||'Событие'),raw=String(detail.text||detail.shortText||detail.description||detail.headline||'').trim();
    const isGoal=Boolean(detail.scoringPlay||/goal|гол/i.test(typeText)||/goal|гол/i.test(raw)),isRed=Boolean(detail.redCard||/red card|красн/i.test(typeText)),isYellow=Boolean(detail.yellowCard||/yellow card|ж[её]лт/i.test(typeText));
    const playerName=athlete.displayName||athlete.fullName||athlete.shortName||athlete.name||extractScorer(raw,isGoal),assistName=assist.displayName||assist.fullName||assist.shortName||assist.name||extractAssist(raw); const side=String(detail.team?.id||detail.teamId||'')===String(homeId)?'home':'away';
    let text=raw||`${typeText}${playerName?` — ${playerName}`:''}`; if(isGoal) text=`${playerName?`Гол — ${playerName}`:'Гол'}${assistName?`, ассист: ${assistName}`:''}`;
    return{minute:parseMinute(detail.clock?.displayValue||detail.clock?.display||String((detail.clock?.value||0)/60)),icon:isGoal?'⚽':isRed?'🟥':isYellow?'🟨':/sub/i.test(typeText)?'⇄':'•',text,playerId:String(athlete.id||detail.athleteId||''),playerName:playerName||'',assistId:String(assist.id||''),assistName:assistName||'',photo:athlete.headshot?.href||athlete.headshot||espnPhoto(athlete.id),assistPhoto:assist.headshot?.href||assist.headshot||espnPhoto(assist.id),team:side,teamName:side==='home'?homeName:awayName,scoringPlay:isGoal,ownGoal:Boolean(detail.ownGoal||/own goal/i.test(raw))};
  }).sort((a,b)=>a.minute-b.minute);
}

function normalizeEspnStats(home,away){const get=(row,name)=>{const s=(row.statistics||[]).find(i=>String(i.name||'').toLowerCase()===name.toLowerCase());const n=Number(String(s?.displayValue??0).replace('%',''));return Number.isFinite(n)?n:0;};return{possession:[get(home,'possessionPct'),get(away,'possessionPct')],shots:[get(home,'totalShots'),get(away,'totalShots')],shotsOnTarget:[get(home,'shotsOnTarget'),get(away,'shotsOnTarget')],corners:[get(home,'wonCorners'),get(away,'wonCorners')],fouls:[get(home,'foulsCommitted'),get(away,'foulsCommitted')],passes:[get(home,'totalPasses'),get(away,'totalPasses')]};}
function normalizeEspnRosters(rosters,homeId,awayId){const one=id=>{const row=(rosters||[]).find(x=>String(x.team?.id)===String(id));return flattenAthletes(row?.roster||row?.athletes||row?.items||[]).map(normalizeEspnSquadPlayer).slice(0,30);};return{home:one(homeId),away:one(awayId)};}
function normalizeEspnBoxscore(boxscore,competitors,homeId,awayId){const teams=boxscore?.teams||[];if(!teams.length)return null;const find=id=>teams.find(r=>String(r.team?.id)===String(id))||competitors.find(r=>String(r.team?.id)===String(id));return normalizeEspnStats(find(homeId)||{},find(awayId)||{});}

function extractAllPlayerMatchStats(payload,match){
  const rosterById=new Map(); for(const side of ['home','away']) for(const p of normalizeEspnRosters(payload.rosters||[],match.home.id,match.away.id)[side]) rosterById.set(String(p.id),{...p,team:side==='home'?match.home.name:match.away.name});
  const rows=[]; for(const team of payload.boxscore?.players||payload.players||[]){const teamName=team.team?.displayName||team.team?.name||'';for(const group of team.statistics||[]){for(const entry of group.athletes||[]){const athlete=entry.athlete||entry.player||entry,id=String(athlete.id||''),base=rosterById.get(id)||{};const names=entry.statNames||group.names||group.labels||[];const vals=entry.stats||[];const map={};names.forEach((n,i)=>map[String(n)]=vals[i]);const get=(...keys)=>{for(const key of keys){const direct=map[key];if(direct!==undefined&&Number.isFinite(Number(direct)))return Number(direct);const obj=(entry.statistics||[]).find(s=>String(s.name||'').toLowerCase()===String(key).toLowerCase());if(obj&&Number.isFinite(Number(obj.value??obj.displayValue)))return Number(obj.value??obj.displayValue);}return 0;};
      const row={id,name:athlete.displayName||athlete.fullName||athlete.name||base.name||'Игрок',team:teamName||base.team||'',photo:athlete.headshot?.href||base.photo||espnPhoto(id),starter:Boolean(entry.starter??base.starter),minutes:get('minutes','mins'),goals:get('goals'),assists:get('assists'),shots:get('totalShots','shots'),shotsOnTarget:get('shotsOnTarget'),passes:get('totalPasses','passes','accuratePasses'),keyPasses:get('keyPasses'),tackles:get('tackles'),interceptions:get('interceptions'),dribbles:get('successfulDribbles','dribbles'),yellowCards:get('yellowCards'),redCards:get('redCards'),saves:get('saves'),conceded:get('goalsConceded'),cleanSheets:get('cleanSheets'),rating:get('rating')||null};
      const events=match.events||[]; row.goals=Math.max(row.goals,events.filter(e=>e.scoringPlay&&!e.ownGoal&&((id&&e.playerId===id)||normalizePlayerName(e.playerName)===normalizePlayerName(row.name))).length); row.assists=Math.max(row.assists,events.filter(e=>e.scoringPlay&&((id&&e.assistId===id)||normalizePlayerName(e.assistName)===normalizePlayerName(row.name))).length); row.rating=row.rating||computedRating(row); rows.push(row);
    }}}
  for(const [id,base] of rosterById){if(rows.some(r=>r.id===id))continue;const events=match.events||[];const goals=events.filter(e=>e.scoringPlay&&!e.ownGoal&&e.playerId===id).length,assists=events.filter(e=>e.scoringPlay&&e.assistId===id).length;if(goals||assists)rows.push({...base,goals,assists,minutes:0,starter:base.starter,rating:computedRating({goals,assists})});}
  return rows;
}
function attachRatings(lineups,rows){for(const side of ['home','away'])for(const p of lineups[side]||[]){const row=rows.find(r=>(p.id&&r.id===p.id)||normalizePlayerName(r.name)===normalizePlayerName(p.name));if(row)p.rating=Number(row.rating).toFixed(1);}}
function computedRating(row){let r=6+Number(row.goals||0)*1.0+Number(row.assists||0)*0.65+Number(row.shotsOnTarget||0)*0.08+Number(row.keyPasses||0)*0.08+Number(row.tackles||0)*0.04+Number(row.interceptions||0)*0.04+Number(row.saves||0)*0.07-Number(row.yellowCards||0)*0.2-Number(row.redCards||0)*1.0;return Math.max(4,Math.min(10,r)).toFixed(2);}

function deriveStandings(matches){const groups=new Map(),ensure=(g,t)=>{if(!groups.has(g))groups.set(g,new Map());const m=groups.get(g);if(!m.has(t.id))m.set(t.id,{pos:0,...t,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,gd:0,points:0,form:[]});return m.get(t.id);};for(const match of matches){if(!match.group)continue;const h=ensure(match.group,match.home),a=ensure(match.group,match.away);if(match.status!=='finished')continue;const hg=nullableNumber(match.home.score),ag=nullableNumber(match.away.score);if(hg===null||ag===null)continue;h.played++;a.played++;h.gf+=hg;h.ga+=ag;a.gf+=ag;a.ga+=hg;if(hg>ag){h.won++;a.lost++;h.points+=3;h.form.push('W');a.form.push('L');}else if(hg<ag){a.won++;h.lost++;a.points+=3;a.form.push('W');h.form.push('L');}else{h.drawn++;a.drawn++;h.points++;a.points++;h.form.push('D');a.form.push('D');}}
  return[...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([group,rows])=>{const teams=[...rows.values()].map(r=>({...r,gd:r.gf-r.ga,form:r.form.slice(-5)})).sort((a,b)=>b.points-a.points||b.gd-a.gd||b.gf-a.gf||a.name.localeCompare(b.name));teams.forEach((t,i)=>t.pos=i+1);return{group,teams};});}
function deriveLeaders(matches){const m=new Map();for(const match of matches)for(const e of match.events||[]){if(e.scoringPlay&&!e.ownGoal)bumpLeader(m,e.playerId,e.playerName,e.teamName,e.photo,'goals',1);if(e.scoringPlay&&e.assistName)bumpLeader(m,e.assistId,e.assistName,e.teamName,e.assistPhoto,'assists',1);}const all=[...m.values()],rows=(metric,label)=>all.filter(r=>r[metric]>0).sort((a,b)=>b[metric]-a[metric]).slice(0,20).map((r,i)=>({...r,value:r[metric],rank:i+1,label}));return{scorers:rows('goals','голов'),goals:rows('goals','голов'),assists:rows('assists','ассистов'),ratings:[]};}
function leaderBase(id,name,team,photo){return{id:String(id||''),espnId:String(id||''),name:name||'Игрок',team:team||'Сборная',countryCode:countryCodeFromName(team),photo:photo||'',photoCandidates:uniqueStrings([photo,id?espnPhoto(id):'',id?espnPhotoLarge(id):'']),goals:0,assists:0,ratingSum:0,ratingCount:0};}
function leaderKey(id,name,team){return String(id||`${normalizePlayerName(name)}-${normalizeTeamName(team)}`);}
function bumpLeader(map,id,name,team,photo,metric,value){if(!name)return;const key=leaderKey(id,name,team),row=map.get(key)||leaderBase(id,name,team,photo);row[metric]=Number(row[metric]||0)+value;if(photo&&!row.photo)row.photo=photo;map.set(key,row);}

async function deriveH2H(ctx,match){
  const found=[]; try{const snapshot=await buildSnapshot(ctx);for(const row of snapshot.matches){const direct=sameTeam(row.home.name,match.home.name)&&sameTeam(row.away.name,match.away.name),reverse=sameTeam(row.home.name,match.away.name)&&sameTeam(row.away.name,match.home.name);if((direct||reverse)&&row.status==='finished')found.push({date:row.startingAt,home:row.home.name,away:row.away.name,homeScore:row.home.score,awayScore:row.away.score,competition:'FIFA World Cup 2026'});}}catch{}
  const pairs=[[match.home.name,match.away.name],[match.away.name,match.home.name]];for(const [a,b] of pairs){try{const url=`${SPORTSDB}/searchevents.php?e=${encodeURIComponent(`${a}_vs_${b}`.replace(/\s+/g,'_'))}`;const data=await cachedValue(`h2h-${normalizeTeamName(a)}-${normalizeTeamName(b)}`,ctx,OPEN_TTL,async()=>{const r=await fetchWithTimeout(url,{headers:{Accept:'application/json'}},3500);if(!r.ok)throw new Error('sportsdb');return r.json();});for(const e of data.event||[]){const hs=nullableNumber(e.intHomeScore),as=nullableNumber(e.intAwayScore);if(hs===null||as===null)continue;found.push({date:e.dateEvent||e.strTimestamp||'',home:e.strHomeTeam||a,away:e.strAwayTeam||b,homeScore:hs,awayScore:as,competition:e.strLeague||e.strEvent||'Международный матч'});}}catch{}}
  const uniq=[];const seen=new Set();for(const r of found){const k=`${String(r.date).slice(0,10)}-${normalizeTeamName(r.home)}-${r.homeScore}-${r.awayScore}`;if(!seen.has(k)){seen.add(k);uniq.push(r);}}
  uniq.sort((a,b)=>String(b.date).localeCompare(String(a.date)));let homeWins=0,draws=0,awayWins=0;for(const r of uniq){const homeIsTarget=sameTeam(r.home,match.home.name),hg=homeIsTarget?r.homeScore:r.awayScore,ag=homeIsTarget?r.awayScore:r.homeScore;if(hg>ag)homeWins++;else if(hg<ag)awayWins++;else draws++;}
  return{homeWins,draws,awayWins,matches:uniq.slice(0,8),scope:uniq.length?'Найденные встречи в открытых источниках':'Нет подтверждённых данных'};
}

async function fetchEspnTeam(ctx,id){
  const [d,r]=await Promise.allSettled([cachedValue(`team-${id}`,ctx,86400,async()=>{const x=await fetchWithTimeout(`${ESPN_TEAMS}/${id}`,{headers:{Accept:'application/json'}},5000);if(!x.ok)throw new Error('team');return x.json();}),cachedValue(`roster-${id}`,ctx,21600,async()=>{const x=await fetchWithTimeout(`${ESPN_TEAMS}/${id}/roster`,{headers:{Accept:'application/json'}},5000);if(!x.ok)throw new Error('roster');return x.json();})]);
  const details=fulfilled(d)||{},roster=fulfilled(r)||{},raw=details.team||details.sports?.[0]?.leagues?.[0]?.teams?.[0]?.team||details;const rows=flattenAthletes(roster.athletes||roster.roster||roster.items||raw.athletes||details.athletes||[]);
  return{source:'ESPN',team:{id:String(raw.id||id),espnId:String(raw.id||id),name:raw.displayName||raw.name||'Сборная',short:raw.abbreviation||teamShortName(raw.displayName||raw.name),countryCode:countryCodeFromName(raw.displayName||raw.name),logo:raw.logos?.[0]?.href||raw.logo||''},coach:raw.coach?.displayName||details.coach?.displayName||'',squad:rows.map(normalizeEspnSquadPlayer).filter(p=>p.name!=='Игрок')};
}
async function fetchSquadFromMatches(ctx,snapshot,base){const matches=snapshot.matches.filter(m=>(sameTeam(m.home.name,base.name)||sameTeam(m.away.name,base.name))&&m.status!=='upcoming').sort((a,b)=>new Date(b.startingAt)-new Date(a.startingAt)).slice(0,3);const rows=await mapLimit(matches,3,async m=>{try{const payload=await fetchSummary(ctx,String(m.id).replace(/^espn-/,'')),c=payload.header?.competitions?.[0]||{},hid=String(c.competitors?.find(x=>x.homeAway==='home')?.team?.id||m.home.id),aid=String(c.competitors?.find(x=>x.homeAway==='away')?.team?.id||m.away.id),rosters=normalizeEspnRosters(payload.rosters||[],hid,aid);return sameTeam(m.home.name,base.name)?rosters.home:rosters.away;}catch{return[];}});let squad=[];for(const row of rows)squad=mergePlayers(squad,row||[]);return squad.length?{source:'ESPN match roster',squad}:null;}
function flattenAthletes(v){if(!Array.isArray(v))return[];const out=[];for(const r of v){if(Array.isArray(r?.items))out.push(...r.items);else if(Array.isArray(r?.athletes))out.push(...r.athletes);else out.push(r);}return out;}
function normalizeEspnSquadPlayer(entry){const a=entry.athlete||entry.player||entry,id=String(a.id||entry.id||''),photo=a.headshot?.href||a.headshot||espnPhoto(id);return{id,espnId:id,name:a.displayName||a.fullName||a.name||'Игрок',number:a.jersey||entry.jersey||null,pos:a.position?.abbreviation||a.position?.displayName||a.position?.name||a.position||entry.position?.abbreviation||'',age:a.age||null,height:a.displayHeight||'',weight:a.displayWeight||'',photo,photoCandidates:uniqueStrings([photo,espnPhoto(id),espnPhotoLarge(id)]),starter:Boolean(entry.starter)};}

async function fetchEspnAthlete(ctx,id){return cachedValue(`athlete-${id}`,ctx,OPEN_TTL,async()=>{const r=await fetchWithTimeout(`${ESPN_ATHLETE}/${id}`,{headers:{Accept:'application/json'}},4000);if(!r.ok)throw new Error(`athlete ${r.status}`);const a=await r.json();let currentClub=null;const ref=a.team?.$ref||a.team?.ref;if(ref){try{const tr=await fetchWithTimeout(ref,{headers:{Accept:'application/json'}},2500);if(tr.ok){const t=await tr.json();currentClub={name:t.displayName||t.name||'',logo:t.logos?.[0]?.href||''};}}catch{}}
    return{id:String(a.id||id),name:a.displayName||a.fullName||a.name||'',birthDate:a.dateOfBirth||'',age:a.age||null,nationality:a.citizenship||a.birthPlace?.country||'',height:a.displayHeight||'',weight:a.displayWeight||'',position:a.position?.displayName||a.position?.name||a.position?.abbreviation||'',photo:a.headshot?.href||espnPhoto(id),currentClub};});}

async function fetchSportsDbTeamRoster(ctx,teamName){
  return cachedValue(`sportsdb-roster-v71-${normalizeTeamName(teamName)}`,ctx,OPEN_TTL,async()=>{
    const searchUrl=`${SPORTSDB}/searchteams.php?t=${encodeURIComponent(String(teamName).replace(/\s+/g,'_'))}`;
    const sr=await fetchWithTimeout(searchUrl,{headers:{Accept:'application/json'}},3000);if(!sr.ok)throw new Error('sportsdb team search');
    const search=await sr.json();const teams=search.teams||search.team||[];const wanted=normalizeTeamName(teamName);
    const team=teams.find(t=>normalizeTeamName(t.strTeam)===wanted&&/soccer/i.test(t.strSport||'Soccer'))||teams.find(t=>normalizeTeamName(t.strTeam)===wanted)||teams[0];
    if(!team?.idTeam)throw new Error('sportsdb team not found');
    const rr=await fetchWithTimeout(`${SPORTSDB}/lookup_all_players.php?id=${encodeURIComponent(team.idTeam)}`,{headers:{Accept:'application/json'}},3500);if(!rr.ok)throw new Error('sportsdb roster');
    const data=await rr.json();const rows=data.player||data.players||[];
    const squad=rows.map(row=>({id:String(row.idPlayer||''),name:row.strPlayer||'Игрок',number:row.strNumber||null,pos:row.strPosition||'',age:calculateAge(row.dateBorn||''),height:row.strHeight||'',weight:row.strWeight||'',photo:row.strCutout||row.strThumb||row.strRender||'',photoCandidates:uniqueStrings([row.strCutout,row.strThumb,row.strRender]),nationality:row.strNationality||'',starter:false})).filter(row=>row.name!=='Игрок');
    return{source:'TheSportsDB roster',coach:'',squad};
  });
}

async function fetchSportsDbPlayer(ctx,name,team){return cachedValue(`sportsdb-player-${normalizePlayerName(name)}`,ctx,OPEN_TTL,async()=>{const url=`${SPORTSDB}/searchplayers.php?p=${encodeURIComponent(name.replace(/\s+/g,'_'))}`;const r=await fetchWithTimeout(url,{headers:{Accept:'application/json'}},3200);if(!r.ok)throw new Error('sportsdb player');const data=await r.json(),rows=data.player||data.players||[],wanted=normalizePlayerName(name),country=normalizeTeamName(team||'');const row=rows.find(x=>normalizePlayerName(x.strPlayer)===wanted&&(!country||normalizeTeamName(x.strNationality||'').includes(country)))||rows.find(x=>normalizePlayerName(x.strPlayer)===wanted)||rows[0];if(!row)return null;return{id:String(row.idPlayer||''),name:row.strPlayer||name,photo:row.strCutout||row.strThumb||row.strRender||'',height:row.strHeight||'',weight:row.strWeight||'',birthDate:row.dateBorn||'',nationality:row.strNationality||'',position:row.strPosition||'',description:row.strDescriptionEN||'',currentClub:row.strTeam?{name:row.strTeam,logo:row.strTeamBadge||''}:null,website:row.strWebsite||''};});}
async function fetchSportsDbHonours(ctx,id,nationality){if(!id)return[];return cachedValue(`sportsdb-honours-${id}`,ctx,OPEN_TTL,async()=>{const r=await fetchWithTimeout(`${SPORTSDB}/lookuphonours.php?id=${encodeURIComponent(id)}`,{headers:{Accept:'application/json'}},3200);if(!r.ok)throw new Error('sportsdb honours');const data=await r.json();const rows=data.honours||data.honor||[];return rows.map(x=>{const title=x.strHonour||x.strAward||x.strTrophy||'',team=x.strTeam||'',season=x.strSeason||x.strYear||'',national=/world cup|copa america|euro|nations league|olympic|africa cup|asian cup|gold cup|finalissima|international/i.test(`${title} ${team}`)||sameTeam(team,nationality);if(!national)return null;const individual=/best|golden|player|boot|ball|glove|young/i.test(title);return individual?{kind:'individual',title,tournament:x.strLeague||'Международный турнир',year:season,wikiTitle:title}:{kind:'team',title:title||x.strLeague||'Международный трофей',competition:x.strLeague||title,season,place:x.strPlace||'Победитель',wikiTitle:x.strLeague||title};}).filter(Boolean);});}

async function fetchWikidataPlayer(ctx,name,nationality){
  const search=await cachedValue(`wd-search-${normalizePlayerName(name)}`,ctx,OPEN_TTL,async()=>{const u=new URL(WIKIDATA_API);Object.entries({action:'wbsearchentities',search:name,language:'en',uselang:'en',type:'item',limit:'6',format:'json',origin:'*'}).forEach(([k,v])=>u.searchParams.set(k,v));const r=await fetchWithTimeout(u,{headers:{Accept:'application/json','User-Agent':'WC26/7'}},4200);if(!r.ok)throw new Error('wd search');return r.json();});
  const wanted=normalizePlayerName(name),country=normalizeTeamName(nationality),candidate=(search.search||[]).find(x=>normalizePlayerName(x.label)===wanted&&/football|soccer/i.test(x.description||''))||(search.search||[]).find(x=>/football|soccer/i.test(x.description||'')&&(!country||normalizeTeamName(x.description).includes(country)))||(search.search||[]).find(x=>/football|soccer/i.test(x.description||''));if(!candidate?.id)return null;
  const payload=await cachedValue(`wd-entity-${candidate.id}`,ctx,OPEN_TTL,async()=>{const r=await fetchWithTimeout(`${WIKIDATA_ENTITY}/${candidate.id}.json`,{headers:{Accept:'application/json','User-Agent':'WC26/7'}},4200);if(!r.ok)throw new Error('wd entity');return r.json();});const e=payload.entities?.[candidate.id];if(!e)return null;
  const ids=uniqueStrings([...claimIds(e,'P54'),...claimIds(e,'P413'),...claimIds(e,'P27'),...claimIds(e,'P1532'),...claimIds(e,'P166'),...claimIds(e,'P1344')]);const related=await fetchWikidataRelated(ctx,ids),label=id=>related[id]?.labels?.ru?.value||related[id]?.labels?.en?.value||id;const image=claimString(e,'P18'),positionId=claimIds(e,'P413')[0],nationId=claimIds(e,'P27')[0]||claimIds(e,'P1532')[0],site=e.sitelinks?.ruwiki||e.sitelinks?.enwiki;
  const participations=claimIds(e,'P1344').map(id=>({title:label(id),year:(label(id).match(/(?:19|20)\d{2}/)||[''])[0]})).filter(r=>/world cup|euro|copa|olympic|nations league|africa cup|asian cup|gold cup|fifa/i.test(r.title));
  const awards=claimIds(e,'P166').map(id=>label(id)).filter(t=>/world cup|golden ball|golden boot|golden glove|young player/i.test(t)).map(title=>({title,tournament:'Международный турнир',year:(title.match(/(?:19|20)\d{2}/)||[''])[0],wikiTitle:title}));
  return{qid:candidate.id,name:e.labels?.ru?.value||e.labels?.en?.value||candidate.label||name,description:e.descriptions?.ru?.value||e.descriptions?.en?.value||candidate.description||'',photo:image?wikimediaImage(image,900):'',birthDate:claimTime(e,'P569'),height:formatMeasurement(claimMeasurement(e,'P2048'),'height'),weight:formatMeasurement(claimMeasurement(e,'P2067'),'weight'),position:positionId?label(positionId):'',nationality:nationId?label(nationId):nationality||'',currentClub:chooseWikidataClub(e,related,nationality),nationalCareer:parseNationalCareer(e,related,nationality),participations,individualAwards:awards,wikipediaTitle:site?.title||'',transfermarktId:claimString(e,'P2446')};
}
async function fetchWikidataRelated(ctx,ids){if(!ids.length)return{};const batches=[];for(let i=0;i<ids.length;i+=45)batches.push(ids.slice(i,i+45));const payloads=await Promise.all(batches.map(batch=>cachedValue(`wd-related-${batch.join('-')}`,ctx,OPEN_TTL,async()=>{const u=new URL(WIKIDATA_API);Object.entries({action:'wbgetentities',ids:batch.join('|'),props:'labels|claims',languages:'ru|en',languagefallback:'1',format:'json',origin:'*'}).forEach(([k,v])=>u.searchParams.set(k,v));const r=await fetchWithTimeout(u,{headers:{Accept:'application/json','User-Agent':'WC26/7'}},4200);if(!r.ok)throw new Error('wd related');return r.json();})));return Object.assign({},...payloads.map(p=>p.entities||{}));}

async function enrichHonoursImages(ctx,rows){return Promise.all((rows||[]).map(async row=>{const title=row.wikiTitle||row.competition||row.tournament||row.title;try{const summary=await fetchWikipediaSummary(ctx,title);return{...row,image:summary.thumbnail||'',link:summary.url||''};}catch{return row;}}));}
async function fetchWikipediaSummary(ctx,title){return cachedValue(`wiki-summary-${title}`,ctx,OPEN_TTL,async()=>{const r=await fetchWithTimeout(`${WIKIPEDIA_SUMMARY}/${encodeURIComponent(String(title).replace(/ /g,'_'))}`,{headers:{Accept:'application/json','User-Agent':'WC26/7'}},3200);if(!r.ok)throw new Error('wiki summary');const x=await r.json();return{extract:x.extract||'',thumbnail:x.thumbnail?.source||x.originalimage?.source||'',url:x.content_urls?.desktop?.page||''};});}

async function collectEspnPlayerStats(ctx,player,teamName){
  return cachedValue(`player-stats-v72-${normalizePlayerName(player.name)}-${normalizeTeamName(teamName)}`,ctx,900,async()=>{
    const snapshot=await buildSnapshot(ctx);
    const matches=snapshot.matches.filter(m=>m.status!=='upcoming'&&(sameTeam(m.home.name,teamName)||sameTeam(m.away.name,teamName))).slice(-8);
    const summaries=await mapLimit(matches,8,async m=>{try{return await fetchSummary(ctx,String(m.id).replace(/^espn-/,''));}catch{return null;}});
    const total=emptyStats(/goalkeeper|\bgk\b/i.test(player.position||'')),ratings=[];
    const targetName=normalizePlayerName(player.name),targetId=String(player.espnId||player.id||'');
    const seenMatches=new Set();

    for(let index=0;index<matches.length;index++){
      const scheduledMatch=matches[index];
      const payload=summaries[index];
      let row=null, match=scheduledMatch, rosterHit=null;
      if(payload){
        const c=payload.header?.competitions?.[0];
        if(c) match=normalizeEspnEvent({id:c.id,date:c.date,competitions:[{...c,details:payload.plays||payload.scoringPlays||c.details||[]}]});
        const rows=extractAllPlayerMatchStats(payload,match);
        row=rows.find(r=>(targetId&&String(r.id)===targetId)||normalizePlayerName(r.name)===targetName)||null;
        const rosters=normalizeEspnRosters(payload.rosters||[],match.home.id,match.away.id);
        rosterHit=[...(rosters.home||[]),...(rosters.away||[])].find(r=>(targetId&&String(r.id)===targetId)||normalizePlayerName(r.name)===targetName)||null;
      }
      const events=(match.events||[]).filter(e=>
        (targetId&&String(e.playerId||'')===targetId)||
        (targetId&&String(e.assistId||'')===targetId)||
        normalizePlayerName(e.playerName)===targetName||
        normalizePlayerName(e.assistName)===targetName
      );
      const eventGoals=(match.events||[]).filter(e=>e.scoringPlay&&!e.ownGoal&&((targetId&&String(e.playerId||'')===targetId)||normalizePlayerName(e.playerName)===targetName)).length;
      const eventAssists=(match.events||[]).filter(e=>e.scoringPlay&&((targetId&&String(e.assistId||'')===targetId)||normalizePlayerName(e.assistName)===targetName)).length;
      const participated=Boolean(row||rosterHit?.starter||events.length);
      if(participated&&!seenMatches.has(String(match.id))){total.appearances++;seenMatches.add(String(match.id));}
      if(row?.starter||rosterHit?.starter) total.lineups++;
      if(row){
        for(const key of ['minutes','shots','shotsOnTarget','passes','keyPasses','tackles','interceptions','dribbles','yellowCards','redCards','saves','conceded','cleanSheets']) total[key]+=Number(row[key]||0);
        total.goals+=Math.max(Number(row.goals||0),eventGoals);
        total.assists+=Math.max(Number(row.assists||0),eventAssists);
        ratings.push(Number(row.rating||computedRating(row)));
      }else{
        total.goals+=eventGoals;
        total.assists+=eventAssists;
        if(events.length) ratings.push(Number(computedRating({goals:eventGoals,assists:eventAssists})));
      }
    }
    total.rating=ratings.length?(ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(2):null;
    return applyPlayerStatFloor(player.name,total,'worldCup2026');
  });
}

function applyPlayerStatFloor(name,stats,scope){
  const floor=PLAYER_STAT_FLOORS.get(normalizePlayerName(name))?.[scope];
  if(!floor)return stats;
  const out={...(stats||{})};
  for(const [key,value] of Object.entries(floor)){
    if(typeof value==='number')out[key]=Math.max(Number(out[key]||0),value);
    else if(out[key]===null||out[key]===undefined||out[key]==='')out[key]=value;
  }
  return out;
}

function resolveCurrentClub(name,...clubs){const n=normalizePlayerName(name),override=CLUB_OVERRIDES.get(n);if(override)return override;const nationality=clubs.pop();for(const c of clubs)if(c?.name&&!sameTeam(c.name,nationality))return c;return null;}
function chooseWikidataClub(e,related,nationality){const now=Date.now(),rows=(e.claims?.P54||[]).map(s=>{const id=s.mainsnak?.datavalue?.value?.id;if(!id)return null;const name=related[id]?.labels?.ru?.value||related[id]?.labels?.en?.value||'',end=qualifierDate(s,'P582'),start=qualifierDate(s,'P580'),active=!end||end>=now,national=sameTeam(name,nationality)||/national|olympic|under-?\d|u-?\d|сборн/i.test(name);return{name,active,national,start:start||0,preferred:s.rank==='preferred'};}).filter(Boolean).filter(r=>r.active&&!r.national&&r.name).sort((a,b)=>Number(b.preferred)-Number(a.preferred)||b.start-a.start);if(!rows[0])return null;const entity=Object.values(related).find(x=>(x.labels?.ru?.value||x.labels?.en?.value)===rows[0].name),logo=claimString(entity,'P154');return{name:rows[0].name,logo:logo?wikimediaImage(logo,300):'',source:'Wikidata'};}
function parseNationalCareer(e,related,nationality){return(e.claims?.P54||[]).map(s=>{const id=s.mainsnak?.datavalue?.value?.id;if(!id)return null;const team=related[id]?.labels?.ru?.value||related[id]?.labels?.en?.value||'';if(!(sameTeam(team,nationality)||/national|olympic|under-?\d|u-?\d|сборн/i.test(team)))return null;return{team,start:qualifierYear(s,'P580'),end:qualifierYear(s,'P582'),appearances:qualifierQuantity(s,'P1350'),goals:qualifierQuantity(s,'P1351')};}).filter(Boolean);}
function buildNationalCareer(wiki,stats){const senior=(wiki?.nationalCareer||[]).find(r=>!/under|u-?\d|olympic|youth/i.test(r.team||''))||wiki?.nationalCareer?.[0];return{appearances:senior?.appearances??stats.appearances??null,minutes:stats.minutes??null,goals:senior?.goals??stats.goals??null,assists:stats.assists??null,rating:stats.rating??null,tournaments:wiki?.participations?.length||null};}
function buildLinks(player,wiki,sports){const links=[];if(wiki?.wikipediaTitle)links.push({label:'Wikipedia',url:`https://en.wikipedia.org/wiki/${encodeURIComponent(wiki.wikipediaTitle.replace(/ /g,'_'))}`});if(wiki?.qid)links.push({label:'Wikidata',url:`https://www.wikidata.org/wiki/${wiki.qid}`});if(sports?.id)links.push({label:'TheSportsDB',url:`https://www.thesportsdb.com/player/${sports.id}`});if(player.espnId)links.push({label:'ESPN',url:`https://www.espn.com/soccer/player/_/id/${player.espnId}`});if(wiki?.transfermarktId)links.push({label:'Transfermarkt',url:`https://www.transfermarkt.com/-/profil/spieler/${encodeURIComponent(wiki.transfermarktId)}`});return links;}

function mergePlayers(a=[],b=[]){const out=[],used=new Set();for(const p of a){const q=findPlayer(p,b);if(q)used.add(playerMarker(q));out.push(mergePlayerRecord(p,q));}for(const p of b)if(!used.has(playerMarker(p))&&!out.some(x=>normalizePlayerName(x.name)===normalizePlayerName(p.name)))out.push(p);return out;}
function findPlayer(p,rows){return(rows||[]).find(x=>(p.id&&x.id&&String(p.id)===String(x.id))||normalizePlayerName(p.name)===normalizePlayerName(x.name));}
function mergePlayerRecord(a,b){if(!b)return a;return{...b,...a,photo:a.photo||b.photo,photoCandidates:uniqueStrings([...(a.photoCandidates||[]),a.photo,...(b.photoCandidates||[]),b.photo]),height:a.height||b.height,weight:a.weight||b.weight,pos:a.pos||b.pos,age:a.age||b.age};}
function emptyStats(gk=false){return{appearances:0,lineups:0,minutes:0,goals:0,assists:0,shots:0,shotsOnTarget:0,passes:0,keyPasses:0,tackles:0,interceptions:0,dribbles:0,yellowCards:0,redCards:0,saves:0,conceded:0,cleanSheets:gk?0:undefined,rating:null,isGoalkeeper:gk};}
function dedupeTrophies(rows){const m=new Map();for(const r of rows||[]){const k=`${normalizeTeamName(r.title||r.competition)}-${r.season}-${r.place}`;if((r.title||r.competition)&&!m.has(k))m.set(k,r);}return[...m.values()].slice(0,30);}
function dedupeAwards(rows){const m=new Map();for(const r of rows||[]){const k=`${normalizeTeamName(r.title)}-${r.year}`;if(r.title&&!m.has(k))m.set(k,r);}return[...m.values()].slice(0,30);}
function findTeamInSnapshot(snapshot,q){const teams=[];for(const m of snapshot.matches||[])teams.push(m.home,m.away);return teams.find(t=>(q.id&&String(t.id)===String(q.id))||(q.code&&t.countryCode===q.code)||(q.name&&sameTeam(t.name,q.name)));}
function extractScorer(text,isGoal){if(!isGoal)return'';const clean=String(text||'').replace(/\s+/g,' ').trim();for(const p of [/(?:goal|scores?|scored by)\s*[-–—:]?\s*([^,(;]+?)(?:\s*\(|,|;|$)/i,/^([^,(;]+?)\s+(?:goal|scores?)(?:\s|$)/i,/(?:гол|забил)\s*[-–—:]?\s*([^,(;]+?)(?:\s*\(|,|;|$)/i]){const m=clean.match(p);if(m?.[1])return m[1].trim();}return'';}
function extractAssist(text){const clean=String(text||'').replace(/\s+/g,' ').trim();for(const p of [/(?:assist(?:ed)? by|assists?:)\s*([^,;()]+?)(?:[,;()]|$)/i,/(?:ассист|передача)\s*[:—-]?\s*([^,;()]+?)(?:[,;()]|$)/i]){const m=clean.match(p);if(m?.[1])return m[1].trim();}return'';}
function countryCodeFromName(n){return COUNTRY_CODES.get(normalizeTeamName(n))||'';}
function normalizeTeamName(v){const x=String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();return TEAM_ALIASES.get(x)||x;}
function sameTeam(a,b){const x=normalizeTeamName(a),y=normalizeTeamName(b);return Boolean(x&&y&&(x===y||x.includes(y)||y.includes(x)));}
function normalizePlayerName(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').replace(/\b(jr|junior|ii|iii|iv)\b/g,'').replace(/\s+/g,' ').trim();}
function teamShortName(n){const w=String(n||'').split(/\s+/).filter(Boolean);return(w.length>1?w.map(x=>x[0]).join(''):String(n||'').slice(0,3)).toUpperCase().slice(0,4);}
function slug(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
function nullableNumber(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;}
function parseMinute(v){const m=String(v||'').match(/\d+/);return m?Number(m[0]):0;}
function translateRound(v){const t=String(v||'');if(/group/i.test(t))return t.replace(/Group/i,'Группа');if(/final/i.test(t)&&!/semi|quarter|round/i.test(t))return'Финал';if(/semi/i.test(t))return'Полуфинал';if(/quarter/i.test(t))return'Четвертьфинал';if(/round of 32/i.test(t))return'1/16 финала';if(/round of 16/i.test(t))return'1/8 финала';return t||'Чемпионат мира 2026';}
function playerMarker(p){return String(p.id||p.espnId||normalizePlayerName(p.name));}
function uniqueStrings(v){return[...new Set((v||[]).filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()))];}
function fulfilled(r){return r?.status==='fulfilled'?r.value:null;}
function safeError(e){return String(e?.message||e||'Unknown error').slice(0,400);}
function calculateAge(date){const b=new Date(date);if(Number.isNaN(b.getTime()))return null;const n=new Date();let a=n.getUTCFullYear()-b.getUTCFullYear();if(n.getUTCMonth()<b.getUTCMonth()||(n.getUTCMonth()===b.getUTCMonth()&&n.getUTCDate()<b.getUTCDate()))a--;return a>0&&a<70?a:null;}
function normalizeHeight(value){if(value===null||value===undefined||value==='')return'';const t=String(value).trim().toLowerCase().replace(',','.');const ft=t.match(/(\d+)\s*['′]\s*(\d+)?/);if(ft)return`${Math.round((Number(ft[1])*12+Number(ft[2]||0))*2.54)} см`;const n=Number((t.match(/-?\d+(?:\.\d+)?/)||[])[0]);if(!Number.isFinite(n))return'';let cm;if(/mm|миллимет/.test(t))cm=n/10;else if(/inch|in\b|дюйм/.test(t))cm=n*2.54;else if(/\bm\b|meter|метр/.test(t)&&n<10)cm=n*100;else if(/cm|см|centimeter/.test(t))cm=n;else if(n>=1.35&&n<=2.3)cm=n*100;else if(n>=135&&n<=230)cm=n;else if(n>=1350&&n<=2300)cm=n/10;else return'';return cm>=135&&cm<=230?`${Math.round(cm)} см`:'';}
function normalizeWeight(value){if(value===null||value===undefined||value==='')return'';const t=String(value).trim().toLowerCase().replace(',','.'),n=Number((t.match(/-?\d+(?:\.\d+)?/)||[])[0]);if(!Number.isFinite(n))return'';let kg;if(/lb|lbs|pound|фунт/.test(t))kg=n*.453592;else if(/gram|\bg\b|грам/.test(t)&&n>1000)kg=n/1000;else if(n>=45&&n<=180)kg=n;else if(n>=45000&&n<=180000)kg=n/1000;else return'';return kg>=45&&kg<=180?`${Math.round(kg)} кг`:'';}
function claimIds(e,p){return(e?.claims?.[p]||[]).map(s=>s.mainsnak?.datavalue?.value?.id).filter(Boolean);}
function claimString(e,p){return e?.claims?.[p]?.[0]?.mainsnak?.datavalue?.value||'';}
function claimTime(e,p){const r=e?.claims?.[p]?.[0]?.mainsnak?.datavalue?.value?.time||'';return r?r.replace(/^\+/,'').slice(0,10):'';}
function claimMeasurement(e,p){const v=e?.claims?.[p]?.[0]?.mainsnak?.datavalue?.value;if(!v)return null;return{amount:Number(v.amount),unit:String(v.unit||'')};}
function formatMeasurement(m,type){if(!m||!Number.isFinite(m.amount))return'';let n=m.amount;if(type==='height'){if(/Q11573$/.test(m.unit))n*=100;else if(/Q174789$/.test(m.unit))n/=10;else if(/Q218593$/.test(m.unit))n*=2.54;else if(/Q3710$/.test(m.unit))n*=30.48;else if(n>1.3&&n<2.3)n*=100;else if(n>1300&&n<2300)n/=10;return n>=135&&n<=230?`${Math.round(n)} см`:'';}if(/Q100995$/.test(m.unit))n*=.453592;else if(/Q41803$/.test(m.unit))n/=1000;else if(n>45000)n/=1000;return n>=45&&n<=180?`${Math.round(n)} кг`:'';}
function qualifierDate(s,p){const r=s.qualifiers?.[p]?.[0]?.datavalue?.value?.time||'';if(!r)return 0;const d=Date.parse(r.replace(/^\+/,'').slice(0,10));return Number.isFinite(d)?d:0;}
function qualifierYear(s,p){const r=s.qualifiers?.[p]?.[0]?.datavalue?.value?.time||'',m=r.match(/(?:19|20)\d{2}/);return m?Number(m[0]):null;}
function qualifierQuantity(s,p){const a=s.qualifiers?.[p]?.[0]?.datavalue?.value?.amount,n=Number(a);return Number.isFinite(n)?n:null;}
function wikimediaImage(f,w=800){return`https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(f)}?width=${w}`;}
function espnPhoto(id){return/^\d+$/.test(String(id||''))?`https://a.espncdn.com/i/headshots/soccer/players/full/${id}.png`:'';}
function espnPhotoLarge(id){return/^\d+$/.test(String(id||''))?`https://a.espncdn.com/i/headshots/soccer/players/large/${id}.png`:'';}

async function proxyImage(rawUrl,ctx,cors){if(!rawUrl)return new Response(null,{status:404,headers:cors});let target;try{target=new URL(rawUrl);}catch{return new Response(null,{status:400,headers:cors});}if(target.protocol!=='https:'||!MEDIA_HOSTS.some(s=>target.hostname.endsWith(s)))return new Response(null,{status:403,headers:cors});const key=new Request(`https://image-cache.invalid/${encodeURIComponent(target.href)}`),cached=await caches.default.match(key);if(cached)return withCors(cached,cors);try{const r=await fetchWithTimeout(target.href,{headers:{Accept:'image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=.8','User-Agent':'Mozilla/5.0 WC26/7.1'}},6000),type=r.headers.get('content-type')||'';if(!r.ok||!type.startsWith('image/'))return new Response(null,{status:404,headers:cors});const h=new Headers(cors);h.set('Content-Type',type);h.set('Cache-Control','public,max-age=86400,s-maxage=2592000,stale-while-revalidate=86400');h.set('Cross-Origin-Resource-Policy','cross-origin');const out=new Response(r.body,{status:200,headers:h});ctx?.waitUntil?.(caches.default.put(key,out.clone()));return out;}catch{return new Response(null,{status:404,headers:cors});}}
async function fetchWithTimeout(input,init={},timeout=6000){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeout);
  const headers=new Headers(init.headers||{});headers.delete('User-Agent');headers.delete('user-agent');
  try{return await NATIVE_FETCH(input,{...init,headers,mode:'cors',signal:c.signal});}
  finally{clearTimeout(timer);}
}
async function withDeadline(p,t){let timer;try{return await Promise.race([p,new Promise((_,rej)=>{timer=setTimeout(()=>rej(new Error('timeout')),t);})]);}finally{clearTimeout(timer);}}
async function mapLimit(items,limit,mapper){const out=new Array(items.length);let next=0;const workers=Array.from({length:Math.min(limit,items.length)},async()=>{while(true){const i=next++;if(i>=items.length)return;try{out[i]=await mapper(items[i],i);}catch{out[i]=null;}}});await Promise.all(workers);return out;}
async function cachedValue(key,ctx,ttl,producer){
  const now=Date.now(),memory=CLIENT_CACHE.get(key);
  if(memory&&now-memory.time<ttl*1000)return memory.value;
  const storageKey=`wc26-direct-cache-v8:${key}`;
  try{
    const raw=localStorage.getItem(storageKey);
    if(raw){const row=JSON.parse(raw);if(row&&now-Number(row.time||0)<ttl*1000){CLIENT_CACHE.set(key,row);return row.value;}}
  }catch{}
  const value=await producer();const row={time:now,value};CLIENT_CACHE.set(key,row);
  try{const serialized=JSON.stringify(row);if(serialized.length<650000)localStorage.setItem(storageKey,serialized);}catch{}
  return value;
}
function corsHeaders(){return{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'86400','Vary':'Origin'};}
function json(v,status=200,extra={}){const h=new Headers(extra);h.set('Content-Type','application/json; charset=utf-8');h.set('X-Content-Type-Options','nosniff');return new Response(JSON.stringify(v),{status,headers:h});}
function withCors(r,cors){const h=new Headers(r.headers);for(const[k,v]of Object.entries(cors))h.set(k,v);return new Response(r.body,{status:r.status,statusText:r.statusText,headers:h});}


async function handleDirectRequest(rawUrl){
  const url=new URL(String(rawUrl).replace(/^direct:\/\/wc26/i,'https://wc26.local'));
  const path=url.pathname;
  if(path==='/'||path==='/api/health')return{ok:true,mode:'browser-direct',build:BUILD,keyless:true,sources:['ESPN','TheSportsDB','Wikidata','Wikipedia'],season:2026};
  if(path==='/api/snapshot')return buildSnapshot(null);
  if(path==='/api/leaders')return buildLeaders(null);
  if(path==='/api/match'){
    const id=String(url.searchParams.get('id')||'').replace(/^espn-/,'');
    if(!/^\d+$/.test(id))throw new Error('Valid match id is required');
    return buildMatch(null,id);
  }
  if(path==='/api/team'||path==='/api/team/photos'){
    const query=readTeamQuery(url);if(!query.name&&!query.id&&!query.code)throw new Error('Team is required');
    const result=await buildTeam(null,query);
    if(path.endsWith('/photos')){
      const photos=await resolvePlayerMediaBatch(null,result.squad.map(p=>({id:p.id,espnId:p.espnId,name:p.name,team:result.team.name,countryCode:result.team.countryCode})),result.team.name,30);
      return{photos,updatedAt:new Date().toISOString()};
    }
    return result;
  }
  if(path==='/api/media/players'){
    const team=String(url.searchParams.get('team')||'').trim();
    const players=readMediaPlayers(url.searchParams.get('players'));
    if(!players.length)return{players:[],updatedAt:new Date().toISOString()};
    return{players:await resolvePlayerMediaBatch(null,players,team,30),updatedAt:new Date().toISOString()};
  }
  if(path==='/api/player'){
    const query=readPlayerQuery(url);if(!query.name&&!query.id&&!query.espnId)throw new Error('Player is required');
    return buildPlayer(null,query);
  }
  if(path==='/api/player/stats'){
    const query=readPlayerQuery(url);if(!query.name&&!query.id&&!query.espnId)throw new Error('Player is required');
    return buildPlayerStats(null,query);
  }
  if(path==='/api/player/history'){
    const query=readPlayerQuery(url);query.season=Number(url.searchParams.get('season')||2026);
    return buildPlayerHistory(null,query);
  }
  throw new Error('Not found');
}

window.WC26_DIRECT_API=Object.freeze({request:handleDirectRequest,build:BUILD});

})();

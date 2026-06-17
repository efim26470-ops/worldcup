window.WC26_DEMO_DATA = {
  source: 'demo',
  provider: 'Локальный резерв',
  freshness: 'демо-режим',
  lastUpdated: new Date().toISOString(),
  matches: [
    {
      id: 'demo-mex-rsa', startingAt: '2026-06-11T19:00:00Z', status: 'finished', minute: 90,
      stage: 'Группа A', venue: 'Estadio Azteca', city: 'Mexico City',
      home: { id: 'mex', name: 'Mexico', short: 'MEX', countryCode: 'mx', score: 2 },
      away: { id: 'rsa', name: 'South Africa', short: 'RSA', countryCode: 'za', score: 0 },
      events: [], stats: {}, lineups: {home:[],away:[]}, h2h: {homeWins:1,draws:1,awayWins:0}
    },
    {
      id: 'demo-usa-par', startingAt: '2026-06-13T01:00:00Z', status: 'finished', minute: 90,
      stage: 'Группа D', venue: 'SoFi Stadium', city: 'Los Angeles',
      home: { id: 'usa', name: 'United States', short: 'USA', countryCode: 'us', score: 4 },
      away: { id: 'par', name: 'Paraguay', short: 'PAR', countryCode: 'py', score: 1 },
      events: [], stats: {}, lineups: {home:[],away:[]}, h2h: {homeWins:2,draws:0,awayWins:1}
    },
    {
      id: 'demo-bra-mar', startingAt: '2026-06-13T22:00:00Z', status: 'finished', minute: 90,
      stage: 'Группа C', venue: 'MetLife Stadium', city: 'New York / New Jersey',
      home: { id: 'bra', name: 'Brazil', short: 'BRA', countryCode: 'br', score: 1 },
      away: { id: 'mar', name: 'Morocco', short: 'MAR', countryCode: 'ma', score: 1 },
      events: [], stats: {}, lineups: {home:[],away:[]}, h2h: {homeWins:2,draws:1,awayWins:1}
    }
  ],
  standings: [],
  leaders: {
    scorers: [
      {id:'demo1',name:'Kylian Mbappé',team:'France',countryCode:'fr',photo:'',value:3,label:'голов'},
      {id:'demo2',name:'Lionel Messi',team:'Argentina',countryCode:'ar',photo:'',value:3,label:'голов'}
    ],
    assists: [
      {id:'demo3',name:'Kevin De Bruyne',team:'Belgium',countryCode:'be',photo:'',value:2,label:'ассистов'}
    ],
    ratings: []
  }
};

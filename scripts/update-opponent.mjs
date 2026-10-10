import {readFile,writeFile} from 'node:fs/promises';

const SEASON=2026;
const API='https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const STANDINGS='https://site.api.espn.com/apis/v2/sports/football/nfl/standings?season='+SEASON;
const MAX_STALE_HOURS=6;
async function request(url){
  const r=await fetch(url,{headers:{'user-agent':'PackersCentral/2.1 independent fan dashboard','accept':'application/json'},signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw Error('HTTP '+r.status+': '+url);
  return r.json();
}
function val(v){
  if(v==null||v==='')return null;
  const n=Number(typeof v==='object'?(v.value??v.displayValue):v);
  return Number.isFinite(n)?n:null;
}
function metric(entry,keys){
  const list=entry?.stats||[];
  const wanted=keys.map(k=>k.toLowerCase().replace(/[^a-z0-9]/g,''));
  for(const item of list){
    for(const key of [item.name,item.abbreviation,item.shortDisplayName].filter(Boolean)){
      if(wanted.includes(String(key).toLowerCase().replace(/[^a-z0-9]/g,'')))return val(item.value??item.displayValue);
    }
  }
  return null;
}
function readLeague(payload){
  const found=new Map();
  const visit=node=>{
    if(!node||typeof node!=='object')return;
    for(const e of node.standings?.entries||node.entries||[]){
      const id=String(e.team?.id||'');
      const wins=metric(e,['wins']),losses=metric(e,['losses']),ties=metric(e,['ties']);
      const played=metric(e,['gamesPlayed','games'])??((wins??0)+(losses??0)+(ties??0));
      const pf=metric(e,['pointsFor','PF']),pa=metric(e,['pointsAgainst','PA']);
      if(id&&played>0&&pf!==null&&pa!==null){
        const team={id,name:e.team?.displayName||e.team?.name||'',abbreviation:e.team?.abbreviation||'',
          games:played,wins:wins??0,losses:losses??0,ties:ties??0,pointsFor:pf,pointsAgainst:pa,
          scoringOffense:Math.round((pf/played)*10)/10,scoringDefense:Math.round((pa/played)*10)/10};
        found.set(id,team);
      }
    }
    for(const child of node.children||[])visit(child);
  };
  visit(payload);
  const list=[...found.values()];
  if(list.length!==32){
    console.warn('ESPN returned '+list.length+' valid standings entries (need 32 for NFL rank).');
    console.warn('Sample standings keys:',Object.keys(payload||{}).join(', '));
    if(payload?.children?.[0]?.standings?.entries?.[0])console.warn('Sample stats:',JSON.stringify(payload.children[0].standings.entries[0].stats?.map(s=>({name:s.name,value:s.value})).slice(0,12)));
  }
  const rank=(field,desc)=>list.filter(t=>t.games>0).sort((a,b)=>desc?b[field]-a[field]:a[field]-b[field]);
  // Rank unrounded per-game averages, so rounding to one decimal does not create false ties.
  const offense=[...list].sort((a,b)=>(b.pointsFor/b.games)-(a.pointsFor/a.games));
  const defense=[...list].sort((a,b)=>(a.pointsAgainst/a.games)-(b.pointsAgainst/b.games));
  for(const team of list){
    const ownOff=team.pointsFor/team.games,ownDef=team.pointsAgainst/team.games;
    team.offenseRank=list.length===32?1+offense.filter(t=>t.pointsFor/t.games>ownOff+1e-10).length:null;
    team.defenseRank=list.length===32?1+defense.filter(t=>t.pointsAgainst/t.games<ownDef-1e-10).length:null;
  }
  return {teams:list,complete:list.length===32};
}
function recentGames(payload,id){
  const events=(payload.events||[]).filter(e=>e.season?.year==null||Number(e.season.year)===SEASON);
  const out=[];
  for(const ev of events){
    const comp=ev.competitions?.[0],status=comp?.status?.type||ev.status?.type||{};
    if(!(status.completed||status.state==='post'))continue;
    const own=comp?.competitors?.find(t=>String(t.team?.id)===String(id));
    const other=comp?.competitors?.find(t=>t!==own);
    if(!own||!other)continue;
    const us=val(own.score),them=val(other.score);
    if(us===null||them===null)continue;
    out.push({
      date:ev.date||'',opponent:other.team?.displayName||'',
      opponentAbbr:other.team?.abbreviation||'',
      homeAway:own.homeAway==='home'?'VS':'AT',
      result:us>them?'W':us<them?'L':'T',
      pointsFor:us,pointsAgainst:them
    });
  }
  return out.sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,4);
}
function stories(payload){
  const entries=Array.isArray(payload.articles)?payload.articles:Array.isArray(payload.news)?payload.news:[];
  const seen=new Set();
  return entries.map(a=>{
    const url=a.links?.web?.href||a.link||a.url;
    const title=a.headline||a.title||'';
    const publishedAt=a.published||a.lastModified||a.updated||'';
    return {title,url,publishedAt,summary:a.description||a.story||'',
      image:a.images?.[0]?.url||a.images?.[0]?.href||'',source:'ESPN'};
  }).filter(a=>{
    if(!a.title||!/^https?:\/\//i.test(a.url||''))return false;
    const key=a.title.toLowerCase().replace(/\W/g,'');
    if(seen.has(key))return false;seen.add(key);return true;
  }).sort((a,b)=>new Date(b.publishedAt||0)-new Date(a.publishedAt||0)).slice(0,6);
}
function nextOpponent(schedule){
  const now=Date.now()-60*60*1000;
  const all=schedule?.games||[];
  const candidate=all.find(g=>!g.bye&&g.status==='live')||
    all.find(g=>!g.bye&&g.status!=='final'&&g.kickoff&&new Date(g.kickoff).getTime()>now)||
    all.find(g=>!g.bye&&g.status!=='final'&&!g.kickoff);
  if(!candidate||!candidate.opponentId)return null;
  return candidate;
}
async function update(){
  const schedule=JSON.parse(await readFile('data/schedule.json','utf8'));
  const next=nextOpponent(schedule);
  if(!next){console.log('No upcoming opponent with ESPN team ID; preserving prior preview');return;}
  const prior=await readFile('data/opponent.json','utf8').then(JSON.parse).catch(()=>null);
  const [leagueResult,gamesResult,newsResult]=await Promise.allSettled([
    request(STANDINGS),
    request(API+'/teams/'+encodeURIComponent(next.opponentId)+'/schedule?season='+SEASON+'&seasontype=2'),
    request(API+'/teams/'+encodeURIComponent(next.opponentId)+'/news')
  ]);
  if(leagueResult.status==='rejected')console.warn('League standings:',leagueResult.reason.message);
  if(gamesResult.status==='rejected')console.warn('Opponent schedule:',gamesResult.reason.message);
  if(newsResult.status==='rejected')console.warn('Opponent headlines:',newsResult.reason.message);
  let league=leagueResult.status==='fulfilled'?readLeague(leagueResult.value):{teams:[],complete:false};
  const opp=league.teams.find(t=>t.id===String(next.opponentId))||null;
  const gb=league.teams.find(t=>t.id==='9')||null;
  const sameTeam=prior?.opponentId===String(next.opponentId);
  const preview={
    season:SEASON,
    opponentId:String(next.opponentId),opponent:next.opponent,opponentAbbr:next.opponentAbbr||opp?.abbreviation||'',
    gameId:next.id||'',week:next.week||'',kickoff:next.kickoff||null,
    statsSource:'ESPN NFL standings (regular season)',
    scoringBasis:'Points per game (regular season). Scoring defense: opponent points allowed per game; lower is better.',
    hasLeagueRanks:league.complete,
    teams:opp&&gb?{opponent:opp,packers:gb}:sameTeam?(prior.teams||null):null,
    recentGames:gamesResult.status==='fulfilled'?recentGames(gamesResult.value,next.opponentId):sameTeam?(prior.recentGames||[]):[],
    articles:newsResult.status==='fulfilled'?stories(newsResult.value):sameTeam?(prior.articles||[]):[]
  };
  // Do not reuse rankings from a previous team or hide incomplete rank data behind stale numbers.
  if(!league.complete&&preview.teams){
    for(const team of Object.values(preview.teams)){team.offenseRank=null;team.defenseRank=null;}
    preview.hasLeagueRanks=false;
  }
  console.log('Opponent:',next.opponent,'| stats teams:',league.teams.length,'| ranks:',preview.hasLeagueRanks,
    '| games:',preview.recentGames.length,'| headlines:',preview.articles.length);
  if(!preview.teams&&!preview.recentGames.length&&!preview.articles.length)throw Error('No usable opponent data; kept old file.');
  const strip=x=>{const copy=structuredClone(x);delete copy.updatedAt;return JSON.stringify(copy);};
  if(prior&&strip(prior)===strip(preview)&&Date.now()-new Date(prior.updatedAt||0).getTime()<MAX_STALE_HOURS*3600000){
    console.log('Opponent scouting unchanged.');return;
  }
  preview.updatedAt=new Date().toISOString();
  await writeFile('data/opponent.json',JSON.stringify(preview,null,2)+'\n');
  console.log('Opponent scout saved.');
}
update().catch(error=>{console.error(error);process.exitCode=1;});
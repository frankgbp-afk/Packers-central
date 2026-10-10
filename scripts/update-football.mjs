import { readFile, mkdir, writeFile } from 'node:fs/promises';

const YEAR=2026;
const BASE='https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams';
const DIVISION=new Set(['Chicago Bears','Detroit Lions','Minnesota Vikings']);
const CLUBS=[['Packers','9'],['Bears','3'],['Lions','8'],['Vikings','16']];
const TZ='America/Chicago';
async function oldFile(path){try{return JSON.parse(await readFile(path,'utf8'));}catch{return null;}}
const dateText=iso=>new Intl.DateTimeFormat('en-US',{timeZone:TZ,weekday:'short',month:'short',day:'numeric'}).format(new Date(iso));
const timeText=iso=>new Intl.DateTimeFormat('en-US',{timeZone:TZ,hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(iso));
async function json(url){
  const r=await fetch(url,{headers:{'user-agent':'PackersCentral/2.0 fan website','accept':'application/json'},signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw Error('ESPN HTTP '+r.status+': '+url);
  return r.json();
}
const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(typeof v==='object'?(v.value??v.displayValue):v);return Number.isFinite(n)?n:null;};
function game(event,phase,teamId){
  const comp=event.competitions?.[0];
  const own=comp?.competitors?.find(c=>String(c.team?.id)===teamId||(teamId==='9'&&c.team?.abbreviation==='GB'));
  const other=comp?.competitors?.find(c=>c!==own);
  if(!own||!other)return null;
  const kind=comp.status?.type||event.status?.type||{};
  const state=kind.state==='in'?'live':(kind.completed||kind.state==='post')?'final':'scheduled';
  const ownScore=num(own.score),oppScore=num(other.score);
  const verifiedFinal=state==='final'&&ownScore!==null&&oppScore!==null;
  const result=verifiedFinal?(ownScore>oppScore?'W':ownScore<oppScore?'L':'T'):null;
  const broadcasts=[...(comp.broadcasts||[]).flatMap(b=>b.names||[b.name].filter(Boolean)),...(event.broadcasts||[]).flatMap(b=>b.names||[b.name].filter(Boolean)),...(comp.geoBroadcasts||[]).map(b=>b.media?.shortName||b.media?.name).filter(Boolean),comp.broadcast,event.broadcast].filter(Boolean);
  const rawKickoff=event.date&&Number.isFinite(new Date(event.date).getTime())?new Date(event.date).toISOString():null;
  const placeholder=phase===2&&Number(event.week?.number)===18&&state==='scheduled'&&rawKickoff&&timeText(rawKickoff)==='11:00 PM';
  const kickoff=placeholder?null:rawKickoff;
  return {
    id:String(event.id),
    phase:phase===1?'Preseason':phase===3?'Postseason':'Regular Season',
    week:(phase===1?'PRE ':phase===3?'POST ':'WK ')+(event.week?.number||'?'),
    homeAway:own.homeAway==='home'?'VS':'AT',
    opponent:other.team?.displayName||other.team?.name||'Opponent TBD',
    opponentLogo:other.team?.logo||other.team?.logos?.[0]?.href||null,
    date:kickoff?dateText(kickoff):'TBD',time:kickoff?timeText(kickoff):'TBD',
    network:[...new Set(broadcasts)].join(' / ')||'TBD',
    venue:comp.venue?.fullName||'TBD',kickoff,
    status:verifiedFinal?'final':state,
    statusDetail:comp.status?.type?.shortDetail||comp.status?.type?.detail||comp.status?.type?.description||event.status?.type?.shortDetail||'',
    packersScore:ownScore,opponentScore:oppScore,result,
    eventUrl:'https://www.espn.com/nfl/game/_/gameId/'+String(event.id)
  };
}
async function schedule(teamId,phase){
  const data=await json(BASE+'/'+teamId+'/schedule?season='+YEAR+'&seasontype='+phase);
  const items=(data.events||[]).filter(e=>!e.season?.year||Number(e.season.year)===YEAR).map(e=>game(e,phase,teamId)).filter(Boolean);
  if(items.length<1)throw Error('No '+phase+' schedule for '+teamId);
  return items.sort((a,b)=>(a.kickoff||'').localeCompare(b.kickoff||''));
}
function summary(games){
  const played=games.filter(g=>g.status==='final'&&g.result&&g.packersScore!==null&&g.opponentScore!==null);
  const count=(set,t)=>set.filter(g=>g.result===t).length;
  const div=played.filter(g=>DIVISION.has(g.opponent));
  let streak='—';
  if(played.length){let n=0;const r=played.at(-1).result;for(let i=played.length-1;i>=0&&played[i].result===r;i--)n++;streak=r+n;}
  return {wins:count(played,'W'),losses:count(played,'L'),ties:count(played,'T'),
    divisionWins:count(div,'W'),divisionLosses:count(div,'L'),divisionTies:count(div,'T'),
    pointsFor:played.reduce((n,g)=>n+g.packersScore,0),pointsAgainst:played.reduce((n,g)=>n+g.opponentScore,0),streak};
}
function addBye(reg){
  const found=new Set(reg.map(g=>Number(g.week.replace(/\D/g,''))));
  if(reg.length===17)for(let wk=1;wk<=18;wk++)if(!found.has(wk)){
    const bye={phase:'Regular Season',week:'WK '+wk,bye:true,date:'Bye week',time:'No game',status:'bye',kickoff:null};
    const index=reg.findIndex(g=>Number(g.week.replace(/\D/g,''))>wk);
    if(index===-1)reg.push(bye);else reg.splice(index,0,bye);
  }
  return reg;
}
async function save(path,data){
  const old=await oldFile(path);
  if(old){
    const strip=x=>{const c=structuredClone(x);delete c.updatedAt;return JSON.stringify(c);};
    const updated=new Date(old.updatedAt||0).getTime();
    if(strip(old)===strip(data)&&Date.now()-updated<6*3600000){console.log('Unchanged:',path);return;}
  }
  data.updatedAt=new Date().toISOString();
  await writeFile(path,JSON.stringify(data,null,2)+'\n');
  console.log('Updated:',path);
}
async function run(){
  await mkdir('data',{recursive:true});
  const [reg,pre,post]=await Promise.all([
    schedule('9',2),
    schedule('9',1).catch(e=>{console.warn('Preseason:',e.message);return [];}),
    schedule('9',3).catch(e=>{console.warn('Postseason:',e.message);return [];})
  ]);
  if(reg.length<16||reg.length>18)throw Error('Incomplete ESPN regular schedule: '+reg.length+'. No existing files changed.');
  // ESPN indexes preseason weeks 2–4 when including the Hall of Fame week.
  if(pre.length===3&&pre.every(g=>/^PRE [234]$/.test(g.week)))pre.forEach(g=>g.week='PRE '+(Number(g.week.slice(4))-1));
  const division=await Promise.all(CLUBS.map(async ([team,id])=>{
    try{
      const games=id==='9'?reg:await schedule(id,2);
      if(games.length<16)throw Error('Incomplete schedule');
      const r=summary(games);
      return {team,wins:r.wins,losses:r.losses,ties:r.ties,packers:id==='9'};
    }catch(e){console.warn('Division team '+team+':',e.message);return null;}
  }));
  const standings=division.every(Boolean)?division.sort((a,b)=>(b.wins+b.ties*.5)-(a.wins+a.ties*.5)||a.losses-b.losses):[];
  await save('data/schedule.json',{season:YEAR,timezone:TZ,source:'ESPN NFL',games:[...pre,...addBye(reg),...post]});
  await save('data/season.json',{season:YEAR,source:'ESPN NFL',regularSeason:summary(reg),standings});
}
run().catch(e=>{console.error(e);process.exitCode=1;});
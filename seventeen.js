(()=>{
'use strict';
const ROOT=document.getElementById('pageContent');
if(!ROOT)return;
const SLOTS=['QB','RB1','RB2','WR1','WR2','TE','FLEX'];
const TEAM_NAMES={
 ARI:'Arizona Cardinals',ATL:'Atlanta Falcons',BAL:'Baltimore Ravens',BUF:'Buffalo Bills',
 CAR:'Carolina Panthers',CHI:'Chicago Bears',CIN:'Cincinnati Bengals',CLE:'Cleveland Browns',
 DAL:'Dallas Cowboys',DEN:'Denver Broncos',DET:'Detroit Lions',GB:'Green Bay Packers',
 HOU:'Houston Texans',IND:'Indianapolis Colts',JAX:'Jacksonville Jaguars',KC:'Kansas City Chiefs',
 LV:'Las Vegas Raiders',LAC:'Los Angeles Chargers',LAR:'Los Angeles Rams',MIA:'Miami Dolphins',
 MIN:'Minnesota Vikings',NE:'New England Patriots',NO:'New Orleans Saints',NYG:'New York Giants',
 NYJ:'New York Jets',PHI:'Philadelphia Eagles',PIT:'Pittsburgh Steelers',SF:'San Francisco 49ers',
 SEA:'Seattle Seahawks',TB:'Tampa Bay Buccaneers',TEN:'Tennessee Titans',WAS:'Washington Commanders'
};
const SOURCES=[
 'data/draft-1999-2002.json','data/draft-2003-2006.json','data/draft-2007-2010.json',
 'data/draft-2011-2014.json','data/draft-2015-2017.json','data/draft-2018-2021.json'
];
const KEY='packers-central-nfl17-v1';
const clean=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const newState=()=>({stage:'intro',team:null,year:null,roster:{},teamUsed:false,yearUsed:false,selected:null,filter:'ALL',search:'',result:null});
let game=newState(),database={},ready=false,filteredPlayers=[];
function save(){try{localStorage.setItem(KEY,JSON.stringify(game))}catch(e){}}
function restore(){try{const old=JSON.parse(localStorage.getItem(KEY)||'null');if(!old||!['intro','board','complete','result'].includes(old.stage))return;game={...newState(),...old,roster:old.roster||{}};if(game.stage==='board'&&game.team!==null&&(!database[game.year]||!database[game.year][game.team]))game=newState()}catch(e){game=newState()}}
const filled=()=>SLOTS.filter(s=>!!game.roster[s]).length;
const openSlots=()=>SLOTS.filter(s=>!game.roster[s]);
function eligible(pos){return openSlots().filter(s=>s==='FLEX'?['RB','WR','TE'].includes(pos):s.startsWith(pos))}
function countPpg(p){return (p[2]/Math.max(1,p[3])).toFixed(1)}
function rng(n){if(n<=1)return 0;if(globalThis.crypto&&crypto.getRandomValues){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]%n}return Math.floor(Math.random()*n)}
function choose(items){return items[rng(items.length)]}
function labelLogo(t){const code=t==='WAS'?'wsh':t.toLowerCase();return 'https://a.espncdn.com/i/teamlogos/nfl/500/'+code+'.png'}
function avatar(t,cls=''){return '<img class="'+cls+'" src="'+labelLogo(t)+'" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">'}
function availablePlayers(team=game.team,year=game.year){
 const raw=database[year]?.[team]||[];
 const taken=new Set(Object.values(game.roster).map(x=>x.name.toLowerCase()));
 return raw.filter(p=>!taken.has(p[0].toLowerCase())&&eligible(p[1]).length)
   .sort((a,b)=>b[2]/b[3]-a[2]/a[3]);
}
function validBoards(year=undefined,team=undefined){
 const rows=[];
 for(const [y,pools] of Object.entries(database)){
   if(year!==undefined&&Number(y)!==Number(year))continue;
   for(const [t,players] of Object.entries(pools)){
     if(team!==undefined&&team!==t)continue;
     if(players.length&&availablePlayers(t,Number(y)).length)rows.push({team:t,year:Number(y)});
   }
 }
 return rows;
}
function draw(which){
 const candidates=which==='team'
   ?validBoards(game.year).filter(x=>x.team!==game.team)
   :which==='year'?validBoards(undefined,game.team).filter(x=>x.year!==game.year)
   :validBoards().filter(x=>x.year!==game.year||x.team!==game.team);
 const target=choose(candidates);
 if(!target){notify('No eligible draw is available.');return false}
 game.team=target.team;game.year=target.year;
 game.stage='board';game.selected=null;game.filter='ALL';game.search='';
 save();render();return true;
}
function start(){game=newState();draw()}
function reroll(which){
 if(game.stage!=='board'||(which==='team'&&game.teamUsed)||(which==='year'&&game.yearUsed))return;
 if(draw(which)){if(which==='team')game.teamUsed=true;else game.yearUsed=true;save();render()}
}
function scoreFor(p,year){
 const others=Object.values(database[year]||{}).flat().filter(x=>x[1]===p[1]&&x[3]>=2).map(x=>x[2]/x[3]);
 const value=p[2]/Math.max(1,p[3]);
 if(others.length<=1)return 50;
 return Math.round(100*others.filter(x=>x<value).length/(others.length-1));
}
function lock(slot){
 const p=game.selected;
 if(game.stage!=='board'||!p||!eligible(p[1]).includes(slot))return;
 game.roster[slot]={name:p[0],pos:p[1],points:p[2],games:p[3],team:game.team,year:game.year,rank:scoreFor(p,game.year)};
 game.selected=null;game.search='';game.filter='ALL';
 game.stage=filled()===SLOTS.length?'complete':'board';
 game.team=null;game.year=null;
 save();render();
}
function nextRound(){if(game.stage==='board'&&game.team===null)draw()}
function shuffleSeed(txt){let h=2166136261;for(let i=0;i<txt.length;i++){h^=txt.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function seeded(seed){let x=seed>>>0;return ()=>{x+=0x6D2B79F5;let t=x;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
function simulate(){
 if(game.stage!=='complete')return;
 const players=SLOTS.map(s=>game.roster[s]),rates=players.map(x=>x.rank);
 const avg=rates.reduce((a,b)=>a+b,0)/rates.length,lowest=Math.min(...rates);
 const overall=Math.round(avg*.78+lowest*.22);
 const random=seeded(shuffleSeed(players.map(x=>x.name+x.year+x.team).join('|')));
 const weeks=[];
 for(let w=1;w<=17;w++){
   const difficulty=55+Math.round(random()*35);
   const chance=Math.min(.965,Math.max(.12,.32+(overall-52)*.017+(72-difficulty)*.007));
   const win=random()<chance;
   const margin=Math.max(1,Math.round(2+random()*18+Math.abs(overall-difficulty)*.17));
   weeks.push({week:w,win,score:win?[24+margin,24]:[17,17+margin]});
 }
 const wins=weeks.filter(x=>x.win).length;
 game.result={weeks,wins,losses:17-wins,overall,average:Math.round(avg),weakest:SLOTS[rates.indexOf(lowest)]};
 game.stage='result';save();render();ROOT.scrollIntoView({behavior:'smooth',block:'start'});
}
function grades(w){if(w===17)return['S','Perfect season'];if(w>=16)return['A+','All-time great'];if(w>=14)return['A','Contender'];if(w>=12)return['B+','Playoff threat'];if(w>=10)return['B','Winning season'];if(w>=8)return['C','Middle of the pack'];return['D','Rebuild and retry']}
function notify(msg){let el=document.getElementById('draft-toast');if(!el){el=document.createElement('div');el.id='draft-toast';el.className='draft-toast';document.body.appendChild(el)}el.textContent=msg;el.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.classList.remove('show'),2300)}
function renderSlots(){
 return '<div class="draft-roster-list">'+SLOTS.map(s=>{
 const p=game.roster[s];
 return '<div class="draft-slot'+(p?' locked':'')+'"><span class="draft-slot-label">'+s+'</span>'+
 (p?'<div class="draft-slot-person"><b>'+clean(p.name)+'</b><span>'+clean(p.team)+' · '+p.year+' · '+(p.points/p.games).toFixed(1)+' PPG</span></div>'+
 '<span class="draft-check">✓</span>':'<span class="draft-slot-vacant">Available</span>')+'</div>';
 }).join('')+'</div>';
}
function renderProgress(){
 let pct=Math.round(filled()/7*100);
 return '<div class="draft-progress-head"><b>Roster progress</b><strong>'+filled()+' <span>/ 7</span></strong></div>'+
 '<div class="draft-progress" role="progressbar" aria-label="Players drafted" aria-valuemin="0" aria-valuemax="7" aria-valuenow="'+filled()+'"><span style="width:'+pct+'%"></span></div>';
}
function renderIntro(){
 return '<div class="draft-welcome"><span class="draft-kicker">THE ALL-TIME NFL CHALLENGE</span><h2>Seven picks.<br>One perfect season.</h2>'+
 '<p>Draw an NFL team and a real historical season. Draft one player from that roster, then build a seven-man fantasy lineup good enough to survive all 17 games.</p>'+
 '<div class="draft-rules"><div><strong>07</strong><span>Roster spots</span></div><div><strong>02</strong><span>Total rerolls</span></div><div><strong>17</strong><span>Simulated games</span></div></div>'+
 '<button type="button" class="draft-main-button" data-action="start">Start drafting <span>→</span></button>'+
 '<small>One team reroll and one year reroll per entire draft. Historical seasons: 1999–2021.</small></div>';
}
function renderDraw(){
 if(game.team===null){
 return '<section class="draft-panel draft-draw"><span class="draft-kicker">ROUND '+(filled()+1)+' / 7</span><h2>Ready for your next draw?</h2>'+
 '<p>Your roster is '+filled()+'/7 complete. You can use any remaining reroll now or save it for later.</p>'+
 '<button class="draft-main-button" data-action="next">Reveal team &amp; season <span>→</span></button></section>';
 }
 return '<section class="draft-panel draft-draw"><div class="draft-section-top"><span class="draft-kicker">ROUND '+(filled()+1)+' / 7</span><span class="draft-season-tag">HISTORIC SEASON</span></div>'+
 '<div class="draft-draw-match">'+avatar(game.team,'draft-logo')+'<div><span class="draft-draw-small">YOU DREW</span><h2>'+clean(TEAM_NAMES[game.team]||game.team)+'</h2><strong>'+game.year+'</strong></div></div>'+
 '<div class="draft-rerolls">'+
 '<button type="button" data-action="reroll-team" '+(game.teamUsed?'disabled':'')+'><span>↻</span><span>Reroll team<small>'+(game.teamUsed?'Used':'1 available · keeps '+game.year)+'</small></span></button>'+
 '<button type="button" data-action="reroll-year" '+(game.yearUsed?'disabled':'')+'><span>↻</span><span>Reroll year<small>'+(game.yearUsed?'Used':'1 available · keeps '+clean(TEAM_NAMES[game.team]||game.team))+'</small></span></button>'+
 '</div><p class="draft-reroll-warning">Choose carefully. Each reroll can only be used once during your entire seven-pick draft.</p></section>';
}
function renderPicker(){
 const list=availablePlayers();
 if(!list.length)return '<section class="draft-panel"><h2>No eligible players</h2><p>Try using a remaining reroll.</p></section>';
 return '<section class="draft-panel draft-player-panel"><div class="draft-section-top"><div><span class="draft-kicker">PICK ONE</span><h2>Season roster</h2></div><span class="draft-player-count">'+list.length+' eligible players</span></div>'+
 '<div class="draft-search-row"><input type="search" id="draft-search" placeholder="Search players..." value="'+clean(game.search)+'" autocomplete="off" aria-label="Search players" />'+
 '<div class="draft-pos-filters" role="group" aria-label="Position filter">'+['ALL','QB','RB','WR','TE'].map(p=>'<button class="'+(game.filter===p?'active':'')+'" data-filter="'+p+'" type="button">'+p+'</button>').join('')+'</div></div>'+
 (game.selected?'<div class="draft-pick-confirm"><div><span class="draft-kicker">YOUR PICK</span><h3>'+clean(game.selected[0])+'</h3><small>'+game.selected[1]+' · '+countPpg(game.selected)+' PPR points per game</small></div>'+
 '<div class="draft-slot-options"><span>Assign a lineup spot</span>'+eligible(game.selected[1]).map(s=>'<button type="button" data-slot="'+s+'">'+s+'</button>').join('')+'</div><button type="button" class="draft-cancel" data-action="cancel">Change player</button></div>':'')+
 '<div id="draft-player-results" class="draft-player-results"></div>'+
 '<p class="draft-data-note">Real historical player seasons. PPR totals calculated from season stats; season availability and ratings are not live NFL roster projections.</p></section>';
}
function renderPlayers(){
 const el=document.getElementById('draft-player-results');if(!el)return;
 const list=availablePlayers();
 filteredPlayers=list.filter(p=>(game.filter==='ALL'||p[1]===game.filter)&&p[0].toLowerCase().includes(game.search.toLowerCase())).slice(0,30);
 el.innerHTML=filteredPlayers.length?filteredPlayers.map((p,i)=>{
 const current=game.selected&&game.selected[0]===p[0]&&game.selected[1]===p[1];
 return '<button class="draft-player'+(current?' selected':'')+'" type="button" data-pick="'+i+'" '+(game.selected?'aria-pressed="'+String(!!current)+'"':'')+'>'+
 '<span class="draft-player-id"><span class="draft-player-pos">'+p[1]+'</span><span><strong>'+clean(p[0])+'</strong><small>'+p[3]+' games · '+p[2].toFixed(1)+' PPR points</small></span></span>'+
 '<span class="draft-player-ppg"><b>'+countPpg(p)+'</b><small>PPG</small></span></button>';
 }).join(''):'<p class="draft-no-results">No matching eligible players. Try another position or search.</p>';
}
function renderComplete(){
 return '<section class="draft-panel draft-finish"><span class="draft-kicker">DRAFT COMPLETE</span><h2>Let the season begin.</h2><p>Seven picks are locked in. We will grade your starters against players at the same position in their own historical seasons, then simulate 17 games.</p>'+
 '<button class="draft-main-button" data-action="simulate">Simulate 17 games <span>→</span></button>'+
 '<p class="draft-data-note">The season simulator is an entertainment model, not an official NFL prediction.</p></section>';
}
function renderResult(){
 const r=game.result,grade=grades(r.wins);
 return '<section class="draft-panel draft-result"><span class="draft-kicker">YOUR FINAL RECORD</span>'+
 '<div class="draft-result-top"><div><strong class="draft-record">'+r.wins+'<span>–</span>'+r.losses+'</strong><p>'+clean(grade[1])+'</p></div><span class="draft-grade">'+grade[0]+'</span></div>'+
 '<div class="draft-week-title">17-game season simulation</div><div class="draft-week-grid">'+r.weeks.map(x=>'<div class="'+(x.win?'draft-week win':'draft-week loss')+'" title="Week '+x.week+': '+x.score.join('–')+'"><small>'+x.week+'</small><b>'+(x.win?'W':'L')+'</b></div>').join('')+'</div>'+
 '<div class="draft-analysis"><div><small>TEAM RATING</small><b>'+r.overall+' <span>/ 100</span></b></div><div><small>POSITION TO IMPROVE</small><b>'+r.weakest+'</b></div></div>'+
 '<div class="draft-result-actions"><button class="draft-main-button" type="button" data-action="restart">Draft again <span>↻</span></button><button type="button" class="draft-secondary" data-action="share">Share results ↗</button></div>'+
 '<p class="draft-data-note">Fictional matchups and scores; ratings normalize players within each season and position.</p></section>';
}
function render(){
 ROOT.innerHTML='<div class="draft-site">'+
 '<div class="draft-heading"><div><span class="draft-eyebrow"><span class="draft-live-dot"></span> PACKERS CENTRAL / GAMES</span><h1>THE <em>17–0</em> CHALLENGE</h1><p>Build an unstoppable NFL fantasy lineup from actual players and seasons.</p></div><div class="draft-heading-record"><span>THE TARGET</span><strong>17<span>–</span>0</strong></div></div>'+
 (game.stage==='intro'?renderIntro():
 '<div class="draft-layout"><div class="draft-main">'+
 (game.stage==='board'?renderDraw()+(game.team!==null?renderPicker():''):game.stage==='complete'?renderComplete():renderResult())+
 '</div><aside class="draft-roster-panel"><div class="draft-roster-heading"><span class="draft-kicker">YOUR TEAM</span><h2>Starting lineup</h2></div>'+renderProgress()+renderSlots()+
 '<div class="draft-roster-footer"><p><b>Team reroll</b><span class="'+(game.teamUsed?'draft-used':'draft-ready')+'">'+(game.teamUsed?'USED':'AVAILABLE')+'</span></p>'+
 '<p><b>Year reroll</b><span class="'+(game.yearUsed?'draft-used':'draft-ready')+'">'+(game.yearUsed?'USED':'AVAILABLE')+'</span></p></div>'+
 (game.stage!=='result'?'<button type="button" class="draft-reset" data-action="restart">↻ Start over</button>':'')+'</aside></div>')+
 '<div class="draft-bottom"><span>HISTORICAL PLAYER DATA: 1999–2021</span><a target="_blank" rel="noopener noreferrer" href="https://github.com/srsavas42/fantasy-football-research">Source &amp; attribution ↗</a></div></div>';
 renderPlayers();
}
async function share(){
 const r=game.result;if(!r)return;
 const lineup=SLOTS.map(slot=>slot+': '+game.roster[slot].name+' ('+game.roster[slot].team+' '+game.roster[slot].year+')').join('\n');
 const text='MY NFL 17–0 CHALLENGE\nRecord: '+r.wins+'–'+r.losses+'\nRating: '+r.overall+'/100\n'+lineup+'\nhttps://frankgbp-afk.github.io/Packers-central/seventeen.html';
 try{if(navigator.share){await navigator.share({title:'My NFL 17–0 Challenge',text});return}if(navigator.clipboard){await navigator.clipboard.writeText(text);notify('Results copied to clipboard!');return}}catch(err){if(err.name==='AbortError')return}
 notify('Sharing is not available here.');
}
ROOT.addEventListener('click',e=>{
 const btn=e.target.closest('button');if(!btn||btn.disabled)return;
 if(btn.dataset.pick!==undefined){game.selected=filteredPlayers[Number(btn.dataset.pick)]||null;save();render();return}
 if(btn.dataset.slot){lock(btn.dataset.slot);return}
 if(btn.dataset.filter){game.filter=btn.dataset.filter;game.selected=null;save();render();return}
 const action=btn.dataset.action;
 if(action==='start'||action==='restart'){start();return}
 if(action==='next'){nextRound();return}
 if(action==='reroll-team'){reroll('team');return}
 if(action==='reroll-year'){reroll('year');return}
 if(action==='cancel'){game.selected=null;save();render();return}
 if(action==='simulate'){simulate();return}
 if(action==='share'){share()}
});
ROOT.addEventListener('input',e=>{
 if(e.target.id==='draft-search'){game.search=e.target.value;game.selected=null;renderPlayers()}
});
async function boot(){
 ROOT.innerHTML='<section class="draft-loading"><span class="draft-kicker">NFL 17–0</span><h2>Loading historical player seasons…</h2><p>Preparing your draft board.</p></section>';
 try{
  const files=await Promise.all(SOURCES.map(async path=>{const res=await fetch(path);if(!res.ok)throw new Error(path);return res.json()}));
  for(const file of files)Object.assign(database,file.teams);
  ready=true;restore();render();
 }catch(err){
  ROOT.innerHTML='<div class="draft-loading"><h2>Unable to load player data</h2><p>Check your connection and refresh the page. No game data has been changed.</p>'+
  '<button class="draft-main-button" data-action="reload">Retry</button></div>';
 }
}
ROOT.addEventListener('click',e=>{if(e.target.closest('[data-action="reload"]'))boot()});
boot();
})();
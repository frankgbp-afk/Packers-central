(()=>{
'use strict';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=u=>/^https:\/\/(www\.)?(espn\.com|acmepackingcompany\.com)(\/|$)/i.test(String(u||''))?u:'#';
const fmt=n=>n==null||!Number.isFinite(Number(n))?'—':Number(n).toFixed(1);
const rec=t=>t?String(t.wins||0)+'–'+String(t.losses||0)+(t.ties?'–'+t.ties:''):'—';
const rank=(t,k)=>Number.isInteger(t?.[k])?'#'+t[k]+' / 32':'Pending';
const date=v=>v?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'America/Chicago'}).format(new Date(v)):'TBD';
const ago=v=>{if(!v)return 'Recent';const n=Date.now()-new Date(v).getTime();if(!Number.isFinite(n))return 'Recent';const h=Math.max(0,Math.floor(n/3600000));return h<1?'Just now':h<24?h+'h ago':Math.floor(h/24)+'d ago';};
let preview=null,game=null,lastFetch=0;
function upcoming(games){
 const t=Date.now()-3600000;
 return games.find(g=>!g.bye&&g.status==='live')||
 games.find(g=>!g.bye&&g.status!=='final'&&g.kickoff&&new Date(g.kickoff).getTime()>t)||
 games.find(g=>!g.bye&&g.status!=='final'&&!g.kickoff)||null;
}
function valid(){return game&&preview&&String(preview.gameId)===String(game.id)&&String(preview.opponentId)===String(game.opponentId)?preview:null;}
const recordLabel=(team)=>rec(team);
const teamUrl=(p)=>{const a=p?.opponentAbbr||game?.opponentAbbr||'';return /^[a-z]{2,4}$/i.test(a)?'https://www.espn.com/nfl/team/_/name/'+a.toLowerCase():null;};
const teamDisplay=(team,offense)=>team?fmt(offense?team.scoringOffense:team.scoringDefense):'—';
const metric=(team,title,field,rankField,subtitle)=>'<div class="scout-metric"><div class="scout-metric-head"><span>'+title+'</span><span class="scout-metric-rank">'+esc(rank(team,rankField))+'</span></div><strong>'+teamDisplay(team,field==='scoringOffense')+'</strong><small>'+subtitle+'</small></div>';
function compare(p){
 const gb=p?.teams?.packers,opp=p?.teams?.opponent;
 if(!gb||!opp)return '<p class="scout-empty">League scoring figures are temporarily unavailable. Check back after the next feed update.</p>';
 return '<div class="scout-compare"><div class="scout-comparison-column"><div class="scout-team-head"><div class="scout-team-chip">GB</div><div><b>Green Bay</b><small>'+recordLabel(gb)+'</small></div></div>'+metric(gb,'Scoring offense','scoringOffense','offenseRank','Points scored per game')+metric(gb,'Scoring defense','scoringDefense','defenseRank','Points allowed per game')+'</div><div class="scout-comparison-column"><div class="scout-team-head"><div class="scout-team-chip gold-chip">'+esc(p.opponentAbbr||'OPP')+'</div><div><b>'+esc(p.opponent)+'</b><small>'+recordLabel(opp)+'</small></div></div>'+metric(opp,'Scoring offense','scoringOffense','offenseRank','Points scored per game')+metric(opp,'Scoring defense','scoringDefense','defenseRank','Points allowed per game')+'</div></div>';
}
function recent(p){
 const games=p?.recentGames||[];
 if(!games.length)return '<p class="scout-empty">Recent results have not loaded yet.</p>';
 return games.map(g=>'<div class="scout-result"><span class="tag '+(g.result==='W'?'win':g.result==='L'?'loss':'tie')+'">'+esc(g.result)+'</span><div class="scout-result-game"><b>'+(g.homeAway==='VS'?'vs ':'at ')+esc(g.opponentAbbr||g.opponent)+'</b><small>'+esc(date(g.date))+'</small></div><strong>'+Math.max(+g.pointsFor||0,+g.pointsAgainst||0)+'–'+Math.min(+g.pointsFor||0,+g.pointsAgainst||0)+'</strong></div>').join('');
}
function headlines(p){
 const items=(p?.articles||[]).slice(0,5),url=teamUrl(p);
 return items.length?items.map(a=>'<a class="scout-headline" target="_blank" rel="noopener noreferrer" href="'+esc(link(a.url))+'"><small>ESPN · '+esc(ago(a.publishedAt))+'</small><b>'+esc(a.title)+'</b><span>↗</span></a>').join(''):'<div class="scout-empty">Opponent-specific headlines aren’t available in ESPN’s feed right now.'+(url?'<p><a href="'+esc(url)+'/news" target="_blank" rel="noopener noreferrer">Read the latest '+esc(p?.opponent||'opponent')+' news on ESPN ↗</a></p>':'')+'</div>';
}
function tease(){
 if(!game)return '';
 const p=valid(),team=p?.teams?.opponent;
 return '<section class="scout-teaser" id="opponent"><div class="scout-teaser-header"><div><span class="eyebrow gold">Next up · Opponent report</span><h2>Know the opponent.</h2><p>'+esc(game.homeAway==='VS'?'Green Bay hosts ':'Green Bay visits ')+esc(game.opponent)+' · '+date(game.kickoff)+'</p></div><a class="button gold" href="matchup.html">Full preview ↗</a></div><div class="scout-teaser-stats"><div><small>Opponent record</small><strong>'+rec(team)+'</strong><span>2026 regular season</span></div><div><small>Scoring offense</small><strong>'+fmt(team?.scoringOffense)+' <em>PPG</em></strong><span>'+rank(team,'offenseRank')+'</span></div><div><small>Scoring defense</small><strong>'+fmt(team?.scoringDefense)+' <em>PA/G</em></strong><span>'+rank(team,'defenseRank')+'</span></div></div>'+(p?.articles?.length?'<a class="scout-teaser-article" href="'+esc(link(p.articles[0].url))+'" target="_blank" rel="noopener noreferrer"><small>Opponent headline · ESPN</small><b>'+esc(p.articles[0].title)+'</b><span>↗</span></a>':'<p class="scout-teaser-fine">Live scoring ranks, recent form and opponent news are available in the full report.</p>')+'</section>';
}
function report(){
 const root=$('#matchup-root');if(!root)return;
 if(!game){root.innerHTML='<div class="page-heading"><div><span class="eyebrow">Scouting desk</span><h1>Opponent preview</h1></div></div><article class="season-panel"><p>No upcoming opponent is listed. The scouting report returns when the next matchup is announced.</p><a href="schedule.html" class="button dark">View schedule ↗</a></article>';return;}
 const p=valid(),name=game.opponent||'Next opponent',vs=game.homeAway==='VS'?'Home at Lambeau':'On the road';
 const shown=game.kickoff?date(game.kickoff)+' · '+new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit'}).format(new Date(game.kickoff))+' CT':'Kickoff TBD';
 const logo=/^https:\/\/a\.espncdn\.com\//.test(game.opponentLogo||'')?'<img src="'+esc(game.opponentLogo)+'" alt="" loading="lazy">':'';
 root.innerHTML='<div class="page-heading"><div><span class="eyebrow">Game week / scouting desk</span><h1>Opponent preview</h1><p>Know who Green Bay is facing: scoring production, defensive results, recent form and headlines from the other side.</p></div><span class="updated">'+(p?.updatedAt?'Scouting updated '+esc(ago(p.updatedAt)):'Scouting feed pending')+'</span></div>'+
 '<section class="scout-hero"><div><span class="eyebrow gold">'+esc(game.week||'GAME WEEK')+' · '+vs+'</span><h2>PACKERS <span>VS</span><br>'+esc(name)+'</h2><p>'+esc(shown)+' · '+esc(game.network||'TV TBD')+' · '+esc(game.venue||'Venue TBD')+'</p><div class="scout-hero-links"><a href="schedule.html" class="button gold">Full schedule ↗</a>'+(teamUrl(p)?'<a href="'+esc(teamUrl(p))+'" class="button scout-outline" target="_blank" rel="noopener noreferrer">ESPN team page ↗</a>':'')+'</div></div><div class="scout-hero-graphic"><b>G</b><span>×</span>'+logo+'</div></section>'+
 '<div class="scout-info"><b>Scoring comparison</b><p>Offense = points scored per game. Defense = points allowed per game (lower is better). Rankings are across all 32 NFL teams and use completed regular-season games, not yards or EPA.</p></div>'+
 '<section class="section-block"><div class="section-head"><h2>By the numbers</h2><span class="section-caption">'+(p?.hasLeagueRanks?'2026 NFL scoring ranks':'Complete league ranks pending')+'</span></div>'+compare(p)+'</section>'+
 '<div class="scout-columns"><section class="season-panel"><div class="section-head"><h2>Recent form</h2></div><p class="scout-section-hint">Last four completed regular-season games for '+esc(name)+'</p>'+recent(p)+'</section><section class="season-panel"><div class="section-head"><h2>From their side</h2></div><p class="scout-section-hint">News and developments from ESPN</p>'+headlines(p)+'</section></div>'+
 '<p class="fine-print">Preview automatically switches to the next opponent following Green Bay’s schedule. Updated statistics and news depend on source availability; an absent metric is left blank rather than invented.</p>';
}
function paint(){
 const page=document.body.dataset.page;
 if(page==='home'){
   const existing=$('#opponent');if(existing)existing.remove();
   const glimpse=$('.at-a-glance');if(glimpse)glimpse.insertAdjacentHTML('afterend',tease());
 }else if(page==='matchup')report();
}
async function load(){
 const files=['data/schedule.json','data/opponent.json'];
 const result=await Promise.allSettled(files.map(async file=>{const r=await fetch(file+'?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(file+' '+r.status);return r.json();}));
 if(result[0].status==='fulfilled')game=upcoming(result[0].value.games||[]);
 if(result[1].status==='fulfilled')preview=result[1].value;
 lastFetch=Date.now();paint();
}
window.addEventListener('packers:render',paint);
load();
setInterval(load,3*60*1000);
})();
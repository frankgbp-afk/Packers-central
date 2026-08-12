const esc=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const teamAbbr={
  'Pittsburgh Steelers':'pit','Denver Broncos':'den','Arizona Cardinals':'ari','Minnesota Vikings':'min','New York Jets':'nyj','Atlanta Falcons':'atl','Tampa Bay Buccaneers':'tb','Chicago Bears':'chi','Dallas Cowboys':'dal','Detroit Lions':'det','Carolina Panthers':'car','New England Patriots':'ne','Los Angeles Rams':'lar','New Orleans Saints':'no','Buffalo Bills':'buf','Miami Dolphins':'mia','Houston Texans':'hou'
};
const logoFor=name=>teamAbbr[name]?`https://a.espncdn.com/i/teamlogos/nfl/500/${teamAbbr[name]}.png`:'';
const isPrimeTime=g=>{
  if(!g?.time||g.time==='TBD'||g.time==='No game')return false;
  const m=g.time.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if(!m)return false;
  let hour=Number(m[1]);const ampm=m[3].toUpperCase();
  if(ampm==='PM'&&hour!==12)hour+=12;if(ampm==='AM'&&hour===12)hour=0;
  return hour>=19;
};
const gameCard=g=>{
  if(g.bye)return `<article class="full-game-card bye"><div class="week-chip">${esc(g.week)}</div><div><b>BYE WEEK</b><span>No game scheduled</span><small>Rest up.</small></div></article>`;
  const home=g.homeAway==='VS';const opponent=`${home?'vs.':'at'} ${g.opponent}`;const prime=isPrimeTime(g);const logo=logoFor(g.opponent);
  return `<article class="full-game-card ${home?'home-game':'away-game'}${prime?' prime-time':''}"><div class="week-chip">${esc(g.week)}</div>${logo?`<div class="opponent-logo"><img src="${logo}" alt="${esc(g.opponent)} logo" loading="lazy" onerror="this.parentElement.style.display='none'"></div>`:''}<div class="game-copy"><div class="game-title-row"><b>${esc(opponent)}</b>${prime?'<span class="prime-badge" title="Prime-time game" aria-label="Prime-time game">★ PRIME</span>':''}</div><span>${esc(g.date)} · ${esc(g.time)}</span><small>${esc(g.network)} · ${esc(g.venue)}</small></div></article>`;
};
async function loadSchedule(){
  try{
    const res=await fetch(`data/schedule.json?v=${Date.now()}`,{cache:'no-store'});if(!res.ok)throw new Error('Schedule unavailable');
    const data=await res.json();const games=data.games||[];const pre=games.filter(g=>g.phase==='Preseason');const reg=games.filter(g=>g.phase==='Regular Season');
    document.querySelector('#preseasonList').innerHTML=pre.map(gameCard).join('');document.querySelector('#regularSeasonList').innerHTML=reg.map(gameCard).join('');
    const now=Date.now();const next=games.find(g=>g.kickoff&&new Date(g.kickoff).getTime()>now)||games.find(g=>!g.bye&&g.kickoff===null);
    if(next){document.querySelector('#nextOpponent').textContent=`${next.homeAway==='VS'?'vs.':'at'} ${next.opponent}`;document.querySelector('#nextDetails').textContent=`${next.date} · ${next.time} · ${next.network}`;document.querySelector('#nextVenue').textContent=next.venue;document.querySelector('#nextNetwork').textContent=next.network==='Packers TV Network'?'PTV':next.network;}
  }catch(error){console.error(error);document.querySelector('#preseasonList').innerHTML='<p class="empty-state">Could not load schedule.</p>';document.querySelector('#regularSeasonList').innerHTML='';document.querySelector('#nextOpponent').textContent='Schedule unavailable';}
}
loadSchedule();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));}

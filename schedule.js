const esc=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const gameCard=g=>{
  if(g.bye)return `<article class="full-game-card bye"><div class="week-chip">${esc(g.week)}</div><div><b>BYE WEEK</b><span>No game scheduled</span><small>Rest up.</small></div></article>`;
  const opponent=`${g.homeAway==='VS'?'vs.':'at'} ${g.opponent}`;
  return `<article class="full-game-card"><div class="week-chip">${esc(g.week)}</div><div><b>${esc(opponent)}</b><span>${esc(g.date)} · ${esc(g.time)}</span><small>${esc(g.network)} · ${esc(g.venue)}</small></div></article>`;
};

async function loadSchedule(){
  try{
    const res=await fetch(`data/schedule.json?v=${Date.now()}`,{cache:'no-store'});if(!res.ok)throw new Error('Schedule unavailable');
    const data=await res.json();const games=data.games||[];
    const pre=games.filter(g=>g.phase==='Preseason');const reg=games.filter(g=>g.phase==='Regular Season');
    document.querySelector('#preseasonList').innerHTML=pre.map(gameCard).join('');
    document.querySelector('#regularSeasonList').innerHTML=reg.map(gameCard).join('');
    const now=Date.now();const next=games.find(g=>g.kickoff&&new Date(g.kickoff).getTime()>now)||games.find(g=>!g.bye&&g.kickoff===null);
    if(next){document.querySelector('#nextOpponent').textContent=`${next.homeAway==='VS'?'vs.':'at'} ${next.opponent}`;document.querySelector('#nextDetails').textContent=`${next.date} · ${next.time} · ${next.network}`;document.querySelector('#nextVenue').textContent=next.venue;document.querySelector('#nextNetwork').textContent=next.network==='Packers TV Network'?'PTV':next.network;}
  }catch(error){console.error(error);document.querySelector('#preseasonList').innerHTML='<p class="empty-state">Could not load schedule.</p>';document.querySelector('#regularSeasonList').innerHTML='';document.querySelector('#nextOpponent').textContent='Schedule unavailable';}
}
loadSchedule();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));}

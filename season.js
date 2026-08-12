const esc=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const recordText=r=>`${r.wins||0}–${r.losses||0}${r.ties?`–${r.ties}`:''}`;

function renderStandings(rows=[]){
  const sorted=[...rows].sort((a,b)=>(b.wins-a.wins)||(a.losses-b.losses));
  document.querySelector('#standings').innerHTML=sorted.map(t=>`<div class="standing-row ${t.packers?'packers':''}"><span>${esc(t.team)}</span><span>${t.wins||0}</span><span>${t.losses||0}</span><span>${t.ties||0}</span></div>`).join('');
}

function renderWatchlist(rows=[]){
  document.querySelector('#watchlist').innerHTML=rows.map(p=>`<article class="watch-card"><div class="watch-card-top"><h4>${esc(p.name)}</h4><span class="position">${esc(p.position)}</span></div><p>${esc(p.note)}</p><span class="watch-stat">${esc(p.stat||'Stats coming soon')}</span></article>`).join('')||'<p class="empty-state">No players on the watchlist yet.</p>';
}

function renderInjuries(rows=[]){
  document.querySelector('#injuryCount').textContent=`${rows.length} listed`;
  document.querySelector('#injuries').innerHTML=rows.length?rows.map(i=>`<div class="injury-row"><b>${esc(i.player)} · ${esc(i.position||'')}</b><span>${esc(i.status)}${i.detail?` · ${esc(i.detail)}`:''}</span></div>`).join(''):'<p class="empty-state">No season injuries added yet.</p>';
}

function renderNotes(rows=[]){
  document.querySelector('#seasonNotes').innerHTML=rows.length?rows.map(n=>`<div class="season-note"><b>${esc(n.label||'NOTE')}</b><br>${esc(n.text)}</div>`).join(''):'<p class="empty-state">This is where weekly takeaways, milestones and “remember this” notes will live.</p>';
}

function buildResultRows(games=[],results=[]){
  const byWeek=new Map(results.map(r=>[r.week,r]));
  return games.filter(g=>g.phase==='Regular Season').map(g=>{
    if(g.bye)return `<div class="result-row"><span class="result-week">${esc(g.week)}</span><div class="result-team"><b>BYE WEEK</b><small>Rest week</small></div><div class="result-status upcoming"><b>—</b><small>No game</small></div></div>`;
    const result=byWeek.get(g.week);
    const opponent=`${g.homeAway==='VS'?'vs.':'at'} ${g.opponent}`;
    if(result){
      const cls=result.result==='W'?'win':result.result==='L'?'loss':'upcoming';
      return `<div class="result-row"><span class="result-week">${esc(g.week)}</span><div class="result-team"><b>${esc(opponent)}</b><small>${esc(g.date)} · ${esc(g.network)}</small></div><div class="result-status ${cls}"><b>${esc(result.result)} ${esc(result.score)}</b><small>${esc(result.note||'Final')}</small></div></div>`;
    }
    return `<div class="result-row"><span class="result-week">${esc(g.week)}</span><div class="result-team"><b>${esc(opponent)}</b><small>${esc(g.date)} · ${esc(g.time)}</small></div><div class="result-status upcoming"><b>UPCOMING</b><small>${esc(g.network)}</small></div></div>`;
  }).join('');
}

async function loadSeason(){
  try{
    const [seasonRes,scheduleRes]=await Promise.all([
      fetch(`data/season.json?v=${Date.now()}`,{cache:'no-store'}),
      fetch(`data/schedule.json?v=${Date.now()}`,{cache:'no-store'})
    ]);
    if(!seasonRes.ok||!scheduleRes.ok)throw new Error('Season data unavailable');
    const season=await seasonRes.json();
    const schedule=await scheduleRes.json();
    const r=season.regularSeason||{};
    const rec=recordText(r);
    document.querySelector('#record').textContent=rec;
    document.querySelector('#heroRecord').textContent=rec;
    document.querySelector('#divisionRecord').textContent=`${r.divisionWins||0}–${r.divisionLosses||0}${r.divisionTies?`–${r.divisionTies}`:''}`;
    document.querySelector('#points').textContent=`${r.pointsFor||0}–${r.pointsAgainst||0}`;
    document.querySelector('#streak').textContent=r.streak||'—';
    document.querySelector('#streakSub').textContent=(r.wins||r.losses||r.ties)?'Current streak':'No games played';

    const p=season.prediction||{};
    document.querySelector('#predictionRecord').textContent=p.record||'—';
    document.querySelector('#predictionDivision').textContent=p.divisionFinish||'—';
    document.querySelector('#predictionPlayoffs').textContent=p.playoffFinish||'—';
    document.querySelector('#predictionBelief').textContent=p.belief||'Set this before Week 1.';
    document.querySelector('#predictionConcern').textContent=p.concern||'Set this before Week 1.';
    document.querySelector('#predictionStatus').textContent=p.locked?'Locked in':'Not locked in yet';

    renderStandings(season.standings||[]);
    renderWatchlist(season.watchlist||[]);
    renderInjuries(season.injuries||[]);
    renderNotes(season.notes||[]);
    document.querySelector('#seasonResults').innerHTML=buildResultRows(schedule.games||[],season.results||[])||'<p class="empty-state">No regular-season games found.</p>';
  }catch(error){
    console.error(error);
    document.querySelector('#seasonResults').innerHTML='<p class="empty-state">Could not load season data.</p>';
  }
}

loadSeason();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));}

const esc=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const recordText=r=>`${r.wins||0}–${r.losses||0}${r.ties?`–${r.ties}`:''}`;

function renderStandings(rows=[]){
  const sorted=[...rows].sort((a,b)=>(b.wins-a.wins)||(a.losses-b.losses));
  const el=document.querySelector('#standings');if(el)el.innerHTML=sorted.map(t=>`<div class="standing-row ${t.packers?'packers':''}"><span>${esc(t.team)}</span><span>${t.wins||0}</span><span>${t.losses||0}</span><span>${t.ties||0}</span></div>`).join('');
}
function renderWatchlist(rows=[]){const el=document.querySelector('#watchlist');if(el)el.innerHTML=rows.map(p=>`<article class="watch-card"><div class="watch-card-top"><h4>${esc(p.name)}</h4><span class="position">${esc(p.position)}</span></div><p>${esc(p.note)}</p><span class="watch-stat">${esc(p.stat||'Stats coming soon')}</span></article>`).join('')||'<p class="empty-state">No players on the watchlist yet.</p>';}
function renderInjuries(rows=[]){const count=document.querySelector('#injuryCount');if(count)count.textContent=`${rows.length} listed`;const el=document.querySelector('#injuries');if(el)el.innerHTML=rows.length?rows.map(i=>`<div class="injury-row"><b>${esc(i.player)} · ${esc(i.position||'')}</b><span>${esc(i.status)}${i.detail?` · ${esc(i.detail)}`:''}</span></div>`).join(''):'<p class="empty-state">No season injuries added yet.</p>';}
function renderNotes(rows=[]){const el=document.querySelector('#seasonNotes');if(el)el.innerHTML=rows.length?rows.map(n=>`<div class="season-note"><b>${esc(n.label||'NOTE')}</b><br>${esc(n.text)}</div>`).join(''):'<p class="empty-state">This is where weekly takeaways, milestones and “remember this” notes will live.</p>';}

// Remove the old duplicate schedule panel even if a stale Season HTML shell is cached.
const oldResults=document.querySelector('#seasonResults');
if(oldResults){const panel=oldResults.closest('.panel');if(panel)panel.remove();else oldResults.remove();}

async function loadSeason(){
  try{
    const seasonRes=await fetch(`data/season.json?v=${Date.now()}`,{cache:'no-store'});
    if(!seasonRes.ok)throw new Error('Season data unavailable');
    const season=await seasonRes.json();const r=season.regularSeason||{};const rec=recordText(r);
    const set=(sel,val)=>{const el=document.querySelector(sel);if(el)el.textContent=val;};
    set('#record',rec);set('#heroRecord',rec);set('#divisionRecord',`${r.divisionWins||0}–${r.divisionLosses||0}${r.divisionTies?`–${r.divisionTies}`:''}`);set('#points',`${r.pointsFor||0}–${r.pointsAgainst||0}`);set('#streak',r.streak||'—');set('#streakSub',(r.wins||r.losses||r.ties)?'Current streak':'No games played');
    const p=season.prediction||{};set('#predictionRecord',p.record||'—');set('#predictionDivision',p.divisionFinish||'—');set('#predictionPlayoffs',p.playoffFinish||'—');set('#predictionBelief',p.belief||'Set this before Week 1.');set('#predictionConcern',p.concern||'Set this before Week 1.');set('#predictionStatus',p.locked?'Locked in':'Not locked in yet');
    renderStandings(season.standings||[]);renderWatchlist(season.watchlist||[]);renderInjuries(season.injuries||[]);renderNotes(season.notes||[]);
  }catch(error){console.error(error);}
}
loadSeason();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));}

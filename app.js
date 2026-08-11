const $=sel=>document.querySelector(sel);
const esc=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const attr=value=>esc(value);
const relativeTime=value=>{if(!value)return 'Recently';const d=new Date(value);if(Number.isNaN(d.getTime()))return value;const mins=Math.round((Date.now()-d.getTime())/60000);if(mins<1)return 'Just now';if(mins<60)return `${mins} min ago`;const hrs=Math.round(mins/60);if(hrs<24)return `${hrs} hr${hrs===1?'':'s'} ago`;const days=Math.round(hrs/24);return `${days} day${days===1?'':'s'} ago`;};
const storyRow=s=>`<a class="story story-link" href="${attr(s.url)}" target="_blank" rel="noopener"><div class="thumb">${esc(s.icon)}</div><div><h4>${esc(s.title)}</h4><div class="details">${esc(s.source)} · ${esc(relativeTime(s.publishedAt))}</div></div><span class="external">↗</span></a>`;
const compactRow=s=>`<a class="compact-story story-link" href="${attr(s.url)}" target="_blank" rel="noopener"><div class="source-icon">${esc(s.icon)}</div><div><h4>${esc(s.title)}</h4><div class="details">${esc(s.source)}</div></div><time>${esc(relativeTime(s.publishedAt))}</time></a>`;

async function loadNews(){
  try{
    const res=await fetch(`data/news.json?v=${Date.now()}`,{cache:'no-store'});if(!res.ok)throw new Error('News unavailable');
    const data=await res.json();const packers=data.sources?.packers||[];const espn=data.sources?.espn||[];
    $('#packersList').innerHTML=packers.length?packers.slice(0,6).map(storyRow).join(''):'<p class="empty-state">Live Packers.com feed is refreshing. Try again in a moment.</p>';
    $('#officialList').innerHTML=packers.length?packers.slice(0,5).map(compactRow).join(''):'<p class="empty-state">Waiting for Packers.com…</p>';
    $('#nflList').innerHTML=espn.length?espn.slice(0,5).map(compactRow).join(''):'<p class="empty-state">Waiting for ESPN NFL…</p>';
    const all=[...packers,...espn].sort((a,b)=>new Date(b.publishedAt||0)-new Date(a.publishedAt||0));
    $('#allNews').innerHTML=all.length?all.slice(0,7).map(compactRow).join(''):'<p class="empty-state">The live feeds are doing their first refresh.</p>';
    if(packers[0]){const top=packers[0];$('#heroTitle').textContent=top.title;$('#heroSummary').textContent=top.summary||'Read the latest official Packers story.';$('#heroSource').textContent=top.source.toUpperCase();$('#heroTime').textContent=relativeTime(top.publishedAt);$('#heroLink').href=top.url;$('#heroLink').target='_blank';$('#heroLink').rel='noopener';}
    if(data.updatedAt)$('#lastUpdated').textContent=`Updated ${relativeTime(data.updatedAt)}`;
  }catch(error){console.error(error);$('#packersList').innerHTML='<p class="empty-state">Could not load live news. Tap Refresh to try again.</p>';$('#officialList').innerHTML='';$('#nflList').innerHTML='';$('#allNews').innerHTML='';}
}

async function loadNextGame(){
  try{const res=await fetch(`data/schedule.json?v=${Date.now()}`,{cache:'no-store'});const data=await res.json();const now=Date.now();const next=data.games.find(g=>g.kickoff&&new Date(g.kickoff).getTime()>now)||data.games.find(g=>!g.bye&&g.kickoff===null);if(!next)return;$('#homeNextOpponent').textContent=`${next.homeAway==='VS'?'vs.':'at'} ${next.opponent}`;$('#homeNextDetails').textContent=`${next.date} · ${next.time} · ${next.network}`;$('#homeNextVenue').textContent=next.venue;$('#homeNextNetwork').textContent=next.network==='Packers TV Network'?'PTV':next.network;}
  catch(error){console.error(error);$('#homeNextOpponent').textContent='Schedule unavailable';}
}

const date=new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date());$('#today').textContent=date;
document.querySelectorAll('button[data-target]').forEach(btn=>btn.addEventListener('click',()=>{document.getElementById(btn.dataset.target)?.scrollIntoView({behavior:'smooth',block:'start'});if(btn.classList.contains('nav-tab')){document.querySelectorAll('.nav-tab').forEach(n=>n.classList.remove('active'));btn.classList.add('active')}}));
$('#refreshBtn').addEventListener('click',async()=>{const b=$('#refreshBtn');b.textContent='↻ Refreshing';await Promise.all([loadNews(),loadNextGame()]);b.textContent='✓ Refreshed';setTimeout(()=>b.textContent='↻ Refresh',1200)});
loadNews();loadNextGame();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));}

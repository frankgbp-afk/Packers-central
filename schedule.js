const regularSeasonList=document.querySelector('#regularSeasonList');
if(regularSeasonList){
  regularSeasonList.innerHTML=Array.from({length:18},(_,i)=>{
    const week=i+1;
    if(week===10){return `<article class="full-game-card bye"><div class="week-chip">WK ${week}</div><div><b>BYE WEEK</b><span>No game scheduled</span><small>Rest up.</small></div></article>`}
    return `<article class="full-game-card"><div class="week-chip">WK ${week}</div><div><b>Opponent TBD</b><span>Date TBD · Time TBD</span><small>Network TBD · Location TBD</small></div></article>`;
  }).join('');
}
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));}

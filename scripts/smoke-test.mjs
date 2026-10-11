import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const files={
 'data/schedule.json':JSON.parse(await readFile('data/schedule.json','utf8')),
 'data/season.json':JSON.parse(await readFile('data/season.json','utf8')),
 'data/news.json':JSON.parse(await readFile('data/news.json','utf8')),
 'data/opponent.json':JSON.parse(await readFile('data/opponent.json','utf8'))
};
assert(files['data/schedule.json'].games.some(g=>g.packersScore===22&&g.opponentScore===39),'Expected completed GB vs MIN fixture');
assert(files['data/opponent.json'].teams?.opponent,'Need an opponent data fixture');
assert(Array.isArray(files['data/opponent.json'].articles),'Opponent news field must be an array');
const realEvent=globalThis.Event;
const fakeElement=()=>({innerHTML:'',querySelectorAll:()=>[],remove:()=>{},insertAdjacentHTML:()=>{},scrollIntoView:()=>{}});
function environment(page){
 const els=new Map();
 const query=selector=>{if(!els.has(selector))els.set(selector,fakeElement());return els.get(selector);};
 const listeners=new Map();
 const document={body:{dataset:{page}},querySelector:query,querySelectorAll:()=>[]};
 const window={
   addEventListener:(type,cb)=>listeners.set(type,cb),
   dispatchEvent:e=>{listeners.get(e.type)?.(e);return true;}
 };
 const fetch=async url=>({ok:true,json:async()=>files[url.split('?')[0]]});
 const context={document,window,location:{hash:''},navigator:{},fetch,Event:realEvent,console,Date,Intl,Math,Number,String,setInterval:()=>{}};
 return {context,query};
}
async function microtasks(){for(let i=0;i<25;i++)await Promise.resolve();}
const app=await readFile('app.js','utf8'),scout=await readFile('scout.js','utf8');
{
 const env=environment('schedule');
 vm.runInNewContext(app,env.context);
 await microtasks();
 const html=env.query('#scheduleList').innerHTML;
 assert(html.includes('39 – 22'),'The winner score must precede the loser score');
 assert(html.includes('MIN 39 · GB 22'),'Ordered team labels must explain the score');
 assert(html.includes('17 – 20')===false,'A lower-first score appeared');
 assert(html.includes('Packers loss'),'Packers results remain recognizable');
 console.log('PASS winner-first scores with labels and W/L badges');
}
{
 const env=environment('home');
 vm.runInNewContext(app,env.context);
 vm.runInNewContext(scout,env.context);
 await microtasks();
 const html=env.query('#pageContent').innerHTML;
 assert(html.includes('Next matchup:')||html.includes('Packers football'),'Homepage game header missing');
 console.log('PASS homepage game and headline rendering');
}
{
 const env=environment('matchup');
 vm.runInNewContext(app,env.context);
 vm.runInNewContext(scout,env.context);
 await microtasks();
 const html=env.query('#matchup-root').innerHTML;
 assert(html.includes('Opponent preview')||html.includes('No upcoming opponent'),'Scouting page title missing');
 assert(html.includes('Scoring offense')&&html.includes('Scoring defense'),'Stats panels missing');
 assert(html.includes('32 NFL teams'),'League rank methodology missing');
 assert(html.includes('From their side')&&html.includes('ESPN'),'Opponent newsroom not rendered');
 assert(html.includes('Recent form'),'Recent games not rendered');
 console.log('PASS opponent preview, comparisons, news, and form');
}

// Regression guard: a scouting page without its own stylesheet breaks the entire design.
const matchupPage=await readFile('matchup.html','utf8');
const homepage=await readFile('index.html','utf8');
const stylesheet=await readFile('scout.css','utf8');
const cacheWorker=await readFile('service-worker.js','utf8');
for(const [label,page] of [['Matchup',matchupPage],['Home',homepage]]){
 assert(page.includes('href="scout.css?v='),label+' missing dedicated scouting stylesheet');
 assert(page.includes('href="styles.css?v='),label+' missing base styles');
 assert(page.includes('src="scout.js?v='),label+' missing scouting functionality');
}
assert(matchupPage.includes('data-page="matchup"'),'Scouting page marker missing');
assert(stylesheet.includes('@media(max-width:760px)'),'Scouting CSS missing mobile rules');
assert(cacheWorker.includes("'./scout.css'"),'Service worker must cache scouting CSS');
console.log('PASS stylesheet wiring, cache registration and mobile CSS safeguards');


const packersSvg=await readFile('packers-mark-2026.svg','utf8');
const oldPackersSvg=await readFile('packers-logo.svg','utf8');
const appIcon=await readFile('packers-icon-2026.svg','utf8');
const manifest=JSON.parse(await readFile('manifest.webmanifest','utf8'));
const baseCss=await readFile('styles.css','utf8');
assert.equal(packersSvg,oldPackersSvg,'The logo should be the actual Packers oval-G, not a recreation');
assert(packersSvg.includes('viewBox="0 0 172.88213 114.26353"')&&packersSvg.includes('fill="#203731"'),'Missing official Green Bay logo paths');
assert(appIcon.includes('viewBox="0 0 172.88213 114.26353"'),'App icon must embed the actual Packers logo');
assert(app.includes('class="brand-mark" src="packers-mark-2026.svg"'),'All-page masthead must use the new canonical Packers mark');
assert(scout.includes('class="scout-packers-logo" src="packers-mark-2026.svg"'),'Matchup hero must show the canonical Packers logo');
assert(scout.includes('class="scout-team-emblem" src="packers-mark-2026.svg"'),'Matchup stats must show the canonical Packers logo');
assert(!scout.includes('<b>G</b>'),'Old fake matchup G was not removed');
assert(!scout.includes('packers-logo.svg')&&!app.includes('packers-logo.svg'),'Old logo URLs must not appear in generated UI');
assert(baseCss.includes('.brand-mark{width:69px;height:54px;display:block'),'Masthead logo styling missing');
for(const [label,page] of [['Home',homepage],['Matchup',matchupPage]]){
 assert(page.includes('v=14'),label+' missing new URL version');
 assert(page.includes('packers-icon-2026.svg?v=14'),label+' icon URL is stale');
}
assert(manifest.icons.some(x=>x.src==='packers-icon-2026.svg'),'Manifest icon URL is stale');
assert(cacheWorker.includes("'./packers-mark-2026.svg'")&&cacheWorker.includes("'./packers-icon-2026.svg'"),'Service worker must precache canonical logo assets');
assert(cacheWorker.includes("fetch(request,{cache:'no-store'})"),'Service worker must not serve stale logo assets while online');
assert(app.includes("addEventListener('controllerchange'"),'Controlled pages must reload when a newer worker takes over');
console.log('PASS canonical Packers mark across all pages, both matchup placements, icon, and fresh-cache handling');
console.log('All Packers Central UI smoke tests passed.');

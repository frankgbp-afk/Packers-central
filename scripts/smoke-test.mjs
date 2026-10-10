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
assert(files['data/opponent.json'].articles?.length>0,'Expected opponent-specific news fixture');
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
 assert(html.includes('Next matchup: Chicago Bears'),'Home has the right next matchup');
 console.log('PASS homepage game and headline rendering');
}
{
 const env=environment('matchup');
 vm.runInNewContext(app,env.context);
 vm.runInNewContext(scout,env.context);
 await microtasks();
 const html=env.query('#matchup-root').innerHTML;
 assert(html.includes('Chicago Bears'),'Scouting page matches next opponent');
 assert(html.includes('Scoring offense')&&html.includes('Scoring defense'),'Stats panels missing');
 assert(html.includes('#8 / 32'),'League scoring rank missing');
 assert(html.includes('From their side')&&html.includes('ESPN'),'Opponent news not rendered');
 assert(html.includes('Recent form'),'Recent games not rendered');
 console.log('PASS opponent preview, comparisons, news, and form');
}
console.log('All Packers Central UI smoke tests passed.');
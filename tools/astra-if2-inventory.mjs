import fs from 'node:fs';
import {compute,ACCELERATORS,POWER,COOLING} from '../src/model/engine.ts';
import {SITES} from '../src/model/sites.ts';
import {content} from '../src/data.js';
import {allClaims} from '../src/claims.js';
import {SOURCES} from '../src/sources.js';
import {CALCS,ASSUMPTIONS} from '../src/evidence.js';
import {SECTIONS} from '../src/pages/method-data.js';
import {story,watt,request,heat} from '../src/app/journeys.js';
const scenarios=[];
for(const accel of Object.keys(ACCELERATORS))for(const power of Object.keys(POWER))for(const cooling of Object.keys(COOLING))for(const meterMW of [10,100,1000,5000])scenarios.push({accel,power,cooling,meterMW});
for(const [site,s]of Object.entries(SITES))scenarios.push({...s.scenario,site});
const claims=new Map();
let inDefault=false;   // true while walking the default scenario (100 MW GB200, 415 V AC, warm-water cooling)
function add(key,label,value,ev,basis){const id=JSON.stringify([key,label,value,ev]);if(!claims.has(id))claims.set(id,{key,label,value,ev,basis,status:'needs Reed',reason:'Inventory entry; not yet individually recertified.'});if(inDefault)claims.get(id).default=true;}
for(const s of scenarios)for(const moduleSide of ['switch','nic']){
const m=compute(s),c=content(m,{moduleSide});inDefault=!s.site&&s.accel==='gb200'&&s.power==='ac415'&&s.cooling==='warm'&&s.meterMW===100;
for(const scene of c.SCENES)for(const field of ['intro','dataIntro','heatIntro','scale'])if(scene[field])add(`scene:${scene.id}:${field}`,scene.title,scene[field],null,null);
for(const r of allClaims(m,c))add(r.key,r.label,r.value,r.ev,r.basis);
for(const [mode,key] of [['power','PARTS'],['data','PARTS_DATA'],['heat','PARTS_HEAT']])for(const [scene,parts]of Object.entries(c[key]))for(const p of parts)for(const f of ['title','body','note'])if(p[f])add(`prose:${mode}:${scene}:${p.id}:${f}`,p.name||p.id,p[f],null,null);
for(const r of m.staircase)add(`staircase:${r.v}`,r.where,`${r.current}; ${r.note}`,null,r.basis);
for(const r of m.bandwidth)add(`bandwidth:${r.cls}`,r.label,`${r.gbs} GB/s; ${r.latency}; ${r.note}`,null,r.basis);
for(const [name,f]of Object.entries({story,watt,request,heat}))for(const [i,b]of f(m).entries())for(const field of ['title','text','tally'])if(b[field])add(`narrative:${name}:${i}:${field}`,b.title,b[field],null,null);
}
inDefault=true;   // registries, Method sections and static pages are scenario-independent
for(const [id,c] of Object.entries(CALCS))add(`calculation:${id}`,c.title,c.how,null,'derived');
for(const [id,a] of Object.entries(ASSUMPTIONS))add(`assumption:${id}`,a.title,`${a.value}: ${a.why}`,{assume:id},'assumed');
for(const s of SECTIONS)add(`method:${s.id}`,s.title,s.html,null,null);
for(const file of ['index.html','evidence.html','method.html']) {
const html=fs.readFileSync(file,'utf8');let i=0;for(const match of html.matchAll(/<(p|h[1-6]|li)\b[^>]*>([\s\S]*?)<\/\1>/g)){const text=match[2].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();if(text)add(`page:${file}:${i++}`,file,text,null,null);}
}
fs.mkdirSync('research/astra-if2',{recursive:true});
fs.writeFileSync('research/astra-if2/claim-inventory.json',JSON.stringify([...claims.values()],null,2)+'\n');


console.log(JSON.stringify({scenarios:scenarios.length,variants:claims.size,sources:Object.keys(SOURCES).length,calculations:Object.keys(CALCS).length,assumptions:Object.keys(ASSUMPTIONS).length}));

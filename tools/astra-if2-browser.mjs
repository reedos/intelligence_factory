import { chromium } from 'playwright';
import fs from 'node:fs';
const port=process.env.PORT, base=`http://127.0.0.1:${port}/`;
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];fs.mkdirSync('research/astra-if2/screens',{recursive:true});
try{for(const width of [360,1440]) for(const route of ['index.html','method.html','evidence.html','parts.html','glossary.html','visualizer.html?view=5.power.tokens']){
 const p=await browser.newPage({viewport:{width,height:900}}), errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+route,{waitUntil:'networkidle'});
 if(route.startsWith('visualizer')){await p.waitForFunction(()=>window.ifx?.built?.[5],null,{timeout:90000});await p.evaluate(()=>{ifx.setTransitions(false);ifx.select('tokens',false);ifx.settle();});await p.locator('#tok-math-toggle').click();await p.waitForTimeout(1500);}

 const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 await p.screenshot({path:`research/astra-if2/screens/${route.split('.')[0]}-${width}.png`});
 results.push({route,width,overflow,errors});await p.close();
}}finally{await browser.close();}
fs.writeFileSync('research/astra-if2/browser-checks.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));if(results.some(r=>r.overflow||r.errors.length))process.exitCode=1;

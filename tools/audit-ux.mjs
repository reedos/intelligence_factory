import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const origin = process.env.URL;
assert(origin, 'Set URL to the local preview origin on your chosen free port');
const b=await chromium.launch({args:['--use-angle=d3d11','--ignore-gpu-blocklist']});
const root=process.env.OUT || 'shots/astra-if1';
fs.mkdirSync(root,{recursive:true});
try {
for(const width of [1440,360]) {
 const p=await b.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(origin);
 for(const id of ['power','data','heat','tokens']) {
 await p.locator(`#${id}`).scrollIntoViewIfNeeded();
 const fig=p.locator(`#${id} + .chapter-scene`);await fig.locator('img').scrollIntoViewIfNeeded();
 await p.waitForFunction(id=>document.querySelector(`#${id} + .chapter-scene img`).naturalWidth>0,id);
 await fig.screenshot({path:`${root}/story-${id}-${width}-after.png`});
 const view={power:'1.power',data:'2.data',heat:'5.heat',tokens:'4.data'}[id];
 for(const link of await fig.locator('a').all()) assert.equal(await link.getAttribute('href'), `visualizer.html?view=${view}`);
 }
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'story overflows');
 await p.goto(new URL('visualizer.html',origin).href);
 await p.waitForFunction(()=>window.ifx?.state.scene===0,null,{timeout:120000});
 await p.locator('[data-pane="scenario"]').click();
 assert.equal(await p.evaluate(()=>ifx.state.selected),null);
 await p.locator('.present-launch').click();assert(await p.evaluate(()=>document.body.classList.contains('presentation-view')));
 await p.keyboard.press('Escape');assert(!(await p.evaluate(()=>document.body.classList.contains('presentation-view'))));
 assert.equal(errors.length,0,errors.join('\n'));await p.close();
 console.log(width,'story images, no overflow, scenario and Present: PASS');
}
 const p=await b.newPage({viewport:{width:1440,height:900}});
 await p.goto(new URL('visualizer.html',origin).href);
 await p.waitForFunction(()=>window.ifx?.state.scene===0,null,{timeout:120000});
 await p.waitForTimeout(18000);
 assert(!(await p.evaluate(()=>ifx.controls.autoRotate)), 'Attract loop started before20seconds');
 await p.waitForFunction(()=>ifx.controls.autoRotate,null,{timeout:12000});
 const before=await p.evaluate(()=>ifx.camera.position.toArray());await p.waitForTimeout(700);
 assert.notDeepEqual(await p.evaluate(()=>ifx.camera.position.toArray()),before,'idle camera did not move');
 await p.screenshot({path:`${root}/idle-present-after.png`});
 await p.keyboard.press('ArrowLeft');assert(!(await p.evaluate(()=>ifx.controls.autoRotate)));
 console.log('20-second idle camera loop and keyboard cancellation: PASS');
 await p.close();
{
 // Defect caught: activity used to disable the idle loop for the whole page life (reviewer's P2).
 // A reset timer fires ~20 s after the move, so it must stay off 12 s after the move and turn on by 25 s.
 const p=await b.newPage({viewport:{width:1440,height:900}});
 await p.goto(new URL('visualizer.html',origin).href);
 await p.waitForFunction(()=>window.ifx?.state.scene===0,null,{timeout:120000});
 await p.waitForTimeout(12000);
 assert(!(await p.evaluate(()=>ifx.controls.autoRotate)),'Attract loop started during the first 12 s');
 await p.mouse.move(300,300);await p.mouse.move(900,500,{steps:12});
 const moved=Date.now();
 await p.waitForTimeout(12000);
 assert(!(await p.evaluate(()=>ifx.controls.autoRotate)),'Attract loop fired ~12 s after the pointer move: the idle timer did not restart');
 await p.waitForFunction(()=>ifx.controls.autoRotate,null,{timeout:Math.max(1000,25000-(Date.now()-moved))});
 const before=await p.evaluate(()=>ifx.camera.position.toArray());await p.waitForTimeout(700);
 assert.notDeepEqual(await p.evaluate(()=>ifx.camera.position.toArray()),before,'camera did not move after the restarted idle loop');
 console.log('Idle reset: pointer activity restarted the 20-second timer, orbit began again within 25 s of the move and the camera moved: PASS');
 await p.close();
}
} finally {await b.close();}

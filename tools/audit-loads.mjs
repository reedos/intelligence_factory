import { chromium } from 'playwright';
if (!process.env.URL) throw new Error('Set URL to your local preview origin');
// Reproducible 4 Mbps down / 1 Mbps up, 150 ms latency; this is a lab profile, not a real phone.
const b=await chromium.launch({args:['--use-angle=d3d11','--ignore-gpu-blocklist']});
try {
 for(const [width,height] of [[1440,900],[360,800]]) {
 const p=await b.newPage({viewport:{width,height},reducedMotion:'reduce'});
 const c=await p.context().newCDPSession(p);await c.send('Network.enable');
 await c.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:4_000_000/8,uploadThroughput:1_000_000/8});
 let bytes=0;c.on('Network.loadingFinished',e=>bytes+=e.encodedDataLength);
 let t=Date.now();await p.goto(new URL('visualizer.html', process.env.URL).href);
 await p.waitForFunction(()=>window.ifx?.state.scene===0&&document.querySelector('#veil.off'),null,{timeout:180000});
 console.log(JSON.stringify({width,scene:0,ms:Date.now()-t,bytes}));
 // The warm-ahead request is included in the bytes accrued since entering the previous level.
 for(const scene of [1,2,3,4]) {
 const old=bytes;t=Date.now();await p.evaluate(async scene=>{await ifx.go(scene);ifx.settle();},scene);
 await p.waitForFunction(()=>document.querySelector('#veil.off'),null,{timeout:180000});
 console.log(JSON.stringify({width,scene,ms:Date.now()-t,bytes:bytes-old,totalBytes:bytes}));
 }
 await p.close();
 }
} finally {await b.close();}

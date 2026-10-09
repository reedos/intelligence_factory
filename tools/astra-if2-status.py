import json,re,glob
from pathlib import Path
p=Path('research/astra-if2/claim-inventory.json');rows=json.loads(p.read_text(encoding='utf-8'))
access={r['id']:r['status'] for r in json.loads(Path('research/astra-if2/source-access.json').read_text(encoding='utf-8'))}
fixed={'campus-transformer-count','token-math-intensity','token-math-step-time','cpu-memory-per-cpu','line-current','campus-crosshall-fibers','hall-crosshall-strands'}
checked={'heat-flux','token-math-flops','token-math-bytes','campus-fuel-volume','reply-energy','reply-water','token-rate','energy-per-token','gpu-die-power','campus-feeder-count','campus-genset-count','campus-unitsub-count','campus-hall-count','campus-cooling-power','campus-chiller-count','campus-drycooler-count','campus-tower-count','campus-gpu-count','it-load-pue','it-load-from-pue','hall-rack-power','campus-water-per-day'}
for r in rows:
 ev=r.get('ev') or {};calc=ev.get('calc')
 if calc in fixed:r.update(status='fixed',reason='Corrected formula, precision or quantity reference; see audit findings and regression tests. Input source recertification is limited separately.')
 elif calc in checked:r.update(status='confirmed',reason='Arithmetic checked by independent dimensional balances or explicit numerical fixture in claim-audit.test.ts; this confirms the model calculation, not empirical validity of assumed inputs.')
 elif r.get('basis')=='assumed' and ev.get('assume'):r.update(status='footnoted',reason='Explicitly labeled model assumption with a named rationale; not an independently measured specification.')
 elif r['key'] in ['method:s1','method:s2','method:s3','method:s11','method:s12']:r.update(status='fixed',reason='Corrected stale description against implementation; remaining source-backed sentences are not fully recertified.')
 else:
  issues=[f'{sid}: {access.get(sid,"unregistered")}' for sid,_ in ev.get('refs',[]) if access.get(sid)!='HTTP 200']
  if issues:r['reason']='Primary recertification unavailable: '+'; '.join(issues)
  else:r['reason']='Not individually recertified in the blocked audit. Source retrieval and metadata validity alone do not establish this claim; independent calculation coverage is not yet exhaustive.'
rank={'confirmed':0,'footnoted':1,'needs Reed':2,'wrong':2,'unsupported':2}
rec={}   # (key, value) -> (verdict, note) from the 10/08/2026 recertification (research/astra-if2/recert/a*.json); the worst verdict wins
for f in sorted(glob.glob('research/astra-if2/recert/a*.json')):
 for x in json.loads(Path(f).read_text(encoding='utf-8')):
  k=(x['key'],x['value']);v=x['verdict']
  if k not in rec or rank[v]>rank[rec[k][0]]:rec[k]=(v,x.get('note') or '')
fixfile=Path('research/astra-if2/recert/fixes.json')
fixed_after={}   # (key, new value) -> source or derivation
if fixfile.exists():
 for x in json.loads(fixfile.read_text(encoding='utf-8')):
  for n in x['new']:fixed_after[(x['key'],n)]=x['source']
for r in rows:
 prior=r.get('status');k=(r['key'],r['value'])
 if prior=='fixed':continue
 if k in fixed_after:r.update(status='fixed',reason='Recertification fix 10/08/2026: '+fixed_after[k])
 elif k in rec:
  v,n=rec[k]
  if v=='confirmed':r.update(status='confirmed',reason='Recertified 10/08/2026 against its cited source or an independent derivation. '+n)
  elif v=='footnoted':r.update(status='footnoted',reason='Recertified 10/08/2026: supported with a disclosed assumption or limit. '+n)
  else:r.update(status='needs Reed',reason='Recertified 10/08/2026, not resolved: '+n)
p.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
from collections import Counter
print(Counter(r['status'] for r in rows))
covered={(r['key'],r['value']) for r in rows if (r['key'],r['value']) in rec or (r['key'],r['value']) in fixed_after}
print('recertified distinct claims:',len(covered),'of',len({(r['key'],r['value']) for r in rows}),'distinct;',sum((r['key'],r['value']) in covered for r in rows),'of',len(rows),'variants')

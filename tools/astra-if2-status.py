import json,re
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
p.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
from collections import Counter
print(Counter(r['status'] for r in rows))

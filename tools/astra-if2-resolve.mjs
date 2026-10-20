import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
registerHooks({resolve(specifier,context,next){
  if(specifier.startsWith('.') && context.parentURL){
    const u=new URL(specifier,context.parentURL);
    if(!/\.[a-z]+$/i.test(u.pathname)) for(const ext of ['.ts','.js']) if(existsSync(new URL(u.href+ext))) return next(u.href+ext,context);
  }
  return next(specifier,context);
}});

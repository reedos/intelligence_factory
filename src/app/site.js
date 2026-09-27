// The top bar: firmer once the hero has scrolled under it, a menu on phones, and the chapter on screen underlined.
const $ = id => document.getElementById(id);
const bar = $('topbar'), nav = $('topnav'), menu = $('menu-btn'), hero = $('top');

// scrolled: the bar needs its own ground once the hero is gone from behind it
const onScroll = () => document.body.classList.toggle('scrolled', !hero || scrollY > hero.offsetHeight - (bar?.offsetHeight || 60) - 8);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// the phone menu
function setMenu(open) {
  nav?.classList.toggle('open', open);
  menu?.setAttribute('aria-expanded', String(open));
}
menu?.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
nav?.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
addEventListener('keydown', e => { if (e.key === 'Escape' && nav?.classList.contains('open')) { setMenu(false); menu.focus(); } });
document.addEventListener('click', e => { if (nav?.classList.contains('open') && !e.target.closest('#topnav, #menu-btn')) setMenu(false); });

// the chapter on screen: the last chapter heading above the middle of the window
const links = [...(nav?.querySelectorAll('a[href^="#"]') || [])];
const chapters = links.map(a => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
let ticking = false;
function spy() {
  ticking = false;
  const mid = innerHeight * 0.45;
  let on = null;
  for (const c of chapters) if (c.getBoundingClientRect().top < mid) on = c.id;
  for (const a of links) a.setAttribute('aria-current', String(a.getAttribute('href') === `#${on}`));
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, { passive: true });
spy();

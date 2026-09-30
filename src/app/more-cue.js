// A scroll box with more below its fold says so: its foot fades out and a "More ↓" button sits over the fade. Pressing
// it scrolls the box (or does what the caller asks, e.g. pull a phone sheet up). Nothing shows when it all fits.
export function moreCue(scroller, { host = scroller.parentElement, label = () => 'More', press = null } = {}) {
  const cue = document.createElement('button');
  cue.type = 'button'; cue.className = 'more-cue'; cue.hidden = true;
  host.append(cue);
  let queued = false;
  const update = () => {
    queued = false;
    const more = scroller.getClientRects().length > 0 && scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop > 8;
    host.classList.toggle('has-more', more);
    cue.hidden = !more;
    if (more) {
      const text = label();
      if (cue.dataset.text !== text) { cue.dataset.text = text; cue.innerHTML = `<span>${text}</span><i aria-hidden="true">↓</i>`; }
      cue.setAttribute('aria-label', `${text}: show what is below`);
    }
  };
  const soon = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  cue.addEventListener('click', () => { if (!press?.()) scroller.scrollBy({ top: Math.max(80, scroller.clientHeight * 0.75), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); });
  scroller.addEventListener('scroll', soon, { passive: true });
  new ResizeObserver(soon).observe(scroller);
  new MutationObserver(soon).observe(scroller, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'class', 'open'] });
  addEventListener('resize', soon);
  update();
  return soon;
}

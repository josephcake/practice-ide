/* ============================================================
   Phone or tablet held upright: the Map side panel and the AWS guide sit under the canvas as a
   bottom sheet with three heights (tabs only, half, nearly full). Tap the grab bar
   to switch, or drag it. Selecting something on the canvas opens the sheet.
   ============================================================ */
const PanelSheet = (() => {
  const phone = typeof window.matchMedia === 'function'
    ? window.matchMedia('(max-width: 1024px) and (orientation: portrait)')
    : null;
  const isPhone = () => !!(phone && phone.matches);
  const byId = (id) => document.getElementById(id);

  const SHEETS = [
    {
      stage: 'design-stage', pane: 'study-pane', collapsedClass: 'study-collapsed', reopen: 'study-reopen', collapse: 'study-collapse',
      active: () => document.body.classList.contains('mode-design') && !!byId('design-stage') && byId('design-stage').classList.contains('view-map')
    },
    {
      stage: 'aws-stage', pane: 'aws-pane', collapsedClass: 'pane-collapsed', reopen: 'aws-reopen', collapse: 'aws-collapse',
      active: () => document.body.classList.contains('mode-aws')
    }
  ];

  const stageOf = (s) => byId(s.stage);
  const isCollapsed = (s) => !!(stageOf(s) && stageOf(s).classList.contains(s.collapsedClass));
  const isFull = (s) => !!(stageOf(s) && stageOf(s).classList.contains('sheet-full'));

  function setFull(s, on) {
    const stage = stageOf(s);
    if (stage) stage.classList.toggle('sheet-full', on);
  }

  function expand(s) {
    if (isCollapsed(s)) { const b = byId(s.reopen); if (b) b.click(); }
  }

  function collapse(s) {
    setFull(s, false);
    if (!isCollapsed(s)) { const b = byId(s.collapse); if (b) b.click(); }
  }

  function bind(s) {
    const stage = stageOf(s);
    const pane = byId(s.pane);
    if (!stage || !pane) return;

    const tabs = pane.querySelector('.study-tabs');
    if (tabs) {
      tabs.addEventListener('click', () => { if (isPhone()) expand(s); }, true);
      tabs.addEventListener('click', (e) => { if (isPhone() && e.target.closest('[data-tab]')) pane.scrollTop = 0; });
    }

    // on a phone the panel never disappears: its ✕ shrinks it to the tab bar, and tapping it again opens it
    const collapseBtn = byId(s.collapse);
    if (collapseBtn) collapseBtn.addEventListener('click', (e) => {
      if (!isPhone()) return;
      if (isCollapsed(s)) { e.stopImmediatePropagation(); expand(s); }
      else setFull(s, false);
    }, true);

    const grab = pane.querySelector('.sheet-grab');
    if (!grab) return;
    let drag = null;
    grab.addEventListener('pointerdown', (e) => {
      if (!isPhone()) return;
      drag = { y: e.clientY, h: pane.getBoundingClientRect().height, moved: false };
      try { grab.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    grab.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(dy) < 6) return;
      drag.moved = true;
      stage.classList.add('sheet-dragging');
      const max = stage.getBoundingClientRect().height;
      pane.style.height = Math.max(56, Math.min(max, drag.h - dy)) + 'px';
    });
    const end = () => {
      if (!drag) return;
      const { moved } = drag;
      const h = pane.getBoundingClientRect().height;
      const max = stage.getBoundingClientRect().height;
      drag = null;
      stage.classList.remove('sheet-dragging');
      pane.style.height = '';
      if (!moved) {
        if (isCollapsed(s)) expand(s);
        else setFull(s, !isFull(s));
      } else if (h < 140) collapse(s);
      else { expand(s); setFull(s, h > max * 0.7); }
      window.dispatchEvent(new Event('resize'));
    };
    grab.addEventListener('pointerup', end);
    grab.addEventListener('pointercancel', end);
  }

  /** Scroll the sheet so the component details sit right under the pinned tab bar. */
  function showDetails(s) {
    const pane = byId(s.pane);
    const details = pane && pane.querySelector('.study-inspect');
    const top = pane && pane.querySelector('.study-top');
    if (!details || details.hidden) return;
    requestAnimationFrame(() => {
      const offset = details.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop;
      const pinned = (top ? top.offsetHeight : 0) + 26;
      pane.scrollTop = Math.max(0, offset - pinned);
    });
  }

  function init() {
    SHEETS.forEach(bind);
    if (typeof DesignGraph !== 'undefined') {
      DesignGraph.onChange((focus) => {
        if (!focus || !isPhone()) return;
        SHEETS.forEach((s) => { if (s.active()) { expand(s); showDetails(s); } });
      });
    }
  }

  init();
  return { isPhone };
})();

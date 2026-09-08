import { renderHeader, renderFooter } from './ui.js';
import { initAuth, requireAdmin } from './auth.js';

function injectAdminGear() {
  if (document.querySelector('.admin-gear')) return;
  const link = document.createElement('a');
  link.className = 'admin-gear';
  link.href = 'admin/login.html';
  link.title = 'ورود به پنل مدیریت';
  link.setAttribute('aria-label', 'ورود به پنل مدیریت');
  link.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
  document.body.appendChild(link);
}

function injectHomeShortcut() {
  if (document.querySelector('.home-shortcut')) return;
  const isAdminArea = document.body.dataset.admin === 'true';
  const link = document.createElement('a');
  link.className = 'home-shortcut';
  link.href = isAdminArea ? '../index.html' : 'index.html';
  link.title = 'صفحه اصلی';
  link.setAttribute('aria-label', 'صفحه اصلی');
  link.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';
  document.body.appendChild(link);
}

function wireAccordions(root = document) {
  root.addEventListener(
    'click',
    (event) => {
      const head = event.target.closest ? event.target.closest('.acc-head') : null;
      if (!head || !root.contains(head)) return;
      const item = head.closest('.acc');
      const group = item && item.parentElement && item.parentElement.closest('.acc-group')
        ? item.parentElement.closest('.acc-group')
        : item
          ? item.parentElement
          : null;
      if (!item || !group) return;
      const opening = !item.classList.contains('is-open');
      group.querySelectorAll(':scope > .acc.is-open').forEach((openItem) => {
        openItem.classList.remove('is-open');
        const openHead = openItem.querySelector(':scope > .acc-head');
        if (openHead) openHead.setAttribute('aria-expanded', 'false');
      });
      if (opening) {
        item.classList.add('is-open');
        head.setAttribute('aria-expanded', 'true');
      }
    },
    true
  );
}

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page || '';
  const isAdmin = document.body.dataset.admin === 'true';
  const isLogin = page === 'login';

  if (isAdmin && !isLogin) {
    requireAdmin();
  }

  wireAccordions();
  renderHeader(page, isAdmin);
  renderFooter();
  if (!isAdmin) injectAdminGear();
  injectHomeShortcut();
  initAuth();
});
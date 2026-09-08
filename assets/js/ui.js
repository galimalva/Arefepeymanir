import config from '../../config.js';
import { getClient, dbTable } from './supabase.js';
import { signOut } from './auth.js';
import { escapeHtml, toPersianDigits, placeholderImage } from './utils.js';

const ADMIN_LINKS = [
  { href: 'dashboard.html', key: 'dashboard', label: 'داشبورد' },
  { href: 'books.html', key: 'books', label: 'کتاب‌ها' },
  { href: 'literary-works.html', key: 'literary-works', label: 'آثار ادبی' },
  { href: 'artworks.html', key: 'artworks', label: 'نقاشی‌ها' },
  { href: 'exhibitions.html', key: 'exhibitions', label: 'نمایشگاه‌ها' },
  { href: 'awards.html', key: 'awards', label: 'جوایز' },
  { href: 'reviews.html', key: 'reviews', label: 'نقدها' },
  { href: 'comments.html', key: 'comments', label: 'نظرات' },
  { href: 'messages.html', key: 'messages', label: 'پیام‌ها' },
  { href: 'timeline.html', key: 'timeline', label: 'سوابق' },
  { href: 'profile.html', key: 'profile', label: 'پروفایل' },
  { href: 'social-links.html', key: 'social-links', label: 'شبکه‌ها' },
  { href: 'settings.html', key: 'settings', label: 'تنظیمات' }
];

const MENU_TOGGLE_ID = 'menu-toggle';

const MENU_PRIMARY_KEYS = new Set([
  'index', 'about', 'resume', 'books', 'literary-works',
  'gallery', 'exhibitions', 'awards', 'contact'
]);

function renderHamburger(extra = '', id = MENU_TOGGLE_ID) {
  return `
    <button class="sig-hamburger" id="${id}" type="button" aria-expanded="false" aria-controls="menu-overlay" aria-label="باز و بسته کردن منوی اصلی" ${extra}>
      <span></span><span></span><span></span>
    </button>`;
}

let siteContextPromise = null;

async function loadSiteContext() {
  const context = {
    title: config.site.title,
    tagline: config.site.tagline,
    email: config.contact.email || '',
    phone: config.contact.phone || '',
    socials: (config.socials || []).slice()
  };
  let client;
  try {
    client = getClient();
  } catch (error) {
    return context;
  }
  try {
    const [{ data: settings }, { data: socials }] = await Promise.all([
      client.from(dbTable('site_settings')).select('*').maybeSingle(),
      client.from(dbTable('social_links')).select('*').order('sort_order', { ascending: true })
    ]);
    if (settings) {
      if (settings.site_title) context.title = settings.site_title;
      if (settings.tagline) context.tagline = settings.tagline;
      if (settings.contact_email) context.email = settings.contact_email;
      if (settings.contact_phone) context.phone = settings.contact_phone;
    }
    if (socials && socials.length) {
      context.socials = socials.map((link) => ({
        label: link.label || link.platform,
        url: link.url
      }));
    }
  } catch (error) {
    /* بدون تغییر روی مقادیر config */
  }
  return context;
}

function getSiteContext() {
  if (!siteContextPromise) {
    siteContextPromise = loadSiteContext();
  }
  return siteContextPromise;
}

function wireLogout() {
  const btn = document.getElementById('logout-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    try {
      await signOut();
    } catch (error) {
      /* در نبود سشن نادیده گرفته می‌شود */
    }
    location.replace('login.html');
  });
}

export async function renderHeader(pageKey, isAdmin) {
  const el = document.getElementById('site-header');
  if (!el) return;

  const context = await getSiteContext();

  if (isAdmin) {
    const links = ADMIN_LINKS.map(
      (item) => `<a class="admin-nav-link${item.key === pageKey ? ' active' : ''}" href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`
    ).join('');
    el.innerHTML = `
      <div class="container admin-bar">
        <div class="admin-bar-top">
          <span class="brand"><span class="brand-mark" aria-hidden="true"></span><span>${escapeHtml(context.title)}</span></span>
        </div>
        <nav class="admin-nav" id="admin-nav" aria-label="منوی مدیریت">${links}</nav>
      </div>`;

    let floatBox = document.getElementById('admin-float-actions');
    if (!floatBox) {
      floatBox = document.createElement('div');
      floatBox.id = 'admin-float-actions';
      floatBox.className = 'admin-float-actions';
      floatBox.innerHTML = `
        <a class="admin-float-action" id="view-site-btn" href="../index.html" title="مشاهدهٔ سایت" aria-label="مشاهدهٔ سایت">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </a>
        <button class="admin-float-action" id="logout-btn" type="button" title="خروج" aria-label="خروج">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>`;
      document.body.appendChild(floatBox);
    }
    wireLogout();
    return;
  }

  const primaryLinks = config.navLinks
    .filter((item) => MENU_PRIMARY_KEYS.has(item.key))
    .map(
      (item) =>
        `<a class="menu-link${item.key === pageKey ? ' is-active' : ''}" href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`
    )
    .join('');

  const secondaryLinks = config.navLinks
    .filter((item) => !MENU_PRIMARY_KEYS.has(item.key))
    .map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`)
    .join('');

  const socials = context.socials.length
    ? context.socials
        .map(
          (item) =>
            `<a href="${escapeHtml(item.url)}" rel="noopener" target="_blank">${escapeHtml(item.label)}</a>`
        )
        .join('')
    : '';

  el.innerHTML = `
    <div class="container sig-header">
      <a class="brand" href="index.html"><span class="brand-mark" aria-hidden="true"></span><span>${escapeHtml(context.title)}</span></a>
      ${renderHamburger()}
    </div>`;

  const toggle = el.querySelector('#menu-toggle');

  let overlay = document.getElementById('menu-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'menu-overlay';
    overlay.className = 'menu-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'منوی اصلی');
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class="menu-shell">
      <div class="menu-head">
        <span class="menu-head-brand"><span class="brand-mark" aria-hidden="true"></span> ${escapeHtml(context.title)}</span>
        ${renderHamburger('data-menu-close aria-expanded="true"', 'menu-close')}
      </div>
      <nav class="menu-links" aria-label="ناوبری اصلی">${primaryLinks}</nav>
      ${secondaryLinks ? `<nav class="menu-sub" aria-label="دسترسی‌های بیشتر">${secondaryLinks}</nav>` : ''}
      <div class="menu-foot">
        <span class="menu-signature">${escapeHtml(context.tagline)}</span>
        ${socials ? `<div class="menu-socials">${socials}</div>` : ''}
      </div>
    </div>`;

  if (!toggle || !overlay) return;

  const setMenu = (open) => {
    overlay.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-locked', open);
    ['header', 'main', 'footer'].forEach((sel) => {
      document.querySelectorAll(sel).forEach((node) => {
        node.inert = open;
      });
    });
    if (open) {
      const first = overlay.querySelector('.menu-links a');
      if (first) first.focus({ preventScroll: true });
    } else {
      toggle.focus({ preventScroll: true });
    }
  };

  const focusables = () =>
    Array.from(overlay.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'));

  toggle.addEventListener('click', () => {
    setMenu(toggle.getAttribute('aria-expanded') !== 'true');
  });

  overlay.querySelectorAll('[data-menu-close]').forEach((btn) => {
    btn.addEventListener('click', () => setMenu(false));
  });

  overlay.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setMenu(false));
  });

  overlay.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const items = focusables();
    if (!items.length) return;
    const firstItem = items[0];
    const lastItem = items[items.length - 1];
    if (event.shiftKey && document.activeElement === firstItem) {
      event.preventDefault();
      lastItem.focus();
    } else if (!event.shiftKey && document.activeElement === lastItem) {
      event.preventDefault();
      firstItem.focus();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && overlay.classList.contains('is-open')) setMenu(false);
  });
}

export async function renderFooter() {
  const el = document.getElementById('site-footer');
  if (!el) return;

  const context = await getSiteContext();
  const year = new Date().getFullYear();

  const isAdmin = document.body.dataset.admin === 'true';
  const links = isAdmin
    ? ADMIN_LINKS.map(
        (item) => `<li><a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a></li>`
      ).join('')
    : config.navLinks
        .map((item) => `<li><a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a></li>`)
        .join('');

  const socials = context.socials.length
    ? context.socials
        .map(
          (item) =>
            `<a class="footer-social-link" href="${escapeHtml(item.url)}" rel="noopener" target="_blank">${escapeHtml(item.label)}</a>`
        )
        .join('')
    : '<span class="footer-pending">در انتظار اطلاعات شبکه‌های اجتماعی</span>';

  const hasContact = !!(context.email || context.phone);
  const contacts = hasContact
    ? [
        context.email && `<li>ایمیل: ${escapeHtml(context.email)}</li>`,
        context.phone && `<li>تلفن: ${escapeHtml(context.phone)}</li>`
      ]
        .filter(Boolean)
        .join('')
    : '<li class="footer-pending">اطلاعات تماس در مرحله محتوا تکمیل می‌شود.</li>';

  el.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div class="footer-col">
          <a class="brand" href="${isAdmin ? 'dashboard.html' : 'index.html'}"><span class="brand-mark" aria-hidden="true"></span><span>${escapeHtml(context.title)}</span></a>
          <p class="footer-about">${escapeHtml(context.tagline)}</p>
          <div class="footer-socials" aria-label="شبکه‌های اجتماعی">${socials}</div>
        </div>
        <nav class="footer-col" aria-label="دسترسی سریع">
          <h4 class="footer-title">دسترسی سریع</h4>
          <ul class="footer-links">${links}</ul>
        </nav>
        <div class="footer-col">
          <h4 class="footer-title">تماس</h4>
          <ul class="footer-contacts">${contacts}</ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${year} ${escapeHtml(context.title)}</span>
        <span>${escapeHtml(context.tagline)}</span>
      </div>
    </div>`;
}

const BOOK_TYPE_LABELS = {
  book: 'کتاب',
  collection: 'مجموعه',
  other: 'اثر ادبی'
};

export function createBookCard(book) {
  const typeLabel = BOOK_TYPE_LABELS[book.type] || 'کتاب';
  const cover =
    book.cover_url || placeholderImage(book.title || 'کتاب', { variant: 'lit', width: 360, height: 480 });
  return `
    <article class="card book-card">
      <div class="card-media card-media--portrait">
        <a href="book.html?id=${encodeURIComponent(book.id)}" tabindex="-1" aria-hidden="true">
          <img src="${cover}" alt="تصویر جای‌نگهدار: ${escapeHtml(book.title || 'کتاب')}" loading="lazy">
        </a>
      </div>
      <div class="card-body">
        <p class="card-meta">
          <span class="badge badge--secondary">${typeLabel}</span>
          ${book.year ? `<span>${toPersianDigits(book.year)}</span>` : ''}
        </p>
        <h3 class="card-title"><a href="book.html?id=${encodeURIComponent(book.id)}">${escapeHtml(book.title)}</a></h3>
      </div>
    </article>`;
}

export function createArtworkCard(artwork) {
  const image =
    artwork.image_url ||
    placeholderImage(artwork.title || 'اثر', { variant: 'art', width: 400, height: 400 });
  return `
    <article class="card art-card">
      <div class="card-media card-media--square">
        <a href="work.html?id=${encodeURIComponent(artwork.id)}" tabindex="-1" aria-hidden="true">
          <img src="${image}" alt="تصویر جای‌نگهدار: ${escapeHtml(artwork.title || 'اثر')}" loading="lazy">
        </a>
      </div>
      <div class="card-body">
        <h3 class="card-title"><a href="work.html?id=${encodeURIComponent(artwork.id)}">${escapeHtml(artwork.title)}</a></h3>
        <p class="card-meta">
          ${artwork.technique ? `<span>${escapeHtml(artwork.technique)}</span>` : ''}
          ${artwork.year ? `<span>${toPersianDigits(artwork.year)}</span>` : ''}
        </p>
      </div>
    </article>`;
}

export function createExhibitionCard(exhibition) {
  const image =
    exhibition.image_url ||
    placeholderImage(exhibition.title || 'نمایشگاه', { variant: 'lit', width: 480, height: 300 });
  const place = [exhibition.location, exhibition.country].filter(Boolean).join('، ');
  return `
    <article class="card">
      <div class="card-media card-media--wide">
        <img src="${image}" alt="تصویر جای‌نگهدار: ${escapeHtml(exhibition.title || 'نمایشگاه')}" loading="lazy">
      </div>
      <div class="card-body">
        <h3 class="card-title"><a href="exhibition.html?id=${encodeURIComponent(exhibition.id)}">${escapeHtml(exhibition.title)}</a></h3>
        <p class="card-meta">
          <span class="badge">${escapeHtml(exhibition.type || 'نمایشگاه')}</span>
          ${place ? `<span>${escapeHtml(place)}</span>` : ''}
          ${exhibition.year ? `<span>${toPersianDigits(exhibition.year)}</span>` : ''}
        </p>
      </div>
    </article>`;
}

export function createAwardChip(award) {
  return `
    <span class="chip">
      ${award.year ? `<span class="chip-year">${toPersianDigits(award.year)}</span>` : ''}
      <span>${escapeHtml(award.title)}</span>
    </span>`;
}
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function toPersianDigits(value) {
  if (value === null || value === undefined) return '';
  const fa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(value).replace(/[0-9]/g, (d) => fa[Number(d)]);
}

export function formatDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return toPersianDigits(date.toLocaleDateString('fa-IR'));
}

export function listErrorHtml(message) {
  return `<p class="page-error">${escapeHtml(message || 'خطا در بارگذاری داده‌ها')}</p>`;
}

export function validateImageFile(file) {
  if (!file) return 'فایل انتخاب نشده است.';
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.type)) return 'فرمت تصویر مجاز نیست (JPEG، PNG، WebP یا GIF).';
  if (file.size > 5 * 1024 * 1024) return 'حجم تصویر باید کمتر از ۵ مگابایت باشد.';
  return null;
}

export function debounce(fn, wait) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function placeholderImage(text, opts) {
  const options = opts || {};
  const width = options.width || 600;
  const height = options.height || 800;
  const variant = options.variant === 'art' ? 'art' : 'lit';
  const colorA = variant === 'art' ? '#2BB5A6' : '#2F6BFF';
  const colorB = variant === 'art' ? '#D6F3EF' : '#D6E6F7';
  const label = xmlEscape(text || 'Signature');
  const size = Math.max(14, Math.round(Math.min(width, height) / 14));
  const subSize = Math.max(10, Math.round(Math.min(width, height) / 22));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="${colorA}" stop-opacity="0.14"/>` +
    `<stop offset="100%" stop-color="${colorB}" stop-opacity="0.55"/>` +
    `</linearGradient></defs>` +
    `<rect width="100%" height="100%" fill="#F6F9FD"/>` +
    `<rect width="100%" height="100%" fill="url(#g)"/>` +
    `<circle cx="50%" cy="44%" r="${Math.round(Math.min(width, height) * 0.16)}" fill="none" stroke="${colorA}" stroke-opacity="0.35" stroke-width="1.5"/>` +
    `<text x="50%" y="46%" text-anchor="middle" dominant-baseline="central" font-size="${size}" font-family="Vazirmatn, Tahoma, sans-serif" fill="#5B6E85">${label}</text>` +
    `<text x="50%" y="${height - 26}" text-anchor="middle" font-size="${subSize}" font-family="Vazirmatn, Tahoma, sans-serif" fill="#A6C8F0">Signature</text>` +
    `</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

export function toast(message, type) {
  let box = document.getElementById('toast-container');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast-container';
    box.className = 'toast-container';
    document.body.appendChild(box);
  }
  const item = document.createElement('div');
  item.className = type === 'success' ? 'toast toast--success' : type === 'error' ? 'toast toast--error' : 'toast';
  item.textContent = message;
  box.appendChild(item);
  setTimeout(() => {
    item.classList.add('toast--out');
    setTimeout(() => item.remove(), 300);
  }, 3500);
}

function ensureMeta(name, content) {
  let tag = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    const attr = name.startsWith('og:') ? 'property' : 'name';
    tag.setAttribute(attr, name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

export function setupModalDialog(overlay) {
  if (!overlay) return;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  const titleEl = overlay.querySelector('.modal-title');
  if (titleEl && titleEl.textContent) overlay.setAttribute('aria-label', titleEl.textContent.trim());
  overlay.querySelectorAll('.form-group').forEach((group) => {
    const label = group.querySelector('label');
    const field = group.querySelector('input, select, textarea');
    if (label && field && field.id) label.setAttribute('for', field.id);
  });
  const opener = document.activeElement;
  const firstFocusable = overlay.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href]');
  if (firstFocusable) firstFocusable.focus({ preventScroll: true });
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      overlay.remove();
      if (opener && opener.focus) opener.focus({ preventScroll: true });
      return;
    }
    if (event.key !== 'Tab') return;
    const items = Array.from(overlay.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href]'));
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

export function setSeo(opts) {
  const title = opts.title || '';
  const description = opts.description || '';
  const image = opts.image || '';
  const url = opts.url || location.href;
  if (title) document.title = title;
  if (description) ensureMeta('description', description);
  if (image) {
    ensureMeta('og:image', image);
    ensureMeta('twitter:image', image);
  }
  ensureMeta('og:title', title || document.title);
  ensureMeta('og:description', description);
  ensureMeta('og:url', url);
  ensureMeta('og:type', opts.ogType || 'website');
  ensureMeta('twitter:card', 'summary_large_image');
  ensureMeta('twitter:title', title || document.title);
  ensureMeta('twitter:description', description);
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', url);
  const current = document.querySelector('script[data-seo-jsonld]');
  if (current) current.remove();
  if (opts.jsonLd) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-seo-jsonld', '');
    script.textContent = JSON.stringify(opts.jsonLd);
    document.head.appendChild(script);
  }
}
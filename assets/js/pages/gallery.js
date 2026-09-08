import { getClient, dbTable, publicUrl } from '../supabase.js';
import { escapeHtml, toPersianDigits, placeholderImage } from '../utils.js';

export const PAGE_SIZE = 12;

export const CATEGORY_LABELS = {
  abstract: 'انتزاعی',
  calligraphy: 'خوشنویسی',
  traditional: 'سنتی',
  portrait: 'چهره',
  landscape: 'منظره',
  still_life: 'طبیعت بی‌جان',
  figurative: 'تجسمی',
  floral: 'گل و گیاه',
  other: 'سایر'
};

export const SALE_LABELS = {
  for_sale: 'برای فروش',
  sold: 'فروخته شده',
  reserved: 'رزرو شده',
  not_for_sale: 'در معرض فروش نیست'
};

function el(id) {
  return document.getElementById(id);
}

function setHtml(id, html) {
  const node = el(id);
  if (node) node.innerHTML = html;
}

function queryParams() {
  return new URLSearchParams(location.search);
}

function buildHref(overrides) {
  const p = queryParams();
  for (const [key, value] of Object.entries(overrides)) {
    if (value === '' || value === null || value === undefined) p.delete(key);
    else p.set(key, String(value));
  }
  return '?' + p.toString();
}

export function imageOf(work) {
  if (work.image) return publicUrl(work.image);
  if (work.image_url) return work.image_url;
  return placeholderImage(work.title || 'اثر', { variant: 'art', width: 600, height: 750 });
}

export function metaLine(work) {
  const parts = [
    work.technique ? String(work.technique).trim() : null,
    work.year ? toPersianDigits(work.year) : null,
    work.dimensions ? String(work.dimensions).trim() : null
  ].filter(Boolean);
  return parts.join(' · ');
}

export function saleBadgeClass(status) {
  const classes = {
    for_sale: 'badge--success',
    sold: 'badge',
    reserved: 'badge--warning',
    not_for_sale: 'badge--outline'
  };
  return classes[status] || 'badge--outline';
}

export function artTile(work, index) {
  const overlayMeta = metaLine(work);
  const badges = [];
  if (work.category) {
    badges.push(`<span class="badge badge--light">${escapeHtml(CATEGORY_LABELS[work.category] || work.category)}</span>`);
  }
  if (work.sale_status) {
    badges.push(`<span class="badge ${saleBadgeClass(work.sale_status)}">${escapeHtml(SALE_LABELS[work.sale_status] || work.sale_status)}</span>`);
  }
  return `
    <article class="art-tile${work.is_featured ? ' art-tile--featured' : ''}">
      <button class="art-frame" type="button" data-open="${index}" aria-label="نمایش «${escapeHtml(work.title || 'اثر')}» در لایت‌باکس">
        <img src="${imageOf(work)}" alt="${escapeHtml(work.title || 'اثر')}" loading="lazy">
        <span class="art-overlay">
          ${badges.length ? `<span class="art-overlay-badges">${badges.join('')}</span>` : ''}
          <span class="art-overlay-title">${escapeHtml(work.title || 'اثر بی‌عنوان')}</span>
          ${overlayMeta ? `<span class="art-overlay-meta">${escapeHtml(overlayMeta)}</span>` : ''}
          <span class="art-overlay-link">مشاهده در لایت‌باکس</span>
        </span>
      </button>
      <a class="art-more" href="work.html?id=${encodeURIComponent(work.id)}">جزئیات اثر</a>
    </article>`;
}

export function buildThumbs(work) {
  const paths = [work.image, ...(Array.isArray(work.images) ? work.images : [])].filter(Boolean).slice(0, 6);
  if (paths.length <= 1) return '';
  return `
    <div class="lb-thumbs" aria-label="تصاویر اثر">
      ${paths
        .map(
          (path, i) =>
            `<button class="lb-thumb${i === 0 ? ' is-active' : ''}" type="button" data-src="${escapeHtml(publicUrl(path))}" aria-label="نمایش تصویر ${toPersianDigits(i + 1)}"><img src="${escapeHtml(publicUrl(path))}" alt="" loading="lazy"></button>`
        )
        .join('')}
    </div>`;
}

export function buildPriceBlock(work) {
  const hasPrice = work.price !== null && work.price !== undefined && work.price !== '';
  if (!hasPrice && !work.sale_status && !work.purchase_note) return '';
  return `
    <div class="lb-price">
      ${work.sale_status ? `<span class="badge ${saleBadgeClass(work.sale_status)}">${escapeHtml(SALE_LABELS[work.sale_status] || work.sale_status)}</span>` : ''}
      ${hasPrice ? `<span class="lb-price-amount">${toPersianDigits(Number(work.price).toLocaleString('en-US'))} تومان</span>` : ''}
      ${work.purchase_note ? `<p class="lb-price-note">${escapeHtml(work.purchase_note)}</p>` : ''}
    </div>`;
}

export function lightboxHtml(work) {
  const info = [];
  if (work.category) info.push(`${escapeHtml(CATEGORY_LABELS[work.category] || work.category)}`);
  if (work.collection) info.push(`مجموعه: ${escapeHtml(work.collection)}`);
  if (work.exhibition) info.push(`نمایشگاه: ${escapeHtml(work.exhibition)}`);
  const meta = metaLine(work);
  return `
    <figure class="lb-figure">
      <img class="lb-main" src="${imageOf(work)}" alt="${escapeHtml(work.title || 'اثر')}">
      ${buildThumbs(work)}
    </figure>
    <div class="lb-side">
      <h3 class="lb-title">${escapeHtml(work.title || 'اثر بی‌عنوان')}</h3>
      ${meta ? `<p class="lb-meta">${escapeHtml(meta)}</p>` : ''}
      ${info.length ? `<p class="lb-chips">${info.join(' · ')}</p>` : ''}
      ${work.description ? `<p class="lb-desc">${escapeHtml(work.description)}</p>` : ''}
      ${buildPriceBlock(work)}
      <a class="btn btn-primary btn-sm" href="work.html?id=${encodeURIComponent(work.id)}">مشاهده صفحه اثر</a>
    </div>`;
}

function emptyState(title, text) {
  return `
    <div class="empty-state">
      <h3 class="empty-title">${escapeHtml(title)}</h3>
      <p class="empty-text">${escapeHtml(text)}</p>
    </div>`;
}

function paginationHtml(current, total, count) {
  if (total <= 1) return '';
  const pages = [];
  const windowStart = Math.max(1, current - 2);
  const windowEnd = Math.min(total, current + 2);
  for (let p = windowStart; p <= windowEnd; p++) {
    pages.push(
      `<a class="btn btn-sm pagination-link ${p === current ? 'pagination-link--active' : ''}" href="${buildHref({ page: p, category: queryParams().get('category') || '', collection: queryParams().get('collection') || '' })}" aria-label="صفحه ${toPersianDigits(p)}" ${p === current ? 'aria-current="page"' : ''}>${toPersianDigits(p)}</a>`
    );
  }
  const prev = current > 1
    ? `<a class="btn btn-sm pagination-link" href="${buildHref({ page: current - 1 })}">قبلی</a>`
    : '';
  const next = current < total
    ? `<a class="btn btn-sm pagination-link" href="${buildHref({ page: current + 1 })}">بعدی</a>`
    : '';
  return `
    <div class="pagination-inner">
      ${prev}
      ${pages.join('')}
      ${next}
      <span class="pagination-count">${toPersianDigits(count)} اثر</span>
    </div>`;
}

async function loadCollections(client) {
  try {
    const { data } = await client
      .from(dbTable('artworks'))
      .select('collection')
      .eq('is_published', true);
    const names = [...new Set((data || []).map((row) => row.collection).filter(Boolean))].sort();
    const wrap = el('fCollectionWrap');
    if (!wrap) return;
    const current = queryParams().get('collection') || '';
    wrap.innerHTML = `
      <select class="form-control" name="collection" id="fCollection" aria-label="فیلتر مجموعه">
        <option value="">همه مجموعه‌ها</option>
        ${names.map((name) => `<option value="${escapeHtml(name)}"${name === current ? ' selected' : ''}>${escapeHtml(name)}</option>`).join('')}
      </select>`;
  } catch (error) {
    /* بدون سوپابیس، فقط همان گزینه همهٔ مجموعه‌ها باقی می‌ماند. */
  }
}

function openLightbox(works, startIndex) {
  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  overlay.innerHTML = `
    <div class="lightbox-inner" role="dialog" aria-modal="true" aria-label="مشاهده اثر">
      <button class="lb-close" type="button" aria-label="بستن">×</button>
      <button class="lb-nav lb-prev" type="button" aria-label="اثر قبلی">‹</button>
      <button class="lb-nav lb-next" type="button" aria-label="اثر بعدی">›</button>
      <div class="lb-body" id="lb-body">${lightboxHtml(works[startIndex])}</div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  const opener = document.activeElement;
  let index = startIndex;

  function render(i) {
    index = (i + works.length) % works.length;
    const body = overlay.querySelector('#lb-body');
    if (body) body.innerHTML = lightboxHtml(works[index]);
    const main = overlay.querySelector('.lb-main');
    if (main) {
      overlay.querySelectorAll('.lb-thumb').forEach((thumb) => {
        thumb.addEventListener('click', () => {
          main.src = thumb.dataset.src;
          overlay.querySelectorAll('.lb-thumb').forEach((t) => t.classList.remove('is-active'));
          thumb.classList.add('is-active');
        });
      });
    }
  }

  function close() {
    overlay.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }

  function onKey(event) {
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowLeft') render(index - 1);
    if (event.key === 'ArrowRight') render(index + 1);
    if (event.key === 'Tab') {
      const nodes = Array.from(overlay.querySelectorAll('.lightbox-inner [tabindex]:not([tabindex="-1"]), .lightbox-inner a[href], .lightbox-inner button:not([disabled])'));
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  overlay.querySelector('.lb-close').addEventListener('click', close);
  overlay.querySelector('.lb-prev').addEventListener('click', () => render(index - 1));
  overlay.querySelector('.lb-next').addEventListener('click', () => render(index + 1));
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener('keydown', onKey);
  render(startIndex);
  const closeBtn = overlay.querySelector('.lb-close');
  if (closeBtn) closeBtn.focus({ preventScroll: true });
}

async function loadGallery() {
  const params = queryParams();
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
  const category = params.get('category') || '';
  const collection = params.get('collection') || '';

  const categoryInput = el('fCategory');
  if (categoryInput) categoryInput.value = category;

  let client;
  try {
    client = getClient();
  } catch (error) {
    setHtml('gallery-grid', emptyState('این بخش به‌زودی تکمیل می‌شود', 'پس از راه‌اندازی پایگاه داده، گالری نقاشی‌ها اینجا نمایش داده می‌شود.'));
    setHtml('gallery-pagination', '');
    return;
  }

  loadCollections(client);

  const start = (page - 1) * PAGE_SIZE;
  let query = client.from(dbTable('artworks')).select('*', { count: 'exact' });
  query = query.eq('is_published', true);
  if (category) query = query.eq('category', category);
  if (collection) query = query.eq('collection', collection);
  query = query
    .order('sort_order', { ascending: true, nulls: 'last' })
    .order('created_at', { ascending: false })
    .range(start, start + PAGE_SIZE - 1);

  let data = [];
  let workCount = 0;
  try {
    const result = await query;
    data = result.data || [];
    workCount = result.count || 0;
  } catch (error) {
    setHtml('gallery-grid', emptyState('خطا در دریافت داده', 'لطفاً دوباره تلاش کنید.'));
    setHtml('gallery-pagination', '');
    return;
  }

  const totalPages = Math.max(1, Math.ceil(workCount / PAGE_SIZE));
  if (totalPages > 1 && page > totalPages) {
    location.replace(buildHref({ page: totalPages }));
    return;
  }

  if (!data.length) {
    const message = category || collection
      ? 'هیچ اثری مطابق فیلتر شما یافت نشد.'
      : 'هنوز اثری در گالری ثبت نشده است.';
    setHtml('gallery-grid', emptyState('موردی یافت نشد', message));
    setHtml('gallery-pagination', '');
    return;
  }

  setHtml('gallery-grid', data.map(artTile).join(''));
  document.querySelectorAll('#gallery-grid [data-open]').forEach((btn) => {
    btn.addEventListener('click', () => openLightbox(data, Number(btn.dataset.open)));
  });

  setHtml('gallery-pagination', paginationHtml(page, totalPages, workCount));
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', loadGallery);
}
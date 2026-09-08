import { getClient, dbTable, publicUrl } from '../supabase.js';
import { escapeHtml, toPersianDigits, formatDate, placeholderImage } from '../utils.js';

const PAGE_SIZE = 8;

const CATEGORY_LABELS = {
  short_story: 'داستان کوتاه',
  poem: 'شعر',
  essay: 'یادداشت/جستار',
  article: 'مقاله',
  memoir: 'خاطره',
  other: 'سایر'
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

function imageOf(work) {
  if (work.image) return publicUrl(work.image);
  if (work.image_url) return work.image_url;
  return placeholderImage(work.title || 'اثر ادبی', { variant: 'lit', width: 480, height: 480 });
}

function workCard(work) {
  const category = CATEGORY_LABELS[work.category] || work.category || 'سایر';
  const excerpt = work.excerpt ? String(work.excerpt).trim() : '';
  return `
    <article class="card work-card">
      <div class="card-media card-media--square">
        <a href="literary-work.html?id=${encodeURIComponent(work.id)}" tabindex="-1" aria-hidden="true">
          <img src="${imageOf(work)}" alt="تصویر: ${escapeHtml(work.title || 'اثر ادبی')}" loading="lazy">
        </a>
      </div>
      <div class="card-body">
        <p class="card-meta">
          <span class="badge">${escapeHtml(category)}</span>
        </p>
        <h3 class="card-title"><a href="literary-work.html?id=${encodeURIComponent(work.id)}">${escapeHtml(work.title)}</a></h3>
      </div>
    </article>`;
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
      `<a class="btn btn-sm pagination-link ${p === current ? 'pagination-link--active' : ''}" href="${buildHref({ page: p })}" aria-label="صفحه ${toPersianDigits(p)}" ${p === current ? 'aria-current="page"' : ''}>${toPersianDigits(p)}</a>`
    );
  }
  const prev = current > 1
    ? `<a class="btn btn-sm pagination-link" href="${buildHref({ page: current - 1 })}">قبلی</a>`
    : '';
  const next = current < total
    ? `<a class="btn btn-sm pagination-link" href="${buildHref({ page: current + 1 })}">بعدی</a>`
    : '';
  return `<div class="pagination-inner">${prev}${pages.join('')}${next}<span class="pagination-count">${toPersianDigits(count)} مورد</span></div>`;
}

async function loadWorks() {
  const params = queryParams();
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
  const q = (params.get('q') || '').trim();
  const category = params.get('category') || '';

  const qInput = el('fWQ');
  const catInput = el('fWCat');
  if (qInput) qInput.value = q;
  if (catInput) catInput.value = category;

  let client;
  try {
    client = getClient();
  } catch (error) {
    setHtml('works-grid', emptyState('این بخش به‌زودی تکمیل می‌شود', 'پس از راه‌اندازی پایگاه داده، آثار ادبی اینجا نمایش داده می‌شوند.'));
    return;
  }

  const start = (page - 1) * PAGE_SIZE;
  let query = client.from(dbTable('literary_works')).select('*', { count: 'exact' });
  query = query.eq('is_published', true);
  if (q) query = query.ilike('title', `%${q}%`);
  if (category) query = query.eq('category', category);
  query = query
    .order('published_at', { ascending: false, nulls: 'last' })
    .order('created_at', { ascending: false })
    .range(start, start + PAGE_SIZE - 1);

  let data = [];
  let count = 0;
  try {
    const result = await query;
    data = result.data || [];
    count = result.count || 0;
  } catch (error) {
    setHtml('works-grid', emptyState('خطا در دریافت داده', 'لطفاً دوباره تلاش کنید.'));
    return;
  }

  if (!data.length) {
    const message = q || category
      ? 'هیچ اثری مطابق فیلتر شما یافت نشد.'
      : 'هنوز اثری در این بخش ثبت نشده است.';
    setHtml('works-grid', emptyState('موردی یافت نشد', message));
    setHtml('works-pagination', '');
    return;
  }

  setHtml('works-grid', data.map(workCard).join(''));
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  if (totalPages > 1 && page > totalPages) {
    location.replace(buildHref({ page: totalPages }));
    return;
  }
  setHtml('works-pagination', paginationHtml(page, totalPages, count));
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', loadWorks);
}
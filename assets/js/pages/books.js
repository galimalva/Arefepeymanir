import { getClient, dbTable, publicUrl } from '../supabase.js';
import { escapeHtml, toPersianDigits, placeholderImage } from '../utils.js';

const PAGE_SIZE = 6;

const TYPE_LABELS = {
  book: 'کتاب',
  collection: 'مجموعه',
  other: 'اثر ادبی'
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

function coverOf(book) {
  if (book.cover) return publicUrl(book.cover);
  if (book.cover_url) return book.cover_url;
  return placeholderImage(book.title || 'کتاب', { variant: 'lit', width: 360, height: 480 });
}

function bookCard(book) {
  const typeLabel = TYPE_LABELS[book.type] || 'کتاب';
  return `
    <article class="card book-card">
      <div class="card-media card-media--portrait">
        <a href="book.html?id=${encodeURIComponent(book.id)}" tabindex="-1" aria-hidden="true">
          <img src="${coverOf(book)}" alt="جلد: ${escapeHtml(book.title || 'کتاب')}" loading="lazy">
        </a>
      </div>
      <div class="card-body">
        <p class="card-meta">
          <span class="badge badge--secondary">${escapeHtml(typeLabel)}</span>
          ${book.year ? `<span>${toPersianDigits(book.year)}</span>` : ''}
        </p>
        <h3 class="card-title"><a href="book.html?id=${encodeURIComponent(book.id)}">${escapeHtml(book.title)}</a></h3>
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
      `<a class="btn btn-sm pagination-link ${p === current ? 'pagination-link--active' : ''}" href="${buildHref({ page: p, q: queryParams().get('q') || '', type: queryParams().get('type') || '' })}" aria-label="صفحه ${toPersianDigits(p)}" ${p === current ? 'aria-current="page"' : ''}>${toPersianDigits(p)}</a>`
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
      <span class="pagination-count">${toPersianDigits(count)} مورد</span>
    </div>`;
}

async function loadBooks() {
  const params = queryParams();
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
  const q = (params.get('q') || '').trim();
  const type = params.get('type') || '';

  const qInput = el('fQ');
  const typeInput = el('fType');
  if (qInput) qInput.value = q;
  if (typeInput) typeInput.value = type;

  let client;
  try {
    client = getClient();
  } catch (error) {
    setHtml('books-grid', emptyState('این بخش به‌زودی تکمیل می‌شود', 'پس از راه‌اندازی پایگاه داده، فهرست کتاب‌ها اینجا نمایش داده می‌شود.'));
    return;
  }

  const start = (page - 1) * PAGE_SIZE;
  let query = client.from(dbTable('books')).select('*', { count: 'exact' });
  query = query.eq('is_published', true);
  if (q) query = query.ilike('title', `%${q}%`);
  if (type) query = query.eq('type', type);
  query = query
    .order('year', { ascending: false, nulls: 'last' })
    .order('created_at', { ascending: false })
    .range(start, start + PAGE_SIZE - 1);

  let data = [];
  let count = 0;
  try {
    const result = await query;
    data = result.data || [];
    count = result.count || 0;
  } catch (error) {
    setHtml('books-grid', emptyState('خطا در دریافت داده', 'لطفاً دوباره تلاش کنید.'));
    return;
  }

  if (!data.length) {
    const message = q || type
      ? 'هیچ کتابی مطابق فیلتر شما یافت نشد.'
      : 'هنوز کتابی در این بخش ثبت نشده است.';
    setHtml('books-grid', emptyState('موردی یافت نشد', message));
    setHtml('books-pagination', '');
    return;
  }

  setHtml('books-grid', data.map(bookCard).join(''));
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  if (totalPages > 1 && page > totalPages) {
    location.replace(buildHref({ page: totalPages }));
    return;
  }
  setHtml('books-pagination', paginationHtml(page, totalPages, count));
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', loadBooks);
}
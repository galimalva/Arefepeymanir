import { getClient, dbTable } from '../supabase.js';
import { escapeHtml, toPersianDigits, formatDate } from '../utils.js';

const TYPE_LABELS = {
  book: 'کتاب',
  literary_work: 'اثر ادبی',
  artwork: 'اثر نقاشی'
};

function el(id) {
  return document.getElementById(id);
}

function setHtml(id, html) {
  const node = el(id);
  if (node) node.innerHTML = html;
}

function textOf(review) {
  return String(review.review_text || '').trim();
}

function dateOf(review) {
  if (review.reviewed_at) return formatDate(review.reviewed_at);
  if (review.created_at) return formatDate(review.created_at);
  return '';
}

export function reviewCard(review, related) {
  const body = textOf(review);
  const excerpt = body.length > 240 ? body.slice(0, 240) + '…' : body;
  const date = dateOf(review);
  return `
    <article class="review-card">
      ${review.title ? `<h2 class="review-source">${escapeHtml(review.title)}</h2>` : ''}
      <div class="review-meta-row">
        ${review.item_type ? `<span class="badge badge--secondary">${escapeHtml(TYPE_LABELS[review.item_type] || review.item_type)}</span>` : ''}
        ${review.reviewer ? `<span>نویسنده نقد: ${escapeHtml(review.reviewer)}</span>` : ''}
        ${date ? `<span>${escapeHtml(toPersianDigits(date))}</span>` : ''}
      </div>
      ${body ? `<p class="review-text">${escapeHtml(excerpt)}</p>` : ''}
      ${related && related.href ? `<p class="review-related"><a href="${escapeHtml(related.href)}">اثر مرتبط: ${escapeHtml(related.title)}</a></p>` : ''}
    </article>`;
}

function listHtml(list) {
  if (!list.length) return '<p class="section-empty">هیچ نقد منتشرشده‌ای یافت نشد.</p>';
  return `<div class="review-list">${list.join('')}</div>`;
}

async function loadReviews() {
  const type = new URLSearchParams(location.search).get('type') || '';

  const activeMap = { '': 'reviews-filter', book: 'reviews-filter-book', literary_work: 'reviews-filter-work', artwork: 'reviews-filter-artwork' };
  const active = el(activeMap[type] || 'reviews-filter');
  if (active) {
    active.classList.add('is-active');
    active.setAttribute('aria-current', 'page');
  }

  let client;
  try {
    client = getClient();
  } catch (error) {
    setHtml('reviews-list', '<p class="section-empty">پایگاه داده هنوز راه‌اندازی نشده است.</p>');
    return;
  }

  let reviews = [];
  let books = [];
  let works = [];
  let artworks = [];
  try {
    let query = client.from(dbTable('book_reviews')).select('*').eq('is_published', true);
    if (type) query = query.eq('item_type', type);
    query = query.order('reviewed_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(200);
    const [reviewResult, bookResult, workResult, artResult] = await Promise.all([
      query,
      client.from(dbTable('books')).select('*').eq('is_published', true).limit(500),
      client.from(dbTable('literary_works')).select('*').eq('is_published', true).limit(500),
      client.from(dbTable('artworks')).select('*').eq('is_published', true).limit(500)
    ]);
    reviews = reviewResult.data || [];
    books = bookResult.data || [];
    works = workResult.data || [];
    artworks = artResult.data || [];
  } catch (error) {
    setHtml('reviews-list', '<p class="section-empty">خطایی در دریافت نقدها رخ داد.</p>');
    return;
  }

  const bookMap = new Map(books.map((b) => [b.id, b]));
  const workMap = new Map(works.map((w) => [w.id, w]));
  const artMap = new Map(artworks.map((a) => [a.id, a]));

  const items = reviews.map((review) => {
    let related = null;
    if (review.item_type === 'book' && bookMap.has(review.book_id)) {
      const book = bookMap.get(review.book_id);
      related = { title: book.title, href: `book.html?id=${encodeURIComponent(book.id)}` };
    } else if (review.item_type === 'literary_work' && workMap.has(review.work_id)) {
      const work = workMap.get(review.work_id);
      related = { title: work.title, href: `literary-work.html?id=${encodeURIComponent(work.id)}` };
    } else if (review.item_type === 'artwork' && artMap.has(review.artwork_id)) {
      const art = artMap.get(review.artwork_id);
      related = { title: art.title, href: `work.html?id=${encodeURIComponent(art.id)}` };
    }
    return reviewCard(review, related);
  });

  setHtml('reviews-list', listHtml(items));
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', loadReviews);
}
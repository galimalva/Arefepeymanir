import { getClient, dbTable, publicUrl } from '../supabase.js';
import { escapeHtml, toPersianDigits, placeholderImage, setSeo, formatDate } from '../utils.js';
import { commentsSectionHtml, initCommentsSection, fetchApprovedComments } from '../comments.js';

const TYPE_LABELS = {
  book: 'کتاب',
  collection: 'مجموعه',
  other: 'اثر ادبی'
};

function coverOf(book) {
  if (book.cover) return publicUrl(book.cover);
  if (book.cover_url) return book.cover_url;
  return placeholderImage(book.title || 'کتاب', { variant: 'lit', width: 360, height: 480 });
}

function relatedCard(book) {
  return `
    <article class="card book-card">
      <a class="card-media card-media--portrait" href="book.html?id=${encodeURIComponent(book.id)}">
        <img src="${coverOf(book)}" alt="جلد: ${escapeHtml(book.title || 'کتاب')}" loading="lazy">
      </a>
      <div class="card-body">
        <p class="card-meta"><span class="badge badge--secondary">${escapeHtml(TYPE_LABELS[book.type] || 'کتاب')}</span></p>
        <h3 class="card-title"><a href="book.html?id=${encodeURIComponent(book.id)}">${escapeHtml(book.title)}</a></h3>
      </div>
    </article>`;
}

export function relatedBooksHtml(books, currentId) {
  const list = (books || []).filter((b) => b && b.id !== currentId);
  if (!list.length) return '';
  return `
    <section class="related-section" aria-labelledby="related-books-title">
      <h2 class="section-title" id="related-books-title">آثار مرتبط</h2>
      <div class="card-grid">${list.map(relatedCard).join('')}</div>
    </section>`;
}

export function applyBookSeo(book, image) {
  setSeo({
    title: `${book.title} — معصومه (عارفه) پیمان`,
    description: (book.description || book.title || '').replace(/\s+/g, ' ').trim().slice(0, 200),
    image,
    url: location.href,
    ogType: 'book',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Book',
      name: book.title,
      author: { '@type': 'Person', name: 'معصومه (عارفه) پیمان' },
      ...(book.type ? { bookFormat: book.type } : {}),
      ...(book.publisher ? { publisher: book.publisher } : {}),
      ...(book.year ? { datePublished: String(book.year) } : {}),
      ...(book.isbn ? { isbn: book.isbn } : {}),
      image
    }
  });
}

async function fetchRelatedBooks(book, client) {
  const query = client
    .from(dbTable('books'))
    .select('*')
    .eq('is_published', true)
    .neq('id', book.id)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(4);
  if (book.type) query.eq('type', book.type);
  const { data } = await query;
  return data || [];
}

function reviewTextOf(review) {
  return String(review.review_text || '').trim();
}

export function bookReviewsHtml(reviews) {
  const list = (reviews || []).filter((r) => r && reviewTextOf(r));
  if (!list.length) return '';
  return `
    <section class="talk-section" aria-labelledby="book-reviews-title">
      <h2 class="section-title" id="book-reviews-title">نقدهای کتاب</h2>
      <div class="review-list">
        ${list
          .map(
            (review) => `
          <article class="review-card">
            ${review.title || review.source ? `<h3 class="review-source">${escapeHtml(review.title || review.source)}</h3>` : ''}
            ${review.reviewed_at || review.created_at ? `<p class="review-date">${escapeHtml(formatDate(review.reviewed_at || review.created_at))}</p>` : ''}
            <p class="review-text">${escapeHtml(reviewTextOf(review))}</p>
          </article>`
          )
          .join('')}
      </div>
    </section>`;
}

function detailHtml(book) {
  const typeLabel = TYPE_LABELS[book.type] || 'کتاب';
  const meta = [];
  if (book.publisher) meta.push(['ناشر', book.publisher]);
  if (book.year) meta.push(['سال انتشار', toPersianDigits(book.year)]);
  if (book.isbn) meta.push(['شابک', book.isbn]);
  const paragraphs = book.description
    ? String(book.description).split(/\n+/).filter(Boolean)
    : [];
  return `
    <div class="book-detail-inner">
      <div class="book-detail-media">
        <img src="${coverOf(book)}" alt="جلد: ${escapeHtml(book.title || 'کتاب')}" fetchpriority="high">
      </div>
      <div class="book-detail-info">
        <p class="card-meta">
          <span class="badge badge--secondary">${escapeHtml(typeLabel)}</span>
        </p>
        <h1 class="display-2">${escapeHtml(book.title)}</h1>
        ${meta.length ? `<dl class="detail-meta">${meta.map(([label, value]) => `<div class="detail-meta-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>` : ''}
        ${paragraphs.length ? `<div class="detail-description">${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}</div>` : ''}
        <div class="detail-actions">
          ${book.purchase_url ? `<a class="btn btn-primary btn-lg" href="${escapeHtml(book.purchase_url)}" target="_blank" rel="noopener">خرید کتاب</a>` : ''}
          ${book.download_url ? `<a class="btn btn-secondary btn-lg" href="${escapeHtml(book.download_url)}" target="_blank" rel="noopener">دانلود نمونه/نسخه الکترونیکی</a>` : ''}
        </div>
      </div>
    </div>`;
}

function notFoundHtml() {
  return `
    <div class="empty-state">
      <h3 class="empty-title">کتاب یافت نشد</h3>
      <p class="empty-text">این کتاب در دسترس نیست یا آدرس اشتباه است.</p>
      <a class="btn btn-primary" href="books.html">بازگشت به فهرست کتاب‌ها</a>
    </div>`;
}

async function loadBook() {
  const id = new URLSearchParams(location.search).get('id');
  const body = document.getElementById('book-detail-body');
  if (!body) return;
  if (!id) {
    body.innerHTML = notFoundHtml();
    return;
  }

  let client;
  try {
    client = getClient();
  } catch (error) {
    body.innerHTML = '<p class="section-empty">پایگاه داده هنوز راه‌اندازی نشده است.</p>';
    return;
  }

  let book = null;
  try {
    const { data } = await client.from(dbTable('books')).select('*').eq('id', id).eq('is_published', true).maybeSingle();
    book = data;
  } catch (error) {
    book = null;
  }

  async function fetchBookReviews(bookId, client) {
    try {
      const { data } = await client
        .from(dbTable('book_reviews'))
        .select('*')
        .eq('item_type', 'book')
        .eq('book_id', bookId)
        .eq('is_published', true)
        .order('reviewed_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    } catch (error) {
      return [];
    }
  }

  async function fetchBookComments(client, bookId) {
    try {
      const { data } = await fetchApprovedComments(client, 'book', 'book_id', bookId);
      return data || [];
    } catch (error) {
      return [];
    }
  }

  if (!book) {
    body.innerHTML = notFoundHtml();
    return;
  }
  const image = coverOf(book);
  const [reviews, comments, related] = await Promise.all([
    fetchBookReviews(book.id, client),
    fetchBookComments(client, book.id),
    fetchRelatedBooks(book, client)
  ]);
  body.innerHTML = `${detailHtml(book)}${bookReviewsHtml(reviews)}${commentsSectionHtml(comments)}`;
  applyBookSeo(book, image);
  initCommentsSection({
    root: body,
    itemType: 'book',
    idField: 'book_id',
    itemId: book.id,
    fetchComments: () => fetchBookComments(client, book.id).then((rows) => ({ data: rows }))
  });

  const relatedBox = document.getElementById('book-related');
  if (relatedBox) {
    relatedBox.innerHTML = relatedBooksHtml(related, book.id);
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', loadBook);
}
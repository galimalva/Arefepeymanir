import { getClient, dbTable, publicUrl } from '../supabase.js';
import { escapeHtml, formatDate, placeholderImage, setSeo } from '../utils.js';
import { commentsSectionHtml, initCommentsSection, fetchApprovedComments } from '../comments.js';

const CATEGORY_LABELS = {
  short_story: 'داستان کوتاه',
  poem: 'شعر',
  essay: 'یادداشت/جستار',
  article: 'مقاله',
  memoir: 'خاطره',
  other: 'سایر'
};

function imageOf(work) {
  if (work.image) return publicUrl(work.image);
  if (work.image_url) return work.image_url;
  return placeholderImage(work.title || 'اثر ادبی', { variant: 'lit', width: 480, height: 480 });
}

function fmtDate(value) {
  return value ? formatDate(value) : '';
}

function firstText(record) {
  return String(record.comment_text || record.text || record.review_text || record.content || '').trim();
}

function nameOf(record) {
  return String(record.reader_name || record.commenter_name || record.reviewer_name || record.name || 'کاربر').trim();
}

function sourceOf(record) {
  return String(record.source || record.title || nameOf(record) || 'نقد').trim();
}

function actionsHtml(work) {
  const actions = [];
  if (work.purchase_url) actions.push(`<a class="btn btn-primary btn-lg" href="${escapeHtml(work.purchase_url)}" target="_blank" rel="noopener">خرید</a>`);
  if (work.download_url) actions.push(`<a class="btn btn-secondary btn-lg" href="${escapeHtml(work.download_url)}" target="_blank" rel="noopener">دانلود</a>`);
  if (!actions.length) return '';
  return `<div class="detail-actions">${actions.join('')}</div>`;
}

export function reviewsHtml(reviews) {
  const list = (reviews || []).filter((r) => r && firstText(r));
  if (!list.length) return '';
  return `
    <section class="talk-section" aria-labelledby="work-reviews-title">
      <h2 class="section-title" id="work-reviews-title">نقدها</h2>
      <div class="review-list">
        ${list
          .map(
            (review) => `
          <article class="review-card">
            ${sourceOf(review) ? `<h3 class="review-source">${escapeHtml(sourceOf(review))}</h3>` : ''}
            ${fmtDate(review.created_at) ? `<p class="review-date">${escapeHtml(fmtDate(review.created_at))}</p>` : ''}
            <p class="review-text">${escapeHtml(firstText(review))}</p>
          </article>`
          )
          .join('')}
      </div>
    </section>`;
}

function relatedCard(work) {
  return `
    <article class="card work-card">
      <a class="card-media card-media--square" href="literary-work.html?id=${encodeURIComponent(work.id)}">
        <img src="${imageOf(work)}" alt="${escapeHtml(work.title || 'اثر ادبی')}" loading="lazy">
      </a>
      <div class="card-body">
        <p class="card-meta"><span class="badge">${escapeHtml(CATEGORY_LABELS[work.category] || work.category || 'سایر')}</span></p>
        <h3 class="card-title"><a href="literary-work.html?id=${encodeURIComponent(work.id)}">${escapeHtml(work.title)}</a></h3>
      </div>
    </article>`;
}

export function relatedWorksHtml(works, currentId) {
  const list = (works || []).filter((w) => w && w.id !== currentId);
  if (!list.length) return '';
  return `
    <section class="related-section" aria-labelledby="related-works-title">
      <h2 class="section-title" id="related-works-title">آثار مرتبط</h2>
      <div class="card-grid">${list.map(relatedCard).join('')}</div>
    </section>`;
}

export function applyWorkSeo(work, image) {
  setSeo({
    title: `${work.title} — معصومه (عارفه) پیمان`,
    description: (work.excerpt || work.body || work.title || '').replace(/\s+/g, ' ').trim().slice(0, 200),
    image,
    url: location.href,
    ogType: 'article',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: work.title,
      author: { '@type': 'Person', name: 'معصومه (عارفه) پیمان' },
      ...(work.category ? { articleSection: CATEGORY_LABELS[work.category] || work.category } : {}),
      ...(work.published_at ? { datePublished: work.published_at } : {}),
      image
    }
  });
}

function detailHtml(work) {
  const category = CATEGORY_LABELS[work.category] || work.category || 'سایر';
  const paragraphs = work.body ? String(work.body).split(/\n+/).filter(Boolean) : [];
  const media = work.image
    ? `<figure class="work-figure"><img src="${imageOf(work)}" alt="${escapeHtml(work.title || 'اثر ادبی')}" fetchpriority="high"></figure>`
    : '';
  return `
    <article class="literary-work-inner">
      ${media}
      <div class="literary-work-info">
        <p class="card-meta">
          <span class="badge">${escapeHtml(category)}</span>
          ${work.published_at ? `<span>${escapeHtml(fmtDate(work.published_at))}</span>` : ''}
        </p>
        <h1 class="display-2 work-title">${escapeHtml(work.title)}</h1>
        ${work.excerpt ? `<p class="work-excerpt">${escapeHtml(work.excerpt)}</p>` : ''}
        ${paragraphs.length ? `<div class="work-body">${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}</div>` : ''}
        ${actionsHtml(work)}
      </div>
    </article>`;
}

function notFoundHtml() {
  return `
    <div class="empty-state">
      <h3 class="empty-title">اثر یافت نشد</h3>
      <p class="empty-text">این اثر در دسترس نیست یا هنوز منتشر نشده است.</p>
      <a class="btn btn-primary" href="literary-works.html">بازگشت به فهرست</a>
    </div>`;
}

async function fetchField(workId, field) {
  let client;
  try {
    client = getClient();
  } catch (error) {
    return [];
  }
  const table = field === 'reviews' ? 'book_reviews' : 'book_comments';
  const flag = field === 'reviews' ? 'is_published' : 'is_approved';
  const query = client
    .from(dbTable(table))
    .select('*')
    .eq('item_type', 'literary_work')
    .eq('work_id', workId)
    .eq(flag, true)
    .order('created_at', { ascending: false })
    .limit(20);
  try {
    const { data } = await query;
    return data || [];
  } catch (error) {
    return [];
  }
}

async function fetchRelated(work, client) {
  const query = client
    .from(dbTable('literary_works'))
    .select('*')
    .eq('is_published', true)
    .neq('id', work.id)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(4);
  try {
    const { data } = await query;
    return data || [];
  } catch (error) {
    return [];
  }
}

async function loadWork() {
  const id = new URLSearchParams(location.search).get('id');
  const body = document.getElementById('work-detail-body');
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

  let work = null;
  try {
    const { data } = await client
      .from(dbTable('literary_works'))
      .select('*')
      .eq('id', id)
      .eq('is_published', true)
      .maybeSingle();
    work = data;
  } catch (error) {
    work = null;
  }

  if (!work) {
    body.innerHTML = notFoundHtml();
    return;
  }

  const image = imageOf(work);
  const [reviews, comments, related] = await Promise.all([
    fetchField(id, 'reviews'),
    fetchField(id, 'comments'),
    fetchRelated(work, client)
  ]);

  body.innerHTML = `${detailHtml(work)}${reviewsHtml(reviews)}${commentsSectionHtml(comments)}`;
  initCommentsSection({
    root: body,
    itemType: 'literary_work',
    idField: 'work_id',
    itemId: work.id,
    fetchComments: () => fetchField(id, 'comments').then((rows) => ({ data: rows }))
  });
  const relatedBox = document.getElementById('work-related');
  if (relatedBox) relatedBox.innerHTML = relatedWorksHtml(related, work.id);
  applyWorkSeo(work, image);
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', loadWork);
}
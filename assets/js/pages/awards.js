import { getClient, dbTable } from '../supabase.js';
import { escapeHtml, toPersianDigits } from '../utils.js';

function el(id) {
  return document.getElementById(id);
}

function setHtml(id, html) {
  const node = el(id);
  if (node) node.innerHTML = html;
}

export function awardCard(award, related) {
  const relatedLabel = related?.title || '';
  const relatedHref = related?.href || '';
  return `
    <article class="award-item">
      ${award.year ? `<span class="badge badge--outline award-year">${escapeHtml(toPersianDigits(award.year))}</span>` : ''}
      <div class="award-text">
        <h2 class="award-title">${escapeHtml(award.title)}</h2>
        ${award.organization ? `<p class="award-org">${escapeHtml(award.organization)}</p>` : ''}
        ${award.description ? `<p class="award-desc">${escapeHtml(award.description)}</p>` : ''}
        ${relatedLabel && relatedHref ? `<a class="award-work-link" href="${escapeHtml(relatedHref)}">اثر مرتبط: ${escapeHtml(relatedLabel)}</a>` : ''}
      </div>
    </article>`;
}

function awardsListHtml(list) {
  if (!list.length) return '<p class="section-empty">هنوز جایزه‌ای ثبت نشده است.</p>';
  return `<ul class="awards-list awards-list--page">${list.map((a) => `<li>${a.html}</li>`).join('')}</ul>`;
}

async function loadAwards() {
  let client;
  try {
    client = getClient();
  } catch (error) {
    setHtml('awards-list', '<p class="section-empty">پایگاه داده هنوز راه‌اندازی نشده است.</p>');
    return;
  }

  let awards = [];
  let books = [];
  let works = [];
  try {
    const [awardResult, bookResult, workResult] = await Promise.all([
      client.from(dbTable('awards')).select('*').eq('is_published', true).order('sort_order', { ascending: true, nullsFirst: false }).order('year', { ascending: false }).limit(200),
      client.from(dbTable('books')).select('*').eq('is_published', true).limit(500),
      client.from(dbTable('literary_works')).select('*').eq('is_published', true).limit(500)
    ]);
    awards = awardResult.data || [];
    books = bookResult.data || [];
    works = workResult.data || [];
  } catch (error) {
    setHtml('awards-list', '<p class="section-empty">خطایی در دریافت جوایز رخ داد.</p>');
    return;
  }

  const bookMap = new Map(books.map((b) => [b.id, b.title]));
  const workMap = new Map(works.map((w) => [w.id, w.title]));

  setHtml(
    'awards-list',
    awardsListHtml(
      awards.map((award) => {
        let related = null;
        if (award.book_id && bookMap.has(award.book_id)) {
          related = { title: bookMap.get(award.book_id), href: `book.html?id=${encodeURIComponent(award.book_id)}` };
        } else if (award.work_id && workMap.has(award.work_id)) {
          related = { title: workMap.get(award.work_id), href: `literary-work.html?id=${encodeURIComponent(award.work_id)}` };
        }
        return { html: awardCard(award, related) };
      })
    )
  );
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', loadAwards);
}
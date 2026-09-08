import { getClient, dbTable } from '../supabase.js';
import { escapeHtml, toPersianDigits, formatDate, toast } from '../utils.js';

function el(id) {
  return document.getElementById(id);
}

function setHtml(id, html) {
  const node = el(id);
  if (node) node.innerHTML = html;
}

const QUICK_SECTIONS = [
  { href: 'books.html', key: 'books', label: 'کتاب‌ها' },
  { href: 'literary-works.html', key: 'literary-works', label: 'آثار ادبی' },
  { href: 'artworks.html', key: 'artworks', label: 'نقاشی‌ها' },
  { href: 'exhibitions.html', key: 'exhibitions', label: 'نمایشگاه‌ها' },
  { href: 'awards.html', key: 'awards', label: 'جوایز' },
  { href: 'reviews.html', key: 'reviews', label: 'نقدها' },
  { href: 'comments.html', key: 'comments', label: 'نظرات' },
  { href: 'messages.html', key: 'messages', label: 'پیام‌های تماس' },
  { href: 'timeline.html', key: 'timeline', label: 'سوابق و رزومه' },
  { href: 'profile.html', key: 'profile', label: 'پروفایل نویسنده' },
  { href: 'social-links.html', key: 'social-links', label: 'شبکه‌های اجتماعی' },
  { href: 'settings.html', key: 'settings', label: 'تنظیمات سایت' }
];

export function statCard(value, label) {
  return `
    <div class="stat-card stat-card--accent">
      <span class="stat-value">${toPersianDigits(value)}</span>
      <span class="stat-label">${escapeHtml(label)}</span>
    </div>`;
}

export function quickLinksHtml(items) {
  return items
    .map(
      (item) => `<a class="quick-link" href="${escapeHtml(item.href)}"><span>${escapeHtml(item.label)}</span><span class="quick-link-count"></span></a>`
    )
    .join('');
}

export function messageRow(message) {
  return `
    <li class="comment-card">
      <div class="comment-head"><strong>${escapeHtml(message.full_name || 'کاربر')}</strong><span>${escapeHtml(fmtShortDate(message))}</span></div>
      <p class="comment-text">${escapeHtml(String(message.message || '').slice(0, 120))}</p>
      <a class="btn btn-ghost btn-sm" href="messages.html">مشاهدهٔ پیام‌ها</a>
    </li>`;
}

function fmtShortDate(message) {
  return message.created_at ? formatDate(message.created_at) : '';
}

function commentInline(comment) {
  return `
    <li class="comment-card">
      <div class="comment-head"><strong>${escapeHtml(comment.commenter_name || 'کاربر')}</strong><span>${escapeHtml(fmtShortDate(comment))}</span></div>
      <p class="comment-text">${escapeHtml(String(comment.comment_text || comment.text || '').slice(0, 120))}</p>
      <a class="btn btn-ghost btn-sm" href="comments.html">بررسی‌کردن</a>
    </li>`;
}

function sectionPanel(title, listHtml, emptyText) {
  return `
    <section>
      <h2 class="panel-title">${escapeHtml(title)}</h2>
      ${listHtml ? `<ul class="comment-list">${listHtml}</ul>` : `<p class="section-empty">${escapeHtml(emptyText)}</p>`}
    </section>`;
}

export async function loadDashboard() {
  let client;
  try {
    client = getClient();
  } catch (error) {
    if (el('dash-loading')) el('dash-loading').hidden = true;
    if (el('dash-error')) {
      el('dash-error').textContent = 'پایگاه داده هنوز راه‌اندازی نشده است؛ بخش‌های پنل پس از اتصال فعال می‌شوند.';
      el('dash-error').hidden = false;
    }
    return;
  }

  let profile = null;
  let books = [];
  let literary = [];
  let artworks = [];
  let exhibitions = [];
  let awards = [];
  let reviews = [];
  let comments = [];
  let messages = [];
  let timeline = [];
  let socials = [];
  try {
    const results = await Promise.all([
      client.from(dbTable('author_profile')).select('*').maybeSingle(),
      client.from(dbTable('books')).select('*').limit(500),
      client.from(dbTable('literary_works')).select('*').limit(500),
      client.from(dbTable('artworks')).select('*').limit(500),
      client.from(dbTable('exhibitions')).select('*').limit(500),
      client.from(dbTable('awards')).select('*').limit(500),
      client.from(dbTable('book_reviews')).select('*').limit(500),
      client.from(dbTable('book_comments')).select('*').limit(500),
      client.from(dbTable('messages')).select('*').limit(500),
      client.from(dbTable('timeline_items')).select('*').limit(500),
      client.from(dbTable('social_links')).select('*').limit(500)
    ]);
    profile = results[0].data || null;
    books = results[1].data || [];
    literary = results[2].data || [];
    artworks = results[3].data || [];
    exhibitions = results[4].data || [];
    awards = results[5].data || [];
    reviews = results[6].data || [];
    comments = results[7].data || [];
    messages = results[8].data || [];
    timeline = results[9].data || [];
    socials = results[10].data || [];
  } catch (error) {
    if (el('dash-loading')) el('dash-loading').hidden = true;
    if (el('dash-error')) {
      el('dash-error').textContent = 'خطا در دریافت داده‌ها: ' + (error.message || '');
      el('dash-error').hidden = false;
    }
    return;
  }

  const pendingComments = comments.filter((c) => !c.is_approved);
  const unreadMessages = messages.filter((m) => !m.is_read);

  const stats = [
    { value: books.length, label: 'کتاب‌ها' },
    { value: literary.length, label: 'آثار ادبی' },
    { value: artworks.length, label: 'نقاشی‌ها' },
    { value: exhibitions.length, label: 'نمایشگاه‌ها' },
    { value: awards.length, label: 'جوایز' },
    { value: reviews.length, label: 'نقدها' },
    { value: pendingComments.length, label: 'نظرات در انتظار' },
    { value: comments.length - pendingComments.length, label: 'نظرات منتشرشده' },
    { value: unreadMessages.length, label: 'پیام‌های خوانده‌نشده' },
    { value: messages.length, label: 'کل پیام‌ها' },
    { value: timeline.length, label: 'سوابق' },
    { value: socials.length, label: 'شبکه‌ها' }
  ];

  const welcome = profile && profile.full_name ? profile.full_name : 'مدیر گرامی';
  const attention =
    sectionPanel(
      'نظرات در انتظار تأیید',
      pendingComments.slice(0, 5).map(commentInline).join(''),
      'نظری در انتظار تأیید نیست.'
    ) +
    sectionPanel(
      'پیام‌های خوانده‌نشده',
      unreadMessages.slice(0, 5).map(messageRow).join(''),
      'پیام خوانده‌نشده‌ای وجود ندارد.'
    );

  setHtml(
    'dash-body',
    `
    <h2 class="display-2">${escapeHtml(welcome)}، خوش آمدید</h2>
    <div class="stats-grid">${stats.map((s) => statCard(s.value, s.label)).join('')}</div>
    <section>
      <h2 class="panel-title">دسترسی سریع <span class="badge badge--outline">۱۲ بخش</span></h2>
      <div class="quick-links">${quickLinksHtml(QUICK_SECTIONS)}</div>
    </section>
    <div class="dashboard-content">${attention}</div>
    `
  );

  const loader = el('dash-loading');
  if (loader) loader.hidden = true;
  const body = el('dash-body');
  if (body) body.hidden = false;
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
  });
}
import { getClient, dbTable } from '../supabase.js';
import { escapeHtml, formatDate, toast, setupModalDialog, listErrorHtml } from '../utils.js';

export const COMMENT_TYPE_LABELS = {
  book: 'کتاب',
  literary_work: 'اثر ادبی',
  artwork: 'اثر نقاشی'
};

let comments = [];
let books = [];
let works = [];
let artworks = [];
let searchText = '';
let statusFilter = '';

function el(id) {
  return document.getElementById(id);
}

function setHtml(id, html) {
  const node = el(id);
  if (node) node.innerHTML = html;
}

function fmtDate(value) {
  return value ? formatDate(value) : '';
}

function excerpt(comment, max) {
  const text = String(comment.comment_text || comment.text || '').trim();
  return text.length > (max || 80) ? text.slice(0, max) + '…' : text;
}

function statusBadge(comment) {
  return comment.is_approved
    ? '<span class="badge badge--success">تأیید شده</span>'
    : '<span class="badge badge--warning">در انتظار تأیید</span>';
}

function relatedLabel(comment) {
  const type = COMMENT_TYPE_LABELS[comment.item_type] || comment.item_type || '';
  let title = '';
  let href = '';
  if (comment.item_type === 'book') {
    const book = books.find((b) => b.id === comment.book_id);
    if (book) {
      title = book.title;
      href = `book.html?id=${encodeURIComponent(book.id)}`;
    }
  } else if (comment.item_type === 'literary_work') {
    const work = works.find((w) => w.id === comment.work_id);
    if (work) {
      title = work.title;
      href = `literary-work.html?id=${encodeURIComponent(work.id)}`;
    }
  } else if (comment.item_type === 'artwork') {
    const art = artworks.find((a) => a.id === comment.artwork_id);
    if (art) {
      title = art.title;
      href = `work.html?id=${encodeURIComponent(art.id)}`;
    }
  }
  if (!title) return escapeHtml(type);
  return `${escapeHtml(type)} — <a href="${href}" target="_blank" rel="noopener">${escapeHtml(title)}</a>`;
}

function tableRow(comment) {
  const meta = [
    relatedLabel(comment),
    comment.commenter_email ? `ایمیل: ${escapeHtml(comment.commenter_email)}` : null,
    fmtDate(comment.created_at)
  ].filter(Boolean).join(' | ');
  return `
    <tr>
      <td>
        <strong>${escapeHtml(comment.commenter_name || 'کاربر')}</strong>
        <br><small class="muted">${escapeHtml(excerpt(comment))}</small>
        <br><small class="muted">${meta}</small>
      </td>
      <td>${statusBadge(comment)}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-view="${comment.id}">مشاهده</button>
          <button class="btn btn-secondary btn-sm" type="button" data-tog="${comment.id}">${comment.is_approved ? 'لغو تأیید' : 'تأیید و انتشار'}</button>
          <button class="btn btn-danger btn-sm" type="button" data-del="${comment.id}">حذف</button>
        </div>
      </td>
    </tr>`;
}

function renderTable() {
  const rows = comments.filter((c) => {
    if (statusFilter === 'pending' && c.is_approved) return false;
    if (statusFilter === 'approved' && !c.is_approved) return false;
    if (!searchText) return true;
    return (
      (c.commenter_name || '').includes(searchText) ||
      (c.comment_text || c.text || '').includes(searchText)
    );
  });
  if (!rows.length) {
    setHtml('aTable', '<p class="section-empty">هیچ نظری مطابق فیلترها یافت نشد.</p>');
    return;
  }
  setHtml(
    'aTable',
    `<div class="table-wrap"><table class="dtable">
      <thead><tr><th>نظر</th><th>وضعیت</th><th>عملیات</th></tr></thead>
      <tbody>${rows.map(tableRow).join('')}</tbody>
    </table></div>`
  );
  document.querySelectorAll('#aTable [data-view]').forEach((btn) => {
    btn.addEventListener('click', () => openView(comments.find((c) => c.id === btn.dataset.view)));
  });
  document.querySelectorAll('#aTable [data-tog]').forEach((btn) => {
    btn.addEventListener('click', () => toggleApprove(comments.find((c) => c.id === btn.dataset.tog)));
  });
  document.querySelectorAll('#aTable [data-del]').forEach((btn) => {
    btn.addEventListener('click', () => removeComment(comments.find((c) => c.id === btn.dataset.del)));
  });
}

async function loadComments() {
  let client;
  try {
    client = getClient();
  } catch (error) {
    setHtml('aTable', listErrorHtml(error && error.message));
    return;
  }
  try {
    const results = await Promise.all([
      client.from(dbTable('book_comments')).select('*').order('created_at', { ascending: false }).limit(500),
      client.from(dbTable('books')).select('*').order('title').limit(500),
      client.from(dbTable('literary_works')).select('*').order('title').limit(500),
      client.from(dbTable('artworks')).select('*').order('title').limit(500)
    ]);
    const failed = results.find((result) => result.error);
    if (failed) {
      setHtml('aTable', listErrorHtml(failed.error.message));
      return;
    }
    comments = results[0].data || [];
    books = results[1].data || [];
    works = results[2].data || [];
    artworks = results[3].data || [];
    renderTable();
  } catch (error) {
    setHtml('aTable', listErrorHtml(error && error.message));
  }
}

export function openView(comment) {
  if (!comment) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal--wide">
      <div class="modal-head">
        <h3 class="modal-title">نظر از ${escapeHtml(comment.commenter_name || 'کاربر')}</h3>
        <button class="modal-close" type="button" aria-label="بستن">×</button>
      </div>
      <div class="modal-body">
        <dl class="detail-meta">
          ${comment.item_type ? `<div class="detail-meta-row"><dt>نوع اثر</dt><dd>${escapeHtml(COMMENT_TYPE_LABELS[comment.item_type] || comment.item_type)}</dd></div>` : ''}
          ${comment.commenter_email ? `<div class="detail-meta-row"><dt>ایمیل</dt><dd>${escapeHtml(comment.commenter_email)}</dd></div>` : ''}
          ${comment.created_at ? `<div class="detail-meta-row"><dt>تاریخ</dt><dd>${escapeHtml(fmtDate(comment.created_at))}</dd></div>` : ''}
        </dl>
        ${!comment.is_approved ? '<p class="comment-pending-note">این نظر هنوز منتشر نشده است. پس از تأیید در سایت عمومی نمایش داده می‌شود.</p>' : ''}
        <p class="review-text">${escapeHtml(comment.comment_text || comment.text || '')}</p>
      </div>
      <div class="modal-foot">
        ${!comment.is_approved ? '<button class="btn btn-primary" data-approve type="button">تأیید و انتشار</button>' : ''}
        <button class="btn btn-ghost" data-close type="button">بستن</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  setupModalDialog(overlay);
  overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
  overlay.querySelector('[data-close]').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  const approve = overlay.querySelector('[data-approve]');
  if (approve) {
    approve.addEventListener('click', async () => {
      await toggleApprove(comment);
      overlay.remove();
    });
  }
}

export async function toggleApprove(comment) {
  if (!comment) return;
  const client = getClient();
  const next = !comment.is_approved;
  const { error } = await client.from(dbTable('book_comments')).update({ is_approved: next }).eq('id', comment.id);
  if (error) {
    toast('خطا در به‌روزرسانی: ' + (error.message || ''), 'error');
    return;
  }
  toast(next ? 'نظر تأیید و منتشر شد.' : 'تأیید نظر برداشته شد.');
  await loadComments();
}

export async function removeCommentRow(id, client) {
  return client.from(dbTable('book_comments')).delete().eq('id', id);
}

async function removeComment(comment) {
  if (!comment) return;
  if (!window.confirm(`نظر «${comment.commenter_name || 'کاربر'}» حذف شود؟`)) return;
  const { error } = await removeCommentRow(comment.id, getClient());
  if (error) {
    toast('خطا در حذف: ' + (error.message || ''), 'error');
    return;
  }
  toast('نظر حذف شد.');
  await loadComments();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    loadComments();
    el('aRefresh').addEventListener('click', loadComments);
    el('aStatus').addEventListener('change', (event) => {
      statusFilter = event.target.value || '';
      renderTable();
    });
    el('aSearch').addEventListener('input', (event) => {
      searchText = String(event.target.value || '').trim();
      renderTable();
    });
  });
}
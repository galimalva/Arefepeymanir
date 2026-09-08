import { getClient, dbTable } from '../supabase.js';
import { escapeHtml, toPersianDigits, formatDate, toast, setupModalDialog, listErrorHtml } from '../utils.js';

let messages = [];
let searchText = '';

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

function excerpt(message, max) {
  const text = String(message.message || '').trim();
  return text.length > (max || 90) ? text.slice(0, max) + '…' : text;
}

function readBadge(message) {
  return message.is_read
    ? '<span class="badge badge--outline">خوانده شده</span>'
    : '<span class="badge badge--warning">خوانده نشده</span>';
}

function tableRow(message) {
  const meta = [message.email ? `ایمیل: ${escapeHtml(message.email)}` : '', fmtDate(message.created_at)].filter(Boolean).join(' | ');
  return `
    <tr>
      <td>
        <strong>${escapeHtml(message.full_name || 'بدون نام')}</strong>
        ${message.subject ? `<br><small class="muted">${escapeHtml(message.subject)}</small>` : ''}
        <br><small class="muted">${escapeHtml(excerpt(message))}</small>
        <br><small class="muted">${escapeHtml(meta)}</small>
      </td>
      <td>${readBadge(message)}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-view="${message.id}">مشاهده</button>
          <button class="btn btn-secondary btn-sm" type="button" data-read="${message.id}">${message.is_read ? 'خوانده نشده' : 'خوانده شد'}</button>
          <button class="btn btn-danger btn-sm" type="button" data-del="${message.id}">حذف</button>
        </div>
      </td>
    </tr>`;
}

function renderTable() {
  const rows = messages.filter(
    (m) =>
      !searchText ||
      (m.full_name || '').includes(searchText) ||
      (m.email || '').includes(searchText) ||
      (m.subject || '').includes(searchText) ||
      (m.message || '').includes(searchText)
  );
  if (!rows.length) {
    setHtml('aTable', '<p class="section-empty">هیچ پیامی دریافت نشده است.</p>');
    return;
  }
  setHtml(
    'aTable',
    `<div class="table-wrap"><table class="dtable">
      <thead><tr><th>فرستنده / پیام</th><th>وضعیت</th><th>عملیات</th></tr></thead>
      <tbody>${rows.map(tableRow).join('')}</tbody>
    </table></div>`
  );
  document.querySelectorAll('#aTable [data-view]').forEach((btn) => {
    btn.addEventListener('click', () => openView(messages.find((m) => m.id === btn.dataset.view)));
  });
  document.querySelectorAll('#aTable [data-read]').forEach((btn) => {
    btn.addEventListener('click', () => toggleRead(messages.find((m) => m.id === btn.dataset.read)));
  });
  document.querySelectorAll('#aTable [data-del]').forEach((btn) => {
    btn.addEventListener('click', () => removeMessage(messages.find((m) => m.id === btn.dataset.del)));
  });
}

async function loadMessages() {
  let client;
  try {
    client = getClient();
  } catch (error) {
    setHtml('aTable', listErrorHtml(error && error.message));
    return;
  }
  try {
    const { data, error: queryError } = await client.from(dbTable('messages')).select('*').order('created_at', { ascending: false }).limit(500);
    if (queryError) {
      setHtml('aTable', listErrorHtml(queryError.message));
      return;
    }
    messages = data || [];
    renderTable();
  } catch (error) {
    setHtml('aTable', listErrorHtml(error && error.message));
  }
}

export function openView(message) {
  if (!message) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal--wide">
      <div class="modal-head">
        <h3 class="modal-title">پیام از ${escapeHtml(message.full_name || 'بینام')} ${message.is_read ? '' : '<span class="badge badge--warning">خوانده نشده</span>'}</h3>
        <button class="modal-close" type="button" aria-label="بستن">×</button>
      </div>
      <div class="modal-body">
        <dl class="detail-meta">
          ${message.email ? `<div class="detail-meta-row"><dt>ایمیل</dt><dd>${escapeHtml(message.email)}</dd></div>` : ''}
          ${message.subject ? `<div class="detail-meta-row"><dt>موضوع</dt><dd>${escapeHtml(message.subject)}</dd></div>` : ''}
          ${message.created_at ? `<div class="detail-meta-row"><dt>تاریخ</dt><dd>${escapeHtml(fmtDate(message.created_at))}</dd></div>` : ''}
        </dl>
        <p class="review-text">${escapeHtml(message.message || '')}</p>
      </div>
      <div class="modal-foot">
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
}

export async function toggleRead(message) {
  if (!message) return;
  const client = getClient();
  const { error } = await client.from(dbTable('messages')).update({ is_read: !message.is_read }).eq('id', message.id);
  if (error) {
    toast('خطا در به‌روزرسانی: ' + (error.message || ''), 'error');
    return;
  }
  toast(message.is_read ? 'پیام «خوانده نشده» شد.' : 'پیام «خوانده شده» شد.');
  await loadMessages();
}

export async function removeMessageRow(id, client) {
  return client.from(dbTable('messages')).delete().eq('id', id);
}

async function removeMessage(message) {
  if (!message) return;
  if (!window.confirm(`پیام از «${message.full_name || 'بینام'}» حذف شود؟`)) return;
  const { error } = await removeMessageRow(message.id, getClient());
  if (error) {
    toast('خطا در حذف: ' + (error.message || ''), 'error');
    return;
  }
  toast('پیام حذف شد.');
  await loadMessages();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    loadMessages();
    el('aRefresh').addEventListener('click', loadMessages);
    el('aSearch').addEventListener('input', (event) => {
      searchText = String(event.target.value || '').trim();
      renderTable();
    });
  });
}
import { getClient, dbTable } from './supabase.js';
import { escapeHtml, formatDate, toast } from './utils.js';

function nameOf(comment) {
  return String(comment.commenter_name || comment.reader_name || comment.name || 'کاربر').trim();
}

function textOf(comment) {
  return String(comment.comment_text || comment.text || '').trim();
}

function fmtDate(value) {
  return value ? formatDate(value) : '';
}

export function commentsListHtml(comments) {
  const list = (comments || []).filter((c) => c && c.id && textOf(c));
  if (!list.length) {
    return '<p class="section-empty">هنوز نظری ثبت نشده است. اولین نفر باشید.</p>';
  }
  return `
    <div class="comment-list">
      ${list
        .map(
          (comment) => `
        <article class="comment-card">
          <div class="comment-head">
            <strong>${escapeHtml(nameOf(comment))}</strong>
            ${fmtDate(comment.created_at) ? `<span>${escapeHtml(fmtDate(comment.created_at))}</span>` : ''}
          </div>
          <p class="comment-text">${escapeHtml(textOf(comment))}</p>
        </article>`
        )
        .join('')}
    </div>`;
}

export function commentsSectionHtml(comments) {
  return `
    <section class="talk-section" aria-labelledby="comments-section-title">
      <h2 class="section-title" id="comments-section-title">نظرات</h2>
      <div id="comments-list">${commentsListHtml(comments)}</div>
      <form id="comment-form" class="comment-form" novalidate>
        <h3 class="comment-form-title">دیدگاه شما</h3>
        <div class="form-grid">
          <div class="form-group">
            <label for="cf-name">نام *</label>
            <input class="form-control" id="cf-name" name="name" autocomplete="name" required>
            <span class="field-error" id="cf-name-error"></span>
          </div>
          <div class="form-group">
            <label for="cf-email">ایمیل (اختیاری)</label>
            <input class="form-control" id="cf-email" name="email" type="email" autocomplete="email">
            <span class="field-error" id="cf-email-error"></span>
          </div>
          <div class="form-group form-group--full">
            <label for="cf-text">متن دیدگاه *</label>
            <textarea class="form-control" id="cf-text" name="text" rows="4" required></textarea>
            <span class="field-error" id="cf-text-error"></span>
          </div>
        </div>
        <p class="form-note">نظر شما پس از بررسی و تأیید مدیر منتشر می‌شود. ایمیل شما نمایش داده نمی‌شود.</p>
        <div class="form-actions">
          <button class="btn btn-primary" id="cf-submit" type="submit">ارسال دیدگاه</button>
        </div>
      </form>
    </section>`;
}

export function fetchApprovedComments(client, itemType, idField, itemId) {
  return client
    .from(dbTable('book_comments'))
    .select('*')
    .eq('item_type', itemType)
    .eq(idField, itemId)
    .eq('is_approved', true)
    .order('created_at', { ascending: false })
    .limit(50);
}

function emailIsValid(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export async function submitComment({ itemType, idField, itemId, values }) {
  const name = String(values.name || '').trim();
  const email = String(values.email || '').trim();
  const text = String(values.text || '').trim();
  if (name.length < 2) return { error: { field: 'name', message: 'نام باید حداقل ۲ حرف باشد.' } };
  if (email && !emailIsValid(email)) return { error: { field: 'email', message: 'فرمت ایمیل صحیح نیست.' } };
  if (text.length < 5) return { error: { field: 'text', message: 'متن دیدگاه باید حداقل ۵ حرف باشد.' } };

  const payload = {
    item_type: itemType,
    [idField]: itemId,
    commenter_name: name,
    commenter_email: email || null,
    comment_text: text,
    is_approved: false
  };
  let client;
  try {
    client = getClient();
  } catch (error) {
    return { error: { field: null, message: 'پایگاه داده هنوز راه‌اندازی نشده است.' } };
  }
  try {
    const { error } = await client.from(dbTable('book_comments')).insert(payload);
    if (error) return { error: { field: null, message: error.message || 'خطا در ثبت دیدگاه.' } };
    return { error: null };
  } catch (error) {
    return { error: { field: null, message: error.message || 'خطا در ثبت دیدگاه.' } };
  }
}

export function initCommentsSection({ root, itemType, idField, itemId, fetchComments }) {
  if (!root) return;
  const form = document.getElementById('comment-form');
  if (!form) return;
  const listNode = document.getElementById('comments-list');
  const nameNode = document.getElementById('cf-name');
  const emailNode = document.getElementById('cf-email');
  const textNode = document.getElementById('cf-text');
  const nameErr = document.getElementById('cf-name-error');
  const emailErr = document.getElementById('cf-email-error');
  const textErr = document.getElementById('cf-text-error');
  const submitBtn = document.getElementById('cf-submit');

  function clearErrors() {
    if (nameErr) nameErr.textContent = '';
    if (emailErr) emailErr.textContent = '';
    if (textErr) textErr.textContent = '';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors();
    const result = await submitComment({
      itemType,
      idField,
      itemId,
      values: {
        name: nameNode ? nameNode.value : '',
        email: emailNode ? emailNode.value : '',
        text: textNode ? textNode.value : ''
      }
    });
    if (result.error) {
      if (result.error.field === 'name' && nameErr) nameErr.textContent = result.error.message;
      else if (result.error.field === 'email' && emailErr) emailErr.textContent = result.error.message;
      else if (result.error.field === 'text' && textErr) textErr.textContent = result.error.message;
      else toast(result.error.message, 'error');
      return;
    }
    toast('دیدگاه شما ثبت شد و پس از تأیید مدیر نمایش داده خواهد شد.');
    if (nameNode) nameNode.value = '';
    if (emailNode) emailNode.value = '';
    if (textNode) textNode.value = '';
    if (submitBtn) submitBtn.disabled = true;
    try {
      const { data } = await fetchComments();
      if (listNode) listNode.innerHTML = commentsListHtml(data || []);
    } catch (error) {
      /* بدون بروزرسانی لیست — دیدگاه ثبت شده است */
    }
    if (submitBtn) submitBtn.disabled = false;
  });
}
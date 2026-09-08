import { getClient, dbTable } from '../supabase.js';
import { escapeHtml, toPersianDigits, toast, setupModalDialog } from '../utils.js';

const CATEGORY_LABELS = {
  literary: 'سفر ادبی',
  project: 'پروژه‌های شاخص',
  artistic: 'سفر هنری',
  education: 'تحصیلات',
  teaching: 'تدریس و آموزش',
  career: 'سوابق حرفه‌ای',
  specialty: 'تخصص‌ها',
  mentor: 'اساتید',
  other: 'سایر'
};

let items = [];
let editing = null;

function el(id) {
  return document.getElementById(id);
}

function setHtml(id, html) {
  const node = el(id);
  if (node) node.innerHTML = html;
}

export function categoryLabel(value) {
  return CATEGORY_LABELS[value] || 'سایر';
}

export function buildTimelinePayload(values) {
  return {
    category: values.category || 'other',
    period: String(values.period || '').trim() || null,
    title: String(values.title || '').trim(),
    description: String(values.description || '').trim() || null,
    sort_order: Number(values.sort_order) || 0,
    is_published: !!values.is_published
  };
}

export function validateTimeline(payload) {
  if (!payload.title) return { error: { field: 'title', message: 'عنوان الزامی است.' } };
  if (!payload.category) return { error: { field: 'category', message: 'بخش الزامی است.' } };
  return { error: null };
}

export async function saveTimeline(record, payload, client) {
  if (record) {
    return client.from(dbTable('timeline_items')).update(payload).eq('id', record.id);
  }
  return client.from(dbTable('timeline_items')).insert(payload);
}

export async function removeTimelineRow(id, client) {
  return client.from(dbTable('timeline_items')).delete().eq('id', id);
}

function tableRow(item) {
  return `
    <tr>
      <td>
        <strong>${escapeHtml(item.title)}</strong>
        ${item.period ? `<br><small class="muted">${escapeHtml(item.period)}</small>` : ''}
        ${item.description ? `<br><small class="muted">${escapeHtml(String(item.description).slice(0, 90))}</small>` : ''}
      </td>
      <td><span class="badge badge--secondary">${escapeHtml(categoryLabel(item.category))}</span> ${item.sort_order ? `<span class="muted">ترتیب ${toPersianDigits(item.sort_order)}</span>` : ''}</td>
      <td>${item.is_published ? '<span class="badge badge--success">منتشر شده</span>' : '<span class="badge badge--error">پیش‌نویس</span>'}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-edit="${item.id}">ویرایش</button>
          <button class="btn btn-danger btn-sm" type="button" data-del="${item.id}">حذف</button>
        </div>
      </td>
    </tr>`;
}

function renderTable() {
  const rows = items.slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  if (!rows.length) {
    setHtml('aTable', '<p class="section-empty">هیچ سابقه‌ای ثبت نشده است. برای افزودن از دکمهٔ «+ سابقهٔ جدید» استفاده کنید.</p>');
    return;
  }
  setHtml(
    'aTable',
    `<div class="table-wrap"><table class="dtable">
      <thead><tr><th>عنوان</th><th>بخش</th><th>وضعیت</th><th>عملیات</th></tr></thead>
      <tbody>${rows.map(tableRow).join('')}</tbody>
    </table></div>`
  );
  document.querySelectorAll('#aTable [data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openForm(items.find((i) => i.id === btn.dataset.edit)));
  });
  document.querySelectorAll('#aTable [data-del]').forEach((btn) => {
    btn.addEventListener('click', () => removeTimeline(items.find((i) => i.id === btn.dataset.del)));
  });
}

export async function loadTimeline() {
  let client;
  try {
    client = getClient();
  } catch (error) {
    if (el('tl-error')) {
      el('tl-error').textContent = 'پایگاه داده هنوز راه‌اندازی نشده است.';
      el('tl-error').hidden = false;
    }
    setHtml('aTable', '');
    return;
  }
  try {
    const { data } = await client.from(dbTable('timeline_items')).select('*').order('sort_order', { ascending: true });
    items = data || [];
  } catch (error) {
    if (el('tl-error')) {
      el('tl-error').textContent = 'خطا در دریافت سوابق: ' + (error.message || '');
      el('tl-error').hidden = false;
    }
    items = [];
  }
  renderTable();
}

export function openForm(item) {
  editing = item;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal--wide">
      <div class="modal-head">
        <h3 class="modal-title">${item ? 'ویرایش سابقه' : 'سابقهٔ جدید'}</h3>
        <button class="modal-close" type="button" aria-label="بستن">×</button>
      </div>
      <div class="modal-body form-grid">
        <div class="form-group"><label>بخش *</label>
          <select class="form-control" id="fCategory">
            ${Object.entries(CATEGORY_LABELS).map(([value, label]) => `<option value="${value}" ${(item?.category || 'other') === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
          <span class="field-error" id="fCategory-error"></span>
        </div>
        <div class="form-group"><label>دوره / سال (مثل ۱۳۹۳–۱۳۹۸)</label><input class="form-control" id="fPeriod" value="${escapeHtml(item?.period || '')}"></div>
        <div class="form-group"><label>عنوان *</label><input class="form-control" id="fTitle" required value="${escapeHtml(item?.title || '')}"><span class="field-error" id="fTitle-error"></span></div>
        <div class="form-group"><label>ترتیب نمایش</label><input class="form-control" id="fSort" type="number" value="${item?.sort_order ?? 0}"></div>
        <div class="form-group form-group--full"><label>توضیحات</label><textarea class="form-control" id="fDescription" rows="3">${escapeHtml(item?.description || '')}</textarea></div>
        <label class="checkbox-field form-group--full"><input type="checkbox" id="fPublished" ${item?.is_published ? 'checked' : ''}> منتشر شده (نمایش عمومی)</label>
      </div>
      <div class="modal-foot">
        <button class="btn btn-primary" id="fSave">ذخیره</button>
        <button class="btn btn-ghost" id="fCancel" type="button">انصراف</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  setupModalDialog(overlay);
  overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#fCancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  overlay.querySelector('#fSave').addEventListener('click', async () => {
    const titleError = overlay.querySelector('#fTitle-error');
    const categoryError = overlay.querySelector('#fCategory-error');
    if (titleError) titleError.textContent = '';
    if (categoryError) categoryError.textContent = '';
    const payload = buildTimelinePayload({
      category: overlay.querySelector('#fCategory').value,
      period: overlay.querySelector('#fPeriod').value,
      title: overlay.querySelector('#fTitle').value,
      description: overlay.querySelector('#fDescription').value,
      sort_order: overlay.querySelector('#fSort').value,
      is_published: overlay.querySelector('#fPublished').checked
    });
    const validation = validateTimeline(payload);
    if (validation.error) {
      const field = validation.error.field === 'title' ? titleError : categoryError;
      if (field) field.textContent = validation.error.message;
      return;
    }
    const { error } = await saveTimeline(editing, payload, getClient());
    if (error) {
      toast('خطا در ذخیره: ' + (error.message || ''), 'error');
      return;
    }
    toast(item ? 'سابقه به‌روزرسانی شد.' : 'سابقه ایجاد شد.');
    overlay.remove();
    await loadTimeline();
  });
}

async function removeTimeline(item) {
  if (!item) return;
  if (!window.confirm(`سابقهٔ «${item.title}» حذف شود؟`)) return;
  const { error } = await removeTimelineRow(item.id, getClient());
  if (error) {
    toast('خطا در حذف: ' + (error.message || ''), 'error');
    return;
  }
  toast('سابقه حذف شد.');
  await loadTimeline();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    loadTimeline();
    el('aAdd').addEventListener('click', () => openForm(null));
  });
}
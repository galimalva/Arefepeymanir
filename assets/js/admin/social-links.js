import { getClient, dbTable } from '../supabase.js';
import { escapeHtml, toPersianDigits, toast, setupModalDialog } from '../utils.js';

const PLATFORM_LABELS = {
  instagram: 'اینستاگرام',
  x: 'ایکس (توییتر)',
  telegram: 'تلگرام',
  whatsapp: 'واتس‌اپ',
  email: 'ایمیل',
  website: 'وب‌سایت',
  other: 'سایر'
};

let links = [];
let searchText = '';
let editing = null;

function el(id) {
  return document.getElementById(id);
}

function setHtml(id, html) {
  const node = el(id);
  if (node) node.innerHTML = html;
}

export function platformLabel(value) {
  return PLATFORM_LABELS[value] || 'سایر';
}

export function buildSocialPayload(values) {
  return {
    platform: values.platform || 'other',
    label: String(values.label || '').trim() || null,
    url: String(values.url || '').trim(),
    sort_order: Number(values.sort_order) || 0
  };
}

export function validateSocial(payload) {
  if (!payload.url) return { error: { field: 'url', message: 'لینک الزامی است.' } };
  if (!/^https?:\/\/.+/.test(payload.url)) return { error: { field: 'url', message: 'لینک باید با http:// یا https:// شروع شود.' } };
  return { error: null };
}

export async function saveSocial(record, payload, client) {
  if (record) {
    return client.from(dbTable('social_links')).update(payload).eq('id', record.id);
  }
  return client.from(dbTable('social_links')).insert(payload);
}

export async function removeSocialRow(id, client) {
  return client.from(dbTable('social_links')).delete().eq('id', id);
}

function tableRow(link) {
  const meta = [platformLabel(link.platform), link.sort_order ? `ترتیب: ${toPersianDigits(link.sort_order)}` : null]
    .filter(Boolean)
    .join(' | ');
  return `
    <tr>
      <td>
        <strong>${escapeHtml(link.label || platformLabel(link.platform))}</strong>
        <br><small class="muted">${escapeHtml(link.url)}</small>
      </td>
      <td>${escapeHtml(meta)}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-edit="${link.id}">ویرایش</button>
          <button class="btn btn-danger btn-sm" type="button" data-del="${link.id}">حذف</button>
        </div>
      </td>
    </tr>`;
}

function renderTable() {
  const rows = links.filter((l) => !searchText || (l.url || '').includes(searchText) || (l.label || '').includes(searchText));
  if (!rows.length) {
    setHtml('aTable', '<p class="section-empty">هیچ شبکهٔ اجتماعی ثبت نشده است. برای افزودن از دکمهٔ «+ شبکهٔ جدید» استفاده کنید.</p>');
    return;
  }
  setHtml(
    'aTable',
    `<div class="table-wrap"><table class="dtable">
      <thead><tr><th>شبکه</th><th>اطلاعات</th><th>عملیات</th></tr></thead>
      <tbody>${rows.map(tableRow).join('')}</tbody>
    </table></div>`
  );
  document.querySelectorAll('#aTable [data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openForm(links.find((l) => l.id === btn.dataset.edit)));
  });
  document.querySelectorAll('#aTable [data-del]').forEach((btn) => {
    btn.addEventListener('click', () => removeSocial(links.find((l) => l.id === btn.dataset.del)));
  });
}

export async function loadSocials() {
  let client;
  try {
    client = getClient();
  } catch (error) {
    if (el('s-error')) {
      el('s-error').textContent = 'پایگاه داده هنوز راه‌اندازی نشده است.';
      el('s-error').hidden = false;
    }
    setHtml('aTable', '');
    return;
  }
  try {
    const { data } = await client.from(dbTable('social_links')).select('*').order('sort_order', { ascending: true });
    links = data || [];
  } catch (error) {
    if (el('s-error')) {
      el('s-error').textContent = 'خطا در دریافت شبکه‌ها: ' + (error.message || '');
      el('s-error').hidden = false;
    }
    links = [];
  }
  renderTable();
}

export function openForm(link) {
  editing = link;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-head">
        <h3 class="modal-title">${link ? 'ویرایش شبکه' : 'شبکهٔ جدید'}</h3>
        <button class="modal-close" type="button" aria-label="بستن">×</button>
      </div>
      <div class="modal-body form-grid">
        <div class="form-group"><label>پلتفرم *</label>
          <select class="form-control" id="fPlatform">
            ${Object.entries(PLATFORM_LABELS).map(([value, label]) => `<option value="${value}" ${(link?.platform || 'other') === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>نام نمایشی</label><input class="form-control" id="fLabel" value="${escapeHtml(link?.label || '')}"></div>
        <div class="form-group"><label>لینک *</label><input class="form-control" id="fUrl" dir="ltr" value="${escapeHtml(link?.url || '')}" placeholder="https://…"><span class="field-error" id="fUrl-error"></span></div>
        <div class="form-group"><label>ترتیب نمایش</label><input class="form-control" id="fSort" type="number" value="${link?.sort_order ?? 0}"></div>
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
    const urlError = overlay.querySelector('#fUrl-error');
    if (urlError) urlError.textContent = '';
    const payload = buildSocialPayload({
      platform: overlay.querySelector('#fPlatform').value,
      label: overlay.querySelector('#fLabel').value,
      url: overlay.querySelector('#fUrl').value,
      sort_order: overlay.querySelector('#fSort').value
    });
    const validation = validateSocial(payload);
    if (validation.error) {
      if (validation.error.field === 'url' && urlError) urlError.textContent = validation.error.message;
      return;
    }
    const { error } = await saveSocial(editing, payload, getClient());
    if (error) {
      toast('خطا در ذخیره: ' + (error.message || ''), 'error');
      return;
    }
    toast('شبکه ذخیره شد.');
    overlay.remove();
    await loadSocials();
  });
}

async function removeSocial(link) {
  if (!link) return;
  if (!window.confirm(`آیا شبکهٔ «${link.label || platformLabel(link.platform)}» حذف شود؟`)) return;
  const { error } = await removeSocialRow(link.id, getClient());
  if (error) {
    toast('خطا در حذف: ' + (error.message || ''), 'error');
    return;
  }
  toast('شبکه حذف شد.');
  await loadSocials();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    loadSocials();
    el('aAdd').addEventListener('click', () => openForm(null));
  });
}
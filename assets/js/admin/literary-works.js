import { getClient, dbTable, uploadFile, publicUrl, removeFiles } from '../supabase.js';
import { escapeHtml, formatDate, toast, setupModalDialog, listErrorHtml, validateImageFile } from '../utils.js';
import config from '../../../config.js';

const CATEGORY_LABELS = {
  short_story: 'داستان کوتاه',
  poem: 'شعر',
  essay: 'یادداشت/جستار',
  article: 'مقاله',
  memoir: 'خاطره',
  other: 'سایر'
};

let works = [];
let searchText = '';
let editing = null;
let modalImagePath = '';

function el(id) {
  return document.getElementById(id);
}

function setHtml(id, html) {
  const node = el(id);
  if (node) node.innerHTML = html;
}

function imageUrl(work) {
  if (work.image) return publicUrl(work.image);
  if (work.image_url) return work.image_url;
  return '';
}

function statusBadge(work) {
  if (!work.is_published) return '<span class="badge badge--error">پیش‌نویس</span>';
  return '<span class="badge badge--success">منتشر شده</span>';
}

function tableRow(work) {
  const image = imageUrl(work)
    ? `<img class="table-thumb" src="${imageUrl(work)}" alt="${escapeHtml(work.title || 'اثر')}" loading="lazy">`
    : `<span class="table-thumb table-thumb--empty">${escapeHtml((work.title || 'ا')[0])}</span>`;
  const meta = [
    CATEGORY_LABELS[work.category] || work.category || 'سایر',
    work.published_at ? formatDate(work.published_at) : '—'
  ].filter(Boolean).join(' | ');
  return `
    <tr>
      <td>${image}</td>
      <td>
        <strong>${escapeHtml(work.title)}</strong>
        <br><small class="muted">${escapeHtml(meta)}</small>
      </td>
      <td>${statusBadge(work)}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-edit="${work.id}">ویرایش</button>
          <button class="btn btn-danger btn-sm" type="button" data-del="${work.id}">حذف</button>
        </div>
      </td>
    </tr>`;
}

function renderTable() {
  const rows = works.filter((w) => !searchText || (w.title || '').includes(searchText));
  if (!rows.length) {
    setHtml('wTable', '<p class="section-empty">هیچ اثری در این پنل ثبت نشده است. برای افزودن از دکمهٔ «+ اثر جدید» استفاده کنید.</p>');
    return;
  }
  setHtml(
    'wTable',
    `<div class="table-wrap"><table class="dtable">
      <thead><tr><th>تصویر</th><th>عنوان</th><th>وضعیت</th><th>عملیات</th></tr></thead>
      <tbody>${rows.map(tableRow).join('')}</tbody>
    </table></div>`
  );
  document.querySelectorAll('#wTable [data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openForm(works.find((w) => w.id === btn.dataset.edit)));
  });
  document.querySelectorAll('#wTable [data-del]').forEach((btn) => {
    btn.addEventListener('click', () => removeWork(works.find((w) => w.id === btn.dataset.del)));
  });
}

async function loadWorks() {
  let client;
  try {
    client = getClient();
  } catch (error) {
    setHtml('wTable', listErrorHtml(error && error.message));
    return;
  }
  try {
    const { data, error: queryError } = await client.from(dbTable('literary_works')).select('*').order('created_at', { ascending: false }).limit(500);
    if (queryError) {
      setHtml('wTable', listErrorHtml(queryError.message));
      return;
    }
    works = data || [];
    renderTable();
  } catch (error) {
    setHtml('wTable', listErrorHtml(error && error.message));
  }
}

export function buildWorkPayload(values) {
  const urlOrNull = (value) => {
    const text = (value || '').trim();
    return text ? text : null;
  };
  return {
    title: (values.title || '').trim(),
    category: values.category || 'other',
    excerpt: (values.excerpt || '').trim() || null,
    body: (values.body || '').trim() || null,
    image: values.image || null,
    purchase_url: urlOrNull(values.purchase_url),
    download_url: urlOrNull(values.download_url),
    published_at: values.published_at || null,
    sort_order: Number(values.sort_order) || 0,
    is_published: !!values.is_published
  };
}

export async function saveWork(record, payload, client) {
  if (!payload.title) return { error: { message: 'عنوان الزامی است' } };
  if (record) {
    return client.from(dbTable('literary_works')).update(payload).eq('id', record.id);
  }
  return client.from(dbTable('literary_works')).insert(payload);
}

export async function removeWorkRow(id, client) {
  return client.from(dbTable('literary_works')).delete().eq('id', id);
}

function openForm(work) {
  editing = work;
  modalImagePath = '';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'crud-modal';
  overlay.innerHTML = `
    <div class="modal modal--wide">
      <div class="modal-head">
        <h3 class="modal-title">${work ? 'ویرایش اثر ادبی' : 'اثر جدید'}</h3>
        <button class="modal-close" type="button" aria-label="بستن">×</button>
      </div>
      <div class="modal-body form-grid">
        <div class="form-group"><label>عنوان *</label><input class="form-control" id="fTitle" required value="${escapeHtml(work?.title || '')}"></div>
        <div class="form-group"><label>دسته</label>
          <select class="form-control" id="fCategory">
            ${Object.entries(CATEGORY_LABELS).map(([value, label]) => `<option value="${value}" ${(work?.category || 'other') === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>تاریخ انتشار</label><input class="form-control" id="fDate" type="date" value="${escapeHtml(work?.published_at || '')}"></div>
        <div class="form-group"><label>ترتیب نمایش</label><input class="form-control" id="fSort" type="number" value="${work?.sort_order ?? 0}"></div>
        <div class="form-group"><label>لینک خرید</label><input class="form-control" id="fPurch" dir="ltr" value="${escapeHtml(work?.purchase_url || '')}" placeholder="https://..."></div>
        <div class="form-group"><label>لینک دانلود</label><input class="form-control" id="fDown" dir="ltr" value="${escapeHtml(work?.download_url || '')}" placeholder="https://..."></div>
        <div class="form-group"><label>خلاصه (Excerpt)</label><textarea class="form-control" id="fExcerpt" rows="3">${escapeHtml(work?.excerpt || '')}</textarea></div>
        <div class="form-group"><label>تصویر</label>
          <input class="form-control" id="fImageFile" type="file" accept="image/jpeg,image/png,image/webp">
          <div id="fImagePreview" class="cover-preview">${work?.image ? `<img src="${publicUrl(work.image)}" alt="تصویر فعلی">` : 'هنوز تصویری انتخاب نشده است.'}</div>
        </div>
        <div class="form-group"><label>متن کامل</label><textarea class="form-control" id="fBody" rows="10">${escapeHtml(work?.body || '')}</textarea></div>
        <label class="checkbox-field"><input type="checkbox" id="fPublished" ${work?.is_published ? 'checked' : ''}> منتشر شده (نمایش عمومی)</label>
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

  overlay.querySelector('#fImageFile').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const badImage = validateImageFile(file);
    if (badImage) { toast(badImage, 'error'); return; }
    const path = `${config.storage.tenantFolder}/literary-works/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '')}`;
    const { error } = await uploadFile(config.storage.publicBucket, path, file);
    if (error) {
      toast('خطا در آپلود تصویر: ' + (error.message || ''), 'error');
      return;
    }
    modalImagePath = path;
    const preview = overlay.querySelector('#fImagePreview');
    if (preview) preview.innerHTML = `<img src="${publicUrl(path)}" alt="تصویر جدید">`;
    toast('تصویر آپلود شد');
  });

  overlay.querySelector('#fSave').addEventListener('click', async () => {
    const payload = buildWorkPayload({
      title: overlay.querySelector('#fTitle').value,
      category: overlay.querySelector('#fCategory').value,
      published_at: overlay.querySelector('#fDate').value,
      excerpt: overlay.querySelector('#fExcerpt').value,
      body: overlay.querySelector('#fBody').value,
      purchase_url: overlay.querySelector('#fPurch').value,
      download_url: overlay.querySelector('#fDown').value,
      sort_order: overlay.querySelector('#fSort').value,
      is_published: overlay.querySelector('#fPublished').checked,
      image: modalImagePath || (editing && editing.image) || null
    });
    const { error } = await saveWork(editing, payload, getClient());
    if (error) {
      toast('خطا در ذخیره: ' + (error.message || ''), 'error');
      return;
    }
    toast('اثر ادبی ذخیره شد');
    overlay.remove();
    await loadWorks();
  });
}

async function removeWork(work) {
  if (!work) return;
  if (!window.confirm(`اثر «${work.title}» حذف شود؟`)) return;
  const { error } = await removeWorkRow(work.id, getClient());
  if (error) {
    toast('خطا در حذف: ' + (error.message || ''), 'error');
    return;
  }
  if (work.image) {
    removeFiles(config.storage.publicBucket, [work.image]);
  }
  toast('اثر حذف شد');
  await loadWorks();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    loadWorks();
    el('wAdd').addEventListener('click', () => openForm(null));
    el('wSearch').addEventListener('input', (event) => {
      searchText = (event.target.value || '').trim();
      renderTable();
    });
  });
}
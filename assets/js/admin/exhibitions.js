import { getClient, dbTable, uploadFile, publicUrl, removeFiles } from '../supabase.js';
import { escapeHtml, toPersianDigits, toast, setupModalDialog, listErrorHtml, validateImageFile } from '../utils.js';
import config from '../../../config.js';

export const EXHIBITION_TYPE_LABELS = {
  solo: 'انفرادی',
  group: 'گروهی',
  joint: 'مشترک',
  online: 'آنلاین',
  other: 'سایر'
};

let exhibitions = [];
let searchText = '';
let editing = null;
let modalImagePath = '';
let modalImages = [];
let removedImages = [];

function el(id) {
  return document.getElementById(id);
}

function setHtml(id, html) {
  const node = el(id);
  if (node) node.innerHTML = html;
}

function imageUrl(exhibition) {
  if (exhibition.image) return publicUrl(exhibition.image);
  if (exhibition.image_url) return exhibition.image_url;
  return '';
}

function imgPlaceholder(title) {
  return `<span class="table-thumb table-thumb--empty">${escapeHtml((title || 'ن')[0])}</span>`;
}

function statusBadge(exhibition) {
  if (!exhibition.is_published) return '<span class="badge badge--error">پیش‌نویس</span>';
  return '<span class="badge badge--success">منتشر شده</span>';
}

function typeLabel(type) {
  return EXHIBITION_TYPE_LABELS[type] || type || '';
}

function tableRow(exhibition) {
  const image = imageUrl(exhibition)
    ? `<img class="table-thumb" src="${imageUrl(exhibition)}" alt="${escapeHtml(exhibition.title || 'نمایشگاه')}" loading="lazy">`
    : imgPlaceholder(exhibition.title);
  const meta = [
    typeLabel(exhibition.type),
    exhibition.year ? toPersianDigits(exhibition.year) : null,
    [exhibition.location, exhibition.country].filter(Boolean).join('، ') || null
  ].filter(Boolean).join(' | ');
  return `
    <tr>
      <td>${image}</td>
      <td>
        <strong>${escapeHtml(exhibition.title)} ${exhibition.is_featured ? '<span class="badge badge--secondary">ویژه</span>' : ''}</strong>
        ${exhibition.organizer ? `<br><small class="muted">${escapeHtml(exhibition.organizer)}</small>` : ''}
        <br><small class="muted">${escapeHtml(meta)}</small>
      </td>
      <td>${statusBadge(exhibition)}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-edit="${exhibition.id}">ویرایش</button>
          <button class="btn btn-danger btn-sm" type="button" data-del="${exhibition.id}">حذف</button>
        </div>
      </td>
    </tr>`;
}

function renderTable() {
  const rows = exhibitions.filter((e) => !searchText || (e.title || '').includes(searchText) || (e.location || '').includes(searchText) || (e.organizer || '').includes(searchText));
  if (!rows.length) {
    setHtml('aTable', '<p class="section-empty">هیچ نمایشگاهی در این پنل ثبت نشده است. برای افزودن از دکمهٔ «+ نمایشگاه جدید» استفاده کنید.</p>');
    return;
  }
  setHtml(
    'aTable',
    `<div class="table-wrap"><table class="dtable">
      <thead><tr><th>تصویر</th><th>عنوان</th><th>وضعیت</th><th>عملیات</th></tr></thead>
      <tbody>${rows.map(tableRow).join('')}</tbody>
    </table></div>`
  );
  document.querySelectorAll('#aTable [data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openForm(exhibitions.find((e) => e.id === btn.dataset.edit)));
  });
  document.querySelectorAll('#aTable [data-del]').forEach((btn) => {
    btn.addEventListener('click', () => removeExhibition(exhibitions.find((e) => e.id === btn.dataset.del)));
  });
}

async function loadExhibitions() {
  let client;
  try {
    client = getClient();
  } catch (error) {
    setHtml('aTable', listErrorHtml(error && error.message));
    return;
  }
  try {
    const { data, error: queryError } = await client.from(dbTable('exhibitions')).select('*').order('created_at', { ascending: false }).limit(500);
    if (queryError) {
      setHtml('aTable', listErrorHtml(queryError.message));
      return;
    }
    exhibitions = data || [];
    renderTable();
  } catch (error) {
    setHtml('aTable', listErrorHtml(error && error.message));
  }
}

export function buildExhibitionPayload(values) {
  return {
    title: (values.title || '').trim(),
    type: values.type || null,
    year: values.year ? Number(values.year) : null,
    location: (values.location || '').trim() || null,
    country: (values.country || '').trim() || null,
    organizer: (values.organizer || '').trim() || null,
    description: (values.description || '').trim() || null,
    image: values.image || null,
    images: Array.isArray(values.images) ? values.images.filter(Boolean) : [],
    sort_order: Number(values.sort_order) || 0,
    is_published: !!values.is_published,
    is_featured: !!values.is_featured
  };
}

export async function saveExhibition(record, payload, client) {
  if (!payload.title) return { error: { message: 'عنوان الزامی است' } };
  if (record) {
    return client.from(dbTable('exhibitions')).update(payload).eq('id', record.id);
  }
  return client.from(dbTable('exhibitions')).insert(payload);
}

export async function removeExhibitionRow(id, client) {
  return client.from(dbTable('exhibitions')).delete().eq('id', id);
}

function renderImagesList() {
  const list = el('fImagesList');
  if (!list) return;
  const paths = modalImages.filter((p) => !removedImages.includes(p));
  if (!paths.length) {
    list.innerHTML = '<div class="section-empty">هنوز تصویر اضافی انتخاب نشده است.</div>';
    return;
  }
  list.innerHTML = paths
    .map(
      (path) => `
        <span class="img-chip">
          <img src="${publicUrl(path)}" alt="تصویر اضافی" loading="lazy">
          <button type="button" data-rmi="${escapeHtml(path)}" aria-label="حذف این تصویر">×</button>
        </span>`
    )
    .join('');
  list.querySelectorAll('[data-rmi]').forEach((btn) => {
    btn.addEventListener('click', () => {
      removedImages.push(btn.dataset.rmi);
      renderImagesList();
    });
  });
}

function openForm(exhibition) {
  editing = exhibition;
  modalImagePath = '';
  modalImages = Array.isArray(exhibition?.images) ? exhibition.images.slice() : [];
  removedImages = [];
  const typeOptions = Object.entries(EXHIBITION_TYPE_LABELS)
    .map(([value, label]) => `<option value="${value}" ${(exhibition?.type || '') === value ? 'selected' : ''}>${label}</option>`)
    .join('');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'crud-modal';
  overlay.innerHTML = `
    <div class="modal modal--wide">
      <div class="modal-head">
        <h3 class="modal-title">${exhibition ? 'ویرایش نمایشگاه' : 'نمایشگاه جدید'}</h3>
        <button class="modal-close" type="button" aria-label="بستن">×</button>
      </div>
      <div class="modal-body form-grid">
        <div class="form-group form-group--full"><label>عنوان نمایشگاه *</label><input class="form-control" id="fTitle" required value="${escapeHtml(exhibition?.title || '')}"></div>
        <div class="form-group"><label>نوع نمایشگاه</label>
          <select class="form-control" id="fType">
            <option value="">وارد نشده</option>
            ${typeOptions}
          </select>
        </div>
        <div class="form-group"><label>سال برگزاری</label><input class="form-control" id="fYear" type="number" min="1300" max="1500" value="${exhibition?.year ?? ''}"></div>
        <div class="form-group"><label>مکان</label><input class="form-control" id="fLocation" value="${escapeHtml(exhibition?.location || '')}" placeholder="مثلاً نگارخانهٔ نقاش"></div>
        <div class="form-group"><label>کشور</label><input class="form-control" id="fCountry" value="${escapeHtml(exhibition?.country || '')}"></div>
        <div class="form-group"><label>برگزارکننده</label><input class="form-control" id="fOrganizer" value="${escapeHtml(exhibition?.organizer || '')}"></div>
        <div class="form-group"><label>ترتیب نمایش</label><input class="form-control" id="fSort" type="number" value="${exhibition?.sort_order ?? 0}"></div>
        <div class="form-group"><label>تصویر اصلی نمایشگاه</label>
          <input class="form-control" id="fImageFile" type="file" accept="image/jpeg,image/png,image/webp">
          <div id="fImagePreview" class="cover-preview">${exhibition?.image ? `<img src="${publicUrl(exhibition.image)}" alt="تصویر فعلی">` : 'هنوز تصویری انتخاب نشده است.'}</div>
        </div>
        <div class="form-group form-group--full"><label>تصاویر اضافی</label>
          <input class="form-control" id="fImagesFile" type="file" accept="image/jpeg,image/png,image/webp" multiple>
          <div id="fImagesList" class="img-list"></div>
        </div>
        <div class="form-group form-group--full"><label>توضیحات نمایشگاه</label><textarea class="form-control" id="fDescription" rows="3">${escapeHtml(exhibition?.description || '')}</textarea></div>
        <label class="checkbox-field"><input type="checkbox" id="fPublished" ${exhibition?.is_published ? 'checked' : ''}> منتشر شده (نمایش عمومی)</label>
        <label class="checkbox-field"><input type="checkbox" id="fFeatured" ${exhibition?.is_featured ? 'checked' : ''}> نشان‌دادن در صفحهٔ اصلی (ویژه)</label>
      </div>
      <div class="modal-foot">
        <button class="btn btn-primary" id="fSave">ذخیره</button>
        <button class="btn btn-ghost" id="fCancel" type="button">انصراف</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  setupModalDialog(overlay);
  renderImagesList();

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
    const path = `${config.storage.tenantFolder}/exhibitions/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '')}`;
    const { error } = await uploadFile(config.storage.publicBucket, path, file);
    if (error) {
      toast('خطا در آپلود تصویر: ' + (error.message || ''), 'error');
      return;
    }
    modalImagePath = path;
    const preview = overlay.querySelector('#fImagePreview');
    if (preview) preview.innerHTML = `<img src="${publicUrl(path)}" alt="تصویر جدید">`;
    toast('تصویر اصلی آپلود شد');
  });

  overlay.querySelector('#fImagesFile').addEventListener('change', async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    for (const extraFile of files) {
      const badExtra = validateImageFile(extraFile);
      if (badExtra) { toast(badExtra, 'error'); return; }
    }
    for (const file of files) {
      const path = `${config.storage.tenantFolder}/exhibitions/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '')}`;
      const { error } = await uploadFile(config.storage.publicBucket, path, file);
      if (error) {
        toast('خطا در آپلود تصویر: ' + (error.message || ''), 'error');
        continue;
      }
      modalImages.push(path);
    }
    renderImagesList();
    toast('تصاویر اضافی آپلود شدند');
  });

  overlay.querySelector('#fSave').addEventListener('click', async () => {
    const payload = buildExhibitionPayload({
      title: overlay.querySelector('#fTitle').value,
      type: overlay.querySelector('#fType').value,
      year: overlay.querySelector('#fYear').value,
      location: overlay.querySelector('#fLocation').value,
      country: overlay.querySelector('#fCountry').value,
      organizer: overlay.querySelector('#fOrganizer').value,
      description: overlay.querySelector('#fDescription').value,
      sort_order: overlay.querySelector('#fSort').value,
      is_published: overlay.querySelector('#fPublished').checked,
      is_featured: overlay.querySelector('#fFeatured').checked,
      image: modalImagePath || (editing && editing.image) || null,
      images: modalImages.filter((p) => !removedImages.includes(p))
    });
    const { error } = await saveExhibition(editing, payload, getClient());
    if (error) {
      toast('خطا در ذخیره: ' + (error.message || ''), 'error');
      return;
    }
    if (removedImages.length) {
      removeFiles(config.storage.publicBucket, removedImages.slice());
    }
    toast('نمایشگاه ذخیره شد');
    overlay.remove();
    await loadExhibitions();
  });
}

async function removeExhibition(exhibition) {
  if (!exhibition) return;
  if (!window.confirm(`نمایشگاه «${exhibition.title}» حذف شود؟`)) return;
  const { error } = await removeExhibitionRow(exhibition.id, getClient());
  if (error) {
    toast('خطا در حذف: ' + (error.message || ''), 'error');
    return;
  }
  const stored = [exhibition.image, ...(Array.isArray(exhibition.images) ? exhibition.images : [])].filter(Boolean);
  if (stored.length) {
    removeFiles(config.storage.publicBucket, stored);
  }
  toast('نمایشگاه حذف شد');
  await loadExhibitions();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    loadExhibitions();
    el('aAdd').addEventListener('click', () => openForm(null));
    el('aSearch').addEventListener('input', (event) => {
      searchText = (event.target.value || '').trim();
      renderTable();
    });
  });
}
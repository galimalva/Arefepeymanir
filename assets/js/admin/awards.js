import { getClient, dbTable, uploadFile, publicUrl, removeFiles } from '../supabase.js';
import { escapeHtml, toPersianDigits, toast, setupModalDialog, listErrorHtml, validateImageFile } from '../utils.js';
import config from '../../../config.js';

let awards = [];
let books = [];
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

function imageUrl(award) {
  if (award.image) return publicUrl(award.image);
  if (award.image_url) return award.image_url;
  return '';
}

function imgPlaceholder(title) {
  return `<span class="table-thumb table-thumb--empty">${escapeHtml((title || 'ج')[0])}</span>`;
}

function statusBadge(award) {
  if (!award.is_published) return '<span class="badge badge--error">پیش‌نویس</span>';
  return '<span class="badge badge--success">منتشر شده</span>';
}

function relatedLabel(award) {
  const book = books.find((b) => b.id === award.book_id);
  if (book) return 'کتاب: ' + book.title;
  const work = works.find((w) => w.id === award.work_id);
  if (work) return 'اثر ادبی: ' + work.title;
  return '';
}

function tableRow(award) {
  const image = imageUrl(award)
    ? `<img class="table-thumb" src="${imageUrl(award)}" alt="${escapeHtml(award.title || 'جایزه')}" loading="lazy">`
    : imgPlaceholder(award.title);
  const related = relatedLabel(award);
  const meta = [
    award.year ? toPersianDigits(award.year) : null,
    award.organization || null,
    related || null
  ].filter(Boolean).join(' | ');
  return `
    <tr>
      <td>${image}</td>
      <td>
        <strong>${escapeHtml(award.title)} ${award.is_featured ? '<span class="badge badge--secondary">ویژه</span>' : ''}</strong>
        <br><small class="muted">${escapeHtml(meta)}</small>
      </td>
      <td>${statusBadge(award)}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-edit="${award.id}">ویرایش</button>
          <button class="btn btn-danger btn-sm" type="button" data-del="${award.id}">حذف</button>
        </div>
      </td>
    </tr>`;
}

function renderTable() {
  const rows = awards.filter((a) => !searchText || (a.title || '').includes(searchText) || (a.organization || '').includes(searchText));
  if (!rows.length) {
    setHtml('aTable', '<p class="section-empty">هیچ جایزه‌ای در این پنل ثبت نشده است. برای افزودن از دکمهٔ «+ جایزه جدید» استفاده کنید.</p>');
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
    btn.addEventListener('click', () => openForm(awards.find((a) => a.id === btn.dataset.edit)));
  });
  document.querySelectorAll('#aTable [data-del]').forEach((btn) => {
    btn.addEventListener('click', () => removeAward(awards.find((a) => a.id === btn.dataset.del)));
  });
}

async function loadAwards() {
  let client;
  try {
    client = getClient();
  } catch (error) {
    setHtml('aTable', listErrorHtml(error && error.message));
    return;
  }
  try {
    const results = await Promise.all([
      client.from(dbTable('awards')).select('*').order('created_at', { ascending: false }).limit(500),
      client.from(dbTable('books')).select('*').order('title').limit(500),
      client.from(dbTable('literary_works')).select('*').order('title').limit(500)
    ]);
    const failed = results.find((result) => result.error);
    if (failed) {
      setHtml('aTable', listErrorHtml(failed.error.message));
      return;
    }
    awards = results[0].data || [];
    books = results[1].data || [];
    works = results[2].data || [];
    renderTable();
  } catch (error) {
    setHtml('aTable', listErrorHtml(error && error.message));
  }
}

export function buildAwardPayload(values) {
  return {
    title: (values.title || '').trim(),
    year: values.year ? Number(values.year) : null,
    organization: (values.organization || '').trim() || null,
    book_id: values.book_id || null,
    work_id: values.work_id || null,
    description: (values.description || '').trim() || null,
    image: values.image || null,
    sort_order: Number(values.sort_order) || 0,
    is_published: !!values.is_published,
    is_featured: !!values.is_featured
  };
}

export async function saveAward(record, payload, client) {
  if (!payload.title) return { error: { message: 'عنوان الزامی است' } };
  if (record) {
    return client.from(dbTable('awards')).update(payload).eq('id', record.id);
  }
  return client.from(dbTable('awards')).insert(payload);
}

export async function removeAwardRow(id, client) {
  return client.from(dbTable('awards')).delete().eq('id', id);
}

function selectOptions(list, current) {
  const opts = list.map(
    (item) => `<option value="${item.id}" ${current === item.id ? 'selected' : ''}>${escapeHtml(item.title)}</option>`
  );
  return `<option value="">وارد نشده</option>${opts.join('')}`;
}

function openForm(award) {
  editing = award;
  modalImagePath = '';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'crud-modal';
  overlay.innerHTML = `
    <div class="modal modal--wide">
      <div class="modal-head">
        <h3 class="modal-title">${award ? 'ویرایش جایزه' : 'جایزه جدید'}</h3>
        <button class="modal-close" type="button" aria-label="بستن">×</button>
      </div>
      <div class="modal-body form-grid">
        <div class="form-group form-group--full"><label>عنوان جایزه *</label><input class="form-control" id="fTitle" required value="${escapeHtml(award?.title || '')}"></div>
        <div class="form-group"><label>سال</label><input class="form-control" id="fYear" type="number" min="1300" max="1500" value="${award?.year ?? ''}"></div>
        <div class="form-group"><label>جشنواره / نهاد</label><input class="form-control" id="fOrganization" value="${escapeHtml(award?.organization || '')}"></div>
        <div class="form-group"><label>ترتیب نمایش</label><input class="form-control" id="fSort" type="number" value="${award?.sort_order ?? 0}"></div>
        <div class="form-group"><label>کتاب مرتبط</label><select class="form-control" id="fBookId">${selectOptions(books, award?.book_id || '')}</select></div>
        <div class="form-group"><label>اثر ادبی مرتبط</label><select class="form-control" id="fWorkId">${selectOptions(works, award?.work_id || '')}</select></div>
        <div class="form-group form-group--full"><label>تصویر (اختیاری)</label>
          <input class="form-control" id="fImageFile" type="file" accept="image/jpeg,image/png,image/webp">
          <div id="fImagePreview" class="cover-preview">${award?.image ? `<img src="${publicUrl(award.image)}" alt="تصویر فعلی">` : 'هنوز تصویری انتخاب نشده است.'}</div>
        </div>
        <div class="form-group form-group--full"><label>توضیحات</label><textarea class="form-control" id="fDescription" rows="3">${escapeHtml(award?.description || '')}</textarea></div>
        <label class="checkbox-field"><input type="checkbox" id="fPublished" ${award?.is_published ? 'checked' : ''}> منتشر شده (نمایش عمومی)</label>
        <label class="checkbox-field"><input type="checkbox" id="fFeatured" ${award?.is_featured ? 'checked' : ''}> نشان‌دادن در صفحهٔ اصلی (ویژه)</label>
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
    const path = `${config.storage.tenantFolder}/awards/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '')}`;
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
    const payload = buildAwardPayload({
      title: overlay.querySelector('#fTitle').value,
      year: overlay.querySelector('#fYear').value,
      organization: overlay.querySelector('#fOrganization').value,
      book_id: overlay.querySelector('#fBookId').value || null,
      work_id: overlay.querySelector('#fWorkId').value || null,
      description: overlay.querySelector('#fDescription').value,
      sort_order: overlay.querySelector('#fSort').value,
      is_published: overlay.querySelector('#fPublished').checked,
      is_featured: overlay.querySelector('#fFeatured').checked,
      image: modalImagePath || (editing && editing.image) || null
    });
    const { error } = await saveAward(editing, payload, getClient());
    if (error) {
      toast('خطا در ذخیره: ' + (error.message || ''), 'error');
      return;
    }
    toast('جایزه ذخیره شد');
    overlay.remove();
    await loadAwards();
  });
}

async function removeAward(award) {
  if (!award) return;
  if (!window.confirm(`جایزهٔ «${award.title}» حذف شود؟`)) return;
  const { error } = await removeAwardRow(award.id, getClient());
  if (error) {
    toast('خطا در حذف: ' + (error.message || ''), 'error');
    return;
  }
  if (award.image) {
    removeFiles(config.storage.publicBucket, [award.image]);
  }
  toast('جایزه حذف شد');
  await loadAwards();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    loadAwards();
    el('aAdd').addEventListener('click', () => openForm(null));
    el('aSearch').addEventListener('input', (event) => {
      searchText = (event.target.value || '').trim();
      renderTable();
    });
  });
}
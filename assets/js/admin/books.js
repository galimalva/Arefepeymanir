import { getClient, dbTable, uploadFile, publicUrl, removeFiles } from '../supabase.js';
import { escapeHtml, toPersianDigits, toast, setupModalDialog, listErrorHtml, validateImageFile } from '../utils.js';
import config from '../../../config.js';

const TYPE_LABELS = { book: 'کتاب', collection: 'مجموعه', other: 'اثر ادبی' };

let books = [];
let searchText = '';
let editing = null;
let modalCoverPath = '';

function el(id) {
  return document.getElementById(id);
}

function setHtml(id, html) {
  const node = el(id);
  if (node) node.innerHTML = html;
}

function coverUrl(book) {
  if (book.cover) return publicUrl(book.cover);
  if (book.cover_url) return book.cover_url;
  return '';
}

function imgPlaceholder(title) {
  return `<span class="table-thumb table-thumb--empty">${escapeHtml((title || 'ک')[0])}</span>`;
}

function statusBadge(book) {
  if (!book.is_published) return '<span class="badge badge--error">پیش‌نویس</span>';
  return '<span class="badge badge--success">منتشر شده</span>';
}

function tableRow(book) {
  const cover = coverUrl(book)
    ? `<img class="table-thumb" src="${coverUrl(book)}" alt="${escapeHtml(book.title || 'کتاب')}" loading="lazy">`
    : imgPlaceholder(book.title);
  const meta = [
    TYPE_LABELS[book.type] || book.type,
    book.year ? toPersianDigits(book.year) : null,
    book.publisher || null
  ].filter(Boolean).join(' | ');
  return `
    <tr>
      <td>${cover}</td>
      <td>
        <strong>${escapeHtml(book.title)} ${book.is_featured ? '<span class="badge badge--secondary">ویژه</span>' : ''}</strong>
        <br><small class="muted">${escapeHtml(meta)}</small>
      </td>
      <td>${statusBadge(book)}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-edit="${book.id}">ویرایش</button>
          <button class="btn btn-danger btn-sm" type="button" data-del="${book.id}">حذف</button>
        </div>
      </td>
    </tr>`;
}

function renderTable() {
  const rows = books.filter((b) => !searchText || (b.title || '').includes(searchText));
  if (!rows.length) {
    setHtml('aTable', '<p class="section-empty">هیچ کتابی در این پنل ثبت نشده است. برای افزودن از دکمهٔ «+ کتاب جدید» استفاده کنید.</p>');
    return;
  }
  setHtml(
    'aTable',
    `<div class="table-wrap"><table class="dtable">
      <thead><tr><th>جلد</th><th>عنوان</th><th>وضعیت</th><th>عملیات</th></tr></thead>
      <tbody>${rows.map(tableRow).join('')}</tbody>
    </table></div>`
  );
  document.querySelectorAll('#aTable [data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openForm(books.find((b) => b.id === btn.dataset.edit)));
  });
  document.querySelectorAll('#aTable [data-del]').forEach((btn) => {
    btn.addEventListener('click', () => removeBook(books.find((b) => b.id === btn.dataset.del)));
  });
}

async function loadBooks() {
  let client;
  try {
    client = getClient();
  } catch (error) {
    setHtml('aTable', listErrorHtml(error && error.message));
    return;
  }
  try {
    const { data, error: queryError } = await client.from(dbTable('books')).select('*').order('created_at', { ascending: false }).limit(500);
    if (queryError) {
      setHtml('aTable', listErrorHtml(queryError.message));
      return;
    }
    books = data || [];
    renderTable();
  } catch (error) {
    setHtml('aTable', listErrorHtml(error && error.message));
  }
}

export function buildBookPayload(values) {
  return {
    title: (values.title || '').trim(),
    type: values.type || 'book',
    year: values.year ? Number(values.year) : null,
    publisher: (values.publisher || '').trim() || null,
    isbn: (values.isbn || '').trim() || null,
    description: (values.description || '').trim() || null,
    cover: values.cover || null,
    purchase_url: (values.purchase_url || '').trim() || null,
    download_url: (values.download_url || '').trim() || null,
    sort_order: Number(values.sort_order) || 0,
    is_published: !!values.is_published,
    is_featured: !!values.is_featured
  };
}

export async function saveBook(record, payload, client) {
  if (!payload.title) return { error: { message: 'عنوان الزامی است' } };
  if (record) {
    return client.from(dbTable('books')).update(payload).eq('id', record.id);
  }
  return client.from(dbTable('books')).insert(payload);
}

export async function removeBookRow(id, client) {
  return client.from(dbTable('books')).delete().eq('id', id);
}

function openForm(book) {
  editing = book;
  modalCoverPath = '';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'crud-modal';
  overlay.innerHTML = `
    <div class="modal modal--wide">
      <div class="modal-head">
        <h3 class="modal-title">${book ? 'ویرایش کتاب' : 'کتاب جدید'}</h3>
        <button class="modal-close" type="button" aria-label="بستن">×</button>
      </div>
      <div class="modal-body form-grid">
        <div class="form-group"><label>عنوان *</label><input class="form-control" id="fTitle" required value="${escapeHtml(book?.title || '')}"></div>
        <div class="form-group"><label>نوع</label>
          <select class="form-control" id="fType">
            ${Object.entries(TYPE_LABELS).map(([value, label]) => `<option value="${value}" ${(book?.type || 'book') === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>سال انتشار</label><input class="form-control" id="fYear" type="number" min="1300" max="1500" value="${book?.year ?? ''}"></div>
        <div class="form-group"><label>ناشر</label><input class="form-control" id="fPublisher" value="${escapeHtml(book?.publisher || '')}"></div>
        <div class="form-group"><label>شابک</label><input class="form-control" id="fIsbn" dir="ltr" value="${escapeHtml(book?.isbn || '')}"></div>
        <div class="form-group"><label>ترتیب نمایش</label><input class="form-control" id="fSort" type="number" value="${book?.sort_order ?? 0}"></div>
        <div class="form-group"><label>لینک خرید</label><input class="form-control" id="fPurchase" dir="ltr" value="${escapeHtml(book?.purchase_url || '')}" placeholder="https://…"></div>
        <div class="form-group"><label>لینک دانلود</label><input class="form-control" id="fDownload" dir="ltr" value="${escapeHtml(book?.download_url || '')}" placeholder="https://…"></div>
        <div class="form-group"><label>توضیحات</label><textarea class="form-control" id="fDescription" rows="3">${escapeHtml(book?.description || '')}</textarea></div>
        <div class="form-group"><label>جلد کتاب</label>
          <input class="form-control" id="fCoverFile" type="file" accept="image/jpeg,image/png,image/webp">
          <div id="fCoverPreview" class="cover-preview">${book?.cover ? `<img src="${publicUrl(book.cover)}" alt="جلد فعلی">` : 'هنوز تصویری انتخاب نشده است.'}</div>
        </div>
        <label class="checkbox-field"><input type="checkbox" id="fPublished" ${book?.is_published ? 'checked' : ''}> منتشر شده (نمایش عمومی)</label>
        <label class="checkbox-field"><input type="checkbox" id="fFeatured" ${book?.is_featured ? 'checked' : ''}> نشان‌دادن در صفحهٔ اصلی</label>
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

  overlay.querySelector('#fCoverFile').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const badCover = validateImageFile(file);
    if (badCover) { toast(badCover, 'error'); return; }
    const path = `${config.storage.tenantFolder}/books/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '')}`;
    const { error } = await uploadFile(config.storage.publicBucket, path, file);
    if (error) {
      toast('خطا در آپلود تصویر: ' + (error.message || ''), 'error');
      return;
    }
    modalCoverPath = path;
    const preview = overlay.querySelector('#fCoverPreview');
    if (preview) preview.innerHTML = `<img src="${publicUrl(path)}" alt="جلد جدید">`;
    toast('تصویر جلد آپلود شد');
  });

  overlay.querySelector('#fSave').addEventListener('click', async () => {
    const title = overlay.querySelector('#fTitle').value;
    const payload = buildBookPayload({
      title,
      type: overlay.querySelector('#fType').value,
      year: overlay.querySelector('#fYear').value,
      publisher: overlay.querySelector('#fPublisher').value,
      isbn: overlay.querySelector('#fIsbn').value,
      description: overlay.querySelector('#fDescription').value,
      purchase_url: overlay.querySelector('#fPurchase').value,
      download_url: overlay.querySelector('#fDownload').value,
      sort_order: overlay.querySelector('#fSort').value,
      is_published: overlay.querySelector('#fPublished').checked,
      is_featured: overlay.querySelector('#fFeatured').checked,
      cover: modalCoverPath || (editing && editing.cover) || null
    });
    const { error } = await saveBook(editing, payload, getClient());
    if (error) {
      toast('خطا در ذخیره: ' + (error.message || ''), 'error');
      return;
    }
    toast('کتاب ذخیره شد');
    overlay.remove();
    await loadBooks();
  });
}

async function removeBook(book) {
  if (!book) return;
  if (!window.confirm(`کتاب «${book.title}» حذف شود؟`)) return;
  const { error } = await removeBookRow(book.id, getClient());
  if (error) {
    toast('خطا در حذف: ' + (error.message || ''), 'error');
    return;
  }
  if (book.cover) {
    removeFiles(config.storage.publicBucket, [book.cover]);
  }
  toast('کتاب حذف شد');
  await loadBooks();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    loadBooks();
    el('aAdd').addEventListener('click', () => openForm(null));
    el('aSearch').addEventListener('input', (event) => {
      searchText = (event.target.value || '').trim();
      renderTable();
    });
  });
}
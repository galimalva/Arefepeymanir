import { getClient, dbTable } from '../supabase.js';
import { escapeHtml, toPersianDigits, toast, setupModalDialog, listErrorHtml } from '../utils.js';

export const REVIEW_TYPE_LABELS = {
  book: 'کتاب',
  literary_work: 'اثر ادبی',
  artwork: 'اثر نقاشی'
};

let reviews = [];
let books = [];
let works = [];
let artworks = [];
let searchText = '';
let editing = null;

function el(id) {
  return document.getElementById(id);
}

function setHtml(id, html) {
  const node = el(id);
  if (node) node.innerHTML = html;
}

function statusBadge(review) {
  if (!review.is_published) return '<span class="badge badge--error">پیش‌نویس</span>';
  return '<span class="badge badge--success">منتشر شده</span>';
}

function relatedLabel(review) {
  if (review.item_type === 'book') {
    const book = books.find((b) => b.id === review.book_id);
    return book ? `کتاب: ${book.title}` : 'کتاب (بدون عنوان)';
  }
  if (review.item_type === 'literary_work') {
    const work = works.find((w) => w.id === review.work_id);
    return work ? `اثر ادبی: ${work.title}` : 'اثر ادبی (بدون عنوان)';
  }
  if (review.item_type === 'artwork') {
    const art = artworks.find((a) => a.id === review.artwork_id);
    return art ? `اثر نقاشی: ${art.title}` : 'اثر نقاشی (بدون عنوان)';
  }
  return '';
}

function tableRow(review) {
  const typeLabel = REVIEW_TYPE_LABELS[review.item_type] || review.item_type || '';
  const related = relatedLabel(review);
  const meta = [typeLabel, review.reviewer || null, related || null].filter(Boolean).join(' | ');
  return `
    <tr>
      <td>
        <strong>${escapeHtml(review.title || 'بدون عنوان')} ${review.is_featured ? '<span class="badge badge--secondary">ویژه</span>' : ''}</strong>
        <br><small class="muted">${escapeHtml(meta)}</small>
      </td>
      <td>${statusBadge(review)}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-edit="${review.id}">ویرایش</button>
          <button class="btn btn-danger btn-sm" type="button" data-del="${review.id}">حذف</button>
        </div>
      </td>
    </tr>`;
}

function renderTable() {
  const rows = reviews.filter(
    (r) => !searchText || (r.title || '').includes(searchText) || (r.reviewer || '').includes(searchText)
  );
  if (!rows.length) {
    setHtml('aTable', '<p class="section-empty">هیچ نقدی در این پنل ثبت نشده است. برای افزودن از دکمهٔ «+ نقد جدید» استفاده کنید.</p>');
    return;
  }
  setHtml(
    'aTable',
    `<div class="table-wrap"><table class="dtable">
      <thead><tr><th>عنوان / نقد</th><th>وضعیت</th><th>عملیات</th></tr></thead>
      <tbody>${rows.map(tableRow).join('')}</tbody>
    </table></div>`
  );
  document.querySelectorAll('#aTable [data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openForm(reviews.find((r) => r.id === btn.dataset.edit)));
  });
  document.querySelectorAll('#aTable [data-del]').forEach((btn) => {
    btn.addEventListener('click', () => removeReview(reviews.find((r) => r.id === btn.dataset.del)));
  });
}

async function loadReviews() {
  let client;
  try {
    client = getClient();
  } catch (error) {
    setHtml('aTable', listErrorHtml(error && error.message));
    return;
  }
  try {
    const results = await Promise.all([
      client.from(dbTable('book_reviews')).select('*').order('created_at', { ascending: false }).limit(500),
      client.from(dbTable('books')).select('*').order('title').limit(500),
      client.from(dbTable('literary_works')).select('*').order('title').limit(500),
      client.from(dbTable('artworks')).select('*').order('title').limit(500)
    ]);
    const failed = results.find((result) => result.error);
    if (failed) {
      setHtml('aTable', listErrorHtml(failed.error.message));
      return;
    }
    reviews = results[0].data || [];
    books = results[1].data || [];
    works = results[2].data || [];
    artworks = results[3].data || [];
    renderTable();
  } catch (error) {
    setHtml('aTable', listErrorHtml(error && error.message));
  }
}

export function buildReviewPayload(values) {
  const text = (values.review_text || '').trim();
  if (!text) return { error: { message: 'متن نقد الزامی است' }, payload: null };
  return {
    payload: {
      item_type: values.item_type || 'book',
      title: (values.title || '').trim() || null,
      reviewer: (values.reviewer || '').trim() || null,
      source: (values.source || '').trim() || null,
      reviewed_at: values.reviewed_at || null,
      book_id: values.item_type === 'book' ? values.book_id || null : null,
      work_id: values.item_type === 'literary_work' ? values.work_id || null : null,
      artwork_id: values.item_type === 'artwork' ? values.artwork_id || null : null,
      review_text: text,
      sort_order: Number(values.sort_order) || 0,
      is_published: !!values.is_published,
      is_featured: !!values.is_featured
    }
  };
}

export async function saveReview(record, payload, client) {
  if (record) {
    return client.from(dbTable('book_reviews')).update(payload).eq('id', record.id);
  }
  return client.from(dbTable('book_reviews')).insert(payload);
}

export async function removeReviewRow(id, client) {
  return client.from(dbTable('book_reviews')).delete().eq('id', id);
}

function selectOptions(list, current) {
  const opts = list.map(
    (item) => `<option value="${item.id}" ${current === item.id ? 'selected' : ''}>${escapeHtml(item.title)}</option>`
  );
  return `<option value="">وارد نشده</option>${opts.join('')}`;
}

function openForm(review) {
  editing = review;
  const typeOptions = Object.entries(REVIEW_TYPE_LABELS)
    .map(([value, label]) => `<option value="${value}" ${(review?.item_type || 'book') === value ? 'selected' : ''}>${label}</option>`)
    .join('');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'crud-modal';
  overlay.innerHTML = `
    <div class="modal modal--wide">
      <div class="modal-head">
        <h3 class="modal-title">${review ? 'ویرایش نقد' : 'نقد جدید'}</h3>
        <button class="modal-close" type="button" aria-label="بستن">×</button>
      </div>
      <div class="modal-body form-grid">
        <div class="form-group"><label>نوع اثر</label>
          <select class="form-control" id="fItemType">${typeOptions}</select>
        </div>
        <div class="form-group"><label>تاریخ نقد</label><input class="form-control" id="fReviewedAt" type="date" value="${review?.reviewed_at || ''}"></div>
        <div class="form-group form-group--full"><label>عنوان نقد</label><input class="form-control" id="fTitle" value="${escapeHtml(review?.title || '')}"></div>
        <div class="form-group"><label>نویسنده نقد</label><input class="form-control" id="fReviewer" value="${escapeHtml(review?.reviewer || '')}"></div>
        <div class="form-group"><label>منبع</label><input class="form-control" id="fSource" value="${escapeHtml(review?.source || '')}"></div>
        <div class="form-group"><label>ترتیب نمایش</label><input class="form-control" id="fSort" type="number" value="${review?.sort_order ?? 0}"></div>
        <div class="form-group form-group--full" data-relation="book"><label>کتاب مرتبط</label><select class="form-control" id="fBookId">${selectOptions(books, review?.book_id || '')}</select></div>
        <div class="form-group form-group--full" data-relation="literary_work"><label>اثر ادبی مرتبط</label><select class="form-control" id="fWorkId">${selectOptions(works, review?.work_id || '')}</select></div>
        <div class="form-group form-group--full" data-relation="artwork"><label>اثر نقاشی مرتبط</label><select class="form-control" id="fArtworkId">${selectOptions(artworks, review?.artwork_id || '')}</select></div>
        <div class="form-group form-group--full"><label>متن نقد *</label><textarea class="form-control" id="fReviewText" rows="5" required>${escapeHtml(review?.review_text || '')}</textarea></div>
        <label class="checkbox-field"><input type="checkbox" id="fPublished" ${review?.is_published ? 'checked' : ''}> منتشر شده (نمایش عمومی)</label>
        <label class="checkbox-field"><input type="checkbox" id="fFeatured" ${review?.is_featured ? 'checked' : ''}> نشان‌دادن در صفحهٔ اصلی (ویژه)</label>
      </div>
      <div class="modal-foot">
        <button class="btn btn-primary" id="fSave">ذخیره</button>
        <button class="btn btn-ghost" id="fCancel" type="button">انصراف</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  setupModalDialog(overlay);

  const relationGroup = (type) => overlay.querySelector(`[data-relation="${type}"]`);
  const syncRelations = () => {
    const type = overlay.querySelector('#fItemType').value;
    Object.keys(REVIEW_TYPE_LABELS).forEach((t) => {
      if (relationGroup(t)) relationGroup(t).style.display = t === type ? '' : 'none';
    });
  };
  syncRelations();
  overlay.querySelector('#fItemType').addEventListener('change', syncRelations);

  overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#fCancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  overlay.querySelector('#fSave').addEventListener('click', async () => {
    const built = buildReviewPayload({
      item_type: overlay.querySelector('#fItemType').value,
      title: overlay.querySelector('#fTitle').value,
      reviewer: overlay.querySelector('#fReviewer').value,
      source: overlay.querySelector('#fSource').value,
      reviewed_at: overlay.querySelector('#fReviewedAt').value,
      book_id: overlay.querySelector('#fBookId').value || null,
      work_id: overlay.querySelector('#fWorkId').value || null,
      artwork_id: overlay.querySelector('#fArtworkId').value || null,
      review_text: overlay.querySelector('#fReviewText').value,
      sort_order: overlay.querySelector('#fSort').value,
      is_published: overlay.querySelector('#fPublished').checked,
      is_featured: overlay.querySelector('#fFeatured').checked
    });
    if (built.error || !built.payload) {
      toast(built.error?.message || 'خطا در اعتبارسنجی', 'error');
      return;
    }
    const { error } = await saveReview(editing, built.payload, getClient());
    if (error) {
      toast('خطا در ذخیره: ' + (error.message || ''), 'error');
      return;
    }
    toast('نقد ذخیره شد');
    overlay.remove();
    await loadReviews();
  });
}

async function removeReview(review) {
  if (!review) return;
  if (!window.confirm(`نقد «${review.title || 'بدون عنوان'}» حذف شود؟`)) return;
  const { error } = await removeReviewRow(review.id, getClient());
  if (error) {
    toast('خطا در حذف: ' + (error.message || ''), 'error');
    return;
  }
  toast('نقد حذف شد');
  await loadReviews();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    loadReviews();
    el('aAdd').addEventListener('click', () => openForm(null));
    el('aSearch').addEventListener('input', (event) => {
      searchText = (event.target.value || '').trim();
      renderTable();
    });
  });
}
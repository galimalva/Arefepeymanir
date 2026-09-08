import { getClient, dbTable, uploadFile, publicUrl, removeFiles } from '../supabase.js';
import { escapeHtml, toPersianDigits, toast, setupModalDialog, listErrorHtml, validateImageFile } from '../utils.js';
import config from '../../../config.js';

export const CATEGORY_LABELS = {
  none: '',
  abstract: 'انتزاعی',
  calligraphy: 'خوشنویسی',
  traditional: 'سنتی',
  portrait: 'چهره',
  landscape: 'منظره',
  still_life: 'طبیعت بی‌جان',
  figurative: 'تجسمی',
  floral: 'گل و گیاه',
  other: 'سایر'
};

const SALE_LABELS = {
  '': 'وارد نشده',
  for_sale: 'برای فروش',
  sold: 'فروخته شده',
  reserved: 'رزرو شده',
  not_for_sale: 'در معرض فروش نیست'
};

let artworks = [];
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

function imageUrl(artwork) {
  if (artwork.image) return publicUrl(artwork.image);
  if (artwork.image_url) return artwork.image_url;
  return '';
}

function imgPlaceholder(title) {
  return `<span class="table-thumb table-thumb--empty">${escapeHtml((title || 'ا')[0])}</span>`;
}

function statusBadge(artwork) {
  if (!artwork.is_published) return '<span class="badge badge--error">پیش‌نویس</span>';
  return '<span class="badge badge--success">منتشر شده</span>';
}

function saleLabel(status) {
  return SALE_LABELS[status] || status || '';
}

function tableRow(artwork) {
  const image = imageUrl(artwork)
    ? `<img class="table-thumb" src="${imageUrl(artwork)}" alt="${escapeHtml(artwork.title || 'اثر')}" loading="lazy">`
    : imgPlaceholder(artwork.title);
  const meta = [
    artwork.category ? (CATEGORY_LABELS[artwork.category] || artwork.category) : null,
    artwork.collection || null,
    artwork.year ? toPersianDigits(artwork.year) : null,
    saleLabel(artwork.sale_status)
  ].filter(Boolean).join(' | ');
  return `
    <tr>
      <td>${image}</td>
      <td>
        <strong>${escapeHtml(artwork.title)} ${artwork.is_featured ? '<span class="badge badge--secondary">ویژه</span>' : ''}</strong>
        ${artwork.dimensions ? `<br><small class="muted">${escapeHtml(artwork.dimensions)}</small>` : ''}
        <br><small class="muted">${escapeHtml(meta)}</small>
      </td>
      <td>${statusBadge(artwork)}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-edit="${artwork.id}">ویرایش</button>
          <button class="btn btn-danger btn-sm" type="button" data-del="${artwork.id}">حذف</button>
        </div>
      </td>
    </tr>`;
}

function renderTable() {
  const rows = artworks.filter((a) => !searchText || (a.title || '').includes(searchText) || (a.collection || '').includes(searchText));
  if (!rows.length) {
    setHtml('aTable', '<p class="section-empty">هیچ اثری در این پنل ثبت نشده است. برای افزودن از دکمهٔ «+ اثر جدید» استفاده کنید.</p>');
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
    btn.addEventListener('click', () => openForm(artworks.find((a) => a.id === btn.dataset.edit)));
  });
  document.querySelectorAll('#aTable [data-del]').forEach((btn) => {
    btn.addEventListener('click', () => removeArtwork(artworks.find((a) => a.id === btn.dataset.del)));
  });
}

async function loadArtworks() {
  let client;
  try {
    client = getClient();
  } catch (error) {
    setHtml('aTable', listErrorHtml(error && error.message));
    return;
  }
  try {
    const { data, error: queryError } = await client.from(dbTable('artworks')).select('*').order('created_at', { ascending: false }).limit(500);
    if (queryError) {
      setHtml('aTable', listErrorHtml(queryError.message));
      return;
    }
    artworks = data || [];
    renderTable();
  } catch (error) {
    setHtml('aTable', listErrorHtml(error && error.message));
  }
}

export function buildArtworkPayload(values) {
  const price = values.price === '' || values.price === null || values.price === undefined ? null : Number(values.price);
  return {
    title: (values.title || '').trim(),
    category: values.category || null,
    collection: (values.collection || '').trim() || null,
    year: values.year ? Number(values.year) : null,
    technique: (values.technique || '').trim() || null,
    dimensions: (values.dimensions || '').trim() || null,
    exhibition: (values.exhibition || '').trim() || null,
    price: Number.isFinite(price) ? price : null,
    sale_status: values.sale_status || null,
    purchase_note: (values.purchase_note || '').trim() || null,
    description: (values.description || '').trim() || null,
    image: values.image || null,
    images: Array.isArray(values.images) ? values.images.filter(Boolean) : [],
    sort_order: Number(values.sort_order) || 0,
    is_published: !!values.is_published,
    is_featured: !!values.is_featured
  };
}

export async function saveArtwork(record, payload, client) {
  if (!payload.title) return { error: { message: 'عنوان الزامی است' } };
  if (record) {
    return client.from(dbTable('artworks')).update(payload).eq('id', record.id);
  }
  return client.from(dbTable('artworks')).insert(payload);
}

export async function removeArtworkRow(id, client) {
  return client.from(dbTable('artworks')).delete().eq('id', id);
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

function openForm(artwork) {
  editing = artwork;
  modalImagePath = '';
  modalImages = Array.isArray(artwork?.images) ? artwork.images.slice() : [];
  removedImages = [];
  const categoryOptions = Object.entries(CATEGORY_LABELS)
    .filter(([value]) => value !== 'none')
    .map(([value, label]) => `<option value="${value}" ${(artwork?.category || '') === value ? 'selected' : ''}>${label}</option>`)
    .join('');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'crud-modal';
  overlay.innerHTML = `
    <div class="modal modal--wide">
      <div class="modal-head">
        <h3 class="modal-title">${artwork ? 'ویرایش اثر' : 'اثر جدید'}</h3>
        <button class="modal-close" type="button" aria-label="بستن">×</button>
      </div>
      <div class="modal-body form-grid">
        <div class="form-group form-group--full"><label>عنوان *</label><input class="form-control" id="fTitle" required value="${escapeHtml(artwork?.title || '')}"></div>
        <div class="form-group"><label>دسته‌بندی</label>
          <select class="form-control" id="fCategory">
            <option value="">وارد نشده</option>
            ${categoryOptions}
          </select>
        </div>
        <div class="form-group"><label>مجموعه / سری</label><input class="form-control" id="fCollection" value="${escapeHtml(artwork?.collection || '')}"></div>
        <div class="form-group"><label>سال اثر</label><input class="form-control" id="fYear" type="number" min="1300" max="1500" value="${artwork?.year ?? ''}"></div>
        <div class="form-group"><label>تکنیک</label><input class="form-control" id="fTechnique" value="${escapeHtml(artwork?.technique || '')}"></div>
        <div class="form-group"><label>ابعاد</label><input class="form-control" id="fDimensions" value="${escapeHtml(artwork?.dimensions || '')}" placeholder="مثلاً ۶۰ × ۸۰ سانتی‌متر"></div>
        <div class="form-group"><label>نمایشگاه مرتبط</label><input class="form-control" id="fExhibition" value="${escapeHtml(artwork?.exhibition || '')}"></div>
        <div class="form-group"><label>قیمت (تومان)</label><input class="form-control" id="fPrice" type="number" min="0" value="${artwork?.price ?? ''}"></div>
        <div class="form-group"><label>وضعیت فروش</label>
          <select class="form-control" id="fSaleStatus">
            <option value="">وارد نشده</option>
            <option value="for_sale" ${artwork?.sale_status === 'for_sale' ? 'selected' : ''}>برای فروش</option>
            <option value="sold" ${artwork?.sale_status === 'sold' ? 'selected' : ''}>فروخته شده</option>
            <option value="reserved" ${artwork?.sale_status === 'reserved' ? 'selected' : ''}>رزرو شده</option>
            <option value="not_for_sale" ${artwork?.sale_status === 'not_for_sale' ? 'selected' : ''}>در معرض فروش نیست</option>
          </select>
        </div>
        <div class="form-group form-group--full"><label>اطلاعات خرید / تماس</label><textarea class="form-control" id="fPurchaseNote" rows="2">${escapeHtml(artwork?.purchase_note || '')}</textarea></div>
        <div class="form-group"><label>ترتیب نمایش</label><input class="form-control" id="fSort" type="number" value="${artwork?.sort_order ?? 0}"></div>
        <div class="form-group"><label>تصویر اصلی اثر</label>
          <input class="form-control" id="fImageFile" type="file" accept="image/jpeg,image/png,image/webp">
          <div id="fImagePreview" class="cover-preview">${artwork?.image ? `<img src="${publicUrl(artwork.image)}" alt="تصویر فعلی">` : 'هنوز تصویری انتخاب نشده است.'}</div>
        </div>
        <div class="form-group form-group--full"><label>تصاویر اضافی</label>
          <input class="form-control" id="fImagesFile" type="file" accept="image/jpeg,image/png,image/webp" multiple>
          <div id="fImagesList" class="img-list"></div>
        </div>
        <div class="form-group form-group--full"><label>توضیحات اثر</label><textarea class="form-control" id="fDescription" rows="3">${escapeHtml(artwork?.description || '')}</textarea></div>
        <label class="checkbox-field"><input type="checkbox" id="fPublished" ${artwork?.is_published ? 'checked' : ''}> منتشر شده (نمایش عمومی)</label>
        <label class="checkbox-field"><input type="checkbox" id="fFeatured" ${artwork?.is_featured ? 'checked' : ''}> نشان‌دادن در صفحهٔ اصلی (ویژه)</label>
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
    const path = `${config.storage.tenantFolder}/paintings/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '')}`;
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
      const path = `${config.storage.tenantFolder}/paintings/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '')}`;
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
    const payload = buildArtworkPayload({
      title: overlay.querySelector('#fTitle').value,
      category: overlay.querySelector('#fCategory').value,
      collection: overlay.querySelector('#fCollection').value,
      year: overlay.querySelector('#fYear').value,
      technique: overlay.querySelector('#fTechnique').value,
      dimensions: overlay.querySelector('#fDimensions').value,
      exhibition: overlay.querySelector('#fExhibition').value,
      price: overlay.querySelector('#fPrice').value,
      sale_status: overlay.querySelector('#fSaleStatus').value,
      purchase_note: overlay.querySelector('#fPurchaseNote').value,
      description: overlay.querySelector('#fDescription').value,
      sort_order: overlay.querySelector('#fSort').value,
      is_published: overlay.querySelector('#fPublished').checked,
      is_featured: overlay.querySelector('#fFeatured').checked,
      image: modalImagePath || (editing && editing.image) || null,
      images: modalImages.filter((p) => !removedImages.includes(p))
    });
    const { error } = await saveArtwork(editing, payload, getClient());
    if (error) {
      toast('خطا در ذخیره: ' + (error.message || ''), 'error');
      return;
    }
    if (removedImages.length) {
      removeFiles(config.storage.publicBucket, removedImages.slice());
    }
    toast('اثر ذخیره شد');
    overlay.remove();
    await loadArtworks();
  });
}

async function removeArtwork(artwork) {
  if (!artwork) return;
  if (!window.confirm(`اثر «${artwork.title}» حذف شود؟`)) return;
  const { error } = await removeArtworkRow(artwork.id, getClient());
  if (error) {
    toast('خطا در حذف: ' + (error.message || ''), 'error');
    return;
  }
  const stored = [artwork.image, ...(Array.isArray(artwork.images) ? artwork.images : [])].filter(Boolean);
  if (stored.length) {
    removeFiles(config.storage.publicBucket, stored);
  }
  toast('اثر حذف شد');
  await loadArtworks();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    loadArtworks();
    el('aAdd').addEventListener('click', () => openForm(null));
    el('aSearch').addEventListener('input', (event) => {
      searchText = (event.target.value || '').trim();
      renderTable();
    });
  });
}
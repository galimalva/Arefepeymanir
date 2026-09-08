import { getClient, dbTable, uploadFile, removeFiles, publicUrl } from '../supabase.js';
import { toast, validateImageFile } from '../utils.js';
import config from '../../../config.js';

let profileRow = null;
let uploadedPath = null;
let oldPhotoPath = null;

function el(id) {
  return document.getElementById(id);
}

function setHtml(id, html) {
  const node = el(id);
  if (node) node.innerHTML = html;
}

function setError(field, message) {
  const node = el(`pf-${field}-error`);
  if (node) node.textContent = message;
}

function clearErrors() {
  ['full-name', 'email', 'birth-year', 'role', 'birth-place', 'education', 'phone', 'quote', 'bio-short', 'bio-full'].forEach((f) => setError(f, ''));
}

export function buildProfilePayload(values) {
  return {
    full_name: String(values.full_name || '').trim(),
    title_role: String(values.title_role || '').trim() || null,
    birth_year: values.birth_year ? Number(values.birth_year) : null,
    birth_place: String(values.birth_place || '').trim() || null,
    education: String(values.education || '').trim() || null,
    email: String(values.email || '').trim() || null,
    phone: String(values.phone || '').trim() || null,
    signature_quote: String(values.signature_quote || '').trim() || null,
    bio_short: String(values.bio_short || '').trim() || null,
    bio_full: String(values.bio_full || '').trim() || null,
    photo_url: values.photo_url || null
  };
}

export function validateProfile(payload) {
  if (!payload.full_name) return { error: { field: 'full-name', message: 'نام کامل الزامی است.' } };
  if (payload.birth_year != null && (payload.birth_year < 1300 || payload.birth_year > 1500)) {
    return { error: { field: 'birth-year', message: 'سال تولد معتبر نیست.' } };
  }
  return { error: null };
}

export async function saveProfile(record, payload, client) {
  if (record) {
    return client.from(dbTable('author_profile')).update(payload).eq('id', record.id);
  }
  return client.from(dbTable('author_profile')).insert(payload);
}

export function fillForm(profile) {
  profileRow = profile;
  el('pf-full-name').value = profile?.full_name || '';
  el('pf-role').value = profile?.title_role || '';
  el('pf-birth-year').value = profile?.birth_year ?? '';
  el('pf-birth-place').value = profile?.birth_place || '';
  el('pf-education').value = profile?.education || '';
  el('pf-email').value = profile?.email || '';
  el('pf-phone').value = profile?.phone || '';
  el('pf-quote').value = profile?.signature_quote || '';
  el('pf-bio-short').value = profile?.bio_short || '';
  el('pf-bio-full').value = profile?.bio_full || '';
  oldPhotoPath = profile?.photo_url || null;
  uploadedPath = null;
  const preview = el('pf-photo-preview');
  if (preview) {
    if (profile?.photo_url) preview.innerHTML = `<img src="${publicUrl(profile.photo_url)}" alt="عکس فعلی نویسنده">`;
    else preview.textContent = 'هنوز عکسی انتخاب نشده است.';
  }
}

export async function loadProfile() {
  let client;
  try {
    client = getClient();
  } catch (error) {
    if (el('pf-loading')) el('pf-loading').hidden = true;
    if (el('pf-error')) {
      el('pf-error').textContent = 'پایگاه داده هنوز راه‌اندازی نشده است.';
      el('pf-error').hidden = false;
    }
    return;
  }
  try {
    const { data } = await client.from(dbTable('author_profile')).select('*').maybeSingle();
    fillForm(data || null);
  } catch (error) {
    if (el('pf-loading')) el('pf-loading').hidden = true;
    if (el('pf-error')) {
      el('pf-error').textContent = 'خطا در دریافت پروفایل: ' + (error.message || '');
      el('pf-error').hidden = false;
    }
    return;
  }
  if (el('pf-loading')) el('pf-loading').hidden = true;
  const form = el('profile-form');
  if (form) form.hidden = false;
}

export function attachProfileForm(form) {
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors();
    if (el('pf-error')) el('pf-error').hidden = true;
    const payload = buildProfilePayload({
      full_name: el('pf-full-name').value,
      title_role: el('pf-role').value,
      birth_year: el('pf-birth-year').value,
      birth_place: el('pf-birth-place').value,
      education: el('pf-education').value,
      email: el('pf-email').value,
      phone: el('pf-phone').value,
      signature_quote: el('pf-quote').value,
      bio_short: el('pf-bio-short').value,
      bio_full: el('pf-bio-full').value,
      photo_url: uploadedPath || oldPhotoPath
    });
    const validation = validateProfile(payload);
    if (validation.error) {
      setError(validation.error.field, validation.error.message);
      return;
    }
    const submitBtn = el('pf-save');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const { error } = await saveProfile(profileRow, payload, getClient());
      if (error) {
        toast('خطا در ذخیره: ' + (error.message || ''), 'error');
        return;
      }
      toast(profileRow ? 'پروفایل به‌روزرسانی شد.' : 'پروفایل ایجاد شد.');
      if (oldPhotoPath && uploadedPath && oldPhotoPath !== uploadedPath) {
        await removeFiles(config.storage.publicBucket, [oldPhotoPath]);
      }
      await loadProfile();
    } catch (error) {
      toast('خطا در ذخیره: ' + (error.message || ''), 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    loadProfile();
    attachProfileForm(el('profile-form'));
    const photoInput = el('pf-photo');
    if (photoInput) {
      photoInput.addEventListener('change', async (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        const badPhoto = validateImageFile(file);
        if (badPhoto) { toast(badPhoto, 'error'); return; }
        const path = `${config.storage.tenantFolder}/profile/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '')}`;
        const { error } = await uploadFile(config.storage.publicBucket, path, file);
        if (error) {
          toast('خطا در آپلود عکس: ' + (error.message || ''), 'error');
          return;
        }
        uploadedPath = path;
        const preview = el('pf-photo-preview');
        if (preview) preview.innerHTML = `<img src="${publicUrl(path)}" alt="عکس جدید نویسنده">`;
        toast('عکس آپلود شد.');
      });
    }
  });
}
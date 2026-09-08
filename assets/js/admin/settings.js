import { getClient, dbTable } from '../supabase.js';
import { toast } from '../utils.js';

let settingsRow = null;

function el(id) {
  return document.getElementById(id);
}

export function buildSettingsPayload(values) {
  return {
    site_title: String(values.site_title || '').trim(),
    tagline: String(values.tagline || '').trim() || null,
    contact_email: String(values.contact_email || '').trim() || null,
    contact_phone: String(values.contact_phone || '').trim() || null
  };
}

export function validateSettings(payload) {
  if (!payload.site_title) return { error: { field: 'title', message: 'نام سایت الزامی است.' } };
  return { error: null };
}

export async function saveSettings(record, payload, client) {
  if (record) {
    return client.from(dbTable('site_settings')).update(payload).eq('id', record.id);
  }
  return client.from(dbTable('site_settings')).insert(payload);
}

export function fillSettingsForm(settings) {
  settingsRow = settings;
  el('st-title').value = settings?.site_title || '';
  el('st-tagline').value = settings?.tagline || '';
  el('st-email').value = settings?.contact_email || '';
  el('st-phone').value = settings?.contact_phone || '';
}

export async function loadSettings() {
  let client;
  try {
    client = getClient();
  } catch (error) {
    if (el('st-loading')) el('st-loading').hidden = true;
    if (el('st-error')) {
      el('st-error').textContent = 'پایگاه داده هنوز راه‌اندازی نشده است.';
      el('st-error').hidden = false;
    }
    return;
  }
  try {
    const { data } = await client.from(dbTable('site_settings')).select('*').maybeSingle();
    fillSettingsForm(data || null);
  } catch (error) {
    if (el('st-loading')) el('st-loading').hidden = true;
    if (el('st-error')) {
      el('st-error').textContent = 'خطا در دریافت تنظیمات: ' + (error.message || '');
      el('st-error').hidden = false;
    }
    return;
  }
  if (el('st-loading')) el('st-loading').hidden = true;
  const form = el('settings-form');
  if (form) form.hidden = false;
}

export function attachSettingsForm(form) {
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const titleError = el('st-title-error');
    if (titleError) titleError.textContent = '';
    if (el('st-error')) el('st-error').hidden = true;
    const payload = buildSettingsPayload({
      site_title: el('st-title').value,
      tagline: el('st-tagline').value,
      contact_email: el('st-email').value,
      contact_phone: el('st-phone').value
    });
    const validation = validateSettings(payload);
    if (validation.error) {
      if (validation.error.field === 'title' && titleError) titleError.textContent = validation.error.message;
      return;
    }
    const submitBtn = el('st-save');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const { error } = await saveSettings(settingsRow, payload, getClient());
      if (error) {
        toast('خطا در ذخیره: ' + (error.message || ''), 'error');
        return;
      }
      toast(settingsRow ? 'تنظیمات به‌روزرسانی شد.' : 'تنظیمات ایجاد شد.');
      await loadSettings();
    } catch (error) {
      toast('خطا در ذخیره: ' + (error.message || ''), 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

export async function changeAdminPassword(values, client) {
  const { data: userData } = await client.auth.getUser();
  const email = userData && userData.user && userData.user.email;
  if (!email) return { error: { message: 'سشن معتبر نیست؛ دوباره وارد شوید.' } };
  const newPass = String(values.newPassword || '');
  if (newPass.length < 6) return { error: { message: 'رمز جدید باید حداقل ۶ کاراکتر باشد.' } };
  if (newPass !== String(values.confirm || '')) return { error: { message: 'تکرار رمز جدید مطابقت ندارد.' } };
  const reauth = await client.auth.signInWithPassword({ email, password: String(values.currentPassword || '') });
  if (reauth.error) return { error: { message: 'رمز فعلی اشتباه است.' } };
  const result = await client.auth.updateUser({ password: newPass });
  if (result.error) return { error: result.error };
  return { error: null };
}

export function attachPasswordForm(form) {
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorBox = el('pw-error');
    if (errorBox) errorBox.hidden = true;
    const submitBtn = el('pw-submit');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const { error } = await changeAdminPassword({
        currentPassword: el('pw-current').value,
        newPassword: el('pw-new').value,
        confirm: el('pw-confirm').value
      }, getClient());
      if (error) {
        if (errorBox) {
          errorBox.textContent = error.message;
          errorBox.hidden = false;
        }
        return;
      }
      form.reset();
      toast('رمز ورود با موفقیت تغییر کرد.');
    } catch (error) {
      toast('خطا در تغییر رمز: ' + (error.message || ''), 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    attachSettingsForm(el('settings-form'));
    attachPasswordForm(el('password-form'));
  });
}
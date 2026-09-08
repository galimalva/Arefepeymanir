import { getClient, dbTable } from '../supabase.js';
import { toast } from '../utils.js';

function el(id) {
  return document.getElementById(id);
}

function emailIsValid(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function clearErrors() {
  ['ct-name', 'ct-email', 'ct-subject', 'ct-message'].forEach((base) => {
    el(`${base}-error`).textContent = '';
  });
}

function setError(field, message) {
  el(`ct-${field}-error`).textContent = message;
}

export function validateContact(values) {
  const name = String(values.name || '').trim();
  const email = String(values.email || '').trim();
  const message = String(values.message || '').trim();
  const subject = String(values.subject || '').trim();
  if (name.length < 2) return { error: 'فرم نام باید حداقل ۲ حرف باشد.', field: 'name' };
  if (!email) return { error: 'ایمیل الزامی است.', field: 'email' };
  if (!emailIsValid(email)) return { error: 'فرمت ایمیل صحیح نیست.', field: 'email' };
  if (message.length < 10) return { error: 'متن پیام باید حداقل ۱۰ حرف باشد.', field: 'message' };
  return {
    error: null,
    values: { full_name: name, email, subject: subject || null, message, is_read: false }
  };
}

export async function sendMessage(client, payload) {
  return client.from(dbTable('messages')).insert(payload);
}

async function handleSubmit(event) {
  event.preventDefault();
  clearErrors();
  const result = validateContact({
    name: el('ct-name').value,
    email: el('ct-email').value,
    subject: el('ct-subject').value,
    message: el('ct-message').value
  });
  if (result.error) {
    setError(result.field, result.error);
    toast(result.error, 'error');
    return;
  }
  let client;
  try {
    client = getClient();
  } catch (error) {
    toast('پایگاه داده هنوز راه‌اندازی نشده است.', 'error');
    return;
  }
  const submitBtn = el('ct-submit');
  if (submitBtn) submitBtn.disabled = true;
  try {
    const { error } = await sendMessage(client, result.values);
    if (error) {
      toast('خطا در ارسال پیام: ' + (error.message || ''), 'error');
      return;
    }
    toast('پیام شما با موفقیت ارسال شد.');
    el('ct-name').value = '';
    el('ct-email').value = '';
    el('ct-subject').value = '';
    el('ct-message').value = '';
  } catch (error) {
    toast('خطا در ارسال پیام: ' + (error.message || ''), 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const form = el('contact-form');
    if (form) form.addEventListener('submit', handleSubmit);
  });
}
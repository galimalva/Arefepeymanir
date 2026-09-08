import { signInWithEmail, isAdmin } from '../auth.js';
import { toast } from '../utils.js';

function el(id) {
  return document.getElementById(id);
}

export function validateLogin(values) {
  const email = String(values.email || '').trim();
  const password = String(values.password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: { field: 'email', message: 'ایمیل معتبر وارد کنید.' } };
  if (password.length < 8) return { error: { field: 'password', message: 'رمز عبور باید حداقل ۸ نویسه باشد.' } };
  return { error: null, values: { email, password } };
}

export async function loginAdmin({ email, password }) {
  let result;
  try {
    result = await signInWithEmail(email, password);
  } catch {
    return { error: { message: 'ورود انجام نشد؛ لطفاً اتصال را بررسی و دوباره تلاش کنید.' } };
  }
  if (result && result.error) return { error: { message: result.error.message || 'ایمیل یا رمز عبور نادرست است.' } };
  const admin = await isAdmin();
  if (!admin) return { error: { message: 'این حساب دسترسی مدیر ندارد.' } };
  return { error: null };
}

export function showLoginError(message) {
  const box = el('login-error');
  if (!box) return;
  box.textContent = message;
  box.hidden = false;
}

export function attachLoginForm(form, onSuccess) {
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const box = el('login-error');
    if (box) box.hidden = true;
    if (el('lg-email-error')) el('lg-email-error').textContent = '';
    if (el('lg-password-error')) el('lg-password-error').textContent = '';
    const result = validateLogin({ email: el('lg-email').value, password: el('lg-password').value });
    if (result.error) {
      if (result.error.field === 'email' && el('lg-email-error')) el('lg-email-error').textContent = result.error.message;
      else if (result.error.field === 'password' && el('lg-password-error')) el('lg-password-error').textContent = result.error.message;
      return;
    }
    const submitBtn = el('lg-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'در حال ورود…';
    }
    const outcome = await loginAdmin(result.values);
    if (outcome.error) {
      showLoginError(outcome.error.message);
      toast(outcome.error.message, 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'ورود';
      }
      return;
    }
    toast('ورود موفق');
    if (onSuccess) onSuccess();
    else if (typeof location !== 'undefined') location.replace('dashboard.html');
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    attachLoginForm(el('login-form'));
  });
}
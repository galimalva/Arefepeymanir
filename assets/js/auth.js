import { getClient, dbTable } from './supabase.js';

export function initAuth() {
  try {
    const supabase = getClient();
    supabase.auth.onAuthStateChange((event, session) => {
      document.dispatchEvent(new CustomEvent('auth:change', { detail: { event, session } }));
    });
  } catch (error) {
    console.warn(error.message);
  }
}

export async function getSession() {
  try {
    const { data, error } = await getClient().auth.getSession();
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

export async function getCurrentUser() {
  const { data } = await getSession();
  return data && data.session ? data.session.user : null;
}

export async function signInWithEmail(email, password) {
  try {
    const { data, error } = await getClient().auth.signInWithPassword({ email, password });
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

export async function signOut() {
  try {
    const { error } = await getClient().auth.signOut();
    return { error };
  } catch (error) {
    return { error };
  }
}

export async function isAdmin() {
  try {
    const { data, error } = await getClient().rpc('author_006_is_admin');
    if (error) return false;
    return !!data;
  } catch (error) {
    return false;
  }
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) {
    location.replace('login.html');
    return;
  }
  const admin = await isAdmin();
  if (!admin) {
    location.replace('login.html');
    return;
  }
  const { data } = await getClient()
    .from(dbTable('author_profile'))
    .select('full_name')
    .maybeSingle();
  return data;
}
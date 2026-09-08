import config from '../../config.js';

let client = null;

export function isSupabaseConfigured() {
  return (
    config.supabase.url &&
    config.supabase.url.startsWith('https://') &&
    config.supabase.anonKey &&
    !config.supabase.anonKey.includes('FILL_WITH')
  );
}

export function getClient() {
  if (!isSupabaseConfigured()) {
    throw new Error('config.js: url و anonKey سوپابیس هنوز تنظیم نشده است.');
  }
  const factory = window.supabase && window.supabase.createClient;
  if (!factory) {
    throw new Error('کتابخانهٔ Supabase بارگیری نشده است.');
  }
  if (!client) {
    client = factory(config.supabase.url, config.supabase.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  }
  return client;
}

export function dbTable(name) {
  return `${config.dbPrefix}${name}`;
}

export function publicUrl(path) {
  return `${config.supabase.url}/storage/v1/object/public/${config.storage.publicBucket}/${path}`;
}

export async function uploadFile(bucket, path, file, upsert) {
  try {
    const { data, error } = await getClient()
      .storage
      .from(bucket)
      .upload(path, file, { upsert: !!upsert, cacheControl: '3600' });
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

export async function removeFiles(bucket, paths) {
  try {
    const { data, error } = await getClient().storage.from(bucket).remove(paths);
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

export async function signUrl(bucket, path, expiresIn) {
  try {
    const { data, error } = await getClient()
      .storage
      .from(bucket)
      .createSignedUrl(path, expiresIn || 3600);
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}
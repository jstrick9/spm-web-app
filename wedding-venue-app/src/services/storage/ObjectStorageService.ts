import { getSupabaseClient, isSupabaseConfigured } from '../backend/supabaseClient';

export type StorageBucket = 'venue-images' | 'event-documents' | 'user-avatars';

export interface UploadedObject {
  bucket: StorageBucket;
  path: string;
  signedUrl?: string;
}

function sanitizeFilename(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'upload';
}

export async function uploadObject(params: {
  bucket: StorageBucket;
  file: File | Blob;
  organizationId?: string;
  eventId?: string;
  userId?: string;
  filename?: string;
  contentType?: string;
}): Promise<UploadedObject> {
  if (!isSupabaseConfigured()) {
    throw new Error('Object storage requires Supabase configuration.');
  }

  const supabase = getSupabaseClient();
  const originalName = params.filename || (params.file instanceof File ? params.file.name : 'upload');
  const filename = `${Date.now()}-${sanitizeFilename(originalName)}`;

  const path =
    params.bucket === 'user-avatars'
      ? `${params.userId || 'unknown'}/${filename}`
      : params.bucket === 'event-documents'
        ? `${params.organizationId}/${params.eventId || 'general'}/${filename}`
        : `${params.organizationId}/${filename}`;

  const { error } = await supabase.storage.from(params.bucket).upload(path, params.file, {
    contentType: params.contentType || (params.file instanceof File ? params.file.type : undefined),
    upsert: false,
  });

  if (error) throw error;

  const { data } = await supabase.storage.from(params.bucket).createSignedUrl(path, 60 * 60);
  return { bucket: params.bucket, path, signedUrl: data?.signedUrl };
}

export async function getSignedObjectUrl(
  bucket: StorageBucket,
  path: string,
  expiresInSeconds = 60 * 60,
): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error('Object storage requires Supabase configuration.');
  }

  const { data, error } = await getSupabaseClient()
    .storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Unable to create signed URL.');
  return data.signedUrl;
}

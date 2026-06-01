import { api } from './client.js';

export interface SdkGalleryImage {
  id: string;
  organization_id: string;
  event_id: string;
  filename: string;
  url: string;
  category: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

export const gallerySdk = {
  list(eventId: string): Promise<{ images: SdkGalleryImage[]; counts: Record<string, number> }> {
    return api.get(`/api/events/${eventId}/gallery`);
  },
  upload(eventId: string, input: {
    filename: string; url: string; category?: string;
    caption?: string; sortOrder?: number;
  }): Promise<{ image: SdkGalleryImage }> {
    return api.post(`/api/events/${eventId}/gallery`, input);
  },
  update(id: string, patch: Partial<{ category: string; caption: string; sortOrder: number }>): Promise<{ image: SdkGalleryImage }> {
    return api.patch(`/api/gallery/${id}`, patch);
  },
  delete(id: string): Promise<void> {
    return api.delete(`/api/gallery/${id}`);
  },
};

import { api } from './client.js';
import type { SdkVenue } from './types.js';

export interface VenueInput {
  name: string;
  category?: string;
  environment?: 'indoor' | 'outdoor' | 'both';
  description?: string;
  capacity?: number;
  width?: number;
  height?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  shape?: Record<string, unknown>;
  style?: Record<string, unknown>;
  masterLayout?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  unitSystem?: 'imperial' | 'metric';
  templateKey?: 'custom' | 'ceremony' | 'cocktail' | 'reception' | 'outdoor_tent';
  approvalStatus?: 'draft' | 'approved' | 'archived';
  underlay?: Record<string, unknown>;
}

export const venuesSdk = {
  eventTemplates(eventId: string): Promise<{ templates: Array<{ id: string; name: string; spec: Record<string, any> }>; spaces: Array<{ id: string; name: string; category: string; capacity: number; templateKey: string }>; guestCount: number }> { return api.get(`/api/events/${eventId}/venue-templates`); },
  list(orgId: string): Promise<{ venues: SdkVenue[] }> {
    return api.get(`/api/orgs/${orgId}/venues`);
  },
  create(orgId: string, input: VenueInput): Promise<{ venue: SdkVenue }> {
    return api.post(`/api/orgs/${orgId}/venues`, input);
  },
  update(venueId: string, patch: Partial<VenueInput>): Promise<{ venue: SdkVenue }> {
    return api.patch(`/api/venues/${venueId}`, patch);
  },
  uploadUnderlay(venueId: string, dataUri: string, originalPdf?: { dataUri: string; name: string }): Promise<{ venue: SdkVenue }> {
    return api.post(`/api/venues/${venueId}/underlay`, { dataUri, ...(originalPdf ? { sourceDataUri: originalPdf.dataUri, sourceName: originalPdf.name } : {}) });
  },
  createEventLayout(venueId: string, eventId: string, name?: string) {
    return api.post(`/api/venues/${venueId}/event-layouts`, { eventId, name });
  },
  scaffoldVersions(venueId: string): Promise<{ versions: Array<{ id: string; revision: number; change_description: string | null; created_at: string }> }> { return api.get(`/api/venues/${venueId}/scaffold/versions`); },
  saveScaffold(venueId: string, input: { masterLayout: Record<string, unknown>; canvasWidth?: number; canvasHeight?: number; description?: string }) {
    return api.post(`/api/venues/${venueId}/scaffold/save`, input);
  },
  delete(venueId: string): Promise<void> {
    return api.delete(`/api/venues/${venueId}`);
  },
};

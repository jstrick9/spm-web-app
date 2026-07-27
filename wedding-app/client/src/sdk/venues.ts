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
  list(orgId: string): Promise<{ venues: SdkVenue[] }> {
    return api.get(`/api/orgs/${orgId}/venues`);
  },
  create(orgId: string, input: VenueInput): Promise<{ venue: SdkVenue }> {
    return api.post(`/api/orgs/${orgId}/venues`, input);
  },
  update(venueId: string, patch: Partial<VenueInput>): Promise<{ venue: SdkVenue }> {
    return api.patch(`/api/venues/${venueId}`, patch);
  },
  uploadUnderlay(venueId: string, dataUri: string): Promise<{ venue: SdkVenue }> {
    return api.post(`/api/venues/${venueId}/underlay`, { dataUri });
  },
  createEventLayout(venueId: string, eventId: string, name?: string) {
    return api.post(`/api/venues/${venueId}/event-layouts`, { eventId, name });
  },
  delete(venueId: string): Promise<void> {
    return api.delete(`/api/venues/${venueId}`);
  },
};

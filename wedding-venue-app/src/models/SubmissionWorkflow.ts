import type { EventAnswer } from '../types';

export type SubmissionStatus = 'pending' | 'approved' | 'changes_requested' | 'rejected';

export interface EventSubmissionReview {
  action: 'approve' | 'request_changes' | 'reject';
  byUserId: string;
  byName: string;
  comment?: string;
  at: string;
}

export interface EventSubmission {
  id: string;
  eventName: string;
  masterUserId: string;
  masterUserName: string;
  selectedVenueIds: string[];
  answers: EventAnswer[];
  status: SubmissionStatus;
  adminComment?: string;
  submittedAt: string;
  updatedAt: string;
  history: EventSubmissionReview[];
}

export const buildSubmissionKey = (eventName: string, masterUserId: string) =>
  `${eventName}::${masterUserId}`;

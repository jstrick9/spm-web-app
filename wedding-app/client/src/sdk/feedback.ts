import { api } from './client.js';

export interface Poll {
  id: string;
  question: string;
  options: { id: string; text: string; votes: number }[];
  status: 'active' | 'closed';
}

export interface FeedbackRecord {
  id: string;
  target: string;
  rating: number;
  comments: string;
  submittedBy: string;
}

export const feedbackSdk = {
  getPolls(eventId: string): Promise<{ polls: Poll[] }> {
    return api.get(`/api/events/${eventId}/polls`);
  },
  createPoll(eventId: string, poll: Omit<Poll, 'id'>): Promise<{ poll: Poll }> {
    return api.post(`/api/events/${eventId}/polls`, poll);
  },
  votePoll(eventId: string, pollId: string, optionId: string): Promise<{ poll: Poll }> {
    return api.post(`/api/events/${eventId}/polls/${pollId}/vote`, { optionId });
  },
  getFeedback(eventId: string): Promise<{ feedback: FeedbackRecord[] }> {
    return api.get(`/api/events/${eventId}/feedback`);
  },
  submitFeedback(eventId: string, feedback: Omit<FeedbackRecord, 'id'>): Promise<{ feedback: FeedbackRecord }> {
    return api.post(`/api/events/${eventId}/feedback`, feedback);
  },
  submitNps(eventId: string, input: { score: number; comment?: string; submittedBy?: string }): Promise<{ nps: any }> {
    return api.post(`/api/public/events/${eventId}/nps`, input);
  },
  getNpsStats(orgId: string): Promise<{
    npsScore: number | null;
    totalResponses: number;
    promoters: number;
    detractors: number;
    responses: Array<{ id: string; eventId: string; eventTitle: string; score: number; comment: string; submittedBy: string; submittedAt: string }>;
  }> {
    return api.get(`/api/orgs/${orgId}/nps-stats`);
  }
};

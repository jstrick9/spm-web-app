import { api } from './client.js';
import type { SdkEventQuestion, SdkEventAnswer } from './types.js';

export interface QuestionInput {
  question: string;
  groupName?: string;
  answerType?: 'dropdown' | 'integer' | 'text' | 'date' | 'boolean' | 'multiselect';
  options?: any[];
  workflow?: Record<string, unknown>;
  required?: boolean;
  sortOrder?: number;
}

export const questionsSdk = {
  list(orgId: string): Promise<{ questions: SdkEventQuestion[] }> {
    return api.get(`/api/orgs/${orgId}/questions`);
  },
  create(orgId: string, input: QuestionInput): Promise<{ question: SdkEventQuestion }> {
    return api.post(`/api/orgs/${orgId}/questions`, input);
  },
  update(questionId: string, patch: Partial<QuestionInput>): Promise<{ question: SdkEventQuestion }> {
    return api.patch(`/api/questions/${questionId}`, patch);
  },
  delete(questionId: string): Promise<void> {
    return api.delete(`/api/questions/${questionId}`);
  },

  listAnswers(eventId: string): Promise<{ answers: SdkEventAnswer[] }> {
    return api.get(`/api/events/${eventId}/answers`);
  },
  upsertAnswer(eventId: string, questionId: string, answer: string): Promise<{ answer: SdkEventAnswer }> {
    return api.put(`/api/events/${eventId}/answers/${questionId}`, { answer });
  }
};

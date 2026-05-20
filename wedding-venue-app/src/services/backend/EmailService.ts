import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

export type EmailPurpose =
  | 'invitation'
  | 'password_reset'
  | 'rsvp_confirmation'
  | 'staff_notification';

export interface SendTransactionalEmailParams {
  to: string;
  purpose: EmailPurpose;
  organizationId: string;
  eventId?: string;
  templateData?: Record<string, unknown>;
}

export async function sendTransactionalEmail(params: SendTransactionalEmailParams): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Email delivery requires Supabase Edge Functions configuration.');
  }

  const { error } = await getSupabaseClient().functions.invoke('send-email', {
    body: params,
  });

  if (error) throw error;
}

export function buildInvitationTemplateData(params: {
  recipientName: string;
  organizationName: string;
  inviteUrl: string;
}): SendTransactionalEmailParams['templateData'] {
  return {
    recipientName: params.recipientName,
    organizationName: params.organizationName,
    inviteUrl: params.inviteUrl,
  };
}

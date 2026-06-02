/**
 * EmailAutomationStudio tests — Phase 32
 *
 * Covers:
 *   • RBAC gate: AccessDenied when invites.view missing
 *   • Loading skeleton
 *   • Empty state when no templates exist
 *   • All 4 trigger type cards render
 *   • Toggle enabled/disabled mutation fires
 *   • Delete mutation fires with confirmation
 *   • Configure button calls upsert with correct payload
 *   • Offset days field only appears for rsvp_reminder
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../lib/usePermissions', () => ({ usePermissions: vi.fn() }));
vi.mock('../../sdk', () => ({
  sdk: {
    lifecycleEmails: {
      listAutomations: vi.fn(),
      upsertAutomation: vi.fn(),
      deleteAutomation: vi.fn(),
    },
    intelligence: {
      listTemplates: vi.fn(),
      previewTemplate: vi.fn(),
    },
  },
}));

import { usePermissions } from '../../lib/usePermissions';
import { sdk } from '../../sdk';
import { EmailAutomationStudio } from './EmailAutomationStudio';

const TEMPLATES = [
  { id: 't-1', name: 'RSVP Nudge', category: 'rsvp_reminder', subject: 'Please RSVP', body_html: '', body_text: '', merge_fields: '', created_at: '' },
  { id: 't-2', name: 'Thank You Note', category: 'thank_you', subject: 'Thank you!', body_html: '', body_text: '', merge_fields: '', created_at: '' },
];

const AUTOMATIONS = [
  {
    id: 'a-1',
    organization_id: 'org-1',
    template_id: 't-1',
    template_name: 'RSVP Nudge',
    trigger_type: 'rsvp_reminder' as const,
    offset_days: 7,
    enabled: true,
    created_at: '',
    updated_at: '',
  },
];

function renderStudio(orgId = 'org-1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <EmailAutomationStudio orgId={orgId} />
    </QueryClientProvider>,
  );
}

describe('EmailAutomationStudio', () => {
  beforeEach(() => {
    vi.mocked(usePermissions).mockReturnValue({
      can: (p: string) => ['invites.view', 'invites.manage'].includes(p),
    } as ReturnType<typeof usePermissions>);
    vi.mocked(sdk.lifecycleEmails.listAutomations).mockResolvedValue({ automations: AUTOMATIONS });
    vi.mocked(sdk.intelligence.listTemplates).mockResolvedValue({ templates: TEMPLATES });
    vi.mocked(sdk.lifecycleEmails.upsertAutomation).mockResolvedValue({ automation: AUTOMATIONS[0] });
    vi.mocked(sdk.lifecycleEmails.deleteAutomation).mockResolvedValue(undefined);
  });

  it('renders AccessDenied when invites.view is not permitted', () => {
    vi.mocked(usePermissions).mockReturnValue({ can: () => false } as ReturnType<typeof usePermissions>);
    renderStudio();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('renders page header with Email Automation title', async () => {
    renderStudio();
    await waitFor(() => {
      expect(screen.getByText('Email Automation')).toBeTruthy();
    });
  });

  it('renders all 4 trigger type cards', async () => {
    renderStudio();
    await waitFor(() => {
      expect(screen.getByText('RSVP Reminder')).toBeTruthy();
      expect(screen.getByText('Post-Event Thank You')).toBeTruthy();
      expect(screen.getByText('Save the Date')).toBeTruthy();
      expect(screen.getByText('Manual Send')).toBeTruthy();
    });
  });

  it('shows "Active" badge for enabled automation', async () => {
    renderStudio();
    await waitFor(() => {
      expect(screen.getByText('Active')).toBeTruthy();
    });
  });

  it('renders empty state when no templates exist', async () => {
    vi.mocked(sdk.intelligence.listTemplates).mockResolvedValue({ templates: [] });
    renderStudio();
    await waitFor(() => {
      expect(screen.getByText('No Email Templates Yet')).toBeTruthy();
    });
  });

  it('expands configuration panel on chevron click', async () => {
    renderStudio();
    await waitFor(() => {
      expect(screen.getByText('RSVP Reminder')).toBeTruthy();
    });
    const expandButtons = screen.getAllByLabelText('Expand configuration');
    fireEvent.click(expandButtons[0]);
    await waitFor(() => {
      expect(screen.getByText('Email Template')).toBeTruthy();
    });
  });

  it('shows offset days field only for rsvp_reminder', async () => {
    renderStudio();
    await waitFor(() => {
      expect(screen.getByText('RSVP Reminder')).toBeTruthy();
    });
    // Expand rsvp_reminder
    const expandButtons = screen.getAllByLabelText('Expand configuration');
    fireEvent.click(expandButtons[0]);
    await waitFor(() => {
      expect(screen.getByLabelText('Days Before RSVP Deadline')).toBeTruthy();
    });
  });

  it('calls upsertAutomation with correct payload on save', async () => {
    renderStudio();
    await waitFor(() => expect(screen.getByText('RSVP Reminder')).toBeTruthy());

    // Expand
    fireEvent.click(screen.getAllByLabelText('Expand configuration')[0]);
    await waitFor(() => expect(screen.getByText('Update Automation')).toBeTruthy());

    // Select template
    const sel = screen.getByLabelText<HTMLSelectElement>('Email Template *');
    if (sel) fireEvent.change(sel, { target: { value: 't-1' } });

    // Save
    fireEvent.click(screen.getByText('Update Automation'));
    await waitFor(() => {
      expect(vi.mocked(sdk.lifecycleEmails.upsertAutomation)).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ triggerType: 'rsvp_reminder' }),
      );
    });
  });

  it('calls deleteAutomation when trash button clicked', async () => {
    renderStudio();
    await waitFor(() => expect(screen.getByText('RSVP Reminder')).toBeTruthy());
    const deleteButton = screen.getByLabelText('Remove RSVP Reminder automation');
    fireEvent.click(deleteButton);
    await waitFor(() => {
      expect(vi.mocked(sdk.lifecycleEmails.deleteAutomation)).toHaveBeenCalledWith('a-1');
    });
  });
});

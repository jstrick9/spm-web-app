import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PortalAccessCard } from './portalSections/PortalAccessCard';
import { PortalAccessSecurityCard } from './portalSections/PortalAccessSecurityCard';
import { PortalDesignerCard } from './portalSections/PortalDesignerCard';
import { PortalSubEventsCard } from './portalSections/PortalSubEventsCard';
import { PortalSmsRemindersCard } from './portalSections/PortalSmsRemindersCard';
import { PortalPhoneMockup } from './portalSections/PortalPhoneMockup';

/**
 * Direct component tests for the extracted GuestPortalSettingsTab sections.
 * Each section renders standalone with props (the container owns all state),
 * locking the contracts so future in-section refactors are safe.
 */

const noop = () => {};
const setState = (v: any) => { void v; };

function accessCardProps(over: Partial<Parameters<typeof PortalAccessCard>[0]> = {}) {
  return {
    localEnabled: true,
    toast: noop as any,
    handleToggleEnable: noop,
    portalUrl: 'http://localhost:3000/#/portal/evt-1',
    guests: [],
    ...over,
  };
}

function securityCardProps(over: Partial<Parameters<typeof PortalAccessSecurityCard>[0]> = {}) {
  return {
    hasPassword: false,
    newPassword: '',
    setNewPassword: setState as any,
    accessStartsAt: '',
    setAccessStartsAt: setState as any,
    accessEndsAt: '',
    setAccessEndsAt: setState as any,
    gracePeriodHours: '24',
    setGracePeriodHours: setState as any,
    setIsDirty: setState as any,
    ownerApprovalRequired: false,
    setOwnerApprovalRequired: setState as any,
    data: { config: { password_hash: null } } as any,
    handleTogglePassword: noop,
    guests: [],
    ...over,
  };
}

function designerCardProps(over: Partial<Parameters<typeof PortalDesignerCard>[0]> = {}): Parameters<typeof PortalDesignerCard>[0] {
  const base: Record<string, any> = {
    welcomeTitle: 'We Are Getting Married!',
    setWelcomeTitle: setState as any,
    tagline: 'Please join us.',
    setTagline: setState as any,
    customBrandColor: '#6B21A8',
    setCustomBrandColor: setState as any,
    enableSongRequests: false,
    setEnableSongRequests: setState as any,
    enableDietaryDetails: false,
    setEnableDietaryDetails: setState as any,
    enableLodgingChoices: false,
    setEnableLodgingChoices: setState as any,
    faqText: '',
    setFaqText: setState as any,
    transportationText: '',
    setTransportationText: setState as any,
    registryLinks: '',
    setRegistryLinks: setState as any,
    giftLinksText: '',
    setGiftLinksText: setState as any,
    cardsGiftTableLocation: '',
    setCardsGiftTableLocation: setState as any,
    registryGiftNote: '',
    setRegistryGiftNote: setState as any,
    venueAddress: '',
    setVenueAddress: setState as any,
    mapUrl: '',
    setMapUrl: setState as any,
    parkingEntrance: '',
    setParkingEntrance: setState as any,
    dropoffPoint: '',
    setDropoffPoint: setState as any,
    rideshareInstructions: '',
    setRideshareInstructions: setState as any,
    shuttleSchedule: '',
    setShuttleSchedule: setState as any,
    shuttlePickupLocation: '',
    setShuttlePickupLocation: setState as any,
    shuttleDropoffLocation: '',
    setShuttleDropoffLocation: setState as any,
    lastShuttleReminder: '',
    setLastShuttleReminder: setState as any,
    roomBlockDetails: '',
    setRoomBlockDetails: setState as any,
    accessibleParking: '',
    setAccessibleParking: setState as any,
    mobilityDropoff: '',
    setMobilityDropoff: setState as any,
    accessibleEntrance: '',
    setAccessibleEntrance: setState as any,
    accessibleRestroom: '',
    setAccessibleRestroom: setState as any,
    accessibleSeating: '',
    setAccessibleSeating: setState as any,
    accessibilityHelpText: '',
    setAccessibilityHelpText: setState as any,
    accessibilityContactLabel: 'venue accessibility contact',
    setAccessibilityContactLabel: setState as any,
    accessibilityContactEmail: '',
    setAccessibilityContactEmail: setState as any,
    accessibilityContactPhone: '',
    setAccessibilityContactPhone: setState as any,
    privacySummary: '',
    setPrivacySummary: setState as any,
    dataRetentionStatement: '',
    setDataRetentionStatement: setState as any,
    privacyContactLabel: 'venue/couple privacy contact',
    setPrivacyContactLabel: setState as any,
    privacyContactEmail: '',
    setPrivacyContactEmail: setState as any,
    privacyRequestsEnabled: true,
    setPrivacyRequestsEnabled: setState as any,
    reminderGuestFriendlyCopy: '',
    setReminderGuestFriendlyCopy: setState as any,
    defaultQuietHoursStart: '22:00',
    setDefaultQuietHoursStart: setState as any,
    defaultQuietHoursEnd: '08:00',
    setDefaultQuietHoursEnd: setState as any,
    rsvpReminderEnabled: false,
    setRsvpReminderEnabled: setState as any,
    scheduleReminderEnabled: false,
    setScheduleReminderEnabled: setState as any,
    rainPlanReminderEnabled: false,
    setRainPlanReminderEnabled: setState as any,
    shuttleReminderEnabled: false,
    setShuttleReminderEnabled: setState as any,
    dayBeforeReminderEnabled: false,
    setDayBeforeReminderEnabled: setState as any,
    dayOfReminderEnabled: false,
    setDayOfReminderEnabled: setState as any,
    dayOfModeEnabled: false,
    setDayOfModeEnabled: setState as any,
    dayOfModeTitle: '',
    setDayOfModeTitle: setState as any,
    dayOfContactLabel: '',
    setDayOfContactLabel: setState as any,
    dayOfContactEmail: '',
    setDayOfContactEmail: setState as any,
    dayOfContactPhone: '',
    setDayOfContactPhone: setState as any,
    dayOfPushCopy: '',
    setDayOfPushCopy: setState as any,
    guestMemoryEnabled: false,
    setGuestMemoryEnabled: setState as any,
    guestPhotoUploadEnabled: false,
    setGuestPhotoUploadEnabled: setState as any,
    guestPostEventFeedbackEnabled: false,
    setGuestPostEventFeedbackEnabled: setState as any,
    postEventThankYouTitle: '',
    setPostEventThankYouTitle: setState as any,
    postEventThankYouMessage: '',
    setPostEventThankYouMessage: setState as any,
    memoryPhotoLinksText: '',
    setMemoryPhotoLinksText: setState as any,
    guestPhotoConsentCopy: '',
    setGuestPhotoConsentCopy: setState as any,
    guestPhotoModerationCopy: '',
    setGuestPhotoModerationCopy: setState as any,
    guestNpsQuestion: '',
    setGuestNpsQuestion: setState as any,
    destinationTravelFaq: '',
    setDestinationTravelFaq: setState as any,
    weatherRainPlanNote: '',
    setWeatherRainPlanNote: setState as any,
    seatingPrivacyMode: 'couple',
    setSeatingPrivacyMode: setState as any,
    wayfindingLabelsText: '',
    setWayfindingLabelsText: setState as any,
    outdoorMapNote: '',
    setOutdoorMapNote: setState as any,
    indoorRainPlanMapNote: '',
    setIndoorRainPlanMapNote: setState as any,
    accessibilityRouteDetails: '',
    setAccessibilityRouteDetails: setState as any,
    arPreviewUrl: '',
    setArPreviewUrl: setState as any,
    arPreviewDescription: '',
    setArPreviewDescription: setState as any,
    dressCodeSummary: '',
    setDressCodeSummary: setState as any,
    dressCodeExamples: '',
    setDressCodeExamples: setState as any,
    dressCodeWeather: '',
    setDressCodeWeather: setState as any,
    dressCodeRainPlan: '',
    setDressCodeRainPlan: setState as any,
    kidsPolicy: '',
    setKidsPolicy: setState as any,
    plusOneRules: '',
    setPlusOneRules: setState as any,
    phonePhotoPolicy: '',
    setPhonePhotoPolicy: setState as any,
    smokingVapingPolicy: '',
    setSmokingVapingPolicy: setState as any,
    barAlcoholPolicy: '',
    setBarAlcoholPolicy: setState as any,
    guestFaqItemsText: '',
    setGuestFaqItemsText: setState as any,
    faqLanguagesText: '',
    setFaqLanguagesText: setState as any,
    guestQuestionsEnabled: false,
    setGuestQuestionsEnabled: setState as any,
    guestQuestionContactLabel: '',
    setGuestQuestionContactLabel: setState as any,
    guestQuestionContactEmail: '',
    setGuestQuestionContactEmail: setState as any,
    rsvpEditWindowDays: '7',
    setRsvpEditWindowDays: setState as any,
    mealOptionsText: '',
    setMealOptionsText: setState as any,
    rsvpTheme: 'classic_vintage',
    setRsvpTheme: setState as any,
    setIsDirty: setState as any,
    data: { config: {} } as any,
    guests: [],
  };
  return { ...base, ...over } as Parameters<typeof PortalDesignerCard>[0];
}

function subEventsProps(over: Partial<Parameters<typeof PortalSubEventsCard>[0]> = {}) {
  return {
    isLoading: false,
    subEvents: [],
    updateSubEventMutation: { mutate: noop } as any,
    ...over,
  };
}

function smsCardProps(over: Partial<Parameters<typeof PortalSmsRemindersCard>[0]> = {}) {
  return {
    enableSmsReminders: false,
    setEnableSmsReminders: setState as any,
    smsTemplate: '',
    setSmsTemplate: setState as any,
    setIsDirty: setState as any,
    guests: [],
    ...over,
  };
}

function phoneMockupProps(over: Partial<Parameters<typeof PortalPhoneMockup>[0]> = {}) {
  return {
    welcomeTitle: 'We Are Getting Married!',
    tagline: 'Please join us.',
    customBrandColor: '#6B21A8',
    enableSongRequests: false,
    enableDietaryDetails: false,
    enableLodgingChoices: false,
    rsvpTheme: 'classic_vintage',
    ...over,
  };
}

// ── PortalAccessCard ──────────────────────────────────────
describe('PortalAccessCard', () => {
  it('renders the enable toggle, shareable link, and visit action', () => {
    render(<PortalAccessCard {...accessCardProps()} />);
    expect(screen.getByText('Public Guest Portal')).toBeInTheDocument();
    expect(screen.getByText(/shareable link/i)).toBeInTheDocument();
    expect(screen.getByText('http://localhost:3000/#/portal/evt-1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy url/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /visit/i })).toBeInTheDocument();
  });

  it('reflects localEnabled in the toggle visual state', () => {
    const { container, rerender } = render(<PortalAccessCard {...accessCardProps({ localEnabled: true })} />);
    expect(container.querySelector('button[type="button"]')?.className).toContain('bg-emerald-600');
    rerender(<PortalAccessCard {...accessCardProps({ localEnabled: false })} />);
    expect(container.querySelector('button[type="button"]')?.className).toContain('bg-gray-200');
  });

  it('fires the enable toggle', () => {
    const handleToggleEnable = vi.fn();
    const { container } = render(<PortalAccessCard {...accessCardProps({ handleToggleEnable })} />);
    fireEvent.click(container.querySelector('button[type="button"]') as HTMLElement);
    expect(handleToggleEnable).toHaveBeenCalledTimes(1);
  });
});

// ── PortalAccessSecurityCard ──────────────────────────────
describe('PortalAccessSecurityCard', () => {
  it('renders access window fields and master password control', () => {
    render(<PortalAccessSecurityCard {...securityCardProps({ hasPassword: true })} />);
    expect(screen.getByText(/access & security/i)).toBeInTheDocument();
    expect(screen.getByText('Access starts')).toBeInTheDocument();
    expect(screen.getByText('Access ends')).toBeInTheDocument();
    expect(screen.getByDisplayValue('24')).toBeInTheDocument(); // grace hours
  });

  it('edits the grace hours field and marks the form dirty', async () => {
    const user = userEvent.setup();
    const setGracePeriodHours = vi.fn();
    const setIsDirty = vi.fn();
    render(<PortalAccessSecurityCard {...securityCardProps({ setGracePeriodHours: setGracePeriodHours as any, setIsDirty: setIsDirty as any })} />);
    const input = screen.getByDisplayValue('24') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, '48');
    expect(setGracePeriodHours).toHaveBeenCalled();
    expect(setIsDirty).toHaveBeenCalledWith(true);
  });

  it('shows the manager-safe portal changes toggle and fires it', async () => {
    const user = userEvent.setup();
    const setOwnerApprovalRequired = vi.fn();
    render(<PortalAccessSecurityCard {...securityCardProps({ setOwnerApprovalRequired: setOwnerApprovalRequired as any })} />);
    const checkbox = screen.getByLabelText(/manager-safe portal changes/i) as HTMLInputElement;
    await user.click(checkbox);
    expect(setOwnerApprovalRequired).toHaveBeenCalledWith(true);
  });
});

// ── PortalDesignerCard ────────────────────────────────────
describe('PortalDesignerCard', () => {
  it('renders the RSVP page designer with welcome title and brand color', () => {
    render(<PortalDesignerCard {...designerCardProps()} />);
    expect(screen.getByText(/invitation & rsvp page designer/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('We Are Getting Married!')).toBeInTheDocument();
    expect(screen.getByDisplayValue('#6B21A8')).toBeInTheDocument();
  });

  it('switches the A/B theme selector', async () => {
    const user = userEvent.setup();
    const setRsvpTheme = vi.fn();
    render(<PortalDesignerCard {...designerCardProps({ setRsvpTheme: setRsvpTheme as any })} />);
    const themeSelect = screen.getAllByRole('combobox').find((el) => (el as HTMLSelectElement).value === 'classic_vintage') as HTMLSelectElement;
    expect(themeSelect).toBeTruthy();
    await user.selectOptions(themeSelect, 'modern_minimalist');
    expect(setRsvpTheme).toHaveBeenCalledWith('modern_minimalist');
  });

  it('edits the welcome title and marks dirty', async () => {
    const user = userEvent.setup();
    const setWelcomeTitle = vi.fn();
    const setIsDirty = vi.fn();
    render(<PortalDesignerCard {...designerCardProps({ setWelcomeTitle: setWelcomeTitle as any, setIsDirty: setIsDirty as any })} />);
    const input = screen.getByDisplayValue('We Are Getting Married!');
    await user.clear(input);
    await user.type(input, 'Save the Date!');
    expect(setWelcomeTitle).toHaveBeenCalled();
    expect(setIsDirty).toHaveBeenCalledWith(true);
  });
});

// ── PortalSubEventsCard ───────────────────────────────────
describe('PortalSubEventsCard', () => {
  it('shows the empty state when there are no sub-events', () => {
    render(<PortalSubEventsCard {...subEventsProps()} />);
    expect(screen.getByText(/guest-facing sub-event details/i)).toBeInTheDocument();
    expect(screen.getByText(/no sub-events created yet/i)).toBeInTheDocument();
  });

  it('renders a sub-event row when present', () => {
    render(<PortalSubEventsCard {...subEventsProps({
      subEvents: [{ id: 's1', title: 'Rehearsal Dinner', starts_at: '2026-09-11T18:00:00', ends_at: null, venue_id: null, invite_only: 0, metadata: '{}', created_at: '2026-01-01' }] as any,
    })} />);
    // appears in the card description AND the sub-event row title
    expect(screen.getAllByText(/rehearsal dinner/i).length).toBeGreaterThanOrEqual(2);
  });
});

// ── PortalSmsRemindersCard ────────────────────────────────
describe('PortalSmsRemindersCard', () => {
  it('renders the SMS reminder toggle and template area', async () => {
    const user = userEvent.setup();
    const setEnableSmsReminders = vi.fn();
    const setIsDirty = vi.fn();
    render(<PortalSmsRemindersCard {...smsCardProps({ setEnableSmsReminders: setEnableSmsReminders as any, setIsDirty: setIsDirty as any })} />);
    expect(screen.getByText(/automated low-velocity sms reminders/i)).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: /automated low-velocity sms reminders/i });
    await user.click(toggle);
    expect(setEnableSmsReminders).toHaveBeenCalledWith(true);
  });
});

// ── PortalPhoneMockup ─────────────────────────────────────
describe('PortalPhoneMockup', () => {
  it('renders the live mobile preview with the welcome title and RSVP form', () => {
    render(<PortalPhoneMockup {...phoneMockupProps()} />);
    expect(screen.getByText(/live mobile rsvp preview/i)).toBeInTheDocument();
    expect(screen.getByText('We Are Getting Married!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit rsvp/i })).toBeInTheDocument();
  });

  it('applies the custom brand color to the preview', () => {
    render(<PortalPhoneMockup {...phoneMockupProps({ customBrandColor: '#123456' })} />);
    const color = document.querySelector('[style*="123456"]');
    expect(color).not.toBeNull();
  });
});

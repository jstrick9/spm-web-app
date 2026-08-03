import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings,
  CalendarDays,
  Globe,
  Lock,
  Key,
  Link as LinkIcon,
  Save,
  ExternalLink,
  Heart,
  Sparkles,
  MessageSquare,
  CheckSquare,
  Palette,
  ShieldCheck,
  AlertTriangle,
  Smartphone,
  Mail,
  Inbox,
  Accessibility,
  ClipboardList,
} from "lucide-react";
import { sdk } from "../../../sdk";
import { Button } from "../../../ui/Button";
import { Badge } from "../../../ui/Badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../../ui/Card";
import { Input } from "../../../ui/Input";
import { Label } from "../../../ui/Label";
import { useToast } from "../../../ui/Toast";
import { Skeleton } from "../../../ui/Skeleton";
import { cn } from "../../../ui/lib/cn";

import { PortalAccessCard } from './portalSections/PortalAccessCard';
import { PortalAccessSecurityCard } from './portalSections/PortalAccessSecurityCard';
import { PortalDesignerCard } from './portalSections/PortalDesignerCard';
import { PortalSubEventsCard } from './portalSections/PortalSubEventsCard';
import { PortalSmsRemindersCard } from './portalSections/PortalSmsRemindersCard';
import { PortalPhoneMockup } from './portalSections/PortalPhoneMockup';

interface Props {
  eventId: string;
}


// Decomposed panels (see portalSettingsPanels.tsx).
import { ManagerPortalQaPanel } from './portalSettingsPanels';

export function GuestPortalSettingsTab({ eventId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [localEnabled, setLocalEnabled] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [accessStartsAt, setAccessStartsAt] = useState("");
  const [accessEndsAt, setAccessEndsAt] = useState("");
  const [gracePeriodHours, setGracePeriodHours] = useState("24");

  // Custom RSVP Page Customization States (Phase 6 + Part 3 Extensions)
  const [welcomeTitle, setWelcomeTitle] = useState("We Are Getting Married!");
  const [tagline, setTagline] = useState("Please join us on our special day.");
  const [customBrandColor, setCustomBrandColor] = useState("#6B21A8");
  const [enableSongRequests, setEnableSongRequests] = useState(false);
  const [enableDietaryDetails, setEnableDietaryDetails] = useState(false);
  const [enableLodgingChoices, setEnableLodgingChoices] = useState(false);
  const [faqText, setFaqText] = useState(
    "What should I wear?\nPlease dress for the venue and weather.",
  );
  const [transportationText, setTransportationText] = useState(
    "Shuttle and parking details will be posted here.",
  );
  const [registryLinks, setRegistryLinks] = useState("");
  const [giftLinksText, setGiftLinksText] = useState("registry|Main registry|https://registry.example.com|Registry details\nhoneymoon|Honeymoon fund|https://fund.example.com|Optional travel fund\ncharity|Charity donation|https://charity.example.org|Optional charitable gift");
  const [cardsGiftTableLocation, setCardsGiftTableLocation] = useState("");
  const [registryGiftNote, setRegistryGiftNote] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [parkingEntrance, setParkingEntrance] = useState("");
  const [dropoffPoint, setDropoffPoint] = useState("");
  const [rideshareInstructions, setRideshareInstructions] = useState("");
  const [shuttleSchedule, setShuttleSchedule] = useState("");
  const [shuttlePickupLocation, setShuttlePickupLocation] = useState("");
  const [shuttleDropoffLocation, setShuttleDropoffLocation] = useState("");
  const [lastShuttleReminder, setLastShuttleReminder] = useState("");
  const [roomBlockDetails, setRoomBlockDetails] = useState("");
  const [accessibleParking, setAccessibleParking] = useState("");
  const [mobilityDropoff, setMobilityDropoff] = useState("");
  const [accessibleEntrance, setAccessibleEntrance] = useState("");
  const [accessibleRestroom, setAccessibleRestroom] = useState("");
  const [accessibleSeating, setAccessibleSeating] = useState("");
  const [accessibilityHelpText, setAccessibilityHelpText] = useState("");
  const [accessibilityContactLabel, setAccessibilityContactLabel] = useState("venue accessibility contact");
  const [accessibilityContactEmail, setAccessibilityContactEmail] = useState("");
  const [accessibilityContactPhone, setAccessibilityContactPhone] = useState("");
  const [privacySummary, setPrivacySummary] = useState("");
  const [dataRetentionStatement, setDataRetentionStatement] = useState("");
  const [privacyContactLabel, setPrivacyContactLabel] = useState("venue/couple privacy contact");
  const [privacyContactEmail, setPrivacyContactEmail] = useState("");
  const [privacyRequestsEnabled, setPrivacyRequestsEnabled] = useState(true);
  const [reminderGuestFriendlyCopy, setReminderGuestFriendlyCopy] = useState("");
  const [defaultQuietHoursStart, setDefaultQuietHoursStart] = useState("21:00");
  const [defaultQuietHoursEnd, setDefaultQuietHoursEnd] = useState("08:00");
  const [rsvpReminderEnabled, setRsvpReminderEnabled] = useState(true);
  const [scheduleReminderEnabled, setScheduleReminderEnabled] = useState(true);
  const [rainPlanReminderEnabled, setRainPlanReminderEnabled] = useState(true);
  const [shuttleReminderEnabled, setShuttleReminderEnabled] = useState(true);
  const [dayBeforeReminderEnabled, setDayBeforeReminderEnabled] = useState(true);
  const [dayOfReminderEnabled, setDayOfReminderEnabled] = useState(true);
  const [dayOfModeEnabled, setDayOfModeEnabled] = useState(true);
  const [dayOfModeTitle, setDayOfModeTitle] = useState("Wedding day quick card");
  const [dayOfContactLabel, setDayOfContactLabel] = useState("venue/couple team");
  const [dayOfContactEmail, setDayOfContactEmail] = useState("");
  const [dayOfContactPhone, setDayOfContactPhone] = useState("");
  const [dayOfPushCopy, setDayOfPushCopy] = useState("");
  const [guestMemoryEnabled, setGuestMemoryEnabled] = useState(true);
  const [guestPhotoUploadEnabled, setGuestPhotoUploadEnabled] = useState(true);
  const [guestPostEventFeedbackEnabled, setGuestPostEventFeedbackEnabled] = useState(true);
  const [postEventThankYouTitle, setPostEventThankYouTitle] = useState("Thank you for celebrating with us");
  const [postEventThankYouMessage, setPostEventThankYouMessage] = useState("");
  const [memoryPhotoLinksText, setMemoryPhotoLinksText] = useState("gallery|Photo gallery|https://gallery.example.com|Official gallery\nmemories|Memory sharing|https://photos.example.com|Share guest photos");
  const [guestPhotoConsentCopy, setGuestPhotoConsentCopy] = useState("");
  const [guestPhotoModerationCopy, setGuestPhotoModerationCopy] = useState("");
  const [guestNpsQuestion, setGuestNpsQuestion] = useState("How likely are you to recommend this venue guest experience to another guest?");
  const [destinationTravelFaq, setDestinationTravelFaq] = useState("");
  const [weatherRainPlanNote, setWeatherRainPlanNote] = useState("");
  const [seatingPrivacyMode, setSeatingPrivacyMode] = useState("full_chart");
  const [wayfindingLabelsText, setWayfindingLabelsText] = useState("parking|Guest parking|Follow signs to the guest lot\nentrance|Main guest entrance|Enter through the front garden gate\nrestroom|Restrooms|Inside reception hall near the bar\nada_route|ADA route|Use the paved path from accessible parking");
  const [outdoorMapNote, setOutdoorMapNote] = useState("");
  const [indoorRainPlanMapNote, setIndoorRainPlanMapNote] = useState("");
  const [accessibilityRouteDetails, setAccessibilityRouteDetails] = useState("");
  const [arPreviewUrl, setArPreviewUrl] = useState("");
  const [arPreviewDescription, setArPreviewDescription] = useState("");
  const [dressCodeSummary, setDressCodeSummary] = useState("");
  const [dressCodeExamples, setDressCodeExamples] = useState("");
  const [dressCodeWeather, setDressCodeWeather] = useState("");
  const [dressCodeRainPlan, setDressCodeRainPlan] = useState("");
  const [kidsPolicy, setKidsPolicy] = useState("");
  const [plusOneRules, setPlusOneRules] = useState("");
  const [phonePhotoPolicy, setPhonePhotoPolicy] = useState("");
  const [smokingVapingPolicy, setSmokingVapingPolicy] = useState("");
  const [barAlcoholPolicy, setBarAlcoholPolicy] = useState("");
  const [guestFaqItemsText, setGuestFaqItemsText] = useState("Dress code|What should I wear?|Please follow the dress code shared on your invitation.\nArrival|When should I arrive?|Please arrive early enough to be seated before the ceremony starts.");
  const [faqLanguagesText, setFaqLanguagesText] = useState("es|Español\nfr|Français");
  const [guestQuestionsEnabled, setGuestQuestionsEnabled] = useState(true);
  const [guestQuestionContactLabel, setGuestQuestionContactLabel] = useState("venue/couple team");
  const [guestQuestionContactEmail, setGuestQuestionContactEmail] = useState("");
  const [rsvpEditWindowDays, setRsvpEditWindowDays] = useState("7");
  const [mealOptionsText, setMealOptionsText] = useState("standard|Standard entrée|Venue default\nvegetarian|Vegetarian entrée|No meat or fish\nvegan|Vegan entrée|No animal products\ngluten_free|Gluten-free entrée|Gluten-sensitive option\nnut_free|Nut-free meal|Avoid nuts where possible\nkids_meal|Kids meal|Child-friendly portion");

  // Brand New A/B Theme & SMS Reminders (Part 3)
  const [rsvpTheme, setRsvpTheme] = useState("classic_vintage");
  const [enableSmsReminders, setEnableSmsReminders] = useState(false);
  const [smsTemplate, setSmsTemplate] = useState(
    "Hi {{guest_name}}, this is a quick reminder that RSVPs for our wedding are due on {{rsvp_deadline}}! Please submit yours at: {{portal_link}}",
  );

  const [isDirty, setIsDirty] = useState(false);
  const [ownerApprovalRequired, setOwnerApprovalRequired] = useState(true);
  const [pendingPortalChange, setPendingPortalChange] = useState("");
  const [supportMessage, setSupportMessage] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["portalConfig", eventId],
    queryFn: () => sdk.guests.getPortalConfig(eventId),
  });

  const guestsQuery = useQuery({
    queryKey: ["guests", eventId, "portal-qa"],
    queryFn: () => sdk.guests.list(eventId),
    staleTime: 30_000,
  });

  const rsvpsQuery = useQuery({
    queryKey: ["rsvps", eventId, "portal-qa"],
    queryFn: () => sdk.rsvps.list(eventId),
    staleTime: 30_000,
  });


  const subEventsQuery = useQuery({
    queryKey: ["sub-events", eventId, "guest-metadata"],
    queryFn: () => sdk.events.listSubEvents(eventId),
    staleTime: 30_000,
  });
  const subEvents = (subEventsQuery.data as any)?.subEvents ?? [];
  const updateSubEventMutation = useMutation({
    mutationFn: ({ id, metadata }: { id: string; metadata: Record<string, unknown> }) => sdk.events.updateSubEvent(id, { metadata }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sub-events", eventId, "guest-metadata"] }); toast({ title: "Sub-event guest details saved", variant: "success" }); },
    onError: (e: any) => toast({ title: "Could not save sub-event details", description: e.message, variant: "destructive" }),
  });

  // Initialize state once loaded
  useEffect(() => {
    if (data && data.config) {
      setLocalEnabled(data.config.enabled === 1);
      setHasPassword(!!data.config.password_hash);
      setAccessStartsAt(
        (data.config as any).access_starts_at?.slice?.(0, 16) || "",
      );
      setAccessEndsAt(
        (data.config as any).access_ends_at?.slice?.(0, 16) || "",
      );
      setGracePeriodHours(
        String((data.config as any).grace_period_hours ?? 24),
      );

      const parsedConfig =
        typeof data.config.config === "string"
          ? JSON.parse(data.config.config || "{}")
          : data.config.config || {};

      setWelcomeTitle(parsedConfig.welcomeTitle || "We Are Getting Married!");
      setTagline(parsedConfig.tagline || "Please join us on our special day.");
      setCustomBrandColor(parsedConfig.brandColor || "#6B21A8");
      setEnableSongRequests(!!parsedConfig.enableSongRequests);
      setEnableDietaryDetails(!!parsedConfig.enableDietaryDetails);
      setEnableLodgingChoices(!!parsedConfig.enableLodgingChoices);
      setFaqText(
        parsedConfig.faqText ||
          "What should I wear?\nPlease dress for the venue and weather.",
      );
      setTransportationText(
        parsedConfig.transportationText ||
          "Shuttle and parking details will be posted here.",
      );
      setRegistryLinks(parsedConfig.registryLinks || "");
      setGiftLinksText(Array.isArray(parsedConfig.giftLinks) ? parsedConfig.giftLinks.map((link: any) => `${link.type || "registry"}|${link.label || ""}|${link.url || ""}|${link.description || ""}`).join("\n") : "registry|Main registry|https://registry.example.com|Registry details\nhoneymoon|Honeymoon fund|https://fund.example.com|Optional travel fund\ncharity|Charity donation|https://charity.example.org|Optional charitable gift");
      setCardsGiftTableLocation(parsedConfig.cardsGiftTableLocation || "");
      setRegistryGiftNote(parsedConfig.registryGiftNote || "");
      setVenueAddress(parsedConfig.venueAddress || "");
      setMapUrl(parsedConfig.mapUrl || "");
      setParkingEntrance(parsedConfig.parkingEntrance || "");
      setDropoffPoint(parsedConfig.dropoffPoint || "");
      setRideshareInstructions(parsedConfig.rideshareInstructions || "");
      setShuttleSchedule(parsedConfig.shuttleSchedule || "");
      setShuttlePickupLocation(parsedConfig.shuttlePickupLocation || "");
      setShuttleDropoffLocation(parsedConfig.shuttleDropoffLocation || "");
      setLastShuttleReminder(parsedConfig.lastShuttleReminder || "");
      setRoomBlockDetails(parsedConfig.roomBlockDetails || "");
      setAccessibleParking(parsedConfig.accessibleParking || "");
      setMobilityDropoff(parsedConfig.mobilityDropoff || "");
      setAccessibleEntrance(parsedConfig.accessibleEntrance || "");
      setAccessibleRestroom(parsedConfig.accessibleRestroom || "");
      setAccessibleSeating(parsedConfig.accessibleSeating || "");
      setAccessibilityHelpText(parsedConfig.accessibilityHelpText || "");
      setAccessibilityContactLabel(parsedConfig.accessibilityContactLabel || "venue accessibility contact");
      setAccessibilityContactEmail(parsedConfig.accessibilityContactEmail || "");
      setAccessibilityContactPhone(parsedConfig.accessibilityContactPhone || "");
      setPrivacySummary(parsedConfig.privacySummary || "");
      setDataRetentionStatement(parsedConfig.dataRetentionStatement || "");
      setPrivacyContactLabel(parsedConfig.privacyContactLabel || "venue/couple privacy contact");
      setPrivacyContactEmail(parsedConfig.privacyContactEmail || "");
      setPrivacyRequestsEnabled(parsedConfig.privacyRequestsEnabled !== false);
      setReminderGuestFriendlyCopy(parsedConfig.reminderGuestFriendlyCopy || "");
      setDefaultQuietHoursStart(parsedConfig.defaultQuietHoursStart || "21:00");
      setDefaultQuietHoursEnd(parsedConfig.defaultQuietHoursEnd || "08:00");
      setRsvpReminderEnabled(parsedConfig.rsvpReminderEnabled !== false);
      setScheduleReminderEnabled(parsedConfig.scheduleReminderEnabled !== false);
      setRainPlanReminderEnabled(parsedConfig.rainPlanReminderEnabled !== false);
      setShuttleReminderEnabled(parsedConfig.shuttleReminderEnabled !== false);
      setDayBeforeReminderEnabled(parsedConfig.dayBeforeReminderEnabled !== false);
      setDayOfReminderEnabled(parsedConfig.dayOfReminderEnabled !== false);
      setDayOfModeEnabled(parsedConfig.dayOfModeEnabled !== false);
      setDayOfModeTitle(parsedConfig.dayOfModeTitle || "Wedding day quick card");
      setDayOfContactLabel(parsedConfig.dayOfContactLabel || "venue/couple team");
      setDayOfContactEmail(parsedConfig.dayOfContactEmail || "");
      setDayOfContactPhone(parsedConfig.dayOfContactPhone || "");
      setDayOfPushCopy(parsedConfig.dayOfPushCopy || "");
      setGuestMemoryEnabled(parsedConfig.guestMemoryEnabled !== false);
      setGuestPhotoUploadEnabled(parsedConfig.guestPhotoUploadEnabled !== false);
      setGuestPostEventFeedbackEnabled(parsedConfig.guestPostEventFeedbackEnabled !== false);
      setPostEventThankYouTitle(parsedConfig.postEventThankYouTitle || "Thank you for celebrating with us");
      setPostEventThankYouMessage(parsedConfig.postEventThankYouMessage || "");
      setMemoryPhotoLinksText(Array.isArray(parsedConfig.memoryPhotoLinks) ? parsedConfig.memoryPhotoLinks.map((link: any) => `${link.id || "link"}|${link.label || ""}|${link.url || ""}|${link.description || ""}`).join("\n") : "gallery|Photo gallery|https://gallery.example.com|Official gallery\nmemories|Memory sharing|https://photos.example.com|Share guest photos");
      setGuestPhotoConsentCopy(parsedConfig.guestPhotoConsentCopy || "");
      setGuestPhotoModerationCopy(parsedConfig.guestPhotoModerationCopy || "");
      setGuestNpsQuestion(parsedConfig.guestNpsQuestion || "How likely are you to recommend this venue guest experience to another guest?");
      setDestinationTravelFaq(parsedConfig.destinationTravelFaq || "");
      setWeatherRainPlanNote(parsedConfig.weatherRainPlanNote || "");
      setSeatingPrivacyMode(parsedConfig.seatingPrivacyMode || (parsedConfig.showOnlyPersonalSeat ? "personal_only" : "full_chart"));
      setWayfindingLabelsText(Array.isArray(parsedConfig.guestWayfindingLabels) ? parsedConfig.guestWayfindingLabels.map((label: any) => `${label.type || label.key || label.id}|${label.label || ""}|${label.details || ""}`).join("\n") : "parking|Guest parking|Follow signs to the guest lot\nentrance|Main guest entrance|Enter through the front garden gate\nrestroom|Restrooms|Inside reception hall near the bar\nada_route|ADA route|Use the paved path from accessible parking");
      setOutdoorMapNote(parsedConfig.outdoorMapNote || "");
      setIndoorRainPlanMapNote(parsedConfig.indoorRainPlanMapNote || "");
      setAccessibilityRouteDetails(parsedConfig.accessibilityRouteDetails || "");
      setArPreviewUrl(parsedConfig.arPreviewUrl || "");
      setArPreviewDescription(parsedConfig.arPreviewDescription || "");
      setDressCodeSummary(parsedConfig.dressCodeSummary || parsedConfig.dressCode || "");
      setDressCodeExamples(parsedConfig.dressCodeExamples || "");
      setDressCodeWeather(parsedConfig.dressCodeWeather || "");
      setDressCodeRainPlan(parsedConfig.dressCodeRainPlan || "");
      setKidsPolicy(parsedConfig.kidsPolicy || "");
      setPlusOneRules(parsedConfig.plusOneRules || "");
      setPhonePhotoPolicy(parsedConfig.phonePhotoPolicy || "");
      setSmokingVapingPolicy(parsedConfig.smokingVapingPolicy || "");
      setBarAlcoholPolicy(parsedConfig.barAlcoholPolicy || "");
      setGuestFaqItemsText(Array.isArray(parsedConfig.guestFaqItems) ? parsedConfig.guestFaqItems.map((item: any) => `${item.category || "General"}|${item.question || ""}|${item.answer || ""}`).join("\n") : "Dress code|What should I wear?|Please follow the dress code shared on your invitation.\nArrival|When should I arrive?|Please arrive early enough to be seated before the ceremony starts.");
      setFaqLanguagesText(Array.isArray(parsedConfig.faqLanguages) ? parsedConfig.faqLanguages.map((lang: any) => `${lang.code}|${lang.label}`).join("\n") : "es|Español\nfr|Français");
      setGuestQuestionsEnabled(parsedConfig.guestQuestionsEnabled !== false);
      setGuestQuestionContactLabel(parsedConfig.guestQuestionContactLabel || "venue/couple team");
      setGuestQuestionContactEmail(parsedConfig.guestQuestionContactEmail || "");
      setRsvpEditWindowDays(String(parsedConfig.rsvpEditWindowDays ?? 7));
      setMealOptionsText(Array.isArray(parsedConfig.mealOptions) ? parsedConfig.mealOptions.map((option: any) => `${option.id}|${option.label}|${option.description || ""}`).join("\n") : "standard|Standard entrée|Venue default\nvegetarian|Vegetarian entrée|No meat or fish\nvegan|Vegan entrée|No animal products\ngluten_free|Gluten-free entrée|Gluten-sensitive option\nnut_free|Nut-free meal|Avoid nuts where possible\nkids_meal|Kids meal|Child-friendly portion");

      setRsvpTheme(parsedConfig.rsvpTheme || "classic_vintage");
      setEnableSmsReminders(!!parsedConfig.enableSmsReminders);
      setSmsTemplate(
        parsedConfig.smsTemplate ||
          "Hi {{guest_name}}, this is a quick reminder that RSVPs for our wedding are due on {{rsvp_deadline}}! Please submit yours at: {{portal_link}}",
      );
      setOwnerApprovalRequired(parsedConfig.ownerApprovalRequired !== false);
      setPendingPortalChange(
        parsedConfig.portalChangeApproval?.status === "pending"
          ? parsedConfig.portalChangeApproval?.request || ""
          : "",
      );

      setIsDirty(false);
      setNewPassword("");
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload: any = {
        enabled: localEnabled,
        config: {
          welcomeTitle,
          tagline,
          brandColor: customBrandColor,
          enableSongRequests,
          enableDietaryDetails,
          enableLodgingChoices,
          faqText,
          transportationText,
          venueAddress,
          mapUrl,
          parkingEntrance,
          dropoffPoint,
          rideshareInstructions,
          shuttleSchedule,
          shuttlePickupLocation,
          shuttleDropoffLocation,
          lastShuttleReminder,
          roomBlockDetails,
          accessibleParking,
          mobilityDropoff,
          accessibleEntrance,
          accessibleRestroom,
          accessibleSeating,
          accessibilityHelpText,
          accessibilityContactLabel,
          accessibilityContactEmail,
          accessibilityContactPhone,
          privacySummary,
          dataRetentionStatement,
          privacyContactLabel,
          privacyContactEmail,
          privacyRequestsEnabled,
          reminderGuestFriendlyCopy,
          defaultQuietHoursStart,
          defaultQuietHoursEnd,
          rsvpReminderEnabled,
          scheduleReminderEnabled,
          rainPlanReminderEnabled,
          shuttleReminderEnabled,
          dayBeforeReminderEnabled,
          dayOfReminderEnabled,
          dayOfModeEnabled,
          dayOfModeTitle,
          dayOfContactLabel,
          dayOfContactEmail,
          dayOfContactPhone,
          dayOfPushCopy,
          guestMemoryEnabled,
          guestPhotoUploadEnabled,
          guestPostEventFeedbackEnabled,
          postEventThankYouTitle,
          postEventThankYouMessage,
          memoryPhotoLinks: memoryPhotoLinksText.split("\n").map((line) => { const [id, label, url, description] = line.split("|").map((part) => part?.trim()); return id && label && url ? { id, label, url, description: description || "" } : null; }).filter(Boolean),
          guestPhotoConsentCopy,
          guestPhotoModerationCopy,
          guestNpsQuestion,
          destinationTravelFaq,
          weatherRainPlanNote,
          seatingPrivacyMode,
          showOnlyPersonalSeat: seatingPrivacyMode === "personal_only",
          guestWayfindingLabels: wayfindingLabelsText.split("\n").map((line) => { const [type, label, details] = line.split("|").map((part) => part?.trim()); return type && label ? { id: type, type, label, details: details || "" } : null; }).filter(Boolean),
          outdoorMapNote,
          indoorRainPlanMapNote,
          accessibilityRouteDetails,
          arPreviewUrl,
          arPreviewDescription,
          dressCodeSummary,
          dressCodeExamples,
          dressCodeWeather,
          dressCodeRainPlan,
          kidsPolicy,
          plusOneRules,
          phonePhotoPolicy,
          smokingVapingPolicy,
          barAlcoholPolicy,
          guestFaqItems: guestFaqItemsText.split("\n").map((line) => { const [category, question, answer] = line.split("|").map((part) => part?.trim()); return category && question ? { id: `${category}-${question}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"), category, question, answer: answer || "" } : null; }).filter(Boolean),
          faqLanguages: faqLanguagesText.split("\n").map((line) => { const [code, label] = line.split("|").map((part) => part?.trim()); return code && label ? { code, label } : null; }).filter(Boolean),
          guestQuestionsEnabled,
          guestQuestionContactLabel,
          guestQuestionContactEmail,
          registryLinks,
          giftLinks: giftLinksText.split("\n").map((line) => { const [type, label, url, description] = line.split("|").map((part) => part?.trim()); return type && label && url ? { id: `${type}-${label}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"), type, label, url, description: description || "" } : null; }).filter(Boolean),
          cardsGiftTableLocation,
          registryGiftNote,
          mealOptions: mealOptionsText.split("\n").map((line) => { const [id, label, description] = line.split("|").map((part) => part?.trim()); return id && label ? { id, label, description: description || "" } : null; }).filter(Boolean),
          rsvpEditWindowDays: Number(rsvpEditWindowDays) || 0,
          rsvpTheme,
          enableSmsReminders,
          smsTemplate,
          ownerApprovalRequired,
          portalChangeApproval: pendingPortalChange
            ? {
                status: "pending",
                request: pendingPortalChange,
                requestedAt: new Date().toISOString(),
                requestedBy: "manager",
              }
            : undefined,
        },
      };
      if (accessStartsAt) payload.accessStartsAt = accessStartsAt;
      if (accessEndsAt) payload.accessEndsAt = accessEndsAt;
      payload.gracePeriodHours = Number(gracePeriodHours) || 0;
      if (newPassword) payload.password = newPassword;
      else if (!hasPassword) payload.clearPassword = true;
      return sdk.guests.updatePortalConfig(eventId, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portalConfig", eventId] });
      toast({
        title: "Portal settings saved successfully",
        variant: "success",
      });
      setIsDirty(false);
      setNewPassword("");
    },
    onError: (e: any) => {
      toast({
        title: "Failed to save settings",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  const handleToggleEnable = () => {
    const managerMode = (() => { try { return localStorage.getItem('wvi_registration_role') === 'venue_manager'; } catch { return false; } })();
    if (managerMode && !window.confirm('Confirm sensitive portal change. Portal enablement/access changes can affect guests and require owner/admin visibility. Continue?')) return;
    if (!localEnabled && ownerApprovalRequired) {
      setPendingPortalChange("Enable guest portal");
      setIsDirty(true);
      toast({
        title: "Owner approval requested",
        description:
          "Portal enablement is staged for owner/admin approval before guests can access it.",
      });
      return;
    }
    setLocalEnabled(!localEnabled);
    setIsDirty(true);
  };

  const handleTogglePassword = () => {
    setHasPassword(!hasPassword);
    if (hasPassword) setNewPassword(""); // clearing
    setIsDirty(true);
  };

  const portalUrl = `${window.location.origin}/#/portal/${eventId}`;
  const guests = guestsQuery.data?.guests ?? [];
  const pendingGuests = guests.filter(
    (guest) => guest.rsvp_status === "pending",
  );
  const lockedOutGuests = guests.filter(
    (guest) => guest.allow_portal_access !== 1,
  );
  const rsvps = rsvpsQuery.data?.rsvps ?? [];
  const parsedAccessEnd = accessEndsAt ? new Date(accessEndsAt) : null;
  const parsedAccessStart = accessStartsAt ? new Date(accessStartsAt) : null;
  const accessExpired = Boolean(
    parsedAccessEnd && parsedAccessEnd.getTime() < Date.now(),
  );
  const accessNotStarted = Boolean(
    parsedAccessStart && parsedAccessStart.getTime() > Date.now(),
  );
  const portalIssues = [
    !localEnabled ? "Portal is not enabled." : null,
    hasPassword && !newPassword && !data?.config?.password_hash
      ? "Password is toggled on but no password is set."
      : null,
    !hasPassword
      ? "No master password is required. Confirm this is intentional before sharing."
      : null,
    accessExpired ? "Access window has expired." : null,
    accessNotStarted ? "Access window has not started yet." : null,
    lockedOutGuests.length
      ? `${lockedOutGuests.length} guest${lockedOutGuests.length === 1 ? "" : "s"} do not have portal access.`
      : null,
    pendingGuests.length
      ? `${pendingGuests.length} pending RSVP${pendingGuests.length === 1 ? "" : "s"} remain.`
      : null,
  ].filter(Boolean) as string[];
  const qaChecks = [
    {
      label: "Portal enabled or owner approval requested",
      done: localEnabled || Boolean(pendingPortalChange),
    },
    {
      label: "Access window reviewed",
      done: Boolean(accessStartsAt || accessEndsAt) && !accessExpired,
    },
    {
      label: "Password policy reviewed",
      done: hasPassword || !ownerApprovalRequired,
    },
    {
      label: "Welcome title and tagline complete",
      done: Boolean(welcomeTitle.trim() && tagline.trim()),
    },
    {
      label: "FAQ and transportation content complete",
      done: Boolean(faqText.trim() && transportationText.trim()),
    },
    {
      label: "Accessibility/lodging needs represented",
      done:
        enableDietaryDetails ||
        enableLodgingChoices ||
        guests.some((guest) => guest.accessibility_notes),
    },
    { label: "Test RSVP performed", done: rsvps.length > 0 },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <Card className="border-brand/30 bg-brand-soft/10">
        <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-brand flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Guest Portal Setup Wizard
            </h2>
            <p className="text-xs text-fg-muted mt-1">
              1) Enable portal, 2) choose access window/password, 3) add
              FAQ/transport/lodging/registry details, 4) test as a guest before
              sharing.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={localEnabled ? "success" : "warning"}>
              {localEnabled ? "Enabled" : "Disabled"}
            </Badge>
            <a href={portalUrl} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline">
                Test as guest
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      <ManagerPortalQaPanel
        qaChecks={qaChecks}
        issues={portalIssues}
        pendingGuests={pendingGuests.length}
        lockedOutGuests={lockedOutGuests.length}
        accessExpired={accessExpired}
        hasPassword={hasPassword}
        ownerApprovalRequired={ownerApprovalRequired}
        setOwnerApprovalRequired={(value) => {
          setOwnerApprovalRequired(value);
          setIsDirty(true);
        }}
        pendingPortalChange={pendingPortalChange}
        setPendingPortalChange={(value) => {
          setPendingPortalChange(value);
          setIsDirty(true);
        }}
        portalUrl={portalUrl}
        supportMessage={supportMessage}
        setSupportMessage={setSupportMessage}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Config Panel */}
        <div className="space-y-6">
          <PortalAccessCard localEnabled={localEnabled} toast={toast} handleToggleEnable={handleToggleEnable} portalUrl={portalUrl} guests={guests} />

          <PortalAccessSecurityCard hasPassword={hasPassword} newPassword={newPassword} setNewPassword={setNewPassword} accessStartsAt={accessStartsAt} setAccessStartsAt={setAccessStartsAt} accessEndsAt={accessEndsAt} setAccessEndsAt={setAccessEndsAt} gracePeriodHours={gracePeriodHours} setGracePeriodHours={setGracePeriodHours} setIsDirty={setIsDirty} ownerApprovalRequired={ownerApprovalRequired} setOwnerApprovalRequired={setOwnerApprovalRequired} data={data} handleTogglePassword={handleTogglePassword} guests={guests} />

          {/* Invitation & RSVP Page Designer */}
          <PortalDesignerCard welcomeTitle={welcomeTitle} setWelcomeTitle={setWelcomeTitle} tagline={tagline} setTagline={setTagline} customBrandColor={customBrandColor} setCustomBrandColor={setCustomBrandColor} enableSongRequests={enableSongRequests} setEnableSongRequests={setEnableSongRequests} enableDietaryDetails={enableDietaryDetails} setEnableDietaryDetails={setEnableDietaryDetails} enableLodgingChoices={enableLodgingChoices} setEnableLodgingChoices={setEnableLodgingChoices} faqText={faqText} setFaqText={setFaqText} transportationText={transportationText} setTransportationText={setTransportationText} registryLinks={registryLinks} setRegistryLinks={setRegistryLinks} giftLinksText={giftLinksText} setGiftLinksText={setGiftLinksText} cardsGiftTableLocation={cardsGiftTableLocation} setCardsGiftTableLocation={setCardsGiftTableLocation} registryGiftNote={registryGiftNote} setRegistryGiftNote={setRegistryGiftNote} venueAddress={venueAddress} setVenueAddress={setVenueAddress} mapUrl={mapUrl} setMapUrl={setMapUrl} parkingEntrance={parkingEntrance} setParkingEntrance={setParkingEntrance} dropoffPoint={dropoffPoint} setDropoffPoint={setDropoffPoint} rideshareInstructions={rideshareInstructions} setRideshareInstructions={setRideshareInstructions} shuttleSchedule={shuttleSchedule} setShuttleSchedule={setShuttleSchedule} shuttlePickupLocation={shuttlePickupLocation} setShuttlePickupLocation={setShuttlePickupLocation} shuttleDropoffLocation={shuttleDropoffLocation} setShuttleDropoffLocation={setShuttleDropoffLocation} lastShuttleReminder={lastShuttleReminder} setLastShuttleReminder={setLastShuttleReminder} roomBlockDetails={roomBlockDetails} setRoomBlockDetails={setRoomBlockDetails} accessibleParking={accessibleParking} setAccessibleParking={setAccessibleParking} mobilityDropoff={mobilityDropoff} setMobilityDropoff={setMobilityDropoff} accessibleEntrance={accessibleEntrance} setAccessibleEntrance={setAccessibleEntrance} accessibleRestroom={accessibleRestroom} setAccessibleRestroom={setAccessibleRestroom} accessibleSeating={accessibleSeating} setAccessibleSeating={setAccessibleSeating} accessibilityHelpText={accessibilityHelpText} setAccessibilityHelpText={setAccessibilityHelpText} accessibilityContactLabel={accessibilityContactLabel} setAccessibilityContactLabel={setAccessibilityContactLabel} accessibilityContactEmail={accessibilityContactEmail} setAccessibilityContactEmail={setAccessibilityContactEmail} accessibilityContactPhone={accessibilityContactPhone} setAccessibilityContactPhone={setAccessibilityContactPhone} privacySummary={privacySummary} setPrivacySummary={setPrivacySummary} dataRetentionStatement={dataRetentionStatement} setDataRetentionStatement={setDataRetentionStatement} privacyContactLabel={privacyContactLabel} setPrivacyContactLabel={setPrivacyContactLabel} privacyContactEmail={privacyContactEmail} setPrivacyContactEmail={setPrivacyContactEmail} privacyRequestsEnabled={privacyRequestsEnabled} setPrivacyRequestsEnabled={setPrivacyRequestsEnabled} reminderGuestFriendlyCopy={reminderGuestFriendlyCopy} setReminderGuestFriendlyCopy={setReminderGuestFriendlyCopy} defaultQuietHoursStart={defaultQuietHoursStart} setDefaultQuietHoursStart={setDefaultQuietHoursStart} defaultQuietHoursEnd={defaultQuietHoursEnd} setDefaultQuietHoursEnd={setDefaultQuietHoursEnd} rsvpReminderEnabled={rsvpReminderEnabled} setRsvpReminderEnabled={setRsvpReminderEnabled} scheduleReminderEnabled={scheduleReminderEnabled} setScheduleReminderEnabled={setScheduleReminderEnabled} rainPlanReminderEnabled={rainPlanReminderEnabled} setRainPlanReminderEnabled={setRainPlanReminderEnabled} shuttleReminderEnabled={shuttleReminderEnabled} setShuttleReminderEnabled={setShuttleReminderEnabled} dayBeforeReminderEnabled={dayBeforeReminderEnabled} setDayBeforeReminderEnabled={setDayBeforeReminderEnabled} dayOfReminderEnabled={dayOfReminderEnabled} setDayOfReminderEnabled={setDayOfReminderEnabled} dayOfModeEnabled={dayOfModeEnabled} setDayOfModeEnabled={setDayOfModeEnabled} dayOfModeTitle={dayOfModeTitle} setDayOfModeTitle={setDayOfModeTitle} dayOfContactLabel={dayOfContactLabel} setDayOfContactLabel={setDayOfContactLabel} dayOfContactEmail={dayOfContactEmail} setDayOfContactEmail={setDayOfContactEmail} dayOfContactPhone={dayOfContactPhone} setDayOfContactPhone={setDayOfContactPhone} dayOfPushCopy={dayOfPushCopy} setDayOfPushCopy={setDayOfPushCopy} guestMemoryEnabled={guestMemoryEnabled} setGuestMemoryEnabled={setGuestMemoryEnabled} guestPhotoUploadEnabled={guestPhotoUploadEnabled} setGuestPhotoUploadEnabled={setGuestPhotoUploadEnabled} guestPostEventFeedbackEnabled={guestPostEventFeedbackEnabled} setGuestPostEventFeedbackEnabled={setGuestPostEventFeedbackEnabled} postEventThankYouTitle={postEventThankYouTitle} setPostEventThankYouTitle={setPostEventThankYouTitle} postEventThankYouMessage={postEventThankYouMessage} setPostEventThankYouMessage={setPostEventThankYouMessage} memoryPhotoLinksText={memoryPhotoLinksText} setMemoryPhotoLinksText={setMemoryPhotoLinksText} guestPhotoConsentCopy={guestPhotoConsentCopy} setGuestPhotoConsentCopy={setGuestPhotoConsentCopy} guestPhotoModerationCopy={guestPhotoModerationCopy} setGuestPhotoModerationCopy={setGuestPhotoModerationCopy} guestNpsQuestion={guestNpsQuestion} setGuestNpsQuestion={setGuestNpsQuestion} destinationTravelFaq={destinationTravelFaq} setDestinationTravelFaq={setDestinationTravelFaq} weatherRainPlanNote={weatherRainPlanNote} setWeatherRainPlanNote={setWeatherRainPlanNote} seatingPrivacyMode={seatingPrivacyMode} setSeatingPrivacyMode={setSeatingPrivacyMode} wayfindingLabelsText={wayfindingLabelsText} setWayfindingLabelsText={setWayfindingLabelsText} outdoorMapNote={outdoorMapNote} setOutdoorMapNote={setOutdoorMapNote} indoorRainPlanMapNote={indoorRainPlanMapNote} setIndoorRainPlanMapNote={setIndoorRainPlanMapNote} accessibilityRouteDetails={accessibilityRouteDetails} setAccessibilityRouteDetails={setAccessibilityRouteDetails} arPreviewUrl={arPreviewUrl} setArPreviewUrl={setArPreviewUrl} arPreviewDescription={arPreviewDescription} setArPreviewDescription={setArPreviewDescription} dressCodeSummary={dressCodeSummary} setDressCodeSummary={setDressCodeSummary} dressCodeExamples={dressCodeExamples} setDressCodeExamples={setDressCodeExamples} dressCodeWeather={dressCodeWeather} setDressCodeWeather={setDressCodeWeather} dressCodeRainPlan={dressCodeRainPlan} setDressCodeRainPlan={setDressCodeRainPlan} kidsPolicy={kidsPolicy} setKidsPolicy={setKidsPolicy} plusOneRules={plusOneRules} setPlusOneRules={setPlusOneRules} phonePhotoPolicy={phonePhotoPolicy} setPhonePhotoPolicy={setPhonePhotoPolicy} smokingVapingPolicy={smokingVapingPolicy} setSmokingVapingPolicy={setSmokingVapingPolicy} barAlcoholPolicy={barAlcoholPolicy} setBarAlcoholPolicy={setBarAlcoholPolicy} guestFaqItemsText={guestFaqItemsText} setGuestFaqItemsText={setGuestFaqItemsText} faqLanguagesText={faqLanguagesText} setFaqLanguagesText={setFaqLanguagesText} guestQuestionsEnabled={guestQuestionsEnabled} setGuestQuestionsEnabled={setGuestQuestionsEnabled} guestQuestionContactLabel={guestQuestionContactLabel} setGuestQuestionContactLabel={setGuestQuestionContactLabel} guestQuestionContactEmail={guestQuestionContactEmail} setGuestQuestionContactEmail={setGuestQuestionContactEmail} rsvpEditWindowDays={rsvpEditWindowDays} setRsvpEditWindowDays={setRsvpEditWindowDays} mealOptionsText={mealOptionsText} setMealOptionsText={setMealOptionsText} rsvpTheme={rsvpTheme} setRsvpTheme={setRsvpTheme} setIsDirty={setIsDirty} data={data} guests={guests} />

          <PortalSubEventsCard isLoading={isLoading} subEvents={subEvents} updateSubEventMutation={updateSubEventMutation} />

          {/* Automated SMS Reminders Panel */}
          <PortalSmsRemindersCard enableSmsReminders={enableSmsReminders} setEnableSmsReminders={setEnableSmsReminders} smsTemplate={smsTemplate} setSmsTemplate={setSmsTemplate} setIsDirty={setIsDirty} guests={guests} />
        </div>

        {/* Right Column: Live Mobile Mockup Preview */}
        <div className="lg:col-span-1 sticky top-4 flex flex-col items-center">
          <PortalPhoneMockup welcomeTitle={welcomeTitle} tagline={tagline} customBrandColor={customBrandColor} enableSongRequests={enableSongRequests} enableDietaryDetails={enableDietaryDetails} enableLodgingChoices={enableLodgingChoices} rsvpTheme={rsvpTheme} />
        </div>
      </div>

      {isDirty && (
        <div className="flex items-center justify-between p-4 bg-surface-2 border border-border rounded-lg shadow-sm animate-in slide-in-from-bottom-4 sticky bottom-4">
          <div className="text-sm font-medium">Unsaved changes</div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLocalEnabled(data?.config?.enabled === 1);
                setHasPassword(!!data?.config?.password_hash);

                const parsedConfig =
                  typeof data?.config?.config === "string"
                    ? JSON.parse(data?.config?.config || "{}")
                    : data?.config?.config || {};

                setWelcomeTitle(
                  parsedConfig.welcomeTitle || "We Are Getting Married!",
                );
                setTagline(
                  parsedConfig.tagline || "Please join us on our special day.",
                );
                setCustomBrandColor(parsedConfig.brandColor || "#6B21A8");
                setEnableSongRequests(!!parsedConfig.enableSongRequests);
                setEnableDietaryDetails(!!parsedConfig.enableDietaryDetails);
                setEnableLodgingChoices(!!parsedConfig.enableLodgingChoices);

                setRsvpTheme(parsedConfig.rsvpTheme || "classic_vintage");
                setEnableSmsReminders(!!parsedConfig.enableSmsReminders);
                setSmsTemplate(
                  parsedConfig.smsTemplate ||
                    "Hi {{guest_name}}, this is a quick reminder that RSVPs for our wedding are due on {{rsvp_deadline}}! Please submit yours at: {{portal_link}}",
                );

                setNewPassword("");
                setIsDirty(false);
              }}
            >
              Discard
            </Button>
            <Button
              size="sm"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                "Saving..."
              ) : (
                <>
                  <Save className="w-4 h-4 mr-1" /> Save Settings
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}



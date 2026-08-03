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
          <Card className="bg-[#FDFBF7] border border-[#e1d5c9] shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="flex flex-row items-start justify-between pb-4 border-b border-[#e1d5c9]">
              <div>
                <CardTitle className="text-lg flex items-center gap-2 font-serif font-black text-brand">
                  <Globe className="w-5 h-5 text-brand" /> Public Guest Portal
                </CardTitle>
                <CardDescription className="mt-1 text-xs">
                  Configure the public-facing RSVP and logistics portal for
                  invited guests.
                </CardDescription>
              </div>

              <button
                type="button"
                onClick={handleToggleEnable}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  localEnabled ? "bg-emerald-600" : "bg-gray-200",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    localEnabled ? "translate-x-6" : "translate-x-1",
                  )}
                />
              </button>
            </CardHeader>

            <CardContent className="space-y-6 pt-6 bg-white">
              <div className="bg-[#FDFBF7] rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border border-[#e1d5c9]">
                <div className="space-y-1">
                  <Label className="flex items-center gap-2 mb-1 text-xs font-bold text-fg-muted uppercase tracking-wider">
                    <LinkIcon className="w-4 h-4 text-brand" /> Shareable Link
                  </Label>
                  <div className="text-xs font-mono text-fg-subtle select-all bg-white px-3 py-1.5 rounded border border-[#e1d5c9]">
                    {portalUrl}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="text-xs font-bold border-[#e1d5c9]"
                    onClick={() => {
                      navigator.clipboard.writeText(portalUrl);
                      toast({
                        title: "Link copied to clipboard",
                        variant: "success",
                      });
                    }}
                  >
                    Copy URL
                  </Button>
                  <a href={portalUrl} target="_blank" rel="noreferrer">
                    <Button
                      variant="secondary"
                      className="text-xs font-bold bg-[#2C2A29] hover:bg-[#3d3b3a] text-white"
                    >
                      <ExternalLink className="w-4 h-4 mr-1" /> Visit
                    </Button>
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#FDFBF7] border border-[#e1d5c9] shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-[#e1d5c9]">
              <CardTitle className="text-base font-serif font-black text-brand flex items-center gap-2">
                <Lock className="w-4 h-4 text-brand" /> Access &amp; Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6 bg-surface">
              <div className="rounded-xl border border-border bg-surface-2 p-3 text-xs text-fg-muted">
                <strong className="text-fg">Access window clarity:</strong>{" "}
                guests can view the portal only during the configured window.
                Grace hours allow a soft buffer after the end date. Passwords
                are shared master passwords; guest-specific access still
                respects each guest’s portal permission.
              </div>
              <label className="flex items-start gap-2 rounded-xl border border-brand/20 bg-brand-soft/20 p-3 text-xs text-fg-muted">
                <input
                  type="checkbox"
                  checked={ownerApprovalRequired}
                  onChange={(e) => {
                    setOwnerApprovalRequired(e.target.checked);
                    setIsDirty(true);
                  }}
                  className="mt-0.5 accent-brand"
                />
                <span>
                  <strong className="text-fg">
                    Manager-safe portal changes:
                  </strong>{" "}
                  require owner/admin approval before enabling or materially
                  changing public guest access.
                </span>
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs">Access starts</Label>
                  <Input
                    type="datetime-local"
                    value={accessStartsAt}
                    onChange={(e) => {
                      setAccessStartsAt(e.target.value);
                      setIsDirty(true);
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Access ends</Label>
                  <Input
                    type="datetime-local"
                    value={accessEndsAt}
                    onChange={(e) => {
                      setAccessEndsAt(e.target.value);
                      setIsDirty(true);
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Grace hours</Label>
                  <Input
                    type="number"
                    min="0"
                    value={gracePeriodHours}
                    onChange={(e) => {
                      setGracePeriodHours(e.target.value);
                      setIsDirty(true);
                    }}
                  />
                </div>
              </div>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="pwd-gate"
                  checked={hasPassword}
                  onChange={handleTogglePassword}
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label
                    htmlFor="pwd-gate"
                    className="font-bold cursor-pointer text-sm"
                  >
                    Require a master password
                  </Label>
                  <p className="text-xs text-fg-subtle mt-1 mb-3 font-semibold leading-relaxed">
                    Guests will need to enter this shared password to view the
                    event details and access the RSVP form.
                  </p>

                  {hasPassword && (
                    <div className="max-w-xs space-y-2">
                      <Label className="text-xs">Set Password</Label>
                      <Input
                        type="text"
                        placeholder="e.g. Smith2026"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          setIsDirty(true);
                        }}
                        className="bg-[#FDFBF7]"
                      />
                      {data?.config?.password_hash && !newPassword && (
                        <p className="text-xs text-emerald-600 font-bold">
                          A password is currently set. Type a new one to replace
                          it.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invitation & RSVP Page Designer */}
          <Card className="bg-[#FDFBF7] border border-[#e1d5c9] shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-[#e1d5c9]">
              <CardTitle className="text-base flex items-center gap-2 text-brand font-black font-serif">
                🎨 Invitation &amp; RSVP Page Designer
              </CardTitle>
              <CardDescription className="text-xs text-fg-subtle">
                White-label your guest-facing wedding landing page, toggle
                custom layouts and custom form fields.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6 bg-white">
              <div className="rounded-xl border border-border bg-surface-2 p-3 space-y-2">
                <div className="text-xs font-bold text-fg uppercase">
                  <Smartphone className="inline h-4 w-4 mr-1 text-brand" />
                  Mobile preview presets
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      setRsvpTheme("classic_vintage");
                      setEnableDietaryDetails(true);
                      setEnableLodgingChoices(true);
                      setIsDirty(true);
                    }}
                  >
                    Full RSVP
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      setRsvpTheme("modern_minimalist");
                      setEnableSongRequests(false);
                      setEnableDietaryDetails(false);
                      setEnableLodgingChoices(false);
                      setIsDirty(true);
                    }}
                  >
                    Simple info
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      setRsvpTheme("bohemian_chic");
                      setEnableSongRequests(true);
                      setEnableDietaryDetails(true);
                      setIsDirty(true);
                    }}
                  >
                    Interactive guest
                  </Button>
                </div>
              </div>

              {/* A/B Theme Choice Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-fg-muted uppercase tracking-wider block">
                  A/B Page Layout Theme
                </Label>
                <select
                  className="w-full text-xs p-2.5 rounded-lg border border-[#e1d5c9] bg-white font-semibold"
                  value={rsvpTheme}
                  onChange={(e) => {
                    setRsvpTheme(e.target.value);
                    setIsDirty(true);
                  }}
                >
                  <option value="classic_vintage">
                    📜 Classic Vintage (Serif &amp; Floral Frames)
                  </option>
                  <option value="modern_minimalist">
                    📐 Modern Minimalist (Monochrome Sans-Serif)
                  </option>
                  <option value="bohemian_chic">
                    🌾 Bohemian Chic (Terracotta scripts)
                  </option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold text-fg-muted uppercase tracking-wider">
                  Wedding Welcome Title
                </Label>
                <Input
                  value={welcomeTitle}
                  onChange={(e) => {
                    setWelcomeTitle(e.target.value);
                    setIsDirty(true);
                  }}
                  className="mt-1 bg-[#FDFBF7] border-[#e1d5c9] text-xs h-9 font-semibold"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-fg-muted uppercase tracking-wider">
                  Welcoming Tagline / Description
                </Label>
                <Input
                  value={tagline}
                  onChange={(e) => {
                    setTagline(e.target.value);
                    setIsDirty(true);
                  }}
                  className="mt-1 bg-[#FDFBF7] border-[#e1d5c9] text-xs h-9 font-semibold"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-fg-muted uppercase tracking-wider">
                  Wedding Highlight Brand Color
                </Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={customBrandColor}
                    onChange={(e) => {
                      setCustomBrandColor(e.target.value);
                      setIsDirty(true);
                    }}
                    className="h-9 w-9 rounded-md border border-[#e1d5c9] cursor-pointer bg-white"
                  />
                  <Input
                    value={customBrandColor}
                    onChange={(e) => {
                      setCustomBrandColor(e.target.value);
                      setIsDirty(true);
                    }}
                    className="bg-[#FDFBF7] border-[#e1d5c9] text-xs h-9 w-28 uppercase font-semibold"
                  />
                </div>
              </div>

              <div className="pt-3 border-t space-y-3 font-semibold text-xs text-fg">
                <h4 className="text-[10px] text-fg-subtle uppercase tracking-wider font-bold">
                  Interactive RSVP Form Custom fields
                </h4>

                <label className="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-surface-2 transition-colors bg-[#FDFBF7] border rounded-xl p-3 border-[#e1d5c9]/60">
                  <input
                    type="checkbox"
                    checked={enableSongRequests}
                    onChange={(e) => {
                      setEnableSongRequests(e.target.checked);
                      setIsDirty(true);
                    }}
                    className="rounded border-[#e1d5c9] text-brand accent-brand h-4 w-4 cursor-pointer"
                  />
                  <div>
                    <div>Collect Song &amp; Music Requests</div>
                    <div className="text-[10px] text-fg-subtle font-normal">
                      Let guests specify songs they want played.
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-surface-2 transition-colors bg-[#FDFBF7] border rounded-xl p-3 border-[#e1d5c9]/60">
                  <input
                    type="checkbox"
                    checked={enableDietaryDetails}
                    onChange={(e) => {
                      setEnableDietaryDetails(e.target.checked);
                      setIsDirty(true);
                    }}
                    className="rounded border-[#e1d5c9] text-brand accent-brand h-4 w-4 cursor-pointer"
                  />
                  <div>
                    <div>Collect Detailed Dietary Restrictions</div>
                    <div className="text-[10px] text-fg-subtle font-normal">
                      Let guests write custom allergy or menu notes.
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-surface-2 transition-colors bg-[#FDFBF7] border rounded-xl p-3 border-[#e1d5c9]/60">
                  <input
                    type="checkbox"
                    checked={enableLodgingChoices}
                    onChange={(e) => {
                      setEnableLodgingChoices(e.target.checked);
                      setIsDirty(true);
                    }}
                    className="rounded border-[#e1d5c9] text-brand accent-brand h-4 w-4 cursor-pointer"
                  />
                  <div>
                    <div>Collect Overnight Lodging Requests</div>
                    <div className="text-[10px] text-fg-subtle font-normal">
                      Ask guests if they desire onsite cabin accommodation.
                    </div>
                  </div>
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 pt-3 border-t border-border">
                <div>
                  <Label className="text-xs font-bold text-fg-muted uppercase">
                    Guest FAQ
                  </Label>
                  <textarea
                    rows={4}
                    className="mt-1 w-full rounded-md border border-border bg-surface p-2 text-xs"
                    value={faqText}
                    onChange={(e) => {
                      setFaqText(e.target.value);
                      setIsDirty(true);
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-fg-muted uppercase">
                    Transportation / shuttle
                  </Label>
                  <textarea
                    rows={4}
                    className="mt-1 w-full rounded-md border border-border bg-surface p-2 text-xs"
                    value={transportationText}
                    onChange={(e) => {
                      setTransportationText(e.target.value);
                      setIsDirty(true);
                    }}
                  />
                </div>
                <div className="sm:col-span-2 rounded-xl border border-border bg-surface-2 p-3">
                  <Label className="text-xs font-bold text-fg-muted uppercase">Guest travel & directions</Label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Input value={venueAddress} onChange={(e) => { setVenueAddress(e.target.value); setIsDirty(true); }} placeholder="Venue address" />
                    <Input value={mapUrl} onChange={(e) => { setMapUrl(e.target.value); setIsDirty(true); }} placeholder="Google/Apple map link" />
                    <Input value={parkingEntrance} onChange={(e) => { setParkingEntrance(e.target.value); setIsDirty(true); }} placeholder="Parking entrance" />
                    <Input value={dropoffPoint} onChange={(e) => { setDropoffPoint(e.target.value); setIsDirty(true); }} placeholder="Drop-off point" />
                    <Input value={shuttlePickupLocation} onChange={(e) => { setShuttlePickupLocation(e.target.value); setIsDirty(true); }} placeholder="Shuttle pickup location" />
                    <Input value={shuttleDropoffLocation} onChange={(e) => { setShuttleDropoffLocation(e.target.value); setIsDirty(true); }} placeholder="Shuttle drop-off location" />
                    <Input value={lastShuttleReminder} onChange={(e) => { setLastShuttleReminder(e.target.value); setIsDirty(true); }} placeholder="Last shuttle reminder" />
                    <Input value={roomBlockDetails} onChange={(e) => { setRoomBlockDetails(e.target.value); setIsDirty(true); }} placeholder="Room block / lodging details" />
                    <Input value={accessibleParking} onChange={(e) => { setAccessibleParking(e.target.value); setIsDirty(true); }} placeholder="Accessible parking" />
                    <Input value={mobilityDropoff} onChange={(e) => { setMobilityDropoff(e.target.value); setIsDirty(true); }} placeholder="Mobility drop-off" />
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <textarea className="min-h-20 rounded-md border border-border bg-surface p-2 text-xs" value={rideshareInstructions} onChange={(e) => { setRideshareInstructions(e.target.value); setIsDirty(true); }} placeholder="Rideshare instructions" />
                    <textarea className="min-h-20 rounded-md border border-border bg-surface p-2 text-xs" value={shuttleSchedule} onChange={(e) => { setShuttleSchedule(e.target.value); setIsDirty(true); }} placeholder="Shuttle schedule" />
                    <textarea className="min-h-20 rounded-md border border-border bg-surface p-2 text-xs" value={destinationTravelFaq} onChange={(e) => { setDestinationTravelFaq(e.target.value); setIsDirty(true); }} placeholder="Destination wedding travel FAQ" />
                    <textarea className="min-h-20 rounded-md border border-border bg-surface p-2 text-xs" value={weatherRainPlanNote} onChange={(e) => { setWeatherRainPlanNote(e.target.value); setIsDirty(true); }} placeholder="Weather / rain-plan travel note" />
                  </div>
                </div>
                <div className="sm:col-span-2 rounded-xl border border-border bg-surface-2 p-3">
                  <Label className="text-xs font-bold text-fg-muted uppercase">Guest memories, photos, polls, and post-event feedback</Label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 text-xs"><input type="checkbox" checked={guestMemoryEnabled} onChange={(e) => { setGuestMemoryEnabled(e.target.checked); setIsDirty(true); }} /> Enable memory/photo module</label>
                    <label className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 text-xs"><input type="checkbox" checked={guestPhotoUploadEnabled} onChange={(e) => { setGuestPhotoUploadEnabled(e.target.checked); setIsDirty(true); }} /> Allow guest photo/link submissions</label>
                    <label className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 text-xs"><input type="checkbox" checked={guestPostEventFeedbackEnabled} onChange={(e) => { setGuestPostEventFeedbackEnabled(e.target.checked); setIsDirty(true); }} /> Enable guest feedback/NPS</label>
                    <Input value={postEventThankYouTitle} onChange={(e) => { setPostEventThankYouTitle(e.target.value); setIsDirty(true); }} placeholder="Post-event thank-you title" />
                    <textarea className="min-h-20 rounded-md border border-border bg-surface p-2 text-xs" value={postEventThankYouMessage} onChange={(e) => { setPostEventThankYouMessage(e.target.value); setIsDirty(true); }} placeholder="Post-event thank-you / gallery card message" />
                    <textarea className="min-h-20 rounded-md border border-border bg-surface p-2 text-xs" value={memoryPhotoLinksText} onChange={(e) => { setMemoryPhotoLinksText(e.target.value); setIsDirty(true); }} placeholder="id|Label|https://url|Description, one per line" />
                    <textarea className="min-h-20 rounded-md border border-border bg-surface p-2 text-xs" value={guestPhotoConsentCopy} onChange={(e) => { setGuestPhotoConsentCopy(e.target.value); setIsDirty(true); }} placeholder="Guest photo consent copy" />
                    <textarea className="min-h-20 rounded-md border border-border bg-surface p-2 text-xs" value={guestPhotoModerationCopy} onChange={(e) => { setGuestPhotoModerationCopy(e.target.value); setIsDirty(true); }} placeholder="Photo moderation copy" />
                    <Input value={guestNpsQuestion} onChange={(e) => { setGuestNpsQuestion(e.target.value); setIsDirty(true); }} placeholder="Guest NPS question" />
                  </div>
                </div>
                <div className="sm:col-span-2 rounded-xl border border-border bg-surface-2 p-3">
                  <Label className="text-xs font-bold text-fg-muted uppercase">Wedding-day mobile mode</Label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 text-xs"><input type="checkbox" checked={dayOfModeEnabled} onChange={(e) => { setDayOfModeEnabled(e.target.checked); setIsDirty(true); }} /> Enable guest event-day mode</label>
                    <Input value={dayOfModeTitle} onChange={(e) => { setDayOfModeTitle(e.target.value); setIsDirty(true); }} placeholder="Event-day mode title" />
                    <Input value={dayOfContactLabel} onChange={(e) => { setDayOfContactLabel(e.target.value); setIsDirty(true); }} placeholder="Day-of contact label" />
                    <Input value={dayOfContactEmail} onChange={(e) => { setDayOfContactEmail(e.target.value); setIsDirty(true); }} placeholder="Day-of contact email" />
                    <Input value={dayOfContactPhone} onChange={(e) => { setDayOfContactPhone(e.target.value); setIsDirty(true); }} placeholder="Day-of contact phone" />
                    <textarea className="min-h-20 rounded-md border border-border bg-surface p-2 text-xs" value={dayOfPushCopy} onChange={(e) => { setDayOfPushCopy(e.target.value); setIsDirty(true); }} placeholder="Browser notification prompt copy for rain-plan/shuttle changes" />
                  </div>
                </div>
                <div className="sm:col-span-2 rounded-xl border border-border bg-surface-2 p-3">
                  <Label className="text-xs font-bold text-fg-muted uppercase">Guest notifications and reminders</Label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Input value={defaultQuietHoursStart} onChange={(e) => { setDefaultQuietHoursStart(e.target.value); setIsDirty(true); }} placeholder="Default quiet hours start, e.g. 21:00" />
                    <Input value={defaultQuietHoursEnd} onChange={(e) => { setDefaultQuietHoursEnd(e.target.value); setIsDirty(true); }} placeholder="Default quiet hours end, e.g. 08:00" />
                    <textarea className="min-h-20 rounded-md border border-border bg-surface p-2 text-xs sm:col-span-2" value={reminderGuestFriendlyCopy} onChange={(e) => { setReminderGuestFriendlyCopy(e.target.value); setIsDirty(true); }} placeholder="Guest-friendly reminder copy" />
                    {[['RSVP deadline', rsvpReminderEnabled, setRsvpReminderEnabled], ['Schedule updates', scheduleReminderEnabled, setScheduleReminderEnabled], ['Rain-plan changes', rainPlanReminderEnabled, setRainPlanReminderEnabled], ['Shuttle reminders', shuttleReminderEnabled, setShuttleReminderEnabled], ['Day-before reminders', dayBeforeReminderEnabled, setDayBeforeReminderEnabled], ['Day-of reminders', dayOfReminderEnabled, setDayOfReminderEnabled]].map(([label, checked, setter]: any) => <label key={label} className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 text-xs"><input type="checkbox" checked={checked} onChange={(e) => { setter(e.target.checked); setIsDirty(true); }} /> {label}</label>)}
                  </div>
                </div>
                <div className="sm:col-span-2 rounded-xl border border-border bg-surface-2 p-3">
                  <Label className="text-xs font-bold text-fg-muted uppercase">Guest privacy, trust, and data permissions</Label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Input value={privacyContactLabel} onChange={(e) => { setPrivacyContactLabel(e.target.value); setIsDirty(true); }} placeholder="Privacy contact label" />
                    <Input value={privacyContactEmail} onChange={(e) => { setPrivacyContactEmail(e.target.value); setIsDirty(true); }} placeholder="Privacy contact email" />
                    <textarea className="min-h-20 rounded-md border border-border bg-surface p-2 text-xs" value={privacySummary} onChange={(e) => { setPrivacySummary(e.target.value); setIsDirty(true); }} placeholder="Guest privacy summary" />
                    <textarea className="min-h-20 rounded-md border border-border bg-surface p-2 text-xs" value={dataRetentionStatement} onChange={(e) => { setDataRetentionStatement(e.target.value); setIsDirty(true); }} placeholder="Guest-visible data retention statement" />
                    <label className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 text-xs"><input type="checkbox" checked={privacyRequestsEnabled} onChange={(e) => { setPrivacyRequestsEnabled(e.target.checked); setIsDirty(true); }} /> Allow guest data correction/deletion requests</label>
                  </div>
                </div>
                <div className="sm:col-span-2 rounded-xl border border-border bg-surface-2 p-3">
                  <Label className="text-xs font-bold text-fg-muted uppercase">Accessibility & guest care center</Label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Input value={accessibleEntrance} onChange={(e) => { setAccessibleEntrance(e.target.value); setIsDirty(true); }} placeholder="Accessible entrance details" />
                    <Input value={accessibleRestroom} onChange={(e) => { setAccessibleRestroom(e.target.value); setIsDirty(true); }} placeholder="Accessible restroom details" />
                    <Input value={accessibleSeating} onChange={(e) => { setAccessibleSeating(e.target.value); setIsDirty(true); }} placeholder="Accessible seating details" />
                    <Input value={accessibilityContactLabel} onChange={(e) => { setAccessibilityContactLabel(e.target.value); setIsDirty(true); }} placeholder="Accessibility contact label" />
                    <Input value={accessibilityContactEmail} onChange={(e) => { setAccessibilityContactEmail(e.target.value); setIsDirty(true); }} placeholder="Accessibility contact email" />
                    <Input value={accessibilityContactPhone} onChange={(e) => { setAccessibilityContactPhone(e.target.value); setIsDirty(true); }} placeholder="Accessibility contact phone" />
                    <textarea className="min-h-20 rounded-md border border-border bg-surface p-2 text-xs sm:col-span-2" value={accessibilityHelpText} onChange={(e) => { setAccessibilityHelpText(e.target.value); setIsDirty(true); }} placeholder="Guest-facing accessibility help text" />
                  </div>
                </div>
                <div className="sm:col-span-2 rounded-xl border border-border bg-surface-2 p-3">
                  <Label className="text-xs font-bold text-fg-muted uppercase">Guest FAQ & etiquette</Label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Input value={dressCodeSummary} onChange={(e) => { setDressCodeSummary(e.target.value); setIsDirty(true); }} placeholder="Dress code summary" />
                    <Input value={dressCodeExamples} onChange={(e) => { setDressCodeExamples(e.target.value); setIsDirty(true); }} placeholder="Dress code examples" />
                    <Input value={dressCodeWeather} onChange={(e) => { setDressCodeWeather(e.target.value); setIsDirty(true); }} placeholder="Weather dress consideration" />
                    <Input value={dressCodeRainPlan} onChange={(e) => { setDressCodeRainPlan(e.target.value); setIsDirty(true); }} placeholder="Rain-plan dress note" />
                    <Input value={kidsPolicy} onChange={(e) => { setKidsPolicy(e.target.value); setIsDirty(true); }} placeholder="Kids policy" />
                    <Input value={plusOneRules} onChange={(e) => { setPlusOneRules(e.target.value); setIsDirty(true); }} placeholder="Plus-one rules" />
                    <Input value={phonePhotoPolicy} onChange={(e) => { setPhonePhotoPolicy(e.target.value); setIsDirty(true); }} placeholder="Ceremony phone/photo policy" />
                    <Input value={smokingVapingPolicy} onChange={(e) => { setSmokingVapingPolicy(e.target.value); setIsDirty(true); }} placeholder="Smoking/vaping policy" />
                    <Input value={barAlcoholPolicy} onChange={(e) => { setBarAlcoholPolicy(e.target.value); setIsDirty(true); }} placeholder="Bar/alcohol policy" />
                    <Input value={guestQuestionContactLabel} onChange={(e) => { setGuestQuestionContactLabel(e.target.value); setIsDirty(true); }} placeholder="Question routing label" />
                    <Input value={guestQuestionContactEmail} onChange={(e) => { setGuestQuestionContactEmail(e.target.value); setIsDirty(true); }} placeholder="Internal question contact email" />
                    <label className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 text-xs"><input type="checkbox" checked={guestQuestionsEnabled} onChange={(e) => { setGuestQuestionsEnabled(e.target.checked); setIsDirty(true); }} /> Allow guest question submissions</label>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <textarea className="min-h-24 rounded-md border border-border bg-surface p-2 text-xs" value={guestFaqItemsText} onChange={(e) => { setGuestFaqItemsText(e.target.value); setIsDirty(true); }} placeholder="category|question|answer, one FAQ per line" />
                    <textarea className="min-h-24 rounded-md border border-border bg-surface p-2 text-xs" value={faqLanguagesText} onChange={(e) => { setFaqLanguagesText(e.target.value); setIsDirty(true); }} placeholder="code|Language label, one per line" />
                  </div>
                </div>
                <div className="sm:col-span-2 rounded-xl border border-border bg-surface-2 p-3">
                  <Label className="text-xs font-bold text-fg-muted uppercase">Venue map, wayfinding, accessibility routes</Label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="flex flex-wrap gap-2" aria-label="Guest seating privacy mode">
                      <Button type="button" size="sm" variant={seatingPrivacyMode === "full_chart" ? "default" : "outline"} onClick={() => { setSeatingPrivacyMode("full_chart"); setIsDirty(true); }}>Shared seating chart</Button>
                      <Button type="button" size="sm" variant={seatingPrivacyMode === "personal_only" ? "default" : "outline"} onClick={() => { setSeatingPrivacyMode("personal_only"); setIsDirty(true); }}>Personal seat only</Button>
                    </div>
                    <Input value={arPreviewUrl} onChange={(e) => { setArPreviewUrl(e.target.value); setIsDirty(true); }} placeholder="3D / AR guest walkthrough URL" />
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <textarea className="min-h-24 rounded-md border border-border bg-surface p-2 text-xs" value={wayfindingLabelsText} onChange={(e) => { setWayfindingLabelsText(e.target.value); setIsDirty(true); }} placeholder="type|Label|Details, one per line. Types: parking, entrance, ceremony, reception, restroom, bar, buffet, dance_floor, ada_route" />
                    <textarea className="min-h-24 rounded-md border border-border bg-surface p-2 text-xs" value={accessibilityRouteDetails} onChange={(e) => { setAccessibilityRouteDetails(e.target.value); setIsDirty(true); }} placeholder="Accessible route details" />
                    <textarea className="min-h-20 rounded-md border border-border bg-surface p-2 text-xs" value={outdoorMapNote} onChange={(e) => { setOutdoorMapNote(e.target.value); setIsDirty(true); }} placeholder="Outdoor / arrival map note" />
                    <textarea className="min-h-20 rounded-md border border-border bg-surface p-2 text-xs" value={indoorRainPlanMapNote} onChange={(e) => { setIndoorRainPlanMapNote(e.target.value); setIsDirty(true); }} placeholder="Indoor / rain-plan map note" />
                    <textarea className="min-h-20 rounded-md border border-border bg-surface p-2 text-xs sm:col-span-2" value={arPreviewDescription} onChange={(e) => { setArPreviewDescription(e.target.value); setIsDirty(true); }} placeholder="Guest-safe 3D/AR preview description" />
                  </div>
                </div>
                <div className="sm:col-span-2 rounded-xl border border-border bg-surface-2 p-3">
                  <Label className="text-xs font-bold text-fg-muted uppercase">Registry, gifts, cards, and contribution links</Label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Input value={registryLinks} onChange={(e) => { setRegistryLinks(e.target.value); setIsDirty(true); }} placeholder="Legacy raw URLs, comma-separated" />
                    <Input value={cardsGiftTableLocation} onChange={(e) => { setCardsGiftTableLocation(e.target.value); setIsDirty(true); }} placeholder="Cards/gifts table location" />
                    <textarea className="min-h-24 rounded-md border border-border bg-surface p-2 text-xs" value={giftLinksText} onChange={(e) => { setGiftLinksText(e.target.value); setIsDirty(true); }} placeholder="type|Label|https://url|Description. Types: registry, honeymoon, charity, cash, website, other" />
                    <textarea className="min-h-24 rounded-md border border-border bg-surface p-2 text-xs" value={registryGiftNote} onChange={(e) => { setRegistryGiftNote(e.target.value); setIsDirty(true); }} placeholder="Optional guest-facing gift note" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-bold text-fg-muted uppercase">
                    RSVP edit window rules
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    value={rsvpEditWindowDays}
                    onChange={(e) => {
                      setRsvpEditWindowDays(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="Days before event edits close"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs font-bold text-fg-muted uppercase">
                    Venue-configurable meal options
                  </Label>
                  <textarea
                    rows={6}
                    className="mt-1 w-full rounded-md border border-border bg-surface p-2 text-xs font-mono"
                    value={mealOptionsText}
                    onChange={(e) => {
                      setMealOptionsText(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="id|Label shown to guests|Description"
                  />
                  <p className="mt-1 text-[11px] text-fg-subtle">One option per line using id|label|description. These labels power the public RSVP meal/allergy module and catering export.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><CalendarDays className="h-4 w-4 text-brand" /> Guest-facing sub-event details</CardTitle>
              <CardDescription>Structured fields for rehearsal dinner, welcome party, brunch, after-party, and invite-only guest itinerary cards.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {subEvents.length === 0 ? <p className="rounded-lg border border-dashed border-border p-3 text-sm text-fg-muted">No sub-events created yet. Add rehearsal dinner or weekend events from the event timeline/sub-event tools.</p> : subEvents.map((sub: any) => {
                const meta = typeof sub.metadata === 'string' ? JSON.parse(sub.metadata || '{}') : sub.metadata || {};
                const save = () => {
                  const fields = ['eventType','location','host','dressCode','parking','dietaryFields','lateArrivalInstructions','contactName','contactEmail','helpText'];
                  const next = { ...meta } as Record<string, unknown>;
                  for (const field of fields) {
                    const el = document.getElementById(`sub-${sub.id}-${field}`) as HTMLInputElement | HTMLTextAreaElement | null;
                    if (el) next[field] = el.value;
                  }
                  updateSubEventMutation.mutate({ id: sub.id, metadata: next });
                };
                return <div key={sub.id} className="rounded-xl border border-border bg-surface-2 p-3 space-y-2"><div className="flex items-center justify-between gap-2"><div><strong>{sub.title}</strong><p className="text-xs text-fg-muted">{sub.invite_only ? 'Invite-only' : 'Public'} · {sub.starts_at ? new Date(sub.starts_at).toLocaleString() : 'Time TBD'}</p></div><Button size="xs" onClick={save} isLoading={updateSubEventMutation.isPending}>Save details</Button></div><div className="grid gap-2 sm:grid-cols-3"><Input id={`sub-${sub.id}-eventType`} defaultValue={meta.eventType || ''} placeholder="eventType: rehearsal_dinner" /><Input id={`sub-${sub.id}-location`} defaultValue={meta.location || ''} placeholder="Location/address" /><Input id={`sub-${sub.id}-host`} defaultValue={meta.host || ''} placeholder="Host" /><Input id={`sub-${sub.id}-dressCode`} defaultValue={meta.dressCode || ''} placeholder="Dress code" /><Input id={`sub-${sub.id}-parking`} defaultValue={meta.parking || ''} placeholder="Parking" /><Input id={`sub-${sub.id}-dietaryFields`} defaultValue={meta.dietaryFields || ''} placeholder="Dietary notes" /><Input id={`sub-${sub.id}-contactName`} defaultValue={meta.contactName || ''} placeholder="Contact name" /><Input id={`sub-${sub.id}-contactEmail`} defaultValue={meta.contactEmail || ''} placeholder="Contact email" /><Input id={`sub-${sub.id}-lateArrivalInstructions`} defaultValue={meta.lateArrivalInstructions || ''} placeholder="Late-arrival instructions" /></div><textarea id={`sub-${sub.id}-helpText`} defaultValue={meta.helpText || ''} className="min-h-16 w-full rounded-md border border-border bg-surface p-2 text-sm" placeholder="Guest help text for this sub-event…" /></div>;
              })}
            </CardContent>
          </Card>

          {/* Automated SMS Reminders Panel */}
          <Card className="bg-[#FDFBF7] border border-[#e1d5c9] shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-[#e1d5c9]">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base flex items-center gap-2 text-brand font-black font-serif">
                  <MessageSquare className="w-4 h-4 text-brand" /> Automated
                  Low-Velocity SMS Reminders
                </CardTitle>
                <button
                  type="button"
                  aria-label="Automated Low-Velocity SMS Reminders"
                  onClick={() => {
                    setEnableSmsReminders(!enableSmsReminders);
                    setIsDirty(true);
                  }}
                  className={cn(
                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0",
                    enableSmsReminders ? "bg-emerald-600" : "bg-gray-200",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                      enableSmsReminders ? "translate-x-4" : "translate-x-1",
                    )}
                  />
                </button>
              </div>
              <CardDescription className="text-xs text-fg-subtle">
                Automatically dispatch text reminders to guests whose RSVPs are
                pending within 7 days of the deadline.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4 bg-white">
              {enableSmsReminders && (
                <div className="space-y-3.5 animate-in slide-in-from-top-2 duration-200">
                  <div className="space-y-1">
                    <Label
                      htmlFor="smsTemplateInput"
                      className="text-xs font-bold text-fg-subtle uppercase block mb-1"
                    >
                      SMS Message Template
                    </Label>
                    <textarea
                      id="smsTemplateInput"
                      rows={3}
                      className="w-full text-xs p-2.5 rounded-lg border border-[#e1d5c9] bg-[#FDFBF7] font-semibold text-fg-muted focus-visible:outline-none"
                      value={smsTemplate}
                      onChange={(e) => {
                        setSmsTemplate(e.target.value);
                        setIsDirty(true);
                      }}
                    />
                    <span className="text-[10px] text-fg-subtle font-semibold block leading-tight">
                      Supported variables:{" "}
                      <strong className="text-fg font-black">
                        {"{{guest_name}}"}
                      </strong>
                      ,{" "}
                      <strong className="text-fg font-black">
                        {"{{rsvp_deadline}}"}
                      </strong>
                      ,{" "}
                      <strong className="text-fg font-black">
                        {"{{portal_link}}"}
                      </strong>
                      .
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live Mobile Mockup Preview */}
        <div className="lg:col-span-1 sticky top-4 flex flex-col items-center">
          <Card className="border-[#e1d5c9] bg-[#FDFBF7] shadow-lg overflow-hidden flex flex-col items-center p-6 min-h-[500px] w-full rounded-2xl">
            <h3 className="font-serif font-black text-xs uppercase tracking-wider text-brand mb-4 flex items-center gap-1.5 self-start">
              📱 Live Mobile RSVP Preview
            </h3>

            {/* Phone container mockup */}
            <div className="w-[300px] h-[550px] bg-zinc-950 rounded-[40px] border-[10px] border-zinc-900 shadow-2xl relative overflow-hidden flex flex-col p-1">
              {/* Phone Speaker Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 h-4 w-28 bg-zinc-900 rounded-b-xl z-20"></div>

              {/* Inside Screen Content */}
              <div
                className={cn(
                  "flex-1 rounded-[30px] overflow-y-auto flex flex-col p-4 text-center relative scrollbar-none transition-all",
                  rsvpTheme === "modern_minimalist" &&
                    "bg-white text-black font-sans border-0",
                  rsvpTheme === "classic_vintage" &&
                    "bg-[#FDFBF7] text-[#2C2A29] font-serif border-4 border-double border-[#e1d5c9] p-3",
                  rsvpTheme === "bohemian_chic" &&
                    "bg-orange-50/30 text-amber-950 font-serif border border-orange-200/50",
                )}
              >
                {/* Cover Top Portion */}
                <div
                  className={cn(
                    "pt-6 pb-4 flex flex-col items-center",
                    rsvpTheme === "modern_minimalist" &&
                      "border-b border-black/10",
                    rsvpTheme === "classic_vintage" &&
                      "border-b border-[#e1d5c9]",
                    rsvpTheme === "bohemian_chic" &&
                      "border-b border-orange-200",
                  )}
                >
                  <Heart
                    className="h-8 w-8 mb-2 animate-bounce"
                    style={{ color: customBrandColor }}
                  />
                  <h1
                    className={cn(
                      "text-sm font-black tracking-tight",
                      rsvpTheme === "modern_minimalist" &&
                        "font-sans uppercase tracking-widest",
                      rsvpTheme === "classic_vintage" &&
                        "font-serif text-base italic",
                      rsvpTheme === "bohemian_chic" &&
                        "font-serif font-bold text-orange-800",
                    )}
                    style={{ color: customBrandColor }}
                  >
                    {welcomeTitle}
                  </h1>
                  <p className="text-[10px] text-fg-subtle font-medium mt-1 leading-relaxed max-w-[200px] italic">
                    "{tagline}"
                  </p>
                </div>

                {/* RSVP Mock Form Section */}
                <div className="py-4 text-left font-sans text-xs font-semibold text-fg space-y-3.5 flex-1">
                  <h4
                    className={cn(
                      "text-[10px] uppercase font-bold text-fg-subtle border-b pb-1",
                      rsvpTheme === "modern_minimalist" && "border-black/15",
                      rsvpTheme === "classic_vintage" && "border-[#e1d5c9]",
                    )}
                  >
                    Guest RSVP Form
                  </h4>

                  <div>
                    <label className="text-[10px] text-fg-subtle block">
                      Select Your Name
                    </label>
                    <div className="mt-1 h-8 w-full border rounded-lg bg-white px-2 flex items-center text-fg-subtle">
                      Select name...
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        checked
                        readOnly
                        className="accent-brand"
                        style={{ accentColor: customBrandColor }}
                      />{" "}
                      Attending
                    </label>
                    <label className="flex items-center gap-1.5 opacity-60">
                      <input type="radio" checked={false} readOnly /> Declined
                    </label>
                  </div>

                  {enableDietaryDetails && (
                    <div className="space-y-1 animate-in slide-in-from-top-2">
                      <label className="text-[10px] text-fg-subtle block">
                        Dietary Restrictions
                      </label>
                      <div className="h-8 w-full border rounded-lg bg-white px-2 flex items-center text-fg-muted italic text-[11px]">
                        e.g. Gluten-Free, Vegan...
                      </div>
                    </div>
                  )}

                  {enableSongRequests && (
                    <div className="space-y-1 animate-in slide-in-from-top-2">
                      <label className="text-[10px] text-fg-subtle block">
                        Song Request
                      </label>
                      <div className="h-8 w-full border rounded-lg bg-white px-2 flex items-center text-fg-muted italic text-[11px]">
                        e.g. Love On Top - Beyoncé...
                      </div>
                    </div>
                  )}

                  {enableLodgingChoices && (
                    <div className="space-y-1 animate-in slide-in-from-top-2">
                      <label className="text-[10px] text-fg-subtle block">
                        On-Site Lodging Request
                      </label>
                      <div className="flex gap-4 mt-1">
                        <label className="flex items-center gap-1.5">
                          <input type="radio" checked readOnly /> Yes
                        </label>
                        <label className="flex items-center gap-1.5">
                          <input type="radio" checked={false} readOnly /> No
                        </label>
                      </div>
                    </div>
                  )}

                  <Button
                    size="sm"
                    disabled
                    className="w-full h-9 font-bold text-xs uppercase rounded-xl tracking-wider shadow-md text-white mt-2"
                    style={{ backgroundColor: customBrandColor }}
                  >
                    Submit RSVP
                  </Button>
                </div>
              </div>
            </div>
          </Card>
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


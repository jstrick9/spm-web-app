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
import { Button } from "../../../../ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../../../ui/Card";
import { Input } from "../../../../ui/Input";
import { Label } from "../../../../ui/Label";

export interface PortalDesignerCardProps {
  welcomeTitle: any;
  setWelcomeTitle: React.Dispatch<React.SetStateAction<any>>;
  tagline: any;
  setTagline: React.Dispatch<React.SetStateAction<any>>;
  customBrandColor: any;
  setCustomBrandColor: React.Dispatch<React.SetStateAction<any>>;
  enableSongRequests: any;
  setEnableSongRequests: React.Dispatch<React.SetStateAction<any>>;
  enableDietaryDetails: any;
  setEnableDietaryDetails: React.Dispatch<React.SetStateAction<any>>;
  enableLodgingChoices: any;
  setEnableLodgingChoices: React.Dispatch<React.SetStateAction<any>>;
  faqText: any;
  setFaqText: React.Dispatch<React.SetStateAction<any>>;
  transportationText: any;
  setTransportationText: React.Dispatch<React.SetStateAction<any>>;
  registryLinks: any;
  setRegistryLinks: React.Dispatch<React.SetStateAction<any>>;
  giftLinksText: any;
  setGiftLinksText: React.Dispatch<React.SetStateAction<any>>;
  cardsGiftTableLocation: any;
  setCardsGiftTableLocation: React.Dispatch<React.SetStateAction<any>>;
  registryGiftNote: any;
  setRegistryGiftNote: React.Dispatch<React.SetStateAction<any>>;
  venueAddress: any;
  setVenueAddress: React.Dispatch<React.SetStateAction<any>>;
  mapUrl: any;
  setMapUrl: React.Dispatch<React.SetStateAction<any>>;
  parkingEntrance: any;
  setParkingEntrance: React.Dispatch<React.SetStateAction<any>>;
  dropoffPoint: any;
  setDropoffPoint: React.Dispatch<React.SetStateAction<any>>;
  rideshareInstructions: any;
  setRideshareInstructions: React.Dispatch<React.SetStateAction<any>>;
  shuttleSchedule: any;
  setShuttleSchedule: React.Dispatch<React.SetStateAction<any>>;
  shuttlePickupLocation: any;
  setShuttlePickupLocation: React.Dispatch<React.SetStateAction<any>>;
  shuttleDropoffLocation: any;
  setShuttleDropoffLocation: React.Dispatch<React.SetStateAction<any>>;
  lastShuttleReminder: any;
  setLastShuttleReminder: React.Dispatch<React.SetStateAction<any>>;
  roomBlockDetails: any;
  setRoomBlockDetails: React.Dispatch<React.SetStateAction<any>>;
  accessibleParking: any;
  setAccessibleParking: React.Dispatch<React.SetStateAction<any>>;
  mobilityDropoff: any;
  setMobilityDropoff: React.Dispatch<React.SetStateAction<any>>;
  accessibleEntrance: any;
  setAccessibleEntrance: React.Dispatch<React.SetStateAction<any>>;
  accessibleRestroom: any;
  setAccessibleRestroom: React.Dispatch<React.SetStateAction<any>>;
  accessibleSeating: any;
  setAccessibleSeating: React.Dispatch<React.SetStateAction<any>>;
  accessibilityHelpText: any;
  setAccessibilityHelpText: React.Dispatch<React.SetStateAction<any>>;
  accessibilityContactLabel: any;
  setAccessibilityContactLabel: React.Dispatch<React.SetStateAction<any>>;
  accessibilityContactEmail: any;
  setAccessibilityContactEmail: React.Dispatch<React.SetStateAction<any>>;
  accessibilityContactPhone: any;
  setAccessibilityContactPhone: React.Dispatch<React.SetStateAction<any>>;
  privacySummary: any;
  setPrivacySummary: React.Dispatch<React.SetStateAction<any>>;
  dataRetentionStatement: any;
  setDataRetentionStatement: React.Dispatch<React.SetStateAction<any>>;
  privacyContactLabel: any;
  setPrivacyContactLabel: React.Dispatch<React.SetStateAction<any>>;
  privacyContactEmail: any;
  setPrivacyContactEmail: React.Dispatch<React.SetStateAction<any>>;
  privacyRequestsEnabled: any;
  guestDirectoryEnabled: boolean;
  setGuestDirectoryEnabled: (v: boolean) => void;
  setPrivacyRequestsEnabled: React.Dispatch<React.SetStateAction<any>>;
  reminderGuestFriendlyCopy: any;
  setReminderGuestFriendlyCopy: React.Dispatch<React.SetStateAction<any>>;
  defaultQuietHoursStart: any;
  setDefaultQuietHoursStart: React.Dispatch<React.SetStateAction<any>>;
  defaultQuietHoursEnd: any;
  setDefaultQuietHoursEnd: React.Dispatch<React.SetStateAction<any>>;
  rsvpReminderEnabled: any;
  setRsvpReminderEnabled: React.Dispatch<React.SetStateAction<any>>;
  scheduleReminderEnabled: any;
  setScheduleReminderEnabled: React.Dispatch<React.SetStateAction<any>>;
  rainPlanReminderEnabled: any;
  setRainPlanReminderEnabled: React.Dispatch<React.SetStateAction<any>>;
  shuttleReminderEnabled: any;
  setShuttleReminderEnabled: React.Dispatch<React.SetStateAction<any>>;
  dayBeforeReminderEnabled: any;
  setDayBeforeReminderEnabled: React.Dispatch<React.SetStateAction<any>>;
  dayOfReminderEnabled: any;
  setDayOfReminderEnabled: React.Dispatch<React.SetStateAction<any>>;
  dayOfModeEnabled: any;
  setDayOfModeEnabled: React.Dispatch<React.SetStateAction<any>>;
  dayOfModeTitle: any;
  setDayOfModeTitle: React.Dispatch<React.SetStateAction<any>>;
  dayOfContactLabel: any;
  setDayOfContactLabel: React.Dispatch<React.SetStateAction<any>>;
  dayOfContactEmail: any;
  setDayOfContactEmail: React.Dispatch<React.SetStateAction<any>>;
  dayOfContactPhone: any;
  setDayOfContactPhone: React.Dispatch<React.SetStateAction<any>>;
  dayOfPushCopy: any;
  setDayOfPushCopy: React.Dispatch<React.SetStateAction<any>>;
  guestMemoryEnabled: any;
  setGuestMemoryEnabled: React.Dispatch<React.SetStateAction<any>>;
  guestPhotoUploadEnabled: any;
  setGuestPhotoUploadEnabled: React.Dispatch<React.SetStateAction<any>>;
  guestPostEventFeedbackEnabled: any;
  setGuestPostEventFeedbackEnabled: React.Dispatch<React.SetStateAction<any>>;
  postEventThankYouTitle: any;
  setPostEventThankYouTitle: React.Dispatch<React.SetStateAction<any>>;
  postEventThankYouMessage: any;
  setPostEventThankYouMessage: React.Dispatch<React.SetStateAction<any>>;
  memoryPhotoLinksText: any;
  setMemoryPhotoLinksText: React.Dispatch<React.SetStateAction<any>>;
  guestPhotoConsentCopy: any;
  setGuestPhotoConsentCopy: React.Dispatch<React.SetStateAction<any>>;
  guestPhotoModerationCopy: any;
  setGuestPhotoModerationCopy: React.Dispatch<React.SetStateAction<any>>;
  guestNpsQuestion: any;
  setGuestNpsQuestion: React.Dispatch<React.SetStateAction<any>>;
  destinationTravelFaq: any;
  setDestinationTravelFaq: React.Dispatch<React.SetStateAction<any>>;
  weatherRainPlanNote: any;
  setWeatherRainPlanNote: React.Dispatch<React.SetStateAction<any>>;
  seatingPrivacyMode: any;
  setSeatingPrivacyMode: React.Dispatch<React.SetStateAction<any>>;
  wayfindingLabelsText: any;
  setWayfindingLabelsText: React.Dispatch<React.SetStateAction<any>>;
  outdoorMapNote: any;
  setOutdoorMapNote: React.Dispatch<React.SetStateAction<any>>;
  indoorRainPlanMapNote: any;
  setIndoorRainPlanMapNote: React.Dispatch<React.SetStateAction<any>>;
  accessibilityRouteDetails: any;
  setAccessibilityRouteDetails: React.Dispatch<React.SetStateAction<any>>;
  arPreviewUrl: any;
  setArPreviewUrl: React.Dispatch<React.SetStateAction<any>>;
  arPreviewDescription: any;
  setArPreviewDescription: React.Dispatch<React.SetStateAction<any>>;
  dressCodeSummary: any;
  setDressCodeSummary: React.Dispatch<React.SetStateAction<any>>;
  dressCodeExamples: any;
  setDressCodeExamples: React.Dispatch<React.SetStateAction<any>>;
  dressCodeWeather: any;
  setDressCodeWeather: React.Dispatch<React.SetStateAction<any>>;
  dressCodeRainPlan: any;
  setDressCodeRainPlan: React.Dispatch<React.SetStateAction<any>>;
  kidsPolicy: any;
  setKidsPolicy: React.Dispatch<React.SetStateAction<any>>;
  plusOneRules: any;
  setPlusOneRules: React.Dispatch<React.SetStateAction<any>>;
  phonePhotoPolicy: any;
  setPhonePhotoPolicy: React.Dispatch<React.SetStateAction<any>>;
  smokingVapingPolicy: any;
  setSmokingVapingPolicy: React.Dispatch<React.SetStateAction<any>>;
  barAlcoholPolicy: any;
  setBarAlcoholPolicy: React.Dispatch<React.SetStateAction<any>>;
  guestFaqItemsText: any;
  setGuestFaqItemsText: React.Dispatch<React.SetStateAction<any>>;
  faqLanguagesText: any;
  setFaqLanguagesText: React.Dispatch<React.SetStateAction<any>>;
  guestQuestionsEnabled: any;
  setGuestQuestionsEnabled: React.Dispatch<React.SetStateAction<any>>;
  guestQuestionContactLabel: any;
  setGuestQuestionContactLabel: React.Dispatch<React.SetStateAction<any>>;
  guestQuestionContactEmail: any;
  setGuestQuestionContactEmail: React.Dispatch<React.SetStateAction<any>>;
  rsvpEditWindowDays: any;
  setRsvpEditWindowDays: React.Dispatch<React.SetStateAction<any>>;
  mealOptionsText: any;
  setMealOptionsText: React.Dispatch<React.SetStateAction<any>>;
  rsvpTheme: any;
  setRsvpTheme: React.Dispatch<React.SetStateAction<any>>;
  setIsDirty: React.Dispatch<React.SetStateAction<any>>;
  data: any;
  guests: any[];
}

export function PortalDesignerCard({ welcomeTitle, setWelcomeTitle, tagline, setTagline, customBrandColor, setCustomBrandColor, enableSongRequests, setEnableSongRequests, enableDietaryDetails, setEnableDietaryDetails, enableLodgingChoices, setEnableLodgingChoices, faqText, setFaqText, transportationText, setTransportationText, registryLinks, setRegistryLinks, giftLinksText, setGiftLinksText, cardsGiftTableLocation, setCardsGiftTableLocation, registryGiftNote, setRegistryGiftNote, venueAddress, setVenueAddress, mapUrl, setMapUrl, parkingEntrance, setParkingEntrance, dropoffPoint, setDropoffPoint, rideshareInstructions, setRideshareInstructions, shuttleSchedule, setShuttleSchedule, shuttlePickupLocation, setShuttlePickupLocation, shuttleDropoffLocation, setShuttleDropoffLocation, lastShuttleReminder, setLastShuttleReminder, roomBlockDetails, setRoomBlockDetails, accessibleParking, setAccessibleParking, mobilityDropoff, setMobilityDropoff, accessibleEntrance, setAccessibleEntrance, accessibleRestroom, setAccessibleRestroom, accessibleSeating, setAccessibleSeating, accessibilityHelpText, setAccessibilityHelpText, accessibilityContactLabel, setAccessibilityContactLabel, accessibilityContactEmail, setAccessibilityContactEmail, accessibilityContactPhone, setAccessibilityContactPhone, privacySummary, setPrivacySummary, dataRetentionStatement, setDataRetentionStatement, privacyContactLabel, setPrivacyContactLabel, privacyContactEmail, setPrivacyContactEmail, privacyRequestsEnabled, setPrivacyRequestsEnabled, guestDirectoryEnabled, setGuestDirectoryEnabled, reminderGuestFriendlyCopy, setReminderGuestFriendlyCopy, defaultQuietHoursStart, setDefaultQuietHoursStart, defaultQuietHoursEnd, setDefaultQuietHoursEnd, rsvpReminderEnabled, setRsvpReminderEnabled, scheduleReminderEnabled, setScheduleReminderEnabled, rainPlanReminderEnabled, setRainPlanReminderEnabled, shuttleReminderEnabled, setShuttleReminderEnabled, dayBeforeReminderEnabled, setDayBeforeReminderEnabled, dayOfReminderEnabled, setDayOfReminderEnabled, dayOfModeEnabled, setDayOfModeEnabled, dayOfModeTitle, setDayOfModeTitle, dayOfContactLabel, setDayOfContactLabel, dayOfContactEmail, setDayOfContactEmail, dayOfContactPhone, setDayOfContactPhone, dayOfPushCopy, setDayOfPushCopy, guestMemoryEnabled, setGuestMemoryEnabled, guestPhotoUploadEnabled, setGuestPhotoUploadEnabled, guestPostEventFeedbackEnabled, setGuestPostEventFeedbackEnabled, postEventThankYouTitle, setPostEventThankYouTitle, postEventThankYouMessage, setPostEventThankYouMessage, memoryPhotoLinksText, setMemoryPhotoLinksText, guestPhotoConsentCopy, setGuestPhotoConsentCopy, guestPhotoModerationCopy, setGuestPhotoModerationCopy, guestNpsQuestion, setGuestNpsQuestion, destinationTravelFaq, setDestinationTravelFaq, weatherRainPlanNote, setWeatherRainPlanNote, seatingPrivacyMode, setSeatingPrivacyMode, wayfindingLabelsText, setWayfindingLabelsText, outdoorMapNote, setOutdoorMapNote, indoorRainPlanMapNote, setIndoorRainPlanMapNote, accessibilityRouteDetails, setAccessibilityRouteDetails, arPreviewUrl, setArPreviewUrl, arPreviewDescription, setArPreviewDescription, dressCodeSummary, setDressCodeSummary, dressCodeExamples, setDressCodeExamples, dressCodeWeather, setDressCodeWeather, dressCodeRainPlan, setDressCodeRainPlan, kidsPolicy, setKidsPolicy, plusOneRules, setPlusOneRules, phonePhotoPolicy, setPhonePhotoPolicy, smokingVapingPolicy, setSmokingVapingPolicy, barAlcoholPolicy, setBarAlcoholPolicy, guestFaqItemsText, setGuestFaqItemsText, faqLanguagesText, setFaqLanguagesText, guestQuestionsEnabled, setGuestQuestionsEnabled, guestQuestionContactLabel, setGuestQuestionContactLabel, guestQuestionContactEmail, setGuestQuestionContactEmail, rsvpEditWindowDays, setRsvpEditWindowDays, mealOptionsText, setMealOptionsText, rsvpTheme, setRsvpTheme, setIsDirty, data, guests }: PortalDesignerCardProps) {
  return (
          <Card className="bg-paper border border-paper-border shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-paper-border">
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
                  className="w-full text-xs p-2.5 rounded-lg border border-paper-border bg-white font-semibold"
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
                  className="mt-1 bg-paper border-paper-border text-xs h-9 font-semibold"
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
                  className="mt-1 bg-paper border-paper-border text-xs h-9 font-semibold"
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
                    className="h-9 w-9 rounded-md border border-paper-border cursor-pointer bg-white"
                  />
                  <Input
                    value={customBrandColor}
                    onChange={(e) => {
                      setCustomBrandColor(e.target.value);
                      setIsDirty(true);
                    }}
                    className="bg-paper border-paper-border text-xs h-9 w-28 uppercase font-semibold"
                  />
                </div>
              </div>

              <div className="pt-3 border-t space-y-3 font-semibold text-xs text-fg">
                <h4 className="text-[10px] text-fg-subtle uppercase tracking-wider font-bold">
                  Interactive RSVP Form Custom fields
                </h4>

                <label className="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-surface-2 transition-colors bg-paper border rounded-xl p-3 border-paper-border/60">
                  <input
                    type="checkbox"
                    checked={enableSongRequests}
                    onChange={(e) => {
                      setEnableSongRequests(e.target.checked);
                      setIsDirty(true);
                    }}
                    className="rounded border-paper-border text-brand accent-brand h-4 w-4 cursor-pointer"
                  />
                  <div>
                    <div>Collect Song &amp; Music Requests</div>
                    <div className="text-[10px] text-fg-subtle font-normal">
                      Let guests specify songs they want played.
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-surface-2 transition-colors bg-paper border rounded-xl p-3 border-paper-border/60">
                  <input
                    type="checkbox"
                    checked={enableDietaryDetails}
                    onChange={(e) => {
                      setEnableDietaryDetails(e.target.checked);
                      setIsDirty(true);
                    }}
                    className="rounded border-paper-border text-brand accent-brand h-4 w-4 cursor-pointer"
                  />
                  <div>
                    <div>Collect Detailed Dietary Restrictions</div>
                    <div className="text-[10px] text-fg-subtle font-normal">
                      Let guests write custom allergy or menu notes.
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-surface-2 transition-colors bg-paper border rounded-xl p-3 border-paper-border/60">
                  <input
                    type="checkbox"
                    checked={enableLodgingChoices}
                    onChange={(e) => {
                      setEnableLodgingChoices(e.target.checked);
                      setIsDirty(true);
                    }}
                    className="rounded border-paper-border text-brand accent-brand h-4 w-4 cursor-pointer"
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
                    <div className="rounded-md border border-warning/30 bg-warning-soft/20 p-2 text-xs">
                      <label className="flex items-center gap-2"><input type="checkbox" checked={guestDirectoryEnabled} onChange={(e) => { setGuestDirectoryEnabled(e.target.checked); setIsDirty(true); }} /> Enable generic guest directory (guests can find names on the portal)</label>
                      <p className="mt-1 text-fg-muted">Privacy note: directory visitors see guest <strong>names only</strong> — RSVP status, seating, lodging, and sub-event details stay hidden until a guest uses their secure invitation link.</p>
                    </div>
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
  );
}

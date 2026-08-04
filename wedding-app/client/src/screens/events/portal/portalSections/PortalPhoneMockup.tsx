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
import { cn } from "../../../../ui/lib/cn";

export interface PortalPhoneMockupProps {
  welcomeTitle: any;
  tagline: any;
  customBrandColor: any;
  enableSongRequests: any;
  enableDietaryDetails: any;
  enableLodgingChoices: any;
  rsvpTheme: any;
}

export function PortalPhoneMockup({ welcomeTitle, tagline, customBrandColor, enableSongRequests, enableDietaryDetails, enableLodgingChoices, rsvpTheme }: PortalPhoneMockupProps) {
  return (
          <Card className="border-paper-border bg-paper shadow-lg overflow-hidden flex flex-col items-center p-6 min-h-[500px] w-full rounded-2xl">
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
                    "bg-paper text-paper-ink font-serif border-4 border-double border-paper-border p-3",
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
                      "border-b border-paper-border",
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
                      rsvpTheme === "classic_vintage" && "border-paper-border",
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
  );
}

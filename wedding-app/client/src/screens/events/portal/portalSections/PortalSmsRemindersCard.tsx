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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../../../ui/Card";
import { Label } from "../../../../ui/Label";
import { cn } from "../../../../ui/lib/cn";

export interface PortalSmsRemindersCardProps {
  enableSmsReminders: any;
  setEnableSmsReminders: React.Dispatch<React.SetStateAction<any>>;
  smsTemplate: any;
  setSmsTemplate: React.Dispatch<React.SetStateAction<any>>;
  setIsDirty: React.Dispatch<React.SetStateAction<any>>;
  guests: any[];
}

export function PortalSmsRemindersCard({ enableSmsReminders, setEnableSmsReminders, smsTemplate, setSmsTemplate, setIsDirty, guests }: PortalSmsRemindersCardProps) {
  return (
          <Card className="bg-paper border border-paper-border shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-paper-border">
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
                      className="w-full text-xs p-2.5 rounded-lg border border-paper-border bg-paper font-semibold text-fg-muted focus-visible:outline-none"
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
  );
}

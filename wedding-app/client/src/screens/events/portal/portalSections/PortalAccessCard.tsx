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
import { Label } from "../../../../ui/Label";
import { cn } from "../../../../ui/lib/cn";

export interface PortalAccessCardProps {
  localEnabled: any;
  toast: any;
  handleToggleEnable: () => void;
  portalUrl: string;
  guests: any[];
}

export function PortalAccessCard({ localEnabled, toast, handleToggleEnable, portalUrl, guests }: PortalAccessCardProps) {
  return (
          <Card className="bg-paper border border-paper-border shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="flex flex-row items-start justify-between pb-4 border-b border-paper-border">
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
              <div className="bg-paper rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border border-paper-border">
                <div className="space-y-1">
                  <Label className="flex items-center gap-2 mb-1 text-xs font-bold text-fg-muted uppercase tracking-wider">
                    <LinkIcon className="w-4 h-4 text-brand" /> Shareable Link
                  </Label>
                  <div className="text-xs font-mono text-fg-subtle select-all bg-white px-3 py-1.5 rounded border border-paper-border">
                    {portalUrl}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="text-xs font-bold border-paper-border"
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
                      className="text-xs font-bold bg-paper-ink hover:bg-[#3d3b3a] text-white"
                    >
                      <ExternalLink className="w-4 h-4 mr-1" /> Visit
                    </Button>
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
  );
}

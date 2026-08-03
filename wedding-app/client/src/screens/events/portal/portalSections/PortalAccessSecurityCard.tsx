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
import { Input } from "../../../../ui/Input";
import { Label } from "../../../../ui/Label";

export interface PortalAccessSecurityCardProps {
  hasPassword: any;
  newPassword: any;
  setNewPassword: React.Dispatch<React.SetStateAction<any>>;
  accessStartsAt: any;
  setAccessStartsAt: React.Dispatch<React.SetStateAction<any>>;
  accessEndsAt: any;
  setAccessEndsAt: React.Dispatch<React.SetStateAction<any>>;
  gracePeriodHours: any;
  setGracePeriodHours: React.Dispatch<React.SetStateAction<any>>;
  setIsDirty: React.Dispatch<React.SetStateAction<any>>;
  ownerApprovalRequired: any;
  setOwnerApprovalRequired: React.Dispatch<React.SetStateAction<any>>;
  data: any;
  handleTogglePassword: any;
  guests: any[];
}

export function PortalAccessSecurityCard({ hasPassword, newPassword, setNewPassword, accessStartsAt, setAccessStartsAt, accessEndsAt, setAccessEndsAt, gracePeriodHours, setGracePeriodHours, setIsDirty, ownerApprovalRequired, setOwnerApprovalRequired, data, handleTogglePassword, guests }: PortalAccessSecurityCardProps) {
  return (
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
  );
}

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
import { Button } from "../../../ui/Button";
import { Badge } from "../../../ui/Badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../../ui/Card";
import { useToast } from "../../../ui/Toast";
import { cn } from "../../../ui/lib/cn";

export function ManagerPortalQaPanel({
  qaChecks,
  issues,
  pendingGuests,
  lockedOutGuests,
  accessExpired,
  hasPassword,
  ownerApprovalRequired,
  setOwnerApprovalRequired,
  pendingPortalChange,
  setPendingPortalChange,
  portalUrl,
  supportMessage,
  setSupportMessage,
}: {
  qaChecks: Array<{ label: string; done: boolean }>;
  issues: string[];
  pendingGuests: number;
  lockedOutGuests: number;
  accessExpired: boolean;
  hasPassword: boolean;
  ownerApprovalRequired: boolean;
  setOwnerApprovalRequired: (value: boolean) => void;
  pendingPortalChange: string;
  setPendingPortalChange: (value: string) => void;
  portalUrl: string;
  supportMessage: string;
  setSupportMessage: (value: string) => void;
}) {
  const { toast } = useToast();
  const readyCount = qaChecks.filter((check) => check.done).length;
  const readinessPct = Math.round(
    (readyCount / Math.max(1, qaChecks.length)) * 100,
  );
  const supportItems = [
    pendingGuests > 0
      ? `${pendingGuests} guests still need RSVP support.`
      : null,
    lockedOutGuests > 0
      ? `${lockedOutGuests} guests have portal access disabled.`
      : null,
    accessExpired
      ? "Access window expired; guests may report link failures."
      : null,
    !hasPassword
      ? "No password required; guests may ask whether a password is missing."
      : null,
  ].filter(Boolean) as string[];
  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="border-brand/20 bg-brand/5">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-brand" /> Guest portal QA
                checklist
              </CardTitle>
              <CardDescription>
                Manager preview checklist before the portal goes live.
              </CardDescription>
            </div>
            <Badge
              variant={
                readinessPct >= 85
                  ? "success"
                  : readinessPct >= 60
                    ? "warning"
                    : "danger"
              }
            >
              {readinessPct}% ready
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {qaChecks.map((check) => (
              <div
                key={check.label}
                className="rounded-lg border border-border bg-surface p-2 text-xs flex items-center gap-2"
              >
                <span
                  className={cn(
                    "inline-flex h-5 w-5 items-center justify-center rounded-full",
                    check.done
                      ? "bg-success text-success-soft"
                      : "bg-warning-soft text-warning",
                  )}
                >
                  {check.done ? "✓" : "!"}
                </span>
                {check.label}
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-surface p-3 text-xs text-fg-muted">
            <strong className="text-fg">What guests see:</strong> public event
            information, RSVP form, selected FAQ, transportation, registry,
            lodging/song/dietary fields you enable, and their portal access
            state.
            <br />
            <strong className="text-fg">What internal teams see:</strong> guest
            records, manager notes, support inbox, issue analytics, access
            configuration, and approval workflow.
          </div>
          <label className="flex items-start gap-2 rounded-xl border border-brand/20 bg-surface p-3 text-xs text-fg-muted">
            <input
              type="checkbox"
              checked={ownerApprovalRequired}
              onChange={(e) => setOwnerApprovalRequired(e.target.checked)}
              className="mt-0.5 accent-brand"
            />
            <span>
              <strong className="text-fg">Owner approval required:</strong>{" "}
              manager changes to portal availability are staged until
              owner/admin review.
            </span>
          </label>
          {pendingPortalChange && (
            <div className="rounded-xl border border-warning/30 bg-warning-soft/20 p-3 text-xs text-warning">
              Pending portal change approval:{" "}
              <strong>{pendingPortalChange}</strong>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-brand" /> Portal issue
              monitor
            </CardTitle>
            <CardDescription>
              Failed RSVPs, locked-out guests, expired access, and missing
              password risk.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {issues.length ? (
              issues.map((issue) => (
                <div
                  key={issue}
                  className="rounded-lg border border-warning/30 bg-warning-soft/20 p-2 text-xs text-warning"
                >
                  {issue}
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-success/30 bg-success-soft p-2 text-xs text-success">
                No portal blockers detected.
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Inbox className="h-4 w-4 text-brand" /> Portal support inbox
            </CardTitle>
            <CardDescription>
              Internal queue for guest portal support issues.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {supportItems.length ? (
              supportItems.map((item) => (
                <div
                  key={item}
                  className="rounded-lg border border-border bg-surface-2 p-2 text-xs text-fg-muted"
                >
                  {item}
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-border p-2 text-xs text-fg-muted">
                No support issues detected.
              </p>
            )}
            <textarea
              className="min-h-20 w-full rounded-md border border-border bg-surface p-2 text-sm"
              value={supportMessage}
              onChange={(e) => setSupportMessage(e.target.value)}
              placeholder="Add support note: guest locked out, RSVP failed, wrong email…"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                toast({
                  title: "Support note staged",
                  description:
                    "Add this to the event notes or owner escalation if follow-up is required.",
                });
                setSupportMessage("");
              }}
            >
              Stage support note
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-brand" /> Manager QA test invite
            </CardTitle>
            <CardDescription>
              Send yourself a test invite before sharing with guests.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href={`mailto:?subject=Guest portal QA test&body=Please review this guest portal before it goes live:%0A${encodeURIComponent(portalUrl)}`}
            >
              <Button variant="outline" className="w-full">
                Send test invite to myself
              </Button>
            </a>
            <p className="text-[11px] text-fg-muted">
              This opens your email client with the portal QA link so a manager
              can test on phone and desktop.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


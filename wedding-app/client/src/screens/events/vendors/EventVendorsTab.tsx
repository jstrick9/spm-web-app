import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Truck,
  ExternalLink,
  Mail,
  Phone,
  ShieldCheck,
  ShieldAlert,
  Edit,
  CreditCard,
  Calendar,
  MessageSquare,
  FileText,
  AlertTriangle,
  ClipboardList,
  UserCheck,
  PackageCheck,
  RefreshCw,
  QrCode,
  Eye,
  MapPin,
} from "lucide-react";
import { sdk } from "../../../sdk";
import { Button } from "../../../ui/Button";
import { Input } from "../../../ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/Card";
import { Skeleton } from "../../../ui/Skeleton";
import { Badge } from "../../../ui/Badge";
import { useToast } from "../../../ui/Toast";
import { usePrompt } from "../../../ui/usePrompt";
import { DataTable, type Column } from "../../../ui/DataTable";
import { Link } from "lucide-react";
import { SdkVendor } from "../../../sdk/types";
import { VendorFormDialog } from "./VendorFormDialog";
import { VendorPaymentDialog } from "./VendorPaymentDialog";
import { VendorTimelineChart } from "./VendorTimelineChart";
import { VendorCommunicationsHub } from "./hub/VendorCommunicationsHub";
import { VendorMatchPanel } from "./VendorMatchPanel";

interface Props {
  eventId: string;
  organizationId: string;
}


// Decomposed panels (see vendorPanels.tsx).
import { VendorOperationsBoard, VendorLayoutPacketReview, PreferredVendorComplianceDashboard, VendorExceptionMetric, VendorManagerPanel, VendorActionList } from './vendorPanels';

export function EventVendorsTab({ eventId, organizationId }: Props) {
  const { ask, promptNode } = usePrompt();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editVendor, setEditVendor] = useState<SdkVendor | null>(null);
  const [paymentVendor, setPaymentVendor] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [generatingPortalFor, setGeneratingPortalFor] = useState<string | null>(
    null,
  );
  const [revokingPortalFor, setRevokingPortalFor] = useState<string | null>(
    null,
  );
  const [portalExpiryDays, setPortalExpiryDays] = useState(30);
  const [inviteMessage, setInviteMessage] = useState(
    "Please complete your vendor portal checklist, logistics details, and COI before the event.",
  );
  const [managerMode] = useState(() => {
    try {
      return localStorage.getItem("wvi_registration_role") === "venue_manager";
    } catch {
      return false;
    }
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["vendors", eventId],
    queryFn: () => sdk.vendors.list(organizationId, { eventId }),
  });

  const { data: portalTokensData } = useQuery({
    queryKey: ["vendor-portal-tokens", organizationId],
    queryFn: () => sdk.vendors.listPortalTokens(organizationId),
    staleTime: 30_000,
  });

  const vendors = data?.vendors || [];
  const filtered = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      (v.category && v.category.toLowerCase().includes(search.toLowerCase())),
  );

  const totalContract = vendors.reduce(
    (acc, v) => acc + (v.contract_amount_cents || 0),
    0,
  );

  const portalTokensByVendor = new Map(
    (portalTokensData?.tokens ?? []).reduce<
      Array<[string, NonNullable<typeof portalTokensData>["tokens"][number]]>
    >((acc, token) => {
      if (!acc.some(([vendorId]) => vendorId === token.vendor_id))
        acc.push([token.vendor_id, token]);
      return acc;
    }, []),
  );

  // Persist the last generated portal URL per vendor so "Preview" can
  // reopen it WITHOUT rotating the vendor's active link (VE-03).
  const rememberedPortalUrl = (vendorId: string): string | null => {
    try {
      const map = JSON.parse(localStorage.getItem("wvi_vendor_portal_urls") || "{}");
      return typeof map[vendorId] === "string" ? map[vendorId] : null;
    } catch {
      return null;
    }
  };
  const rememberPortalUrl = (vendorId: string, url: string) => {
    try {
      const map = JSON.parse(localStorage.getItem("wvi_vendor_portal_urls") || "{}");
      map[vendorId] = url;
      localStorage.setItem("wvi_vendor_portal_urls", JSON.stringify(map));
    } catch { /* private mode etc. */ }
  };

  // Preview: reopen the last generated portal URL when available (no token
  // rotation); otherwise generate one explicitly (same as Copy Secure Link).
  const previewVendorPortal = async (vendor: SdkVendor) => {
    const existing = rememberedPortalUrl(vendor.id);
    if (existing) {
      window.open(existing, "_blank", "noopener,noreferrer");
      return;
    }
    const url = await createAndCopyPortalLink(vendor);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const coiReview = useMutation({
    mutationFn: ({ vendorId, status, note }: { vendorId: string; status: 'approved' | 'changes_requested'; note?: string }) =>
      sdk.vendors.reviewCoi(vendorId, { status, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors", eventId] });
      toast({ title: "COI review saved", variant: "success" });
    },
    onError: (e: any) => toast({ title: "Could not save COI review", description: e.message, variant: "destructive" }),
  });

  const createAndCopyPortalLink = async (vendor: SdkVendor) => {
    try {
      setGeneratingPortalFor(vendor.id);
      const { token, expiresAt } = await sdk.vendors.createPortalToken(
        vendor.id,
        { expiresInDays: portalExpiryDays },
      );
      const url = `${window.location.origin}/#/vendor/${vendor.id}?token=${encodeURIComponent(token)}`;
      rememberPortalUrl(vendor.id, url);
      await navigator.clipboard.writeText(url);
      await qc.invalidateQueries({
        queryKey: ["vendor-portal-tokens", organizationId],
      });
      toast({
        title: "Secure vendor portal link copied",
        description: `Expires ${new Date(expiresAt).toLocaleDateString()}. Generating a new link revokes any prior link for ${vendor.name}.`,
        variant: "success",
      });
      return url;
    } catch (e: any) {
      toast({
        title: "Unable to create vendor portal link",
        description: e.message,
        variant: "destructive",
      });
      return null;
    } finally {
      setGeneratingPortalFor(null);
    }
  };

  const sendVendorPortalInvite = async (vendor: SdkVendor) => {
    try {
      setGeneratingPortalFor(vendor.id);
      const res = await sdk.vendors.sendPortalInvite(vendor.id, {
        expiresInDays: portalExpiryDays,
        message: inviteMessage,
      });
      if (res.delivery?.url)
        await navigator.clipboard.writeText(res.delivery.url);
      await qc.invalidateQueries({
        queryKey: ["vendor-portal-tokens", organizationId],
      });
      await qc.invalidateQueries({ queryKey: ["vendors", eventId] });
      toast({
        title: "Vendor portal invite prepared",
        description:
          res.delivery.channel === "copy_only"
            ? "No email integration was available; link copied instead."
            : `Invite sent via ${res.delivery.channel}.`,
        variant: "success",
      });
    } catch (e: any) {
      toast({
        title: "Unable to send vendor invite",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setGeneratingPortalFor(null);
    }
  };

  const revokePortalLink = async (vendor: SdkVendor) => {
    try {
      setRevokingPortalFor(vendor.id);
      await sdk.vendors.revokePortalToken(vendor.id);
      await qc.invalidateQueries({
        queryKey: ["vendor-portal-tokens", organizationId],
      });
      toast({
        title: "Vendor portal link revoked",
        description: `${vendor.name} will need a new secure link to access their portal.`,
        variant: "success",
      });
    } catch (e: any) {
      toast({
        title: "Unable to revoke vendor portal link",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setRevokingPortalFor(null);
    }
  };

  const vendorMetadata = (v: SdkVendor) =>
    typeof v.metadata === "string"
      ? JSON.parse(v.metadata || "{}")
      : v.metadata || {};

  const vendorCompletion = (v: SdkVendor) => {
    const meta = vendorMetadata(v);
    const items = [
      v.email,
      v.phone,
      v.contract_amount_cents,
      meta.arrivalTime,
      meta.departureTime,
      meta.teamSize,
      meta.coiReceived || meta.coiLink,
      meta.vendorChecklistComplete,
    ];
    return Math.round((items.filter(Boolean).length / items.length) * 100);
  };

  // COI Analytics & Compliance Status helper
  const getCoiStatus = (v: SdkVendor) => {
    const meta =
      typeof v.metadata === "string"
        ? JSON.parse(v.metadata || "{}")
        : v.metadata || {};
    if (!meta.coiReceived) {
      return {
        status: "at-risk",
        label: "At Risk (No COI)",
        insurer: null,
        policy: null,
        expires: null,
        color: "danger" as const,
      };
    }
    const expires = meta.coiExpirationDate;
    if (expires) {
      const expDate = new Date(expires);
      const today = new Date();
      // Set hours to zero for clean comparison
      expDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      if (expDate < today) {
        return {
          status: "expired",
          label: "Expired COI",
          insurer: meta.coiInsurer,
          policy: meta.coiPolicyNumber,
          expires,
          color: "danger" as const,
        };
      }
      const daysUntil = Math.ceil(
        (expDate.getTime() - today.getTime()) / 86400000,
      );
      if (daysUntil <= 30) {
        return {
          status: "expiring",
          label: "COI Expiring Soon",
          insurer: meta.coiInsurer,
          policy: meta.coiPolicyNumber,
          expires,
          color: "warning" as const,
        };
      }
    }
    return {
      status: "compliant",
      label:
        meta.coiVerificationStatus === "pending_review"
          ? "COI Pending Review"
          : "Compliant",
      insurer: meta.coiInsurer,
      policy: meta.coiPolicyNumber,
      expires,
      color:
        meta.coiVerificationStatus === "pending_review"
          ? ("warning" as const)
          : ("success" as const),
    };
  };

  const coiReviewMeta = (v: SdkVendor) => {
    const meta = vendorMetadata(v);
    const status = meta.coiVerificationStatus;
    return {
      assetId: typeof meta.coiAssetId === "string" ? meta.coiAssetId : null,
      needsReview: !!meta.coiReceived && (status === "pending_review" || status === "changes_requested"),
      reviewedBy: typeof meta.coiReviewedBy === "string" ? meta.coiReviewedBy : null,
      note: typeof meta.coiReviewNote === "string" ? meta.coiReviewNote : null,
    };
  };

  const vendorArrivalRisk = (v: SdkVendor) => {
    const meta = vendorMetadata(v);
    let score = 10;
    const reasons: string[] = [];
    if (!meta.arrivalTime) {
      score += 25;
      reasons.push("missing arrival time");
    }
    if (getCoiStatus(v).status !== "compliant") {
      score += 25;
      reasons.push("COI issue");
    }
    if (!v.phone) {
      score += 15;
      reasons.push("missing phone");
    }
    if (!meta.vendorChecklistComplete && !meta.questionnaireCompletedAt) {
      score += 15;
      reasons.push("questionnaire incomplete");
    }
    if ((v.contract_amount_cents || 0) - (v.amount_paid_cents || 0) > 0) {
      score += 10;
      reasons.push("balance due");
    }
    if (meta.unreadMessagesCount > 0) {
      score += 10;
      reasons.push("unread messages");
    }
    return { score: Math.min(100, score), reasons };
  };

  const updateVendorMetadata = async (
    vendor: SdkVendor,
    patch: Record<string, any>,
    action: string,
  ) => {
    const meta = vendorMetadata(vendor);
    const audit = Array.isArray(meta.managerAuditTrail)
      ? meta.managerAuditTrail
      : [];
    await sdk.vendors.update(vendor.id, {
      metadata: {
        ...meta,
        ...patch,
        managerAuditTrail: [
          ...audit,
          { action, at: new Date().toISOString(), actor: "manager" },
        ].slice(-20),
      },
    });
    await qc.invalidateQueries({ queryKey: ["vendors", eventId] });
  };

  const markNeedsOwnerDecision = async (vendor: SdkVendor) => {
    await updateVendorMetadata(
      vendor,
      { needsOwnerDecision: true, escalationStatus: "owner_decision_needed" },
      "vendor-owner-decision",
    );
    toast({
      title: "Vendor escalated to owner/admin",
      description: `${vendor.name} is now marked as needing owner decision.`,
      variant: "success",
    });
  };

  const markNoShow = async (vendor: SdkVendor) => {
    await updateVendorMetadata(
      vendor,
      {
        noShowWorkflow: {
          status: "active",
          startedAt: new Date().toISOString(),
        },
        needsSubstitution: true,
      },
      "vendor-no-show",
    );
    toast({
      title: "No-show workflow started",
      description: `Use preferred vendor recommendations and call sheet to substitute ${vendor.name}.`,
      variant: "destructive",
    });
  };

  const generateLoadInPacket = (vendor: SdkVendor) => {
    const meta = vendorMetadata(vendor);
    const packet = [
      `Vendor Load-In Packet — ${vendor.name}`,
      `Category: ${vendor.category || "Vendor"}`,
      `Contact: ${vendor.contact_name || "TBD"}`,
      `Phone: ${vendor.phone || "TBD"}`,
      `Email: ${vendor.email || "TBD"}`,
      `Arrival: ${meta.arrivalTime || "TBD"}`,
      `Departure: ${meta.departureTime || "TBD"}`,
      `Team size: ${meta.teamSize || "TBD"}`,
      `Load-in route: ${meta.loadInRoute || "Confirm with venue manager"}`,
      `COI: ${getCoiStatus(vendor).label}`,
      `Notes: ${vendor.notes || meta.notes || "None"}`,
    ].join("\n");
    const blob = new Blob([packet], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendor-load-in-${vendor.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Load-in packet generated",
      description: `${vendor.name} packet downloaded.`,
      variant: "success",
    });
  };

  const formatPortalDate = (value?: string | null) =>
    value ? new Date(value).toLocaleDateString() : "Never";

  // Compile compliance aggregate counts
  const compliantCount = vendors.filter(
    (v) => getCoiStatus(v).status === "compliant",
  ).length;
  const atRiskCount = vendors.filter(
    (v) => getCoiStatus(v).status !== "compliant",
  ).length;

  const columns: Column<SdkVendor>[] = [
    {
      id: "name",
      header: "Vendor Name",
      cell: (v) => {
        const pct = vendorCompletion(v);
        const meta = vendorMetadata(v);
        return (
          <div className="space-y-1">
            <div className="font-semibold text-fg flex items-center gap-2">
              {v.name}
              {v.is_preferred === 1 && (
                <Badge variant="brand" className="text-[10px]">
                  Preferred
                </Badge>
              )}
              <Badge
                variant={
                  pct >= 80 ? "success" : pct >= 50 ? "warning" : "outline"
                }
                className="text-[10px]"
              >
                {pct}% complete
              </Badge>
              <Badge
                variant={
                  vendorArrivalRisk(v).score >= 70
                    ? "danger"
                    : vendorArrivalRisk(v).score >= 40
                      ? "warning"
                      : "success"
                }
                className="text-[10px]"
              >
                Arrival risk {vendorArrivalRisk(v).score}
              </Badge>
            </div>
            <div className="text-[10px] text-fg-subtle">
              Last active:{" "}
              {meta.lastPortalActivityAt
                ? new Date(meta.lastPortalActivityAt).toLocaleString()
                : "Not yet active"}
            </div>
          </div>
        );
      },
    },
    {
      id: "category",
      header: "Category",
      cell: (v) => (
        <span className="text-fg-muted font-semibold capitalize">
          {v.category || "—"}
        </span>
      ),
    },
    {
      id: "coi",
      header: "COI Compliance Status",
      cell: (v) => {
        const coi = getCoiStatus(v);
        return (
          <div className="flex flex-col gap-1">
            <Badge
              variant={coi.color}
              className="text-[10px] uppercase font-bold tracking-tight py-0.5 px-2.5 max-w-fit"
            >
              {coi.status === "compliant" ? (
                <span className="flex items-center gap-1">🛡️ {coi.label}</span>
              ) : (
                <span className="flex items-center gap-1">🚨 {coi.label}</span>
              )}
            </Badge>
            {coi.insurer && (
              <span className="text-[9px] text-fg-subtle">
                {coi.insurer} ({coi.policy || "No Policy#"})
              </span>
            )}
            {coi.expires && (
              <span
                className={
                  coi.status === "expired"
                    ? "text-[9px] text-danger font-bold"
                    : "text-[9px] text-fg-subtle"
                }
              >
                Expires: {new Date(coi.expires).toLocaleDateString()}
              </span>
            )}
            {coiReviewMeta(v).reviewedBy && (
              <span className="text-[9px] text-fg-subtle">
                Reviewed by {coiReviewMeta(v).reviewedBy}
                {coiReviewMeta(v).note ? ` · ${coiReviewMeta(v).note}` : ""}
              </span>
            )}
            {coiReviewMeta(v).assetId && (
              <a
                href={`/api/assets/${coiReviewMeta(v).assetId}/content`}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[9px] text-brand font-bold hover:underline"
              >
                View COI file ↗
              </a>
            )}
            {coiReviewMeta(v).needsReview && (
              <div className="flex flex-wrap gap-1 mt-0.5">
                <button
                  type="button"
                  disabled={coiReview.isPending}
                  onClick={() => coiReview.mutate({ vendorId: v.id, status: "approved" })}
                  className="text-[9px] font-bold text-success hover:underline disabled:opacity-50"
                >
                  ✓ Approve
                </button>
                <button
                  type="button"
                  disabled={coiReview.isPending}
                  onClick={async () => {
                    const note = await ask({ title: "Request COI changes", label: "What changes are needed on this COI?", multiline: true, required: true });
                    if (note) coiReview.mutate({ vendorId: v.id, status: "changes_requested", note });
                  }}
                  className="text-[9px] font-bold text-warning hover:underline disabled:opacity-50"
                >
                  Request changes
                </button>
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "contact",
      header: "Contact & Portal",
      cell: (v) => {
        const portalToken = portalTokensByVendor.get(v.id);
        const hasActivePortal = portalToken?.is_active === 1;
        return (
          <div className="flex flex-col text-xs text-fg-muted font-semibold">
            {v.contact_name ? (
              <span className="font-bold text-fg">{v.contact_name}</span>
            ) : null}
            <div className="flex gap-2 items-center mt-1">
              {v.email && (
                <a
                  href={`mailto:${v.email}`}
                  className="text-brand hover:underline flex items-center gap-1"
                  aria-label="Email"
                >
                  <Mail className="w-3.5 h-3.5" /> {v.email}
                </a>
              )}
              {v.phone && (
                <a
                  href={`tel:${v.phone}`}
                  className="text-brand hover:underline flex items-center gap-1"
                  aria-label="Phone"
                >
                  <Phone className="w-3.5 h-3.5" /> {v.phone}
                </a>
              )}
              {v.phone && (
                <a
                  href={`sms:${v.phone}`}
                  className="text-brand hover:underline flex items-center gap-1"
                  aria-label="SMS"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> SMS
                </a>
              )}
              {v.website_url && (
                <a
                  href={v.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand hover:underline"
                  aria-label="Website"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            <div className="mt-2 flex flex-col gap-1.5 rounded-lg border border-border bg-surface-2 p-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant={
                    hasActivePortal
                      ? "success"
                      : portalToken
                        ? "warning"
                        : "outline"
                  }
                  className="text-[9px] uppercase tracking-wider"
                >
                  {hasActivePortal
                    ? "Active portal link"
                    : portalToken
                      ? "Expired/revoked link"
                      : "No portal link"}
                </Badge>
                {portalToken && (
                  <span className="text-[10px] text-fg-subtle">
                    Expires {formatPortalDate(portalToken.expires_at)} · Last
                    used {formatPortalDate(portalToken.last_used_at)}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={generatingPortalFor === v.id}
                  onClick={() => void createAndCopyPortalLink(v)}
                  className="inline-flex items-center gap-1 text-[10px] uppercase font-medium text-brand tracking-wider hover:underline disabled:opacity-60"
                >
                  <Link className="w-3 h-3" />{" "}
                  {generatingPortalFor === v.id
                    ? "Creating Link…"
                    : hasActivePortal
                      ? "Regenerate & Copy"
                      : "Copy Secure Link"}
                </button>
                <button
                  type="button"
                  disabled={generatingPortalFor === v.id || !v.email}
                  onClick={() => void sendVendorPortalInvite(v)}
                  className="inline-flex items-center gap-1 text-[10px] uppercase font-medium text-brand tracking-wider hover:underline disabled:opacity-50"
                  title={
                    !v.email
                      ? "Add vendor email before sending an invite"
                      : "Send email invite"
                  }
                >
                  <Mail className="w-3 h-3" /> Send Email Invite
                </button>
                <button
                  type="button"
                  onClick={() => void previewVendorPortal(v)}
                  className="text-[10px] uppercase font-medium text-brand tracking-wider hover:underline"
                  title="Open the portal in a new tab (reuses the existing secure link when available)"
                >
                  Preview Vendor Portal
                </button>
                {hasActivePortal && (
                  <button
                    type="button"
                    disabled={revokingPortalFor === v.id}
                    onClick={() => void revokePortalLink(v)}
                    className="text-[10px] uppercase font-medium text-danger tracking-wider hover:underline disabled:opacity-60"
                  >
                    {revokingPortalFor === v.id ? "Revoking…" : "Revoke"}
                  </button>
                )}
                {getCoiStatus(v).status !== "compliant" && (
                  <Button
                    variant="outline"
                    size="xs"
                    className="text-[9px] h-6 py-0.5 px-2 bg-warning-soft text-warning border-warning/30 hover:bg-warning-soft font-bold rounded-lg inline-flex items-center gap-1 shadow-xs"
                    disabled={generatingPortalFor === v.id}
                    onClick={() => void createAndCopyPortalLink(v)}
                  >
                    🔔 Remind
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: "amount",
      header: "Contract Amount",
      cell: (v) => (
        <div className="text-right font-bold tabular-nums">
          {v.contract_amount_cents
            ? `$${(v.contract_amount_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : "—"}
        </div>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: (v) => {
        const contract = v.contract_amount_cents || 0;
        const paid = v.amount_paid_cents || 0;
        const balance = contract - paid;
        return (
          <div className="flex flex-col items-end gap-1.5 min-w-[120px]">
            <div className="tabular-nums font-bold">
              Bal:{" "}
              {balance > 0
                ? `$${(balance / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                : balance < 0
                  ? `-$${(Math.abs(balance) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                  : "$0.00"}
            </div>
            {paid > 0 && (
              <div className="text-[10px] text-success font-bold">
                Paid: ${(paid / 100).toLocaleString()}
              </div>
            )}
            <div className="flex gap-1 mt-1">
              <Button
                variant="outline"
                size="xs"
                className="text-[9px] py-1 h-auto"
                onClick={() => setPaymentVendor({ id: v.id, name: v.name })}
              >
                <CreditCard className="w-3 h-3 mr-1" /> Log Pay
              </Button>
              <Button
                variant="outline"
                size="xs"
                className="text-[9px] py-1 h-auto border-brand/20 text-brand hover:bg-brand-soft/20"
                onClick={() => setEditVendor(v)}
              >
                <Edit className="w-3 h-3 mr-1" /> Edit
              </Button>
              <Button
                variant="outline"
                size="xs"
                className="text-[9px] py-1 h-auto"
                onClick={() => generateLoadInPacket(v)}
              >
                <FileText className="w-3 h-3 mr-1" /> Packet
              </Button>
              <Button
                variant="outline"
                size="xs"
                className="text-[9px] py-1 h-auto text-warning border-warning/30"
                onClick={() => void markNeedsOwnerDecision(v)}
              >
                Escalate
              </Button>
              <Button
                variant="destructive"
                size="xs"
                className="text-[9px] py-1 h-auto"
                onClick={() => void markNoShow(v)}
              >
                No-show
              </Button>
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {promptNode}
      <Card className="border-brand/20 bg-brand-soft/10">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-brand">
                Vendor onboarding command center
              </h3>
              <p className="text-xs text-fg-muted">
                Invite vendors, track portal activity, COIs, documents, contract
                packets, SLA/load-in readiness, and preferred marketplace
                status.
              </p>
            </div>
            <Badge variant="outline">
              Vendor score explanation: reliability combines ratings, response
              completion, COI status, and payment/logistics readiness.
            </Badge>
          </div>
          <Input
            value={inviteMessage}
            onChange={(e) => setInviteMessage(e.target.value)}
            placeholder="Vendor invite email message"
            className="text-xs"
          />
        </CardContent>
      </Card>

      {managerMode && (
        <>
          <VendorOperationsBoard
            vendors={vendors}
            vendorMetadata={vendorMetadata}
            getCoiStatus={getCoiStatus}
            vendorArrivalRisk={vendorArrivalRisk}
            onPacket={generateLoadInPacket}
            onEscalate={(vendor) => void markNeedsOwnerDecision(vendor)}
            onNoShow={(vendor) => void markNoShow(vendor)}
          />
          <PreferredVendorComplianceDashboard
            vendors={vendors}
            getCoiStatus={getCoiStatus}
            vendorArrivalRisk={vendorArrivalRisk}
          />
          <VendorLayoutPacketReview vendors={vendors} eventId={eventId} vendorMetadata={vendorMetadata} />
        </>
      )}

      {/* Search & Action Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 max-w-sm">
          <Input
            startSlot={<Search className="w-4 h-4 text-fg-muted" />}
            placeholder="Search vendors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-surface border-border h-10 text-xs"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-xs font-semibold text-fg-muted">
            Portal link expiry
            <select
              value={portalExpiryDays}
              onChange={(e) => setPortalExpiryDays(Number(e.target.value))}
              className="h-9 rounded-md border border-border bg-surface px-2 text-xs text-fg"
              aria-label="Vendor portal link expiration"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </label>
          <Button onClick={() => setCreateOpen(true)} className="font-bold">
            <Plus className="w-4 h-4 mr-1" /> Add Vendor Partner
          </Button>
        </div>
      </div>

      {/* KPI Stats Panel with COI Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-surface border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-fg-subtle uppercase tracking-wider font-serif">
              Total Vendors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-fg">{vendors.length}</div>
            <p className="text-[10px] text-fg-subtle font-semibold mt-1">
              partners attached to event
            </p>
          </CardContent>
        </Card>

        <Card className="bg-surface border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-fg-subtle uppercase tracking-wider font-serif">
              Total Contracted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-fg tabular-nums">
              $
              {(totalContract / 100).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </div>
            <p className="text-[10px] text-fg-subtle font-semibold mt-1">
              accrued financial liabilities
            </p>
          </CardContent>
        </Card>

        {/* Compliant COI KPI Card */}
        <Card className="bg-surface border-success/30 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-success uppercase tracking-wider font-serif flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" /> Compliant (COI)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-success">
              {compliantCount}
            </div>
            <p className="text-[10px] text-success/80 font-semibold mt-1">
              verified active vendor insurance
            </p>
          </CardContent>
        </Card>

        {/* At Risk COI KPI Card */}
        <Card className="bg-surface border-danger/30 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-danger uppercase tracking-wider font-serif flex items-center gap-1">
              <ShieldAlert className="w-4 h-4 text-danger animate-pulse" /> At
              Risk (No COI)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-danger">{atRiskCount}</div>
            <p className="text-[10px] text-danger/80 font-semibold mt-1">
              unverified/expired vendor liability
            </p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="pt-6 space-y-2 bg-surface">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="pt-6 text-sm text-danger bg-surface">
            Failed to load vendor directory.
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-surface">
          <DataTable
            columns={columns}
            data={filtered}
            getRowKey={(v) => v.id}
            emptyMessage={
              <div className="py-12 flex flex-col items-center text-center">
                <Truck className="w-12 h-12 text-fg-subtle mb-4" />
                <h3 className="text-lg font-medium font-serif text-fg">
                  No vendors attached
                </h3>
                <p className="text-sm text-fg-muted max-w-sm mt-1 mb-4">
                  Add caterers, florists, photographers, and other partners
                  specific to this event.
                </p>
                <Button variant="outline" onClick={() => setCreateOpen(true)}>
                  Add Vendor
                </Button>
              </div>
            }
          />
        </Card>
      )}

      {/* Smart vendor matching: reliability-ranked recommendations for this event */}
      <VendorMatchPanel eventId={eventId} />

      {vendors.length > 0 && <VendorTimelineChart eventId={eventId} />}
      {vendors.length > 0 && (
        <VendorCommunicationsHub
          eventId={eventId}
          organizationId={organizationId}
        />
      )}

      {paymentVendor && (
        <VendorPaymentDialog
          open={true}
          onOpenChange={(v) => !v && setPaymentVendor(null)}
          vendorId={paymentVendor.id}
          vendorName={paymentVendor.name}
          eventId={eventId}
        />
      )}

      {createOpen && (
        <VendorFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          eventId={eventId}
          organizationId={organizationId}
        />
      )}

      {editVendor && (
        <VendorFormDialog
          open={true}
          onOpenChange={(v) => !v && setEditVendor(null)}
          eventId={eventId}
          organizationId={organizationId}
          vendor={editVendor}
        />
      )}
    </div>
  );
}


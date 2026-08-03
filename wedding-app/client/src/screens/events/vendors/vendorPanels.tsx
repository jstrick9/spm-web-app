import React, { useState } from "react";
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
import { Button } from "../../../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/Card";
import { Badge } from "../../../ui/Badge";
import { SdkVendor } from "../../../sdk/types";

export function VendorOperationsBoard({
  vendors,
  vendorMetadata,
  getCoiStatus,
  vendorArrivalRisk,
  onPacket,
  onEscalate,
  onNoShow,
}: {
  vendors: SdkVendor[];
  vendorMetadata: (vendor: SdkVendor) => Record<string, any>;
  getCoiStatus: (vendor: SdkVendor) => {
    status: string;
    label: string;
    color: "danger" | "warning" | "success";
  };
  vendorArrivalRisk: (vendor: SdkVendor) => {
    score: number;
    reasons: string[];
  };
  onPacket: (vendor: SdkVendor) => void;
  onEscalate: (vendor: SdkVendor) => void;
  onNoShow: (vendor: SdkVendor) => void;
}) {
  const exceptions = {
    missingCoi: vendors.filter((v) => getCoiStatus(v).status !== "compliant"),
    missingArrival: vendors.filter((v) => !vendorMetadata(v).arrivalTime),
    unreadMessages: vendors.filter(
      (v) => Number(vendorMetadata(v).unreadMessagesCount || 0) > 0,
    ),
    unpaid: vendors.filter(
      (v) => (v.contract_amount_cents || 0) - (v.amount_paid_cents || 0) > 0,
    ),
    incompleteQuestionnaire: vendors.filter(
      (v) =>
        !vendorMetadata(v).vendorChecklistComplete &&
        !vendorMetadata(v).questionnaireCompletedAt,
    ),
    ownerDecision: vendors.filter((v) => vendorMetadata(v).needsOwnerDecision),
  };
  const callSheet = vendors.filter((v) => v.phone || v.email).slice(0, 8);
  const highRisk = vendors
    .map((v) => ({ vendor: v, risk: vendorArrivalRisk(v) }))
    .filter((item) => item.risk.score >= 50)
    .sort((a, b) => b.risk.score - a.risk.score)
    .slice(0, 6);
  return (
    <div className="space-y-4">
      <Card className="border-brand/20 bg-brand-soft/10">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-brand flex items-center gap-2">
                <ClipboardList className="h-4 w-4" /> Vendor operations board
              </h3>
              <p className="text-xs text-fg-muted mt-1">
                Manager exception queue: COI, arrival time, unread messages,
                unpaid balance, questionnaire completion, and owner decisions.
              </p>
            </div>
            <Badge variant="outline">Day-of vendor command</Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <VendorExceptionMetric
              label="Missing COI"
              value={exceptions.missingCoi.length}
              icon={<ShieldAlert className="h-4 w-4" />}
            />
            <VendorExceptionMetric
              label="Missing arrival"
              value={exceptions.missingArrival.length}
              icon={<Calendar className="h-4 w-4" />}
            />
            <VendorExceptionMetric
              label="Unread messages"
              value={exceptions.unreadMessages.length}
              icon={<MessageSquare className="h-4 w-4" />}
            />
            <VendorExceptionMetric
              label="Unpaid"
              value={exceptions.unpaid.length}
              icon={<CreditCard className="h-4 w-4" />}
            />
            <VendorExceptionMetric
              label="Incomplete forms"
              value={exceptions.incompleteQuestionnaire.length}
              icon={<FileText className="h-4 w-4" />}
            />
            <VendorExceptionMetric
              label="Owner decision"
              value={exceptions.ownerDecision.length}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <VendorManagerPanel
          title="Vendor arrival risk"
          icon={<AlertTriangle className="h-4 w-4" />}
        >
          <VendorActionList
            items={highRisk.map(({ vendor, risk }) => ({
              vendor,
              title: vendor.name,
              detail: `Risk ${risk.score}: ${risk.reasons.join(", ") || "low risk"}`,
            }))}
            empty="No high-risk arrivals detected."
            onPacket={onPacket}
            onEscalate={onEscalate}
            onNoShow={onNoShow}
          />
        </VendorManagerPanel>
        <VendorManagerPanel
          title="Vendor call sheet"
          icon={<Phone className="h-4 w-4" />}
        >
          <div className="space-y-2">
            {callSheet.length ? (
              callSheet.map((v) => (
                <div
                  key={v.id}
                  className="rounded-lg border border-border bg-surface-2 p-2 text-xs"
                >
                  <div className="font-bold text-fg">{v.name}</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {v.phone && (
                      <a
                        href={`tel:${v.phone}`}
                        className="text-brand font-bold"
                      >
                        Call
                      </a>
                    )}
                    {v.phone && (
                      <a
                        href={`sms:${v.phone}`}
                        className="text-brand font-bold"
                      >
                        SMS
                      </a>
                    )}
                    {v.email && (
                      <a
                        href={`mailto:${v.email}`}
                        className="text-brand font-bold"
                      >
                        Email
                      </a>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-fg-muted">
                No vendor contacts available.
              </p>
            )}
          </div>
        </VendorManagerPanel>
        <VendorManagerPanel
          title="Day-of no-show workflow"
          icon={<RefreshCw className="h-4 w-4" />}
        >
          <p className="text-xs text-fg-muted">
            If a vendor is late/no-show: call vendor, notify owner/planner,
            generate packet for substitute, and mark no-show to start
            escalation.
          </p>
          <VendorActionList
            items={vendors
              .filter((v) => vendorArrivalRisk(v).score >= 70)
              .slice(0, 3)
              .map((v) => ({
                vendor: v,
                title: v.name,
                detail: "High risk candidate for substitution workflow",
              }))}
            empty="No no-show workflow candidates."
            onPacket={onPacket}
            onEscalate={onEscalate}
            onNoShow={onNoShow}
          />
        </VendorManagerPanel>
      </div>
    </div>
  );
}


export function VendorLayoutPacketReview({ vendors, eventId, vendorMetadata }: { vendors: SdkVendor[]; eventId: string; vendorMetadata: (vendor: SdkVendor) => Record<string, any> }) {
  const vendorsNeedingLayout = vendors.filter(v => /cater|bar|dj|band|photo|flor|rental|lighting|av|tent/i.test(`${v.category} ${v.name}`));
  return (
    <Card className="border-brand/20 bg-brand-soft/5">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4 text-brand" /> Vendor-specific layout packet review</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-fg-muted">Review vendor zones, power, load-in path, rain-plan routing, and QR setup packet before vendor arrival. This links vendor operations to the floorplan packet without forcing managers into canvas editing.</p>
        <div className="grid gap-3 md:grid-cols-3">
          {vendorsNeedingLayout.slice(0, 6).map(vendor => {
            const meta = vendorMetadata(vendor);
            return (
              <div key={vendor.id} className="rounded-xl border border-border bg-surface p-3 text-xs">
                <div className="font-bold text-fg">{vendor.name}</div>
                <div className="text-fg-muted capitalize">{vendor.category || 'Vendor'}</div>
                <div className="mt-2 space-y-1 text-fg-muted">
                  <div>Zone: {meta.layoutZone || meta.loadInRoute || 'Needs floorplan zone review'}</div>
                  <div>Power: {meta.powerNeeds || 'Confirm power needs'}</div>
                  <div>Rain route: {meta.rainPlanRoute || 'Confirm if rain plan active'}</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  <a href={`#/events/${eventId}?tab=layout`} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-bold text-brand"><Eye className="h-3.5 w-3.5" /> Layout</a>
                  <a href={`#/events/${eventId}/run-sheet`} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-bold text-brand"><FileText className="h-3.5 w-3.5" /> Run sheet</a>
                  <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-bold text-fg-muted"><QrCode className="h-3.5 w-3.5" /> QR packet</span>
                </div>
              </div>
            );
          })}
          {vendorsNeedingLayout.length === 0 && <div className="rounded-xl border border-dashed border-border bg-surface p-3 text-xs text-fg-muted">No layout-sensitive vendors detected yet. Add catering, DJ/band, rentals, lighting, bar, floral, photo booth, or tent vendors to build vendor layout packets.</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export function PreferredVendorComplianceDashboard({
  vendors,
  getCoiStatus,
  vendorArrivalRisk,
}: {
  vendors: SdkVendor[];
  getCoiStatus: (vendor: SdkVendor) => {
    status: string;
    label: string;
    color: "danger" | "warning" | "success";
  };
  vendorArrivalRisk: (vendor: SdkVendor) => {
    score: number;
    reasons: string[];
  };
}) {
  const preferred = vendors.filter((v) => v.is_preferred === 1);
  const compliantPreferred = preferred.filter(
    (v) => getCoiStatus(v).status === "compliant",
  ).length;
  const substituteCandidates = vendors
    .filter(
      (v) =>
        v.is_preferred === 1 &&
        getCoiStatus(v).status === "compliant" &&
        vendorArrivalRisk(v).score < 50,
    )
    .slice(0, 5);
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-brand flex items-center gap-2">
              <PackageCheck className="h-4 w-4" /> Preferred vendor compliance
              dashboard
            </h3>
            <p className="text-xs text-fg-muted mt-1">
              Use preferred, compliant vendors as substitution recommendations
              for day-of emergencies.
            </p>
          </div>
          <Badge
            variant={
              preferred.length && compliantPreferred === preferred.length
                ? "success"
                : "warning"
            }
          >
            {compliantPreferred}/{preferred.length} compliant preferred
          </Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {substituteCandidates.length ? (
            substituteCandidates.map((v) => (
              <div
                key={v.id}
                className="rounded-lg border border-border bg-surface-2 p-2 text-xs"
              >
                <div className="font-bold text-fg">{v.name}</div>
                <div className="text-fg-muted">
                  {v.category || "Vendor"} · substitute-ready
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-fg-muted">
              No substitute-ready preferred vendors available.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function VendorExceptionMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-brand">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-black text-fg">{value}</div>
    </div>
  );
}

export function VendorManagerPanel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

export function VendorActionList({
  items,
  empty,
  onPacket,
  onEscalate,
  onNoShow,
}: {
  items: Array<{ vendor: SdkVendor; title: string; detail: string }>;
  empty: string;
  onPacket: (vendor: SdkVendor) => void;
  onEscalate: (vendor: SdkVendor) => void;
  onNoShow: (vendor: SdkVendor) => void;
}) {
  if (!items.length)
    return (
      <p className="rounded-lg border border-dashed border-border p-2 text-xs text-fg-muted">
        {empty}
      </p>
    );
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.vendor.id}
          className="rounded-lg border border-border bg-surface-2 p-2 text-xs"
        >
          <div className="font-bold text-fg">{item.title}</div>
          <p className="mt-1 text-fg-muted">{item.detail}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <Button
              size="xs"
              variant="outline"
              onClick={() => onPacket(item.vendor)}
            >
              Packet
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => onEscalate(item.vendor)}
            >
              Escalate
            </Button>
            <Button
              size="xs"
              variant="destructive"
              onClick={() => onNoShow(item.vendor)}
            >
              No-show
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}


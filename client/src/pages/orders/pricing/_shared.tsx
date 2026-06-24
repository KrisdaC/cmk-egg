import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { MapPin, ChevronRight } from "lucide-react";

// =============================================
// TYPES
// =============================================

export interface Partner {
  id: number;
  nickname: string;
  code: string;
}

export interface Item {
  id: number;
  sku: string | null;
  name: string;
  baseUnit: string | null;
  eggsPerPack: number | null;
}

export interface PricingAssumption {
  id: number;
  pricingWeekId: number;
  partnerId: number | null;
  component: string;
  value: string;
  unit: string | null;
  notes: string | null;
  partner: Partner | null;
}

export interface PricingWeek {
  id: number;
  weekCode: string;
  startDate: string;
  endDate: string;
  status: string;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  benchmarkPartner: Partner | null;
  assumptions?: PricingAssumption[];
}

export interface ProposalLine {
  id: number;
  referencePrice: string | null;
  proposalPrice: string | null;
  counterPrice: string | null;
  finalLockedPrice: string | null;
  notes: string | null;
  item: {
    id: number;
    sku: string | null;
    name: string;
    baseUnit: string | null;
    eggsPerPack: number | null;
  } | null;
}

export interface ProposalRow {
  id: number;
  proposalNumber: string;
  status: string;
  scopeType: string;
  siteGroupId: number | null;
  deliverySiteId: number | null;
  submittedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  notes: string | null;
  createdAt: string;
  partner: Partner | null;
  week: { id: number; weekCode: string; status: string } | null;
  lines?: ProposalLine[];
}

export interface ActivePriceRow {
  id: number;
  scopeType: string;
  price: string;
  effectiveDate: string;
  expiryDate: string | null;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  item: { id: number; sku: string | null; name: string; baseUnit: string | null } | null;
  partner: Partner | null;
  siteGroupId?: number | null;
  deliverySiteId?: number | null;
}

export interface DeliverySite {
  id: number;
  siteCode: string;
  displayName: string;
  branchName: string | null;
  province: string | null;
  isActive: boolean | null;
}

export interface SiteGroupMember {
  id: number;
  deliverySite: DeliverySite | null;
}

export interface SiteGroup {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean | null;
  createdAt: string;
  partner: Partner | null;
  members?: SiteGroupMember[];
}

// =============================================
// CONSTANTS
// =============================================

export const ASSUMPTION_COMPONENTS = [
  { key: "transport_in",  label: "ขนส่งเข้า",   defaultUnit: "บาท" },
  { key: "transport_out", label: "ขนส่งออก",   defaultUnit: "บาท" },
  { key: "disty_cost",    label: "Disty cost",  defaultUnit: "%"   },
  { key: "operations",    label: "ดำเนินงาน",   defaultUnit: "บาท" },
  { key: "labor",         label: "ค่าแรง",      defaultUnit: "บาท" },
  { key: "maintenance",   label: "ซ่อมบำรุง",   defaultUnit: "บาท" },
  { key: "egg_loss",      label: "ไข่สูญเสีย",  defaultUnit: "บาท" },
];

export const STATUS_COLORS: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; label: string }> = {
  draft: { variant: "outline", label: "Draft" },
  approved: { variant: "secondary", label: "Approved" },
  active: { variant: "default", label: "Active" },
  archived: { variant: "outline", label: "Archived" },
  submitted: { variant: "secondary", label: "Submitted" },
  counter_pending: { variant: "default", label: "Counter Pending" },
  rejected: { variant: "destructive", label: "Rejected" },
  replaced: { variant: "outline", label: "Replaced" },
};

// =============================================
// SHARED COMPONENTS
// =============================================

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_COLORS[status] ?? { variant: "outline" as const, label: status };
  return (
    <Badge variant={cfg.variant} className="capitalize">
      {cfg.label}
    </Badge>
  );
}

export function ScopeBadge({ scopeType, siteGroup }: { scopeType: string; siteGroup?: SiteGroup }) {
  if (scopeType === "site_group") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-full">
        <MapPin className="w-3 h-3" />
        {siteGroup?.name ?? "Site Group"}
      </span>
    );
  }
  if (scopeType === "delivery_site") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-50 dark:bg-purple-950 px-2 py-0.5 rounded-full">
        <MapPin className="w-3 h-3" />
        Single Site
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
      All Sites
    </span>
  );
}

export function fmt(val: string | null | undefined): string {
  if (!val) return "—";
  const n = parseFloat(val);
  return isNaN(n) ? "—" : n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// =============================================
// PRICING STEP NAV
// =============================================

const PRICING_STEPS = [
  { step: 1, label: "Global Assumptions", url: "/orders/pricing/assumptions" },
  { step: 2, label: "Reference Price", url: "/orders/pricing/reference" },
  { step: 3, label: "Proposals", url: "/orders/pricing/proposals" },
  { step: 4, label: "Active Prices", url: "/orders/pricing/active-prices" },
];

export function PricingStepNav() {
  const [location] = useLocation();
  const currentStep = PRICING_STEPS.find((s) => s.url === location)?.step ?? 0;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {PRICING_STEPS.map((s, idx) => {
        const isActive = s.url === location;
        const isDone = s.step < currentStep;
        return (
          <div key={s.step} className="flex items-center gap-1">
            <Link href={s.url}>
              <span
                className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  isActive
                    ? "bg-primary text-primary-foreground font-medium"
                    : isDone
                    ? "bg-muted text-muted-foreground hover:bg-muted/80"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold shrink-0 ${
                    isActive
                      ? "bg-primary-foreground text-primary"
                      : isDone
                      ? "bg-muted-foreground/30 text-muted-foreground"
                      : "bg-muted-foreground/20 text-muted-foreground"
                  }`}
                >
                  {s.step}
                </span>
                {s.label}
              </span>
            </Link>
            {idx < PRICING_STEPS.length - 1 && (
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

import {
  Activity,
  Beaker,
  Building2,
  CalendarClock,
  Eye,
  FlaskConical,
  LayoutDashboard,
  ListChecks,
  Mails,
  Megaphone,
  RefreshCw,
  Settings,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Top-level sections shown directly in the horizontal nav (spec §48).
 * The rest live behind the "More" menu.
 */
export const PRIMARY_NAV: NavItem[] = [
  { label: "Home", href: "/", icon: LayoutDashboard },
  { label: "Signals", href: "/signals", icon: Activity },
  { label: "Accounts", href: "/accounts", icon: Building2 },
  { label: "Trials", href: "/trials", icon: FlaskConical },
  { label: "Tasks", href: "/tasks", icon: ListChecks },
  { label: "Progress", href: "/progress", icon: TrendingUp },
];

/** Secondary sections — grouped under "Workspace" in the sidebar. */
export const MORE_NAV: NavItem[] = [
  { label: "Assets", href: "/assets", icon: Beaker },
  { label: "People", href: "/people", icon: Users },
  { label: "Outreach", href: "/outreach", icon: Mails },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Meetings", href: "/meetings", icon: CalendarClock },
  { label: "Opportunities", href: "/opportunities", icon: Target },
  { label: "CRM", href: "/crm", icon: RefreshCw },
  { label: "Watchlists", href: "/watchlists", icon: Eye },
  { label: "Settings", href: "/settings", icon: Settings },
];

export const ALL_NAV: NavItem[] = [...PRIMARY_NAV, ...MORE_NAV];

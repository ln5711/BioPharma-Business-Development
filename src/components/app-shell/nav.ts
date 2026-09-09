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

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Sidebar navigation, grouped (Pulsar mockup: a blank lead group + labelled sections). */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "",
    items: [
      { label: "Command", href: "/", icon: LayoutDashboard },
      { label: "Signals", href: "/signals", icon: Activity },
      { label: "Accounts", href: "/accounts", icon: Building2 },
      { label: "Opportunities", href: "/opportunities", icon: Target },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Trials", href: "/trials", icon: FlaskConical },
      { label: "Assets", href: "/assets", icon: Beaker },
      { label: "People", href: "/people", icon: Users },
      { label: "Watchlists", href: "/watchlists", icon: Eye },
    ],
  },
  {
    label: "Execution",
    items: [
      { label: "Outreach", href: "/outreach", icon: Mails },
      { label: "Campaigns", href: "/campaigns", icon: Megaphone },
      { label: "Meetings", href: "/meetings", icon: CalendarClock },
      { label: "Tasks", href: "/tasks", icon: ListChecks },
      { label: "Progress", href: "/progress", icon: TrendingUp },
      { label: "CRM", href: "/crm", icon: RefreshCw },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export const ALL_NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** Phone bottom tab bar (Pulsar mockup — 5 tabs). */
export const BOTTOM_NAV: NavItem[] = [
  { label: "Command", href: "/", icon: LayoutDashboard },
  { label: "Signals", href: "/signals", icon: Activity },
  { label: "Accounts", href: "/accounts", icon: Building2 },
  { label: "Outreach", href: "/outreach", icon: Mails },
  { label: "Tasks", href: "/tasks", icon: ListChecks },
];

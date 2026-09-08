import {
  Activity,
  Beaker,
  Building2,
  CalendarClock,
  FlaskConical,
  LayoutDashboard,
  Mails,
  Megaphone,
  RefreshCw,
  Target,
  Users,
  Eye,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Left navigation (spec §48 / §131). */
export const PRIMARY_NAV: NavItem[] = [
  { label: "Home", href: "/", icon: LayoutDashboard },
  { label: "Signals", href: "/signals", icon: Activity },
  { label: "Accounts", href: "/accounts", icon: Building2 },
  { label: "Assets", href: "/assets", icon: Beaker },
  { label: "Trials", href: "/trials", icon: FlaskConical },
  { label: "People", href: "/people", icon: Users },
  { label: "Outreach", href: "/outreach", icon: Mails },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Meetings", href: "/meetings", icon: CalendarClock },
  { label: "Opportunities", href: "/opportunities", icon: Target },
  { label: "CRM", href: "/crm", icon: RefreshCw },
  { label: "Watchlists", href: "/watchlists", icon: Eye },
];

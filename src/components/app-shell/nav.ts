import {
  Building2,
  FlaskConical,
  LayoutDashboard,
  Mails,
  Radar,
  SquareStack,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Six primary tabs — everything else lives contextually inside them. */
export const PRIMARY_NAV: NavItem[] = [
  { label: "Home", href: "/", icon: LayoutDashboard },
  { label: "Intelligence", href: "/intelligence", icon: Radar },
  { label: "Accounts", href: "/accounts", icon: Building2 },
  { label: "Trials", href: "/trials", icon: FlaskConical },
  { label: "Workspaces", href: "/workspaces", icon: SquareStack },
  { label: "Outreach", href: "/outreach", icon: Mails },
];

export const ALL_NAV = PRIMARY_NAV;

/** Phone bottom tab bar — 5 of the 6. */
export const BOTTOM_NAV: NavItem[] = [
  { label: "Home", href: "/", icon: LayoutDashboard },
  { label: "Intelligence", href: "/intelligence", icon: Radar },
  { label: "Accounts", href: "/accounts", icon: Building2 },
  { label: "Trials", href: "/trials", icon: FlaskConical },
  { label: "Outreach", href: "/outreach", icon: Mails },
];

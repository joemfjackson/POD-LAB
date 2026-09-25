import {
  Bot,
  ChartColumn,
  CheckCheck,
  FlaskConical,
  FolderOpen,
  Layers,
  LayoutDashboard,
  Lightbulb,
  Megaphone,
  Package,
  Palette,
  Radar,
  Settings,
  Store,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Operate",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Opportunities", href: "/opportunities", icon: Radar },
      { label: "Brands", href: "/brands", icon: Layers },
      { label: "Agents", href: "/agents", icon: Bot },
      { label: "Approvals", href: "/approvals", icon: CheckCheck },
    ],
  },
  {
    label: "Build",
    items: [
      { label: "Design Studio", href: "/design-studio", icon: Palette },
      { label: "Products", href: "/products", icon: Package },
      { label: "Stores", href: "/stores", icon: Store },
    ],
  },
  {
    label: "Grow & learn",
    items: [
      { label: "Growth", href: "/growth", icon: Megaphone },
      { label: "Experiments", href: "/experiments", icon: FlaskConical },
      { label: "Trends", href: "/trends", icon: TrendingUp },
      { label: "Insights", href: "/insights", icon: Lightbulb },
      { label: "Reports", href: "/reports", icon: ChartColumn },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Files", href: "/files", icon: FolderOpen },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

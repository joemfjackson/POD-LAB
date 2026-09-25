import { SettingsTabs } from "@/components/settings/settings-tabs";
import { PageHeader } from "@/components/ui/page-header";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Settings" description="Workspace, members, AI and provider configuration, cost controls and decision rules. Secrets never reach the browser." />
      <SettingsTabs />
      {children}
    </>
  );
}

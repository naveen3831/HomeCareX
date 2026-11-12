import { useEffect } from "react";
import { FileText, ShieldCheck } from "lucide-react";
import { privacyContent } from "@/content/privacy";
import { customerPath } from "@/routes/customerPath";
import LegalDocumentView from "./LegalDocumentView";
import SettingsPageShell from "./SettingsPageShell";

/** /customer/profile/privacy: the Privacy Policy, inside the dashboard. */
export default function PrivacyPage() {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  return (
    <SettingsPageShell title="Privacy Policy" subtitle="How we collect, use and protect your data." icon={ShieldCheck} tone="emerald">
      <LegalDocumentView doc={privacyContent} other={{ label: "Terms & Conditions", to: customerPath("/profile/terms"), icon: FileText }} />
    </SettingsPageShell>
  );
}

import { useEffect } from "react";
import { FileText, ShieldCheck } from "lucide-react";
import { termsContent } from "@/content/terms";
import { customerPath } from "@/routes/customerPath";
import LegalDocumentView from "./LegalDocumentView";
import SettingsPageShell from "./SettingsPageShell";

/** /customer/profile/terms: the Terms & Conditions, inside the dashboard. */
export default function TermsPage() {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  return (
    <SettingsPageShell title="Terms & Conditions" subtitle="The rules for using HomeCareX." icon={FileText} tone="indigo">
      <LegalDocumentView doc={termsContent} other={{ label: "Privacy Policy", to: customerPath("/profile/privacy"), icon: ShieldCheck }} />
    </SettingsPageShell>
  );
}

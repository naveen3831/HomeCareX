import { termsContent } from '@/content/terms';
import LegalDocument from './LegalDocument';
import { PRIVACY_POLICY_PATH } from './paths';

/** /partner/settings/other/terms */
export default function TermsPage() {
  return <LegalDocument doc={termsContent} other={{ label: 'Privacy Policy', to: PRIVACY_POLICY_PATH }} />;
}
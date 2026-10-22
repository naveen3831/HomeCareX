import { privacyContent } from '@/content/privacy';
import LegalDocument from './LegalDocument';
import { TERMS_PATH } from './paths';

/** /partner/settings/other/privacy-policy */
export default function PrivacyPolicyPage() {
  return <LegalDocument doc={privacyContent} other={{ label: 'Terms & Conditions', to: TERMS_PATH }} />;
}
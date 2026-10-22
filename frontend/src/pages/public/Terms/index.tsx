import React from "react";
import LegalLayout from "../../../components/public/LegalLayout";
import Seo from "../../../components/common/Seo";
import { termsContent } from "../../../content/terms";

const TermsPage: React.FC = () => (
  <>
    <Seo
      title="Terms & Conditions | HomeCareX"
      description="Read the Terms and Conditions governing your access to and use of the HomeCareX digital platform, booking workflows, and home-services marketplace."
    />
    <LegalLayout {...termsContent} />
  </>
);

export default TermsPage;
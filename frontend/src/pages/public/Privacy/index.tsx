import React from "react";
import LegalLayout from "../../../components/public/LegalLayout";
import Seo from "../../../components/common/Seo";
import { privacyContent } from "../../../content/privacy";

const PrivacyPage: React.FC = () => (
  <>
    <Seo
      title="Privacy Policy | HomeCareX"
      description="Learn how HomeCareX collects, uses, shares, protects, and retains your personal information across our home-services platform and applications."
    />
    <LegalLayout {...privacyContent} />
  </>
);

export default PrivacyPage;
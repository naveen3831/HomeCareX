import React from "react";
import LegalLayout from "../../../components/public/LegalLayout";
import Seo from "../../../components/common/Seo";
import { cookiesContent } from "../../../content/cookies";

const CookiesPage: React.FC = () => (
  <>
    <Seo
      title="Cookie Policy | HomeCareX"
      description="Learn how HomeCareX uses cookies and similar technologies, why we use them, and how you can manage your cookie preferences."
    />
    <LegalLayout {...cookiesContent} />
  </>
);

export default CookiesPage;
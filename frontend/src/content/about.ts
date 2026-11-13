import { ROUTES } from "../constants/routes";

/* =========================================================================
   TYPES: HOMECAREX ABOUT PAGE CONTENT
   Strictly adheres to verified platform capabilities with zero unsupported claims.
   ========================================================================= */

export interface AboutHeroHighlight {
  icon: string;
  title: string;
  subtitle?: string;
}

export interface AboutHeroContent {
  eyebrow?: string;
  title: string;
  subtitle: string;
  description: string;
  primaryCta: {
    label: string;
    href: string;
  };
  secondaryCta: {
    label: string;
    href: string;
  };
  image?: {
    src: string;
    alt: string;
  };
  highlights: AboutHeroHighlight[];
}

export interface AboutStoryChallenge {
  title: string;
  description?: string;
  icon?: string;
}

export interface AboutStoryContent {
  eyebrow: string;
  heading: string;
  introQuote: string;
  paragraphs: string[];
  challengesTitle: string;
  challenges: AboutStoryChallenge[];
  image: {
    src: string;
    alt: string;
  };
}

export interface AboutFeaturedService {
  id: string;
  name: string;
  category: string;
  description: string;
  image: string;
  icon: string;
  ctaText: string;
  href: string;
}

export interface AboutWhatWeDoContent {
  eyebrow: string;
  heading: string;
  description: string;
  services: AboutFeaturedService[];
}

export interface AboutMissionPillar {
  title: string;
  description?: string;
  icon: string;
}

export interface AboutMissionContent {
  eyebrow: string;
  heading: string;
  statement: string;
  supportingText: string;
  pillars: AboutMissionPillar[];
}

export interface AboutVisionCommitment {
  title: string;
  description?: string;
  icon?: string;
}

export interface AboutVisionContent {
  eyebrow: string;
  heading: string;
  statement: string;
  aspirationalNote: string;
  commitments: AboutVisionCommitment[];
}

export interface AboutTrustPractice {
  title: string;
  description?: string;
  tag: string;
  icon: string;
}

export interface AboutTrustContent {
  eyebrow: string;
  heading: string;
  subtitle: string;
  subtleNote: string;
  practices: AboutTrustPractice[];
  faqCta: {
    heading: string;
    description: string;
    buttonLabel: string;
    href: string;
  };
}

export interface AboutQualityStep {
  step: string;
  title: string;
  description?: string;
  icon?: string;
}

export interface AboutQualityContent {
  eyebrow: string;
  heading: string;
  supportingMessage: string;
  description: string;
  steps: AboutQualityStep[];
}

export interface AboutTeamDiscipline {
  id: string;
  title: string;
  scope: string;
  description?: string;
  focusAreas: string[];
  icon: string;
}

export interface AboutTeamContent {
  eyebrow: string;
  heading: string;
  subtitle: string;
  intro: string;
  disciplines: AboutTeamDiscipline[];
}

export interface AboutValueItem {
  number: string;
  title: string;
  tagline: string;
  description?: string;
  icon: string;
}

export interface AboutValuesContent {
  eyebrow: string;
  heading: string;
  subtitle: string;
  items: AboutValueItem[];
}

export interface AboutHowItWorksStep {
  number: string;
  title: string;
  summary: string;
  description?: string;
  details: string[];
  icon: string;
}

export interface AboutHowItWorksContent {
  eyebrow: string;
  heading: string;
  subtitle: string;
  steps: AboutHowItWorksStep[];
}

export interface AboutCtaContent {
  heading: string;
  description: string;
  primaryCta: {
    label: string;
    href: string;
  };
  secondaryCta: {
    label: string;
    href: string;
  };
}

export interface AboutPageData {
  hero: AboutHeroContent;
  story: AboutStoryContent;
  whatWeDo: AboutWhatWeDoContent;
  mission: AboutMissionContent;
  vision: AboutVisionContent;
  trust: AboutTrustContent;
  quality: AboutQualityContent;
  team: AboutTeamContent;
  values: AboutValuesContent;
  howItWorks: AboutHowItWorksContent;
  cta: AboutCtaContent;
}

/* =========================================================================
   CONTENT DEFINITIONS (CLEAN, MINIMAL, EXECUTIVE TONE)
   ========================================================================= */

export const aboutData: AboutPageData = {
  /* 1. HERO */
  hero: {
    title: "About HomeCareX",
    subtitle: "Everyday Home Services, Thoughtfully Simplified.",
    description:
      "A unified digital platform connecting homeowners with certified craft specialists for transparent, dependable doorstep care.",
    primaryCta: {
      label: "Explore Services",
      href: ROUTES.SERVICES,
    },
    secondaryCta: {
      label: "Become a Partner",
      href: ROUTES.PARTNER_REGISTER,
    },
    highlights: [
      {
        icon: "🔍",
        title: "Transparent Scopes & Rates",
      },
      {
        icon: "📅",
        title: "Confirmed Arrival Slots",
      },
      {
        icon: "🔄",
        title: "Verified Service Guarantee",
      },
    ],
  },

  /* 2. OUR STORY */
  story: {
    eyebrow: "Our Purpose & Background",
    heading: "Our Story",
    introQuote:
      "HomeCareX was created around a simple idea: accessing everyday home services should feel straightforward, transparent, and dependable.",
    paragraphs: [
      "Finding reliable home repairs often means opaque pricing, delayed arrival windows, and fragmented coordination.",
      "At the same time, skilled technicians struggle with manual scheduling, irregular inquiries, and administrative friction.",
      "HomeCareX unifies both with transparent rate cards, confirmed time slots, and checklist-verified fulfillment for every home.",
    ],
    challengesTitle: "Key Challenges We Address",
    challenges: [
      {
        icon: "🔍",
        title: "Uncertain Rates & Fragmented Discovery",
        description: "Standardized service rates, upfront scopes, and zero surprise fees.",
      },
      {
        icon: "⏱️",
        title: "Manual Booking & Timing Conflicts",
        description: "Confirmed calendar time slots with automated technician dispatch.",
      },
      {
        icon: "📱",
        title: "Disorganized Service Workflows",
        description: "End-to-end digital tracking from request to doorstep completion.",
      },
    ],
    image: {
      src: "/images/about/about-plumber.jpg",
      alt: "Resident reviewing clear home service details on a mobile device",
    },
  },

  /* 3. WHAT WE DO */
  whatWeDo: {
    eyebrow: "WHAT WE DO",
    heading: "Home Services, Made Simpler",
    description:
      "We connect homeowners who need everyday repairs with certified, independent service partners through clear scopes and standardized pricing.",
    services: [
      {
        id: "home-cleaning",
        name: "Cleaning",
        category: "Essential Care",
        description:
          "Residential deep cleaning for everyday spaces and seasonal upkeep.",
        image: "/images/about/about-cleaning-team.jpg",
        icon: "✨",
        ctaText: "Explore",
        href: ROUTES.SERVICES,
      },
      {
        id: "plumbing",
        name: "Plumbing",
        category: "Repairs & Installs",
        description:
          "Prompt diagnosis, pipe repairs, and household fixture installations.",
        image: "/images/about/about-plumber.jpg",
        icon: "🔧",
        ctaText: "Explore",
        href: ROUTES.SERVICES,
      },
      {
        id: "electrical",
        name: "Electrical",
        category: "Safety & Wiring",
        description:
          "Certified diagnostics, safe wiring, and household appliance setups.",
        image: "/images/about/about-electrician.jpg",
        icon: "⚡",
        ctaText: "Explore",
        href: ROUTES.SERVICES,
      },
      {
        id: "appliance-repair",
        name: "Appliance Services",
        category: "Appliance Care",
        description:
          "Convenient maintenance and precision repairs for essential home appliances.",
        image: "/images/about/about-service-crew.jpg",
        icon: "🛠️",
        ctaText: "Explore",
        href: ROUTES.SERVICES,
      },
    ],
  },

  /* 4. OUR MISSION */
  mission: {
    eyebrow: "Our Purpose",
    heading: "Our Mission",
    statement:
      "To make everyday home maintenance effortless to discover and trust, while providing independent technicians with a dependable digital platform.",
    supportingText:
      "Rooted in simplicity, clarity, and respect, HomeCareX removes the guesswork from home repairs through verified standards and upfront pricing.",
    pillars: [
      {
        title: "Simplicity & Accessibility",
        icon: "✨",
      },
      {
        title: "Transparent Rates & Published Scope",
        icon: "👁️",
      },
      {
        title: "Fair Growth for Service Partners",
        icon: "🤝",
      },
    ],
  },

  /* 5. OUR VISION */
  vision: {
    eyebrow: "Looking Forward",
    heading: "Our Vision",
    statement:
      "To build an ecosystem where homeowners book with complete peace of mind and skilled professionals build thriving livelihoods through technology.",
    aspirationalNote:
      "Continuous innovation in scheduling, partner empowerment, and service reliability drives our long-term roadmap.",
    commitments: [
      {
        title: "Dependability in Every Booking",
        icon: "🎯",
      },
      {
        title: "Empowerment Through Technology",
        icon: "💻",
      },
      {
        title: "Community Trust & High Standards",
        icon: "🔄",
      },
    ],
  },

  /* 6. TRUST & SAFETY */
  trust: {
    eyebrow: "Platform Safeguards",
    heading: "Trust & Safety",
    subtitle:
      "Platform safeguards designed to ensure security, transparency, and dependability.",
    subtleNote:
      "We continuously refine the systems and protocols that support a safer, more dependable service experience.",
    practices: [
      {
        title: "Clear Service Information",
        tag: "Clarity",
        icon: "📋",
        description:
          "Upfront pricing, published checklists, and guaranteed estimates.",
      },
      {
        title: "Transparent Communication",
        tag: "Communication",
        icon: "💬",
        description:
          "In-app messaging, verified partner ID, and live arrival updates.",
      },
      {
        title: "Structured Interactions",
        tag: "Workflow",
        icon: "🔄",
        description:
          "Standard operating checklists for verified doorstep fulfillment.",
      },
      {
        title: "Responsible Data Handling",
        tag: "Privacy",
        icon: "🔒",
        description:
          "Encrypted records and privacy-first phone number masking.",
      },
      {
        title: "Slot Concurrency Controls",
        tag: "Integrity",
        icon: "🛡️",
        description:
          "Intelligent scheduling to eliminate overlapping arrivals and delays.",
      },
      {
        title: "Resolution Pathways",
        tag: "Support",
        icon: "🤝",
        description:
          "Dedicated support specialists and satisfaction guarantee coverage.",
      },
    ],
    faqCta: {
      heading: "Have questions about how HomeCareX works?",
      description:
        "Find clear answers about bookings, rates, guarantees, and service scopes.",
      buttonLabel: "View FAQs",
      href: ROUTES.FAQ,
    },
  },

  /* 7. QUALITY */
  quality: {
    eyebrow: "Standards & Process",
    heading: "Our Approach to Quality",
    supportingMessage:
      "Operational excellence embedded across every stage of the booking lifecycle.",
    description:
      "From discovery through post-service warranty, every booking adheres to strict platform standards.",
    steps: [
      {
        step: "01",
        title: "Clear Service Scope",
        icon: "📋",
      },
      {
        step: "02",
        title: "SOP Compliance",
        icon: "🔄",
      },
      {
        step: "03",
        title: "Seamless Experience",
        icon: "📱",
      },
      {
        step: "04",
        title: "Partner Enablement",
        icon: "🤝",
      },
      {
        step: "05",
        title: "Feedback & Auditing",
        icon: "📈",
      },
    ],
  },

  /* 8. OUR TEAM */
  team: {
    eyebrow: "Our Organization",
    heading: "The People Behind HomeCareX",
    subtitle:
      "Cross-functional teams building and operating the platform.",
    intro:
      "Bringing together product engineers, service operators, and user advocates.",
    disciplines: [
      {
        id: "prod-tech",
        title: "Product & Technology",
        scope: "Platform Architecture & Engineering",
        focusAreas: [
          "Platform Architecture",
          "Capacity & Scheduling Engine",
          "Accessible Web Interfaces",
          "Data Security & Session Protection",
        ],
        icon: "💻",
      },
      {
        id: "service-ops",
        title: "Service Operations",
        scope: "Catalog & Workflow Coordination",
        focusAreas: [
          "Catalog Scope Standardization",
          "Partner Onboarding Guidelines",
          "Category Expansion",
          "Fulfillment Coordination",
        ],
        icon: "⚙️",
      },
      {
        id: "customer-exp",
        title: "Customer Experience",
        scope: "Support & User Advocacy",
        focusAreas: [
          "User Inquiry Support",
          "Booking Assistance",
          "Feedback Synthesis",
          "Resolution Pathways",
        ],
        icon: "🎧",
      },
      {
        id: "quality-safeguards",
        title: "Quality & Platform Safeguards",
        scope: "Process & System Integrity",
        focusAreas: [
          "Workflow Auditing",
          "Platform Reliability",
          "Safety Protocols",
          "Continuous Enhancement",
        ],
        icon: "🛡️",
      },
    ],
  },

  /* 9. OUR VALUES */
  values: {
    eyebrow: "Guiding Principles",
    heading: "Our Core Values",
    subtitle:
      "The operating principles guiding our product design, partnerships, and customer experience.",
    items: [
      {
        number: "01",
        title: "Customer First",
        tagline: "Designing simple, reliable experiences centered on homeowner peace of mind.",
        icon: "🎯",
      },
      {
        number: "02",
        title: "Transparency",
        tagline: "Zero hidden charges, published scopes, and honest communication.",
        icon: "🔍",
      },
      {
        number: "03",
        title: "Respect",
        tagline: "Valuing the craft, time, and livelihood of service professionals.",
        icon: "🤝",
      },
      {
        number: "04",
        title: "Responsibility",
        tagline: "Taking full ownership of safety, reliability, and platform trust.",
        icon: "⚖️",
      },
      {
        number: "05",
        title: "Continuous Improvement",
        tagline: "Refining our tools, service benchmarks, and customer care daily.",
        icon: "📈",
      },
    ],
  },

  /* 10. HOW HOMECAREX CONNECTS PEOPLE */
  howItWorks: {
    eyebrow: "How It Works",
    heading: "The 4-Step Customer Journey",
    subtitle:
      "A structured 4-step pathway from service selection to completed care.",
    steps: [
      {
        number: "01",
        title: "Discover",
        summary: "Explore vetted home services with transparent rates and clear inclusions.",
        details: [
          "Browse residential service categories",
          "Inspect transparent rate cards & inclusions",
          "Select optional add-on requirements",
        ],
        icon: "🔍",
      },
      {
        number: "02",
        title: "Request",
        summary: "Select a preferred date, time slot, and task specifications.",
        details: [
          "Choose preferred date & time slot",
          "Provide task details and location",
          "Secure reservation with automated slot locking",
        ],
        icon: "📝",
      },
      {
        number: "03",
        title: "Fulfill",
        summary: "Certified professionals arrive on time to complete checklist-verified work.",
        details: [
          "Platform coordinates partner dispatch",
          "Track real-time status transitions",
          "Standardized checklist fulfillment",
        ],
        icon: "⚡",
      },
      {
        number: "04",
        title: "Review & Guarantee",
        summary: "Inspect finished work, complete payment securely, and share feedback.",
        details: [
          "Post-service quality inspection",
          "Transparent digital payment settlement",
          "Customer reviews and satisfaction guarantee",
        ],
        icon: "🤝",
      },
    ],
  },

  /* 11. FINAL CTA */
  cta: {
    heading: "Ready for Simpler Home Services?",
    description:
      "Book verified professionals with upfront pricing and guaranteed quality.",
    primaryCta: {
      label: "Explore Services",
      href: ROUTES.SERVICES,
    },
    secondaryCta: {
      label: "Become a Partner",
      href: ROUTES.PARTNER_REGISTER,
    },
  },
};

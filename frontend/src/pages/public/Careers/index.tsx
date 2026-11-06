import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../../../components/common/Seo";
import { ROUTES } from "../../../constants/routes";
import {
  PublicPageBackground,
  publicStyles,
} from "../../../components/public/PublicPageBackground";

/* =========================================================
   SCROLL REVEAL HELPER
========================================================= */

function useInView<T extends HTMLElement>(threshold = 0.1) {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -30px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return [ref, seen] as const;
}

const Reveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
}> = ({ children, delay = 0, className = "" }) => {
  const [ref, seen] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`hcx-reveal ${seen ? "is-in" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

const SectionHead: React.FC<{
  id: string;
  eyebrow: string;
  title: string;
  text?: string;
}> = ({ id, eyebrow, title, text }) => (
  <Reveal className="mx-auto mb-6 max-w-3xl text-center sm:mb-8">
    <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#eef0ff] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#4338ca]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#ff8a3d]" aria-hidden="true" />
      {eyebrow}
    </p>
    <h2
      id={id}
      className="text-2xl font-extrabold text-[#1e1b6e] sm:text-3xl lg:text-[2.25rem] lg:leading-[1.18]"
    >
      {title}
    </h2>
    {text && (
      <p className="mt-2.5 text-sm leading-6 text-[#5b5b7a] sm:text-base sm:leading-7">
        {text}
      </p>
    )}
  </Reveal>
);

/* =========================================================
   CONTENT
   No fake job listings: openings are only shown when real.
   Add real roles to OPEN_ROLES below and they render automatically.
========================================================= */

interface OpenRole {
  title: string;
  team: string;
  location: string;
  type: string;
  summary: string;
}

const OPEN_ROLES: OpenRole[] = [];

const CAREERS_EMAIL = "support@homecarex.com";

const perks = [
  {
    icon: "🏡",
    title: "Meaningful work",
    text: "Help families get reliable home services without the hassle.",
  },
  {
    icon: "🚀",
    title: "Room to grow",
    text: "Work on a growing platform where your ideas can ship.",
  },
  {
    icon: "🤝",
    title: "Respectful culture",
    text: "Clear communication, honest feedback, and teamwork.",
  },
  {
    icon: "💻",
    title: "Modern tools",
    text: "Build with a modern web, mobile, and cloud stack.",
  },
];

const teams = [
  { icon: "🛠️", title: "Engineering", text: "Web, mobile, backend, and platform reliability." },
  { icon: "🎨", title: "Product & Design", text: "Simple, accessible experiences for customers and partners." },
  { icon: "📞", title: "Customer Support", text: "Helping customers and partners resolve issues quickly." },
  { icon: "📈", title: "Operations & Growth", text: "Partner onboarding, service quality, and city expansion." },
];

const steps = [
  { n: "01", title: "Apply", text: "Send your profile or resume with the role you are interested in." },
  { n: "02", title: "Conversation", text: "We chat about your experience, goals, and how you like to work." },
  { n: "03", title: "Skills discussion", text: "A practical discussion or task relevant to the role." },
  { n: "04", title: "Offer", text: "If it is a fit on both sides, we share the details and next steps." },
];

const CareersPage: React.FC = () => {
  const mailSubject = encodeURIComponent("Career enquiry - HomeCareX");

  return (
    <div className="hcx overflow-x-hidden bg-white">
      <Seo
        title="Careers | HomeCareX"
        description="Join HomeCareX and help make everyday home services simpler. Learn about our teams, how we hire, and how to get in touch about opportunities."
      />
      <style>{publicStyles}</style>

      {/* HERO */}
      <section
        aria-labelledby="careers-hero-title"
        className="relative isolate overflow-hidden bg-gradient-to-b from-[#eef0ff] via-[#f7f8ff] to-white pt-12 pb-12 sm:pt-16 sm:pb-16 lg:pt-20 lg:pb-20"
      >
        <div
          className="hcx-drift pointer-events-none absolute -right-32 -top-24 -z-10 h-96 w-96 rounded-full bg-[#ff8a3d]/15 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="hcx-drift pointer-events-none absolute -bottom-24 -left-32 -z-10 h-96 w-96 rounded-full bg-[#4338ca]/15 blur-3xl"
          style={{ animationDelay: "-7s" }}
          aria-hidden="true"
        />

        <div className="relative mx-auto flex max-w-7xl flex-col items-center px-5 sm:px-8 lg:px-10 text-center">
          <p className="hcx-in inline-flex items-center gap-1.5 rounded-full bg-white/90 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#4338ca] shadow-xs ring-1 ring-[#4338ca]/15 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff8a3d]" aria-hidden="true" />
            Careers
          </p>

          <h1
            id="careers-hero-title"
            className="mt-2.5 text-4xl font-extrabold leading-[1.08] tracking-tight text-[#1e1b6e] sm:text-5xl md:text-6xl lg:text-[4.25rem]"
          >
            Build the future of <span className="text-[#4338ca]">home care</span>
          </h1>

          <p
            className="hcx-in mx-auto mt-4 max-w-2xl text-sm leading-6 text-[#5b5b7a] sm:text-base sm:leading-7"
            style={{ animationDelay: "0.2s" }}
          >
            At HomeCareX we connect customers with trusted service professionals.
            If you care about quality, simplicity, and people, we would love to
            hear from you.
          </p>

          <div
            className="hcx-in mx-auto mt-6 flex w-full max-w-sm flex-row items-center justify-center gap-2 sm:mt-7 sm:max-w-none sm:gap-3.5"
            style={{ animationDelay: "0.35s" }}
          >
            <a
              href="#open-roles"
              className="group inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-[#ff8a3d] px-3.5 py-2.5 text-xs font-bold text-[#1b1b3a] shadow-[0_10px_30px_-10px_rgba(255,138,61,0.9)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#ff7a22] sm:flex-initial sm:gap-2 sm:px-6 sm:py-3 sm:text-sm lg:px-7 lg:py-3.5"
            >
              <span>View openings</span>
              <span className="shrink-0 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true">
                →
              </span>
            </a>
            <Link
              to={ROUTES.ABOUT}
              className="inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-xl border-2 border-[#4338ca] bg-white/90 px-3.5 py-2.5 text-xs font-bold text-[#4338ca] shadow-xs backdrop-blur-md transition duration-300 hover:bg-[#4338ca] hover:text-white sm:flex-initial sm:px-6 sm:py-3 sm:text-sm lg:px-7 lg:py-3.5"
            >
              About us
            </Link>
          </div>
        </div>
      </section>

      {/* WHY HOMECAREX */}
      <section
        aria-labelledby="careers-why-title"
        className="border-t border-[#4338ca]/10 bg-white py-10 sm:py-12 lg:py-14"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <SectionHead
            id="careers-why-title"
            eyebrow="Why HomeCareX"
            title="A place to do work that matters"
            text="Every booking on our platform is someone's home and someone's livelihood. That is what keeps us focused."
          />
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
            {perks.map((perk, i) => (
              <Reveal key={perk.title} delay={i * 80}>
                <article className="flex h-full flex-col rounded-xl border border-[#4338ca]/15 bg-[#fbfbfe] p-3 shadow-xs transition duration-300 hover:-translate-y-1 hover:border-[#4338ca] hover:shadow-md sm:rounded-2xl sm:p-5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-base shadow-2xs sm:h-10 sm:w-10 sm:rounded-xl sm:text-xl">
                    {perk.icon}
                  </span>
                  <h3 className="mt-2.5 text-xs font-bold text-[#1e1b6e] sm:mt-3.5 sm:text-base">
                    {perk.title}
                  </h3>
                  <p className="mt-1 text-[11px] leading-4 text-[#5b5b7a] sm:text-sm sm:leading-6">
                    {perk.text}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* TEAMS */}
      <section
        aria-labelledby="careers-teams-title"
        className="bg-[#eef0ff] py-10 sm:py-12 lg:py-14"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <SectionHead
            id="careers-teams-title"
            eyebrow="Our teams"
            title="Where you could fit in"
            text="We work across a few focus areas. Tell us where your strengths are."
          />
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
            {teams.map((t, i) => (
              <Reveal key={t.title} delay={i * 80}>
                <div className="flex h-full flex-col rounded-xl border border-[#4338ca]/10 bg-white p-3 shadow-2xs transition hover:border-[#ff8a3d]/50 sm:rounded-2xl sm:p-5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fff3ea] text-base sm:h-10 sm:w-10 sm:rounded-xl sm:text-xl">
                    {t.icon}
                  </span>
                  <h3 className="mt-2.5 text-xs font-bold text-[#1e1b6e] sm:mt-3.5 sm:text-base">
                    {t.title}
                  </h3>
                  <p className="mt-1 text-[11px] leading-4 text-[#5b5b7a] sm:text-sm sm:leading-6">
                    {t.text}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* OPEN ROLES */}
      <section
        id="open-roles"
        aria-labelledby="careers-roles-title"
        className="scroll-mt-24 bg-white py-10 sm:py-12 lg:py-14"
      >
        <div className="mx-auto max-w-4xl px-6">
          <SectionHead
            id="careers-roles-title"
            eyebrow="Open positions"
            title="Current openings"
          />

          {OPEN_ROLES.length === 0 ? (
            <Reveal>
              <div className="rounded-2xl border border-dashed border-[#4338ca]/30 bg-[#fbfbfe] p-6 text-center sm:p-8">
                <span className="text-3xl" aria-hidden="true">📭</span>
                <h3 className="mt-2 text-base font-bold text-[#1e1b6e] sm:text-lg">
                  No open positions right now
                </h3>
                <p className="mx-auto mt-1.5 max-w-xl text-sm leading-6 text-[#5b5b7a]">
                  We are not hiring for a specific role at the moment, but we
                  are always happy to meet talented people. Send us a short
                  note about yourself and we will keep it on file.
                </p>
                <div className="mt-5 flex flex-col items-center justify-center gap-2.5 sm:flex-row sm:gap-3">
                  <a
                    href={`mailto:${CAREERS_EMAIL}?subject=${mailSubject}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4338ca] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#3730a3]"
                  >
                    ✉️ <span>{CAREERS_EMAIL}</span>
                  </a>
                  <Link
                    to={ROUTES.CONTACT}
                    className="inline-flex items-center justify-center rounded-xl border border-[#4338ca]/30 px-5 py-2.5 text-sm font-semibold text-[#1e1b6e] transition hover:bg-[#eef0ff]"
                  >
                    Contact page
                  </Link>
                </div>
              </div>
            </Reveal>
          ) : (
            <ul className="space-y-3">
              {OPEN_ROLES.map((role, i) => (
                <Reveal key={role.title} delay={i * 60}>
                  <li className="rounded-2xl border border-[#4338ca]/15 bg-[#fbfbfe] p-4 shadow-xs sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-base font-bold text-[#1e1b6e] sm:text-lg">
                          {role.title}
                        </h3>
                        <p className="mt-0.5 text-xs font-semibold text-[#4338ca]">
                          {role.team} · {role.location} · {role.type}
                        </p>
                        <p className="mt-1.5 text-sm text-[#5b5b7a]">{role.summary}</p>
                      </div>
                      <a
                        href={`mailto:${CAREERS_EMAIL}?subject=${encodeURIComponent(
                          `Application - ${role.title}`
                        )}`}
                        className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#ff8a3d] px-5 py-2.5 text-sm font-bold text-[#1b1b3a] transition hover:bg-[#ff7a22]"
                      >
                        Apply
                      </a>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* HIRING PROCESS */}
      <section
        aria-labelledby="careers-process-title"
        className="bg-[#eef0ff] py-10 sm:py-12 lg:py-14"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <SectionHead
            id="careers-process-title"
            eyebrow="How we hire"
            title="A simple, respectful process"
          />
          <ol className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={i * 80}>
                <li className="flex h-full flex-col rounded-xl border border-[#4338ca]/10 bg-white p-3 shadow-2xs sm:rounded-2xl sm:p-5">
                  <span className="w-fit rounded-full bg-[#ff8a3d] px-2.5 py-0.5 text-[10px] font-black text-[#1b1b3a] sm:text-xs">
                    Step {s.n}
                  </span>
                  <h3 className="mt-2.5 text-xs font-bold text-[#1e1b6e] sm:text-base">
                    {s.title}
                  </h3>
                  <p className="mt-1 text-[11px] leading-4 text-[#5b5b7a] sm:text-sm sm:leading-6">
                    {s.text}
                  </p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* PARTNER CTA */}
      <PublicPageBackground variant="cta">
        <section
          aria-labelledby="careers-cta-title"
          className="border-t border-[#4338ca]/10 px-6 py-10 text-center sm:py-14 lg:py-16"
        >
          <Reveal>
            <div className="mx-auto max-w-4xl">
              <h2
                id="careers-cta-title"
                className="mx-auto max-w-2xl text-3xl font-extrabold leading-tight text-[#1e1b6e] sm:text-4xl lg:text-5xl"
              >
                Are you a skilled professional?
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#5b5b7a] sm:text-base sm:leading-7">
                Looking to offer services like cleaning, plumbing, electrical,
                or painting? Join HomeCareX as a service partner and connect
                with customers near you.
              </p>
              <div className="mx-auto mt-6 flex w-full max-w-sm flex-row items-center justify-center gap-2 sm:max-w-none sm:gap-4">
                <Link
                  to={ROUTES.PARTNER_REGISTER}
                  className="group inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-[#ff8a3d] px-3.5 py-2.5 text-xs font-bold text-[#1b1b3a] shadow-[0_10px_30px_-10px_rgba(255,138,61,0.9)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#ff7a22] sm:flex-initial sm:gap-2 sm:px-7 sm:py-3.5 sm:text-sm lg:px-8 lg:py-4"
                >
                  <span>Join as a professional</span>
                  <span className="shrink-0 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true">
                    →
                  </span>
                </Link>
                <Link
                  to={ROUTES.CONTACT}
                  className="inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-xl border-2 border-[#4338ca] bg-white/80 px-3.5 py-2.5 text-xs font-bold text-[#4338ca] backdrop-blur-xs transition duration-300 hover:-translate-y-0.5 hover:bg-[#4338ca] hover:text-white sm:flex-initial sm:px-7 sm:py-3.5 sm:text-sm lg:px-8 lg:py-4"
                >
                  Contact us
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </PublicPageBackground>
    </div>
  );
};

export default CareersPage;
import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LucideIcon,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import ContactForm from '@/components/public/ContactForm';
import MapEmbed from '@/components/public/MapEmbed';
import PartnerInterestForm from '@/components/public/PartnerInterestForm';
import Seo from '@/components/common/Seo';
import { breadcrumbLd } from '@/lib/jsonld';
import './Contact.css';

const CAROUSEL_INTERVAL_MS = 4000;

interface ContactItem {
  id: string;
  label: string;
  tabLabel: string;
  badge: string;
  title: string;
  detail: string;
  href: string;
  note: string;
  cta: string;
  icon: LucideIcon;
  theme: {
    border: string;
    gradient: string;
    bg: string;
    pillBorder: string;
    badgeText: string;
    accentText: string;
    buttonBg: string;
  };
}

const contactItems: ContactItem[] = [
  {
    id: 'call',
    label: 'Call',
    tabLabel: 'Call',
    badge: 'Direct Line',
    title: 'Talk to our team',
    detail: '+91 93902 12572',
    href: 'tel:+919390212572',
    note: 'Monday–Saturday, 9:00 AM–6:00 PM',
    cta: 'Call Now',
    icon: Phone,
    theme: {
      border: 'border-indigo-100',
      gradient: 'from-white via-indigo-50/40 to-indigo-100/30',
      bg: 'bg-gradient-to-br from-indigo-500 to-indigo-700',
      pillBorder: 'border-indigo-200/80',
      badgeText: 'text-indigo-800',
      accentText: 'text-indigo-600',
      buttonBg: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200',
    },
  },
  {
    id: 'email',
    label: 'Email',
    tabLabel: 'Email',
    badge: 'Priority Inbox',
    title: 'Write us a note',
    detail: 'support@homecarex.com',
    href: 'mailto:support@homecarex.com',
    note: 'We’ll get back to you as soon as we can.',
    cta: 'Send Email',
    icon: Mail,
    theme: {
      border: 'border-blue-100',
      gradient: 'from-white via-blue-50/40 to-sky-100/30',
      bg: 'bg-gradient-to-br from-blue-500 to-sky-600',
      pillBorder: 'border-blue-200/80',
      badgeText: 'text-blue-800',
      accentText: 'text-blue-600',
      buttonBg: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200',
    },
  },
  {
    id: 'office',
    label: 'Office',
    tabLabel: 'Office',
    badge: 'Headquarters',
    title: 'Find our office',
    detail: 'Hyderabad, Telangana',
    href: '#office',
    note: 'Get in touch before visiting.',
    cta: 'View Office Location',
    icon: MapPin,
    theme: {
      border: 'border-emerald-100',
      gradient: 'from-white via-emerald-50/40 to-teal-100/30',
      bg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
      pillBorder: 'border-emerald-200/80',
      badgeText: 'text-emerald-800',
      accentText: 'text-emerald-600',
      buttonBg: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200',
    },
  },
  {
    id: 'hours',
    label: 'Support hours',
    tabLabel: 'Hours',
    badge: 'Active Support',
    title: 'We’re here to help',
    detail: 'Monday–Saturday',
    href: '#contact-form',
    note: '9:00 AM–6:00 PM',
    cta: 'Send Message',
    icon: Clock3,
    theme: {
      border: 'border-amber-100',
      gradient: 'from-white via-amber-50/40 to-orange-100/30',
      bg: 'bg-gradient-to-br from-amber-500 to-orange-600',
      pillBorder: 'border-amber-200/80',
      badgeText: 'text-amber-800',
      accentText: 'text-amber-600',
      buttonBg: 'bg-[#f97316] hover:bg-orange-600 text-white shadow-orange-200',
    },
  },
];

const nextSteps = [
  { title: 'You send the details', text: 'Fill in the short form with your question or request.' },
  { title: 'Our team reviews it', text: 'Your enquiry goes to the HomeCareX team, not posted publicly.' },
  { title: 'We get back to you', text: 'We reply on working days, Monday to Saturday.' },
] as const;

/** Support runs Mon–Sat, 9:00–18:00 India time. Computed from IST so it is right for any visitor. */
const isSupportOpen = (now: Date): boolean => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      hour: 'numeric',
      hour12: false,
    }).formatToParts(now);
    const weekday = parts.find((p) => p.type === 'weekday')?.value;
    const hour = Number(parts.find((p) => p.type === 'hour')?.value) % 24;
    return weekday !== 'Sun' && hour >= 9 && hour < 18;
  } catch {
    return false;
  }
};

const useSupportOpen = (): boolean => {
  const [open, setOpen] = useState<boolean>(() => isSupportOpen(new Date()));
  useEffect(() => {
    const id = window.setInterval(() => setOpen(isSupportOpen(new Date())), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return open;
};

const Contact: React.FC = () => {
  const location = useLocation();
  const supportOpen = useSupportOpen();

  // Mobile Carousel State
  const [mobileTab, setMobileTab] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

  // Auto-rotate mobile carousel
  useEffect(() => {
    if (isCarouselPaused) return;

    const timer = setInterval(() => {
      setMobileTab((prev) => (prev + 1) % contactItems.length);
    }, CAROUSEL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [isCarouselPaused]);

  useEffect(() => {
    if (!location.hash) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.hash]);

  return (
    <div className="contact-page">
      <Seo
        title="Contact Us | HomeCareX"
        description="Get in touch with HomeCareX for booking help, support or partner enquiries. Choose the way that suits you."
        jsonLd={breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: 'Contact', path: '/contact' },
        ])}
      />

      {/* ============ HERO ============ */}
      <section id="contact-methods" className="cx-hero" aria-labelledby="contact-hero-title">
        <div className="cx-shell cx-hero__grid">
          <div className="cx-hero__copy">
            <p className="cx-eyebrow"><span aria-hidden="true" />Contact HomeCareX</p>
            <h1 id="contact-hero-title">
              How can we <em>help you</em> today?
            </h1>
            <p className="cx-hero__lead">
              Questions about a booking, a service, or working with us? Pick the way that suits
              you and our team will take it from there.
            </p>

            <div className="cx-hero__actions">
              <a href="#contact-form" className="cx-btn cx-btn--primary">
                <MessageSquareText aria-hidden="true" size={17} /> Send us a message
              </a>
              <a href={PHONE_HREF} className="cx-btn cx-btn--ghost">
                <Phone aria-hidden="true" size={17} /> Call {PHONE_DISPLAY}
              </a>
            </div>

            <p className={`cx-status ${supportOpen ? 'is-open' : ''}`}>
              <span className="cx-status__dot" aria-hidden="true" />
              <span>
                <b>{supportOpen ? 'Support is open now' : 'Support is currently closed'}</b>
                <small>Monday–Saturday, 9:00 AM–6:00 PM</small>
              </span>
            </p>
          </div>

          {/* --------------------------------------------------
              MOBILE VIEW: Animated Carousel (< 768px)
          -------------------------------------------------- */}
          <div className="mt-5 block md:hidden">
            {/* Interactive Pill Tabs */}
            <div className="flex items-center gap-1 rounded-2xl bg-slate-100/90 p-1 shadow-2xs">
              {contactItems.map((item, idx) => {
                const TabIcon = item.icon;
                const isActive = mobileTab === idx;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setMobileTab(idx);
                      setIsCarouselPaused(true);
                    }}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 px-1 text-xs font-bold transition-all duration-300 ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    aria-label={`Show ${item.label} contact option`}
                    aria-pressed={isActive}
                  >
                    <TabIcon
                      size={13}
                      className={isActive ? item.theme.accentText : 'text-slate-400'}
                      aria-hidden="true"
                    />
                    <span className="truncate text-[11px]">{item.tabLabel}</span>
                  </button>
                );
              })}
            </div>

            {/* Sliding Carousel Track Container */}
            <div
              className="relative mt-3"
              onMouseEnter={() => setIsCarouselPaused(true)}
              onMouseLeave={() => setIsCarouselPaused(false)}
              onTouchStart={() => setIsCarouselPaused(true)}
              onTouchEnd={() => setIsCarouselPaused(false)}
            >
              {/* Overflow Hidden Track Window */}
              <div className="overflow-hidden rounded-2xl">
                <div
                  className="flex transition-transform duration-500 ease-out will-change-transform"
                  style={{ transform: `translateX(-${mobileTab * 100}%)` }}
                >
                  {contactItems.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <div key={item.id} className="w-full shrink-0">
                        <div
                          className={`rounded-2xl border ${item.theme.border} bg-gradient-to-br ${item.theme.gradient} p-5 shadow-2xs`}
                        >
                          {/* Top Row: Icon + Eyebrow + Title + Badge */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.theme.bg} text-white shadow-2xs`}
                              >
                                <ItemIcon size={20} aria-hidden="true" />
                              </div>
                              <div className="min-w-0">
                                <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                  {item.label}
                                </span>
                                <h2 className="text-base font-extrabold text-slate-900 leading-snug">
                                  {item.title}
                                </h2>
                              </div>
                            </div>

                            <span
                              className={`shrink-0 rounded-full bg-white/95 border ${item.theme.pillBorder} px-2.5 py-0.5 text-[10px] font-extrabold ${item.theme.badgeText} shadow-2xs`}
                            >
                              {item.badge}
                            </span>
                          </div>

                          {/* Detail & Note Box */}
                          <div className="mt-4 rounded-xl bg-white/90 border border-slate-200/70 p-3.5 shadow-2xs">
                            <a
                              href={item.href}
                              className="block text-base font-black text-slate-900 transition-colors hover:text-indigo-600 break-words"
                            >
                              {item.detail}
                            </a>
                            <p className="mt-1 text-xs text-slate-500 font-medium leading-relaxed">
                              {item.note}
                            </p>
                          </div>

                          {/* Action CTA Button */}
                          <a
                            href={item.href}
                            className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs font-bold transition-all duration-200 active:scale-[0.98] ${item.theme.buttonBg} shadow-xs`}
                          >
                            <span>{item.cta}</span>
                            <ArrowRight size={14} aria-hidden="true" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Prev Carousel Navigation Button (Positioned cleanly outward) */}
              <button
                type="button"
                onClick={() => {
                  setMobileTab(
                    (prev) => (prev - 1 + contactItems.length) % contactItems.length
                  );
                  setIsCarouselPaused(true);
                }}
                aria-label="Previous contact option"
                className="absolute -left-3 sm:-left-3.5 top-1/2 -translate-y-1/2 z-10 flex h-7.5 w-7.5 items-center justify-center rounded-full bg-white text-slate-700 shadow-md border border-slate-200/90 transition-all active:scale-90 hover:bg-slate-50"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>

              {/* Next Carousel Navigation Button (Positioned cleanly outward) */}
              <button
                type="button"
                onClick={() => {
                  setMobileTab((prev) => (prev + 1) % contactItems.length);
                  setIsCarouselPaused(true);
                }}
                aria-label="Next contact option"
                className="absolute -right-3 sm:-right-3.5 top-1/2 -translate-y-1/2 z-10 flex h-7.5 w-7.5 items-center justify-center rounded-full bg-white text-slate-700 shadow-md border border-slate-200/90 transition-all active:scale-90 hover:bg-slate-50"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>

            {/* Carousel Animated Dots Indicator */}
            <div className="mt-3 flex items-center justify-center gap-1.5">
              {contactItems.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setMobileTab(idx);
                    setIsCarouselPaused(true);
                  }}
                  aria-label={`Go to ${item.label} contact option`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    mobileTab === idx
                      ? 'w-6 bg-gradient-to-r from-indigo-600 to-[#f97316]'
                      : 'w-2 bg-slate-300 hover:bg-slate-400'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* --------------------------------------------------
              DESKTOP VIEW: Full Grid (>= 768px)
          -------------------------------------------------- */}
          <div className="contact-ways__grid hidden md:grid">
            {contactItems.map(({ label, title, detail, href, note, icon: Icon }) => (
              <a key={label} href={href} className="contact-way">
                <span className="contact-way__top"><Icon aria-hidden="true" size={17} /><span>{label}</span><ArrowRight aria-hidden="true" size={15} /></span>
                <span className="contact-way__title">{title}</span>
                <span className="contact-way__action">{detail}</span>
                <span className="contact-way__note">{note}</span>
              </a>
            ))}
          </aside>
        </div>
      </section>

      {/* ============ FORM + SIDEBAR ============ */}
      <section className="cx-section cx-talk" aria-label="Send us a message">
        <div className="cx-shell cx-talk__grid">
          <div className="cx-talk__form">
            <ContactForm />
          </div>

          <aside className="cx-talk__side">
            <div className="cx-card">
              <p className="cx-eyebrow"><span aria-hidden="true" />What happens next</p>
              <ol className="cx-steps">
                {nextSteps.map((step, i) => (
                  <li key={step.title}>
                    <span className="cx-steps__num" aria-hidden="true">{i + 1}</span>
                    <span>
                      <b>{step.title}</b>
                      <small>{step.text}</small>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="cx-card cx-card--accent">
              <span className="cx-card__badge"><Headphones aria-hidden="true" size={18} /></span>
              <h3>Prefer to talk?</h3>
              <p>Call us during support hours and we will help you right away.</p>
              <a href={PHONE_HREF} className="cx-link">
                {PHONE_DISPLAY} <ArrowRight aria-hidden="true" size={15} />
              </a>
              <p className="cx-card__hours"><Clock3 aria-hidden="true" size={14} /> Mon–Sat, 9:00 AM–6:00 PM</p>
            </div>

            <div className="cx-card cx-help">
              <h3>Looking for a quick answer?</h3>
              <Link to="/faq" className="cx-help__row">
                <Search aria-hidden="true" size={16} /> Browse the FAQs <ArrowRight aria-hidden="true" size={15} />
              </Link>
              <Link to="/services" className="cx-help__row">
                <CheckCircle2 aria-hidden="true" size={16} /> Explore our services <ArrowRight aria-hidden="true" size={15} />
              </Link>
            </div>
          </aside>
        </div>
      </section>

      {/* ============ OFFICE ============ */}
      <section className="cx-section cx-office-band" aria-labelledby="contact-office-title">
        <div id="office" className="cx-shell cx-office">
          <div className="cx-office__copy">
            <p className="cx-eyebrow"><span aria-hidden="true" />Our location</p>
            <h2 id="contact-office-title">Rooted in Hyderabad. <em>Here for your home.</em></h2>
            <p>
              HomeCareX is based in Hyderabad, Telangana. Please reach out before visiting so we can
              make sure someone is available to meet you.
            </p>
            <div className="cx-address">
              <span className="cx-address__icon"><MapPin aria-hidden="true" size={18} /></span>
              <span>
                <b>HomeCareX Office</b>
                <small>Hyderabad, Telangana, India</small>
              </span>
            </div>
            <a
              className="cx-link"
              href="https://www.openstreetmap.org/?mlat=17.385&mlon=78.4867#map=12/17.385/78.4867"
              target="_blank"
              rel="noreferrer"
            >
              Open in OpenStreetMap <ArrowRight aria-hidden="true" size={15} />
            </a>
          </div>
          <div className="cx-office__map"><MapEmbed /></div>
        </div>
      </section>

      <section
        id="partner-interest"
        className="partner-band"
        aria-labelledby="partner-band-title"
      >
        <div className="contact-shell partner-band__layout">
          <div className="partner-band__copy">
            <p className="contact-eyebrow contact-eyebrow--light"><span />For home-service professionals</p>
            <h2 id="partner-band-title">Bring your craft.<br /><span>Build what’s next.</span></h2>
            <p>Join the HomeCareX network and let customers discover the services you provide. Tell us about your experience and location — our team will follow up personally.</p>
            <Link to="/register/partner" className="partner-band__cta">Become a Partner <ArrowRight aria-hidden="true" size={17} /></Link>
            <div className="partner-band__note"><ShieldCheck aria-hidden="true" size={16} /><span><b>A conversation, not a commitment.</b><small>This enquiry does not create an account or sign you up for anything.</small></span></div>
          </div>
          <div className="cx-partner__form">
            <PartnerInterestForm />
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
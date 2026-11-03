import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LucideIcon,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
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

const Contact: React.FC = () => {
  const location = useLocation();

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
      <section id="contact-methods" className="contact-ways" aria-labelledby="contact-ways-title">
        <div className="contact-shell">
          <div className="contact-section-heading">
            <div>
              <p className="contact-eyebrow"><span />Choose your way in</p>
              <h1 id="contact-ways-title">Reach us directly.</h1>
            </div>
            <p>Whether it’s a quick question or a bigger conversation, we’re listening.</p>
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
          </div>
        </div>
      </section>

      <section className="contact-faq" aria-labelledby="contact-faq-title">
        <div className="contact-shell contact-faq__inner">
          <span className="contact-faq__icon"><MessageCircle aria-hidden="true" size={20} /></span>
          <div className="contact-faq__copy">
            <p className="contact-eyebrow"><span />Frequently asked questions</p>
            <h2 id="contact-faq-title">Still have questions?</h2>
            <p>Find answers about HomeCareX services and getting started.</p>
            <Link to="/faq" className="contact-faq__link">View FAQs <ArrowRight aria-hidden="true" size={16} /></Link>
          </div>
        </div>
      </section>

      <section className="contact-conversation" aria-labelledby="contact-form-heading">
        <div className="contact-shell contact-conversation__layout">
          <aside className="contact-conversation__aside">
            <p className="contact-eyebrow"><span />Start a conversation</p>
            <h2 id="contact-form-heading">Tell us what’s on your mind.</h2>
            <p>Send a few details and the HomeCareX team will take it from there. Your enquiry is shared with our team, not posted publicly.</p>
            <a className="contact-conversation__direct" href="tel:+919390212572">
              <span className="contact-conversation__direct-icon"><Phone aria-hidden="true" size={17} /></span>
              <span><small>Prefer to call?</small><b>+91 93902 12572</b></span>
              <ArrowRight aria-hidden="true" size={16} />
            </a>
            <div className="contact-conversation__hours"><Clock3 aria-hidden="true" size={16} /><span>Monday–Saturday<small>9:00 AM–6:00 PM</small></span></div>
          </aside>
          <ContactForm />
        </div>
      </section>

      <section className="contact-office-band" aria-labelledby="contact-office-title">
        <div id="office" className="contact-office contact-shell">
          <div className="contact-office__copy">
            <p className="contact-eyebrow"><span />A local point of contact</p>
            <h2 id="contact-office-title">Rooted in Hyderabad.<br /><span>Here for your home.</span></h2>
            <p>HomeCareX is based in Hyderabad, Telangana. Reach out before visiting so we can make sure someone is available to meet you.</p>
            <div className="contact-office__address"><span><MapPin aria-hidden="true" size={18} /></span><div><b>HomeCareX Office</b><small>Hyderabad, Telangana, India</small></div></div>
            <a className="contact-office__link" href="https://www.openstreetmap.org/?mlat=17.385&mlon=78.4867#map=12/17.385/78.4867" target="_blank" rel="noreferrer">Open in OpenStreetMap <ArrowRight aria-hidden="true" size={15} /></a>
          </div>
          <div className="contact-office__map"><MapEmbed /><span className="contact-office__map-label"><MapPin aria-hidden="true" size={14} /> HYDERABAD, TELANGANA</span></div>
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
          <div className="partner-band__form">
            <div className="partner-band__form-head"><span>PARTNER ENQUIRY</span><span>01 <i /> 02 <i /> 03</span></div>
            <PartnerInterestForm />
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;

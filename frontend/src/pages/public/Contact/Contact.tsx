import React, { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Headphones,
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

const PHONE_DISPLAY = '+91 93902 12572';
const PHONE_HREF = 'tel:+919390212572';
const EMAIL = 'support@homecarex.com';

interface ContactItem {
  id: string;
  label: string;
  detail: string;
  href: string;
  note: string;
  icon: LucideIcon;
}

const contactItems: ContactItem[] = [
  {
    id: 'call',
    label: 'Call us',
    detail: PHONE_DISPLAY,
    href: PHONE_HREF,
    note: 'Speak directly with our team',
    icon: Phone,
  },
  {
    id: 'email',
    label: 'Email us',
    detail: EMAIL,
    href: `mailto:${EMAIL}`,
    note: 'We’ll get back to you as soon as we can.',
    icon: Mail,
  },
  {
    id: 'office',
    label: 'Visit us',
    detail: 'Hyderabad, Telangana',
    href: '#office',
    note: 'Get in touch before visiting.',
    icon: MapPin,
  },
  {
    id: 'hours',
    label: 'Support hours',
    detail: 'Monday–Saturday',
    href: '#contact-form',
    note: '9:00 AM–6:00 PM',
    icon: Clock3,
  },
];

const nextSteps = [
  { title: 'You send the details', text: 'Fill in the short form with your question or request.' },
  { title: 'Our team reviews it', text: 'Your enquiry goes to the HomeCareX team, not posted publicly.' },
  { title: 'We get back to you', text: 'We reply on working days, Monday to Saturday.' },
] as const;

/** Support runs Monâ€“Sat, 9:00â€“18:00 India time. Computed from IST so it is right for any visitor. */
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

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const Contact: React.FC = () => {
  const location = useLocation();
  const supportOpen = useSupportOpen();

  useEffect(() => {
    if (!location.hash) return undefined;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
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
            </div>

            <p className={`cx-status ${supportOpen ? 'is-open' : ''}`}>
              <span className="cx-status__dot" aria-hidden="true" />
              <span>
                <b>{supportOpen ? 'Support is open now' : 'Support is currently closed'}</b>
                <small>Mondayâ€“Saturday, 9:00 AMâ€“6:00 PM</small>
              </span>
            </p>
          </div>

          {/* Contact options: same stacked cards on every screen size */}
          <aside className="cx-channels" aria-label="Ways to reach us">
            {contactItems.map(({ id, label, detail, href, note, icon: Icon }) => (
              <a key={id} href={href} className="cx-channel">
                <span className="cx-channel__icon"><Icon aria-hidden="true" size={20} /></span>
                <span className="cx-channel__text">
                  <small>{label}</small>
                  <b>{detail}</b>
                  <span>{note}</span>
                </span>
                <ArrowRight aria-hidden="true" size={17} className="cx-channel__arrow" />
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
              <p className="cx-card__hours"><Clock3 aria-hidden="true" size={14} /> Monâ€“Sat, 9:00 AMâ€“6:00 PM</p>
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

      {/* ============ PARTNER ============ */}
      <section id="partner-interest" className="cx-partner" aria-labelledby="partner-band-title">
        <div className="cx-shell cx-partner__grid">
          <div className="cx-partner__copy">
            <p className="cx-eyebrow"><span aria-hidden="true" />For home-service professionals</p>
            <h2 id="partner-band-title">Bring your craft. <em>Build what&rsquo;s next.</em></h2>
            <p>
              Join the HomeCareX network and let customers discover the services you provide. Tell us
              about your experience and location, and our team will follow up personally.
            </p>
            <Link to="/register/partner" className="cx-btn cx-btn--primary">
              Become a Partner <ArrowRight aria-hidden="true" size={17} />
            </Link>
            <p className="cx-partner__note">
              <ShieldCheck aria-hidden="true" size={18} />
              <span>
                <b>A conversation, not a commitment.</b>
                <small>This enquiry does not create an account or sign you up for anything.</small>
              </span>
            </p>
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
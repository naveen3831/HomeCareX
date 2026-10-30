import api from '@/lib/api';
import { getQuickFix, sendSos } from '@/pages/partner/Safety/safety.api';
import { MAX_PHOTO_BYTES, validatePhoto } from '@/lib/photoValidation';
import { mapJob, mapJobListItemToJobDetails, getDefaultChecklistForService, type JobListItemLike } from './jobDetails.mapper';
import type { ApiJob, CompletionInput, ExtraChargeItem, JobDetails, StartVerification } from './jobDetails.types';
import type { JobAction, JobStatus } from './jobStatus';
import { useAuthStore } from '@/store/useAuthStore';
import { getPartnerServices } from '../MyServices/myServices.api';

export const MOCK_PARTNER_ROUTE_STORAGE_KEY = 'homecarex_partner_route_mock_job_v1';
export const MOCK_PARTNER_ASSIGNED_LIST_STORAGE_KEY = 'homecarex_partner_assigned_services_v2';

function getCurrentUserId(): string | undefined {
  const id = useAuthStore.getState().user?.id;
  return typeof id === 'string' ? id : undefined;
}

export function getAssignedCatalogStorageKey(userId?: string): string {
  const effectiveId = userId || getCurrentUserId();
  return effectiveId
    ? `homecarex_partner_assigned_services_v3_${effectiveId}`
    : MOCK_PARTNER_ASSIGNED_LIST_STORAGE_KEY;
}

export function matchServiceToPartner(
  jobServiceName: string,
  partnerServices?: Array<{ id?: string; name?: string; slug?: string }>,
): boolean {
  if (!partnerServices || partnerServices.length === 0) {
    return true;
  }

  const jobNorm = (jobServiceName || '').toLowerCase().trim();
  if (!jobNorm) return false;

  const KEYWORD_GROUPS: string[][] = [
    ['spa', 'salon', 'massage', 'facial', 'therapy', 'beauty', 'waxing', 'manicure', 'pedicure'],
    ['pest', 'termite', 'cockroach', 'gel treatment', 'bed bug', 'insect', 'rodent'],
    ['ac', 'air condition', 'cooling', 'compressor', 'split ac', 'window ac'],
    ['chimney', 'hob', 'kitchen', 'exhaust fan'],
    ['bathroom', 'steam sanitization', 'toilet', 'tile', 'descaling'],
    ['sofa', 'upholstery', 'carpet', 'shampoo', 'cushion', 'fabric'],
    ['tank', 'water tank', 'sintex', 'over head tank', 'sump'],
    ['washing machine', 'washer', 'dryer', 'laundry'],
    ['refrigerator', 'fridge', 'freezer'],
    ['deep home cleaning', 'deep clean', 'home clean', 'house clean', 'floor polish', 'marble', 'buffing', 'regular home cleaning', 'cleaning'],
    ['plumbing', 'pipe', 'tap', 'leak', 'drain', 'water motor'],
    ['electrical', 'switch', 'wiring', 'circuit', 'fan', 'fuse', 'socket'],
    ['paint', 'whitewash', 'waterproofing', 'wall putty'],
  ];

  for (const svc of partnerServices) {
    const sName = (svc.name || '').toLowerCase().trim();
    const sSlug = (svc.slug || '').toLowerCase().replace(/[-_]/g, ' ').trim();

    if (!sName && !sSlug) continue;

    if (jobNorm.includes(sName) || sName.includes(jobNorm)) return true;
    if (sSlug && (jobNorm.includes(sSlug) || sSlug.includes(jobNorm))) return true;

    for (const group of KEYWORD_GROUPS) {
      const jobMatchesGroup = group.some((kw) => jobNorm.includes(kw));
      const svcMatchesGroup = group.some((kw) => sName.includes(kw) || sSlug.includes(kw));
      if (jobMatchesGroup && svcMatchesGroup) {
        return true;
      }
    }
  }

  return false;
}
/** Demo start code. The real code is 4 digits too (see POST /partner/jobs/:id/verify-start). */
export const DEMO_START_OTP = '1234';

/**
 * Mocks are active when VITE_USE_MOCKS is explicitly set to 'true'.
 * In real API mode, fetchJob still falls back cleanly if a mock job is requested.
 */
export const IS_MOCK_JOBS = String(import.meta.env.VITE_USE_MOCKS ?? 'false') === 'true';

/** Same rules as the backend (backend/src/modules/partner-jobs/partner-jobs.service.ts). */
export const START_OTP_MAX_ATTEMPTS = 5;
const START_OTP_TTL_MS = 60 * 60_000;

function getActionsForStatus(status: JobStatus): JobAction[] {
  if (status === 'confirmed' || status === 'assigned') {
    return [{ status: 'en_route', label: 'On the way' }];
  }
  if (status === 'en_route') {
    return [{ status: 'arrived', label: 'Arrived at location' }];
  }
  return [];
}

const KNOWN_MOCK_SERVICES: Record<string, Partial<JobDetails>> = {
  spa: {
    service: {
      name: 'At-Home Spa for Women',
      description: 'Relaxing spa session by a trained therapist, at home.',
      quantity: 1,
      durationMinutes: 120,
    },
    customer: {
      name: 'Bharat S.',
      phoneMasked: '+91 ΓÇóΓÇóΓÇóΓÇóΓÇó ΓÇóΓÇó007',
      subtitle: 'Calls are routed through the app',
    },
    location: {
      address: '14, Road No. 5, Jubilee Hills',
      city: 'Hyderabad',
      pincode: '500033',
      hint: 'Near Jubilee Hills Checkpost',
    },
    price: {
      basePrice: 1299,
      total: 1348,
      partnerEarning: 1299,
    },
    addOns: [
      { id: 'addon-spa-1', name: 'Aromatherapy Oils', quantity: 1, amount: 200 },
    ],
    instructions: 'Please bring fresh massage oils and clean towels.',
  },
  repair: {
    service: {
      name: 'Washing Machine Repair',
      description: 'Front & Top Load Washing Machine Diagnostic & Repair',
      quantity: 1,
      durationMinutes: 60,
    },
    customer: {
      name: 'Priya Reddy',
      phoneMasked: '+91 ΓÇóΓÇóΓÇóΓÇóΓÇó ΓÇóΓÇó202',
      subtitle: 'Calls are routed through the app',
    },
    location: {
      address: 'Plot 28, Silicon Valley, Kondapur',
      city: 'Hyderabad',
      pincode: '500084',
      hint: '4.1 km away',
    },
    price: {
      basePrice: 599,
      total: 648,
      partnerEarning: 599,
    },
    addOns: [],
    instructions: 'Customer reported unusual vibration during spin cycle.',
  },
  ac: {
    service: {
      name: 'AC Service & Gas Refill',
      description: 'Split / Window AC Deep Cleaning & Refrigerant Gas Check',
      quantity: 1,
      durationMinutes: 90,
    },
    customer: {
      name: 'Arjun Kumar',
      phoneMasked: '+91 ΓÇóΓÇóΓÇóΓÇóΓÇó ΓÇóΓÇó303',
      subtitle: 'Calls are routed through the app',
    },
    location: {
      address: 'Tower B, Inorbit Mall Road, Madhapur',
      city: 'Hyderabad',
      pincode: '500081',
      hint: '5.2 km away',
    },
    price: {
      basePrice: 899,
      total: 948,
      partnerEarning: 899,
    },
    addOns: [
      { id: 'addon-ac-1', name: 'Gas Top-up', quantity: 1, amount: 400 },
    ],
    instructions: 'Check cooling efficiency and clean outdoor unit.',
  },
  kitchen: {
    service: {
      name: 'Kitchen Cleaning',
      description: 'Deep Degreasing & Disinfection for Modular Kitchen',
      quantity: 1,
      durationMinutes: 120,
    },
    customer: {
      name: 'Sneha Patel',
      phoneMasked: '+91 ΓÇóΓÇóΓÇóΓÇóΓÇó ΓÇóΓÇó404',
      subtitle: 'Calls are routed through the app',
    },
    location: {
      address: 'Villa 12, Road No. 10, Jubilee Hills',
      city: 'Hyderabad',
      pincode: '500033',
      hint: '7.8 km away',
    },
    price: {
      basePrice: 1299,
      total: 1348,
      partnerEarning: 1299,
    },
    addOns: [],
    instructions: 'Focus on kitchen cabinets and chimney area.',
  },
  plumbing: {
    service: {
      name: 'Plumbing ΓÇô Tap & Leak Repair',
      description: 'Kitchen and Bathroom Tap Leakage & Pipe Repair',
      quantity: 1,
      durationMinutes: 45,
    },
    customer: {
      name: 'Vikram Singh',
      phoneMasked: '+91 ΓÇóΓÇóΓÇóΓÇóΓÇó ΓÇóΓÇó505',
      subtitle: 'Calls are routed through the app',
    },
    location: {
      address: 'Flat 101, Lakeview Residency, Manikonda',
      city: 'Hyderabad',
      pincode: '500089',
      hint: '6.3 km away',
    },
    price: {
      basePrice: 299,
      total: 348,
      partnerEarning: 299,
    },
    addOns: [],
    instructions: 'Tap leakage under kitchen sink.',
  },
  cleaning: {
    service: {
      name: 'Deep home cleaning',
      description: '2 BHK ┬╖ Kitchen, bathrooms, floors',
      quantity: 1,
      durationMinutes: 180,
    },
    customer: {
      name: 'Rohan K.',
      phoneMasked: '+91 ΓÇóΓÇóΓÇóΓÇóΓÇó ΓÇóΓÇó214',
      subtitle: 'Calls are routed through the app',
    },
    location: {
      address: 'Flat 402, Green Meadows Apartments, Gachibowli',
      city: 'Hyderabad',
      pincode: '500032',
      hint: '6.4 km away',
    },
    price: {
      basePrice: 1499,
      total: 1997,
      partnerEarning: 1498,
    },
    addOns: [
      { id: 'addon-1', name: 'Fridge cleaning', quantity: 1, amount: 299 },
      { id: 'addon-2', name: 'Balcony wash', quantity: 1, amount: 199 },
    ],
    instructions: 'Pet cat at home. Ring the bell once only.',
  },
};

/**
 * Catalog of assigned services for the partner.
 * Contains realistic services including At-Home Spa, Appliance Repair, and Cleaning.
 */
export function createInitialAssignedServicesCatalog(
  partnerServices?: Array<{ id?: string; name?: string; slug?: string }>,
): JobDetails[] {
  const started1h24m36sAgo = new Date(Date.now() - (1 * 3600 + 24 * 60 + 36) * 1000).toISOString();

  const candidatePool: JobDetails[] = [
    {
      id: 'BK-20418',
      bookingCode: '#BK-20418',
      status: 'assigned',
      customer: {
        name: 'Rohan K.',
        phoneMasked: '+91 ΓÇóΓÇóΓÇóΓÇóΓÇó ΓÇóΓÇó214',
        subtitle: 'Calls are routed through the app',
      },
      service: {
        name: 'Deep home cleaning',
        description: '2 BHK ┬╖ Kitchen, bathrooms, floors',
        quantity: 1,
        durationMinutes: 180,
      },
      location: {
        address: 'Flat ΓÇóΓÇóΓÇó, Green Meadows Apartments',
        city: 'Hyderabad',
        pincode: '500039',
        hint: 'Full address unlocks at start ┬╖ 6.4 km away',
      },
      schedule: {
        scheduledAt: '2026-10-14T04:30:00.000Z',
        dateLabel: 'Tue, 14 Oct 2026',
        slot: '10:00 ΓÇô 13:00',
        startedAt: started1h24m36sAgo,
        startedTimeLabel: '10:02 AM',
        completedAt: null,
      },
      price: {
        basePrice: 1499,
        total: 1997,
        partnerEarning: 1498,
      },
      addOns: [
        { id: 'addon-1', name: 'Fridge cleaning', quantity: 1, amount: 299 },
        { id: 'addon-2', name: 'Balcony wash', quantity: 1, amount: 199 },
      ],
      instructions: 'Pet cat at home. Please bring your own mop. Ring the bell once only.',
      checklist: [
        { id: 'chk-1', label: 'Dust and wipe all surfaces', done: true },
        { id: 'chk-2', label: 'Scrub kitchen counters and sink', done: true },
        { id: 'chk-3', label: 'Fridge cleaning (add-on)', done: true },
        { id: 'chk-4', label: 'Clean both bathrooms', done: false },
        { id: 'chk-5', label: 'Balcony wash (add-on)', done: false },
        { id: 'chk-6', label: 'Sweep and mop floors', done: false },
      ],
      payment: {
        status: 'PENDING',
        amount: 1997,
        method: 'Pay after service (UPI / cash)',
      },
      actions: [{ status: 'en_route', label: 'On the way' }],
      otpRequired: false,
      otpVerified: false,
      sosTriggeredAt: null,
      history: [
        {
          status: 'assigned',
          at: '2026-10-14T04:00:00.000Z',
          actor: 'System',
        },
      ],
    },
    {
      id: 'BK-20425',
      bookingCode: '#BK-20425',
      status: 'assigned',
      customer: {
        name: 'Ananya S.',
        phoneMasked: '+91 ΓÇóΓÇóΓÇóΓÇóΓÇó ΓÇóΓÇó842',
        subtitle: 'Calls are routed through the app',
      },
      service: {
        name: 'Bathroom & kitchen sanitization',
        description: '2 Bathrooms + Modular Kitchen ┬╖ Steam & descaling',
        quantity: 1,
        durationMinutes: 120,
      },
      location: {
        address: 'Flat ΓÇóΓÇóΓÇó, Prestige High Fields, Gachibowli',
        city: 'Hyderabad',
        pincode: '500032',
        hint: 'Full address unlocks at start ┬╖ 3.8 km away',
      },
      schedule: {
        scheduledAt: '2026-10-14T09:00:00.000Z',
        dateLabel: 'Tue, 14 Oct 2026',
        slot: '14:30 ΓÇô 16:30',
        startedAt: started1h24m36sAgo,
        startedTimeLabel: '02:32 PM',
        completedAt: null,
      },
      price: {
        basePrice: 999,
        total: 1299,
        partnerEarning: 995,
      },
      addOns: [
        { id: 'addon-20425-1', name: 'Exhaust fan degreasing', quantity: 1, amount: 199 },
        { id: 'addon-20425-2', name: 'Hard-water tile descaling', quantity: 1, amount: 101 },
      ],
      instructions: 'Use mild low-odor disinfectant in the kitchen. Gate passcode shared in app.',
      checklist: [
        { id: 'chk-20425-1', label: 'Degrease kitchen tiles and chimney exterior', done: true },
        { id: 'chk-20425-2', label: 'Exhaust fan degreasing (add-on)', done: true },
        { id: 'chk-20425-3', label: 'Descale bathroom taps and shower glass', done: false },
        { id: 'chk-20425-4', label: 'Sanitize washbasins and commodes', done: false },
        { id: 'chk-20425-5', label: 'Mop and dry bathroom floors', done: false },
      ],
      payment: {
        status: 'PAID',
        amount: 1299,
        method: 'Online prepaid (UPI)',
      },
      actions: [{ status: 'en_route', label: 'On the way' }],
      otpRequired: false,
      otpVerified: false,
      sosTriggeredAt: null,
      history: [
        {
          status: 'assigned',
          at: '2026-10-14T05:15:00.000Z',
          actor: 'System',
        },
      ],
    },
    {
      id: 'BK-20431',
      bookingCode: '#BK-20431',
      status: 'assigned',
      customer: {
        name: 'Vikram R.',
        phoneMasked: '+91 ΓÇóΓÇóΓÇóΓÇóΓÇó ΓÇóΓÇó519',
        subtitle: 'Calls are routed through the app',
      },
      service: {
        name: 'AC foam-jet service & gas check',
        description: '2 Split AC units ┬╖ Filter, cooling coil & drain tray wash',
        quantity: 2,
        durationMinutes: 90,
      },
      location: {
        address: 'Plot ΓÇóΓÇóΓÇó, Jubilee Enclave, Hitech City',
        city: 'Hyderabad',
        pincode: '500081',
        hint: 'Full address unlocks at start ┬╖ 4.2 km away',
      },
      schedule: {
        scheduledAt: '2026-10-15T05:30:00.000Z',
        dateLabel: 'Wed, 15 Oct 2026',
        slot: '11:00 ΓÇô 12:30',
        startedAt: started1h24m36sAgo,
        startedTimeLabel: '11:04 AM',
        completedAt: null,
      },
      price: {
        basePrice: 899,
        total: 1148,
        partnerEarning: 880,
      },
      addOns: [
        { id: 'addon-20431-1', name: 'Anti-rust coil coating', quantity: 1, amount: 249 },
      ],
      instructions: 'Please bring a step ladder for the living room outdoor unit.',
      checklist: [
        { id: 'chk-20431-1', label: 'Inspect cooling performance and thermostat', done: true },
        { id: 'chk-20431-2', label: 'Foam-jet clean indoor evaporator coils', done: true },
        { id: 'chk-20431-3', label: 'Clean air filters and flush drain pipe', done: false },
        { id: 'chk-20431-4', label: 'Anti-rust coil coating (add-on)', done: false },
        { id: 'chk-20431-5', label: 'Check refrigerant gas pressure', done: false },
      ],
      payment: {
        status: 'PENDING',
        amount: 1148,
        method: 'Pay after service (UPI / cash)',
      },
      actions: [{ status: 'en_route', label: 'On the way' }],
      otpRequired: false,
      otpVerified: false,
      sosTriggeredAt: null,
      history: [
        {
          status: 'assigned',
          at: '2026-10-14T06:00:00.000Z',
          actor: 'System',
        },
      ],
    },
    {
      id: 'BK-20439',
      bookingCode: '#BK-20439',
      status: 'assigned',
      customer: {
        name: 'Priya M.',
        phoneMasked: '+91 ΓÇóΓÇóΓÇóΓÇóΓÇó ΓÇóΓÇó673',
        subtitle: 'Calls are routed through the app',
      },
      service: {
        name: 'Sofa & carpet shampooing',
        description: '5-seater fabric sofa + living room carpet ┬╖ Wet extraction',
        quantity: 1,
        durationMinutes: 120,
      },
      location: {
        address: 'Villa ΓÇóΓÇóΓÇó, My Home Bhooja, Madhapur',
        city: 'Hyderabad',
        pincode: '500081',
        hint: 'Full address unlocks at start ┬╖ 5.1 km away',
      },
      schedule: {
        scheduledAt: '2026-10-15T10:30:00.000Z',
        dateLabel: 'Wed, 15 Oct 2026',
        slot: '16:00 ΓÇô 18:00',
        startedAt: started1h24m36sAgo,
        startedTimeLabel: '04:05 PM',
        completedAt: null,
      },
      price: {
        basePrice: 1199,
        total: 1599,
        partnerEarning: 1220,
      },
      addOns: [
        { id: 'addon-20439-1', name: 'Scotchgard fabric protection', quantity: 1, amount: 250 },
        { id: 'addon-20439-2', name: 'Cushion dry vacuuming', quantity: 1, amount: 150 },
      ],
      instructions: 'Light beige linen sofa ΓÇö test shampoo on back corner first.',
      checklist: [
        { id: 'chk-20439-1', label: 'Dry vacuum sofa crevices and carpet', done: true },
        { id: 'chk-20439-2', label: 'Spot-treat fabric stains', done: true },
        { id: 'chk-20439-3', label: 'Foam shampoo and soft brush agitation', done: false },
        { id: 'chk-20439-4', label: 'Wet vacuum moisture extraction', done: false },
        { id: 'chk-20439-5', label: 'Scotchgard fabric protection (add-on)', done: false },
      ],
      payment: {
        status: 'PAID',
        amount: 1599,
        method: 'Online prepaid (Card)',
      },
      actions: [{ status: 'en_route', label: 'On the way' }],
      otpRequired: false,
      otpVerified: false,
      sosTriggeredAt: null,
      history: [
        {
          status: 'assigned',
          at: '2026-10-14T07:10:00.000Z',
          actor: 'System',
        },
      ],
    },
    {
      id: 'BK-20444',
      bookingCode: '#BK-20444',
      status: 'assigned',
      customer: {
        name: 'Karthik V.',
        phoneMasked: '+91 ΓÇóΓÇóΓÇóΓÇóΓÇó ΓÇóΓÇó308',
        subtitle: 'Calls are routed through the app',
      },
      service: {
        name: 'Herbal pest control & gel treatment',
        description: '3 BHK ┬╖ Odorless cockroach, ant & silverfish control',
        quantity: 1,
        durationMinutes: 90,
      },
      location: {
        address: 'Flat ΓÇóΓÇóΓÇó, Aparna Serene Park, Kondapur',
        city: 'Hyderabad',
        pincode: '500084',
        hint: 'Full address unlocks at start ┬╖ 7.0 km away',
      },
      schedule: {
        scheduledAt: '2026-10-16T04:00:00.000Z',
        dateLabel: 'Thu, 16 Oct 2026',
        slot: '09:30 ΓÇô 11:00',
        startedAt: started1h24m36sAgo,
        startedTimeLabel: '09:33 AM',
        completedAt: null,
      },
      price: {
        basePrice: 899,
        total: 1099,
        partnerEarning: 840,
      },
      addOns: [
        { id: 'addon-20444-1', name: 'Balcony drain spray', quantity: 1, amount: 200 },
      ],
      instructions: 'Toddler at home ΓÇö use only herbal gel inside kitchen cabinets.',
      checklist: [
        { id: 'chk-20444-1', label: 'Apply herbal gel in kitchen hinges and drawers', done: true },
        { id: 'chk-20444-2', label: 'Spray odorless barrier along skirting boards', done: false },
        { id: 'chk-20444-3', label: 'Treat bathroom drain traps and utility area', done: false },
        { id: 'chk-20444-4', label: 'Balcony drain spray (add-on)', done: false },
      ],
      payment: {
        status: 'PENDING',
        amount: 1099,
        method: 'Pay after service (UPI / cash)',
      },
      actions: [{ status: 'en_route', label: 'On the way' }],
      otpRequired: false,
      otpVerified: false,
      sosTriggeredAt: null,
      history: [
        {
          status: 'assigned',
          at: '2026-10-14T08:00:00.000Z',
          actor: 'System',
        },
      ],
    },
    {
      id: 'BK-20452',
      bookingCode: '#BK-20452',
      status: 'assigned',
      customer: {
        name: 'Meera N.',
        phoneMasked: '+91 ΓÇóΓÇóΓÇóΓÇóΓÇó ΓÇóΓÇó951',
        subtitle: 'Calls are routed through the app',
      },
      service: {
        name: 'Regular home cleaning & floor polish',
        description: '3 BHK ┬╖ Living area, bedrooms, windows & floor buffing',
        quantity: 1,
        durationMinutes: 150,
      },
      location: {
        address: 'Flat ΓÇóΓÇóΓÇó, Rainbow Vistas, Moosapet',
        city: 'Hyderabad',
        pincode: '500018',
        hint: 'Full address unlocks at start ┬╖ 5.6 km away',
      },
      schedule: {
        scheduledAt: '2026-10-16T09:30:00.000Z',
        dateLabel: 'Thu, 16 Oct 2026',
        slot: '15:00 ΓÇô 17:30',
        startedAt: started1h24m36sAgo,
        startedTimeLabel: '03:02 PM',
        completedAt: null,
      },
      price: {
        basePrice: 1099,
        total: 1399,
        partnerEarning: 1070,
      },
      addOns: [
        { id: 'addon-20452-1', name: 'Window track detailing', quantity: 1, amount: 300 },
      ],
      instructions: 'Focus on sliding window tracks in the master bedroom.',
      checklist: [
        { id: 'chk-20452-1', label: 'Dust furniture, fans and light fixtures', done: true },
        { id: 'chk-20452-2', label: 'Window track detailing (add-on)', done: true },
        { id: 'chk-20452-3', label: 'Sanitize bathroom fixtures and mirrors', done: false },
        { id: 'chk-20452-4', label: 'Vacuum and mop all bedroom floors', done: false },
        { id: 'chk-20452-5', label: 'Machine buff living room marble floor', done: false },
      ],
      payment: {
        status: 'PAID',
        amount: 1399,
        method: 'Online prepaid (UPI)',
      },
      actions: [{ status: 'en_route', label: 'On the way' }],
      otpRequired: false,
      otpVerified: false,
      sosTriggeredAt: null,
      history: [
        {
          status: 'assigned',
          at: '2026-10-14T08:30:00.000Z',
          actor: 'System',
        },
      ],
    },
    {
      id: 'BK-10214',
      bookingCode: '#BK-10214',
      status: 'assigned',
      customer: {
        name: 'Bharat S.',
        phoneMasked: '+91 ΓÇóΓÇóΓÇóΓÇóΓÇó ΓÇóΓÇó007',
        subtitle: 'Calls are routed through the app',
      },
      service: {
        name: 'At-Home Spa for Women',
        description: 'Relaxing spa session by a trained therapist, at home.',
        quantity: 1,
        durationMinutes: 120,
      },
      location: {
        address: '14, Road No. 5, Jubilee Hills',
        city: 'Hyderabad',
        pincode: '500033',
        hint: 'Near Jubilee Hills Checkpost ┬╖ 2.5 km away',
      },
      schedule: {
        scheduledAt: new Date(Date.now() + 7200 * 1000).toISOString(),
        dateLabel: 'Today',
        slot: '14:00 ΓÇô 16:00',
        startedAt: null,
        startedTimeLabel: undefined,
        completedAt: null,
      },
      price: {
        basePrice: 1299,
        total: 1348,
        partnerEarning: 1299,
      },
      addOns: [
        { id: 'addon-spa-1', name: 'Aromatherapy Oils', quantity: 1, amount: 200 },
      ],
      instructions: 'Please bring fresh massage oils and clean towels.',
      checklist: [
        { id: 'chk-spa-1', label: 'Setup sanitized spa kit and clean towels', done: false },
        { id: 'chk-spa-2', label: 'Customer skin & treatment consultation', done: false },
        { id: 'chk-spa-3', label: 'Sanitize hands and prepare relaxation area', done: false },
        { id: 'chk-spa-4', label: 'Perform requested spa & wellness session', done: false },
        { id: 'chk-spa-5', label: 'Apply soothing essential oils / post-care', done: false },
        { id: 'chk-spa-6', label: 'Area cleanup and customer satisfaction review', done: false },
      ],
      payment: {
        status: 'PAID',
        amount: 1348,
        method: 'Online prepaid (UPI)',
      },
      actions: [{ status: 'en_route', label: 'On the way' }],
      otpRequired: false,
      otpVerified: false,
      sosTriggeredAt: null,
      history: [
        {
          status: 'assigned',
          at: new Date(Date.now() - 1800 * 1000).toISOString(),
          actor: 'System',
        },
      ],
    },
    {
      id: 'BK-20460',
      bookingCode: '#BK-20460',
      status: 'confirmed',
      customer: {
        name: 'Suresh P.',
        phoneMasked: '+91 ΓÇóΓÇóΓÇóΓÇóΓÇó ΓÇóΓÇó410',
        subtitle: 'Calls are routed through the app',
      },
      service: {
        name: 'Kitchen chimney & hob deep cleaning',
        description: 'Baffle filter degreasing, motor carbon cleaning & gas stove scrub',
        quantity: 1,
        durationMinutes: 90,
      },
      location: {
        address: 'Tower ΓÇóΓÇóΓÇó, Lodha Bellezza, KPHB Colony',
        city: 'Hyderabad',
        pincode: '500072',
        hint: 'Full address unlocks at start ┬╖ 4.8 km away',
      },
      schedule: {
        scheduledAt: '2026-10-15T08:00:00.000Z',
        dateLabel: 'Wed, 15 Oct 2026',
        slot: '13:30 ΓÇô 15:00',
        startedAt: started1h24m36sAgo,
        startedTimeLabel: '01:32 PM',
        completedAt: null,
      },
      price: {
        basePrice: 799,
        total: 999,
        partnerEarning: 760,
      },
      addOns: [
        { id: 'addon-20460-1', name: 'Burner brass polish', quantity: 1, amount: 200 },
      ],
      instructions: 'Heavy oil build-up on duct pipe. Please bring caustic-free cleaner.',
      checklist: [
        { id: 'chk-20460-1', label: 'Dismantle and soak chimney baffle filters', done: true },
        { id: 'chk-20460-2', label: 'Degrease outer stainless steel body and hood', done: false },
        { id: 'chk-20460-3', label: 'Scrub 4-burner glass hob and drip trays', done: false },
        { id: 'chk-20460-4', label: 'Burner brass polish (add-on)', done: false },
      ],
      payment: {
        status: 'PAID',
        amount: 999,
        method: 'Online prepaid (Card)',
      },
      actions: [{ status: 'en_route', label: 'On the way' }],
      otpRequired: false,
      otpVerified: false,
      sosTriggeredAt: null,
      history: [
        {
          status: 'confirmed',
          at: '2026-10-14T09:00:00.000Z',
          actor: 'Partner',
        },
      ],
    },
    {
      id: 'BK-20388',
      bookingCode: '#BK-20388',
      status: 'cancelled_by_partner',
      customer: {
        name: 'Deepak T.',
        phoneMasked: '+91 ΓÇóΓÇóΓÇóΓÇóΓÇó ΓÇóΓÇó190',
        subtitle: 'Calls are routed through the app',
      },
      service: {
        name: 'Terrace water tank cleaning',
        description: '1000L Sintex tank ┬╖ Sludge removal, high pressure wash & UV sanitization',
        quantity: 1,
        durationMinutes: 90,
      },
      location: {
        address: 'House ΓÇóΓÇóΓÇó, Road No. 12, Banjara Hills',
        city: 'Hyderabad',
        pincode: '500034',
        hint: 'Terrace access via external spiral staircase',
      },
      schedule: {
        scheduledAt: '2026-10-13T04:00:00.000Z',
        dateLabel: 'Mon, 13 Oct 2026',
        slot: '09:30 ΓÇô 11:00',
        startedAt: null,
        startedTimeLabel: '',
        completedAt: null,
      },
      price: {
        basePrice: 699,
        total: 899,
        partnerEarning: 680,
      },
      addOns: [
        { id: 'addon-20388-1', name: 'Anti-algae spray', quantity: 1, amount: 200 },
      ],
      instructions: 'Terrace tank has heavy silt. Water connection available on rooftop.',
      checklist: [
        { id: 'chk-20388-1', label: 'De-water tank and extract bottom sediment', done: false },
        { id: 'chk-20388-2', label: 'Scrub interior walls with food-grade disinfectant', done: false },
        { id: 'chk-20388-3', label: 'UV germicidal lamp exposure (15 mins)', done: false },
      ],
      payment: {
        status: 'PENDING',
        amount: 899,
        method: 'Pay after service (UPI / cash)',
      },
      actions: [],
      otpRequired: false,
      otpVerified: false,
      sosTriggeredAt: null,
      history: [
        {
          status: 'cancelled_by_partner',
          at: '2026-10-13T04:15:00.000Z',
          actor: 'Partner',
        },
      ],
    },
    {
      id: 'BK-20394',
      bookingCode: '#BK-20394',
      status: 'completed',
      customer: {
        name: 'Pooja G.',
        phoneMasked: '+91 ΓÇóΓÇóΓÇóΓÇóΓÇó ΓÇóΓÇó772',
        subtitle: 'Calls are routed through the app',
      },
      service: {
        name: 'Full bathroom steam sanitization',
        description: '2 Bathrooms ┬╖ Tile grouting, steam disinfection & glass scale removal',
        quantity: 2,
        durationMinutes: 100,
      },
      location: {
        address: 'Flat ΓÇóΓÇóΓÇó, My Home Jewel, Madinaguda',
        city: 'Hyderabad',
        pincode: '500049',
        hint: 'Job completed successfully',
      },
      schedule: {
        scheduledAt: '2026-10-12T05:00:00.000Z',
        dateLabel: 'Sun, 12 Oct 2026',
        slot: '10:30 ΓÇô 12:10',
        startedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        startedTimeLabel: '10:31 AM',
        completedAt: new Date(Date.now() - 22 * 3600 * 1000).toISOString(),
      },
      price: {
        basePrice: 899,
        total: 1099,
        partnerEarning: 840,
      },
      addOns: [
        { id: 'addon-20394-1', name: 'Mirror anti-fog coating', quantity: 1, amount: 200 },
      ],
      instructions: 'Completed service. Customer rated 5.0 stars.',
      checklist: [
        { id: 'chk-20394-1', label: 'Scrub wall and floor tiles with anti-scaling agent', done: true },
        { id: 'chk-20394-2', label: 'High-temperature steam treatment for corners', done: true },
        { id: 'chk-20394-3', label: 'Descale shower cubicle glass', done: true },
        { id: 'chk-20394-4', label: 'Mirror anti-fog coating (add-on)', done: true },
      ],
      payment: {
        status: 'PAID',
        amount: 1099,
        method: 'Online prepaid (UPI)',
      },
      actions: [],
      otpRequired: false,
      otpVerified: true,
      sosTriggeredAt: null,
      history: [
        {
          status: 'completed',
          at: '2026-10-12T07:10:00.000Z',
          actor: 'Partner',
        },
      ],
    },
  ];

  if (!partnerServices || partnerServices.length === 0) {
    return candidatePool;
  }

  // Filter pool strictly by the partner's assigned services
  const filtered = candidatePool.filter((job) =>
    matchServiceToPartner(job.service.name, partnerServices),
  );

  // For a newly registered/logged-in partner, completed services must start empty.
  // Transform any matched mock completed job into an active assigned service
  // so the partner doesn't see a fake past completed service that doesn't belong to them!
  const sanitized: JobDetails[] = filtered.map((job): JobDetails => {
    if (job.status === 'completed') {
      return {
        ...job,
        status: 'assigned',
        schedule: {
          ...job.schedule,
          scheduledAt: new Date(Date.now() + 3600 * 1000).toISOString(),
          dateLabel: 'Today',
          slot: '11:00 ΓÇô 13:00',
          startedAt: null,
          startedTimeLabel: undefined,
          completedAt: null,
        },
        actions: [{ status: 'en_route', label: 'On the way' }],
        otpVerified: false,
        history: [
          {
            status: 'assigned',
            at: new Date().toISOString(),
            actor: 'System',
          },
        ],
      };
    }
    return job;
  });

  // Ensure every service assigned to the partner has at least one job in their catalog
  for (const svc of partnerServices) {
    const hasJob = sanitized.some((j) => matchServiceToPartner(j.service.name, [svc]));
    if (!hasJob && svc.name) {
      const generated = createInitialPartnerRouteMockJob(
        `BK-${(svc.id || '99999').slice(-5)}`,
        svc.name,
      );
      sanitized.push({
        ...generated,
        status: 'assigned',
      });
    }
  }

  return sanitized;
}

/**
 * Creates an initial booking object tailored dynamically to the requested service.
 */
export function createInitialPartnerRouteMockJob(
  requestedId?: string,
  serviceNameHint?: string,
): JobDetails {
  const cleanId = requestedId && requestedId.trim() ? requestedId.trim() : 'BK-20418';
  const catalog = createInitialAssignedServicesCatalog();
  const matched = catalog.find(
    (item) => item.id.toLowerCase() === cleanId.toLowerCase() || item.bookingCode.toLowerCase() === `#${cleanId.toLowerCase()}`,
  );
  if (matched && !serviceNameHint) {
    return {
      ...matched,
      status: matched.status === 'assigned' ? 'confirmed' : matched.status,
    };
  }

  const hint = (serviceNameHint || cleanId).toLowerCase();

  let profile = KNOWN_MOCK_SERVICES.cleaning;
  if (
    hint.includes('spa') ||
    hint.includes('salon') ||
    hint.includes('massage') ||
    cleanId.includes('10214') ||
    cleanId === 'svc-5'
  ) {
    profile = KNOWN_MOCK_SERVICES.spa;
  } else if (hint.includes('washing') || hint.includes('repair') || cleanId === 'job-002' || cleanId === 'hcx-10002') {
    profile = KNOWN_MOCK_SERVICES.repair;
  } else if (hint.includes('ac') || cleanId === 'job-003' || cleanId === 'hcx-10003') {
    profile = KNOWN_MOCK_SERVICES.ac;
  } else if (hint.includes('kitchen') || cleanId === 'job-004' || cleanId === 'hcx-10004') {
    profile = KNOWN_MOCK_SERVICES.kitchen;
  } else if (hint.includes('plumb') || cleanId === 'job-005' || cleanId === 'hcx-10005') {
    profile = KNOWN_MOCK_SERVICES.plumbing;
  }

  const sName = serviceNameHint || profile.service!.name;
  const checklist = getDefaultChecklistForService(sName);

  return {
    id: cleanId,
    bookingCode: '#' + (cleanId.length > 8 ? cleanId.slice(-6).toUpperCase() : cleanId),
    status: 'confirmed',
    customer: profile.customer!,
    service: {
      name: sName,
      description: profile.service!.description,
      quantity: 1,
      durationMinutes: profile.service!.durationMinutes || 90,
    },
    location: profile.location!,
    schedule: {
      scheduledAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      dateLabel: 'Today',
      slot: '11:00 ΓÇô 13:00',
      startedAt: null,
      startedTimeLabel: undefined,
      completedAt: null,
    },
    price: profile.price!,
    addOns: profile.addOns || [],
    instructions: profile.instructions || '',
    checklist,
    payment: {
      status: 'PENDING',
      amount: profile.price!.total,
      method: 'Pay after service (UPI / cash)',
    },
    actions: [{ status: 'en_route', label: 'On the way' }],
    otpRequired: false,
    otpVerified: false,
    sosTriggeredAt: null,
    history: [
      {
        status: 'assigned',
        at: new Date(Date.now() - 1800 * 1000).toISOString(),
        actor: 'System',
      },
      {
        status: 'confirmed',
        at: new Date(Date.now() - 900 * 1000).toISOString(),
        actor: 'Partner',
      },
    ],
  };
}

export function loadAssignedCatalogFromStorage(
  userId?: string,
  partnerServices?: Array<{ id?: string; name?: string; slug?: string }>,
): JobDetails[] {
  try {
    const key = getAssignedCatalogStorageKey(userId);
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      const initial = createInitialAssignedServicesCatalog(partnerServices);
      if (initial.length > 0) {
        saveAssignedCatalogToStorage(initial, userId);
      }
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const initial = createInitialAssignedServicesCatalog(partnerServices);
      if (initial.length > 0) {
        saveAssignedCatalogToStorage(initial, userId);
      }
      return initial;
    }

    if (partnerServices && partnerServices.length > 0) {
      const filtered = parsed.filter((item) =>
        matchServiceToPartner(item.service?.name, partnerServices),
      );
      if (filtered.length === 0) {
        const initial = createInitialAssignedServicesCatalog(partnerServices);
        saveAssignedCatalogToStorage(initial, userId);
        return initial;
      }
      if (filtered.length !== parsed.length) {
        saveAssignedCatalogToStorage(filtered, userId);
      }
      return filtered;
    }

    return parsed;
  } catch {
    return createInitialAssignedServicesCatalog(partnerServices);
  }
}

export function saveAssignedCatalogToStorage(list: JobDetails[], userId?: string): JobDetails[] {
  try {
    const key = getAssignedCatalogStorageKey(userId);
    window.localStorage.setItem(key, JSON.stringify(list));
    if (key !== MOCK_PARTNER_ASSIGNED_LIST_STORAGE_KEY) {
      window.localStorage.setItem(MOCK_PARTNER_ASSIGNED_LIST_STORAGE_KEY, JSON.stringify(list));
    }
  } catch {
    /* ignore storage quota errors */
  }
  return list;
}

function syncJobIntoCatalog(job: JobDetails, userId?: string): void {
  const catalog = loadAssignedCatalogFromStorage(userId);
  const idx = catalog.findIndex((item) => item.id.toLowerCase() === job.id.toLowerCase());
  if (idx >= 0) {
    const next = [...catalog];
    next[idx] = job;
    saveAssignedCatalogToStorage(next, userId);
  }
}

function findKnownJob(requestedId?: string): JobDetails | null {
  if (!requestedId) return null;
  const cleanId = requestedId.trim().toLowerCase();

  // 1. Check assigned catalog in storage
  const catalog = loadAssignedCatalogFromStorage();
  const fromCatalog = catalog.find((item) => item.id.toLowerCase() === cleanId);
  if (fromCatalog) return fromCatalog;

  // 2. Check cached live jobs from LiveJobsList (sessionStorage)
  try {
    const rawLive = window.sessionStorage.getItem('homecarex_last_live_jobs');
    if (rawLive) {
      const liveList = JSON.parse(rawLive);
      if (Array.isArray(liveList)) {
        const found = liveList.find((j: { id?: string | number }) => String(j.id).toLowerCase() === cleanId);
        if (found) {
          return mapJobListItemToJobDetails(found);
        }
      }
    }
  } catch {
    /* ignore parse failure */
  }

  // 3. Match against known mock IDs / patterns
  if (cleanId === 'bk-10214' || cleanId === 'svc-5' || cleanId.includes('spa')) {
    return createInitialPartnerRouteMockJob(requestedId, 'At-Home Spa for Women');
  }
  if (cleanId === 'job-002' || cleanId === 'hcx-10002' || cleanId.includes('washing')) {
    return createInitialPartnerRouteMockJob(requestedId, 'Washing Machine Repair');
  }
  if (cleanId === 'job-003' || cleanId === 'hcx-10003' || cleanId.includes('ac')) {
    return createInitialPartnerRouteMockJob(requestedId, 'AC Service & Gas Refill');
  }
  if (cleanId === 'job-004' || cleanId === 'hcx-10004' || cleanId.includes('kitchen')) {
    return createInitialPartnerRouteMockJob(requestedId, 'Kitchen Cleaning');
  }
  if (cleanId === 'job-005' || cleanId === 'hcx-10005' || cleanId.includes('plumb')) {
    return createInitialPartnerRouteMockJob(requestedId, 'Plumbing ΓÇô Tap & Leak Repair');
  }
  if (cleanId === 'job-001' || cleanId === 'hcx-10001') {
    return createInitialPartnerRouteMockJob(requestedId, 'Deep home cleaning');
  }

  return null;
}

function loadRawMockJob(requestedId?: string): JobDetails {
  try {
    const cleanId = requestedId?.trim();
    if (cleanId) {
      const rawCurrent = window.localStorage.getItem(MOCK_PARTNER_ROUTE_STORAGE_KEY);
      if (rawCurrent) {
        const parsedCurrent = JSON.parse(rawCurrent) as Partial<JobDetails>;
        if (
          parsedCurrent &&
          typeof parsedCurrent === 'object' &&
          parsedCurrent.id?.toLowerCase() === cleanId.toLowerCase() &&
          Array.isArray(parsedCurrent.checklist) &&
          parsedCurrent.service &&
          parsedCurrent.customer
        ) {
          return parsedCurrent as JobDetails;
        }
      }

      const known = findKnownJob(cleanId);
      if (known) {
        const normalized: JobDetails =
          known.status === 'assigned'
            ? { ...known, status: 'confirmed' }
            : known;
        window.localStorage.setItem(MOCK_PARTNER_ROUTE_STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
      }

      const unknown = createInitialPartnerRouteMockJob(cleanId);
      window.localStorage.setItem(MOCK_PARTNER_ROUTE_STORAGE_KEY, JSON.stringify(unknown));
      return unknown;
    }

    const raw = window.localStorage.getItem(MOCK_PARTNER_ROUTE_STORAGE_KEY);
    if (!raw) {
      const initial = createInitialPartnerRouteMockJob(requestedId);
      window.localStorage.setItem(MOCK_PARTNER_ROUTE_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as Partial<JobDetails>;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.id !== 'string' ||
      !Array.isArray(parsed.checklist) ||
      !parsed.service ||
      !parsed.customer
    ) {
      const recovered = createInitialPartnerRouteMockJob(requestedId);
      window.localStorage.setItem(MOCK_PARTNER_ROUTE_STORAGE_KEY, JSON.stringify(recovered));
      return recovered;
    }
    return parsed as JobDetails;
  } catch {
    return createInitialPartnerRouteMockJob(requestedId);
  }
}

/** The OTP clock starts at the last "arrived" entry, exactly like the backend. */
function mockOtpExpiry(job: JobDetails): Date | null {
  for (let i = job.history.length - 1; i >= 0; i -= 1) {
    if (job.history[i].status === 'arrived') {
      const at = new Date(job.history[i].at).getTime();
      return Number.isNaN(at) ? null : new Date(at + START_OTP_TTL_MS);
    }
  }
  return null;
}

/** Adds the live start-OTP state (attempts left, expiry, lock) to a job that is waiting at "arrived". */
function withStartVerification(job: JobDetails, now: Date = new Date()): JobDetails {
  if (job.status !== 'arrived') return { ...job, startVerification: null };
  const left = Math.min(
    START_OTP_MAX_ATTEMPTS,
    Math.max(0, job.startVerification?.attemptsRemaining ?? START_OTP_MAX_ATTEMPTS),
  );
  const expiresAt = mockOtpExpiry(job);
  const verification: StartVerification = {
    maxAttempts: START_OTP_MAX_ATTEMPTS,
    attemptsRemaining: left,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    expired: expiresAt ? now.getTime() >= expiresAt.getTime() : false,
    locked: left <= 0,
  };
  return { ...job, otpRequired: true, startVerification: verification };
}

function loadMockJobFromStorage(requestedId?: string): JobDetails {
  return withStartVerification(loadRawMockJob(requestedId));
}

function saveMockJobToStorage(job: JobDetails, userId?: string): JobDetails {
  try {
    window.localStorage.setItem(MOCK_PARTNER_ROUTE_STORAGE_KEY, JSON.stringify(job));
    syncJobIntoCatalog(job, userId);
  } catch {
    /* ignore storage quota errors */
  }
  return job;
}

export interface FetchAssignedServicesOptions {
  userId?: string;
  assignedServices?: Array<{ id?: string; name?: string; slug?: string }>;
}

/** The partner's assigned services. Real mode: only bookings assigned to this partner. */
export async function fetchAssignedServices(
  options?: FetchAssignedServicesOptions,
): Promise<JobDetails[]> {
  const effectiveUserId = options?.userId || getCurrentUserId();
  let partnerServices = options?.assignedServices;

  if (!partnerServices || partnerServices.length === 0) {
    try {
      const res = await getPartnerServices();
      if (res?.approved && Array.isArray(res.selectedIds)) {
        const selectedSet = new Set(res.selectedIds);
        partnerServices = res.approved.filter((s) => selectedSet.has(s.id));
      }
    } catch {
      // Ignore API error
    }
  }

  try {
    const res = await api.get<{ data: JobListItemLike[] }>('/partner/jobs?tab=all');
    if (Array.isArray(res.data?.data) && res.data.data.length > 0) {
      const mapped = res.data.data.map(mapJobListItemToJobDetails);
      const filtered =
        partnerServices && partnerServices.length > 0
          ? mapped.filter((j) => matchServiceToPartner(j.service?.name, partnerServices))
          : mapped;
      saveAssignedCatalogToStorage(filtered, effectiveUserId);
      return filtered;
    }
  } catch (err) {
    console.warn('[fetchAssignedServices] API fetch failed, falling back to storage:', err);
  }
  return loadAssignedCatalogFromStorage(effectiveUserId, partnerServices);
}

export async function acceptAssignedService(bookingId: string, userId?: string): Promise<JobDetails> {
  // Real mode: admin already assigned this job to the partner, so "accept" only opens it. The server
  // moves it forward when the partner taps "On the way".
  if (!IS_MOCK_JOBS) return fetchJob(bookingId);
  const catalog = loadAssignedCatalogFromStorage(userId);
  const target =
    catalog.find((item) => item.id === bookingId) ??
    createInitialPartnerRouteMockJob(bookingId);
  const nowIso = new Date().toISOString();
  const isPendingOrDeclined =
    target.status === 'assigned' || target.status.startsWith('cancelled');
  const nextStatus: JobStatus = isPendingOrDeclined ? 'confirmed' : target.status;

  const acceptedJob: JobDetails = {
    ...target,
    status: nextStatus,
    actions: getActionsForStatus(nextStatus),
    history: [
      ...target.history,
      ...(isPendingOrDeclined
        ? [{ status: 'confirmed' as JobStatus, at: nowIso, actor: 'Partner' }]
        : []),
    ],
  };

  return saveMockJobToStorage(acceptedJob, userId);
}

export async function declineAssignedService(bookingId: string, userId?: string): Promise<JobDetails[]> {
  if (!IS_MOCK_JOBS) {
    await api.post(`/partner/jobs/${bookingId}/decline`, {});
    return fetchAssignedServices({ userId });
  }
  const catalog = loadAssignedCatalogFromStorage(userId);
  const next = catalog.map((item) =>
    item.id === bookingId
      ? {
          ...item,
          status: 'cancelled_by_partner' as JobStatus,
          history: [
            ...item.history,
            {
              status: 'cancelled_by_partner' as JobStatus,
              at: new Date().toISOString(),
              actor: 'Partner',
            },
          ],
        }
      : item,
  );
  return saveAssignedCatalogToStorage(next, userId);
}

export function resetAllAssignedServices(
  userId?: string,
  partnerServices?: Array<{ id?: string; name?: string; slug?: string }>,
): JobDetails[] {
  const freshCatalog = createInitialAssignedServicesCatalog(partnerServices);
  saveAssignedCatalogToStorage(freshCatalog, userId);
  const defaultJob = createInitialPartnerRouteMockJob('BK-20418');
  try {
    window.localStorage.setItem(MOCK_PARTNER_ROUTE_STORAGE_KEY, JSON.stringify(defaultJob));
  } catch {
    /* ignore */
  }
  return freshCatalog;
}

export function resetMockPartnerJob(
  requestedId?: string,
  userId?: string,
  partnerServices?: Array<{ id?: string; name?: string; slug?: string }>,
): JobDetails {
  const freshCatalog = createInitialAssignedServicesCatalog(partnerServices);
  const cleanId = requestedId && requestedId.trim() ? requestedId.trim() : 'BK-20418';
  const fresh = createInitialPartnerRouteMockJob(cleanId);
  const updatedCatalog = freshCatalog.map((item) =>
    item.id === fresh.id ? fresh : item,
  );
  saveAssignedCatalogToStorage(updatedCatalog, userId);
  return saveMockJobToStorage(fresh, userId);
}

export async function fetchJob(id: string): Promise<JobDetails> {
  const cleanId = id?.trim();
  if (!cleanId) {
    return loadMockJobFromStorage('BK-20418');
  }

  // Always attempt real backend API first
  try {
    const res = await api.get<{ data: ApiJob }>(`/partner/jobs/${cleanId}`);
    if (res.data?.data) {
      const mapped = mapJob(res.data.data);
      saveMockJobToStorage(mapped);
      return mapped;
    }
  } catch (err: unknown) {
    console.warn(`[fetchJob] Failed fetching from API for ${cleanId}:`, (err as { message?: string })?.message || err);
    if (!IS_MOCK_JOBS && ((err as { response?: { status?: number } })?.response?.status === 404 || (err as { response?: { status?: number } })?.response?.status === 403)) {
      const fallback = findKnownJob(cleanId);
      if (fallback) {
        return withStartVerification(fallback);
      }
      throw err;
    }
  }

  return loadMockJobFromStorage(cleanId);
}

/** Updates the booking status locally in localStorage and returns the updated job. */
export async function updateBookingStatus(
  bookingId: string,
  status: JobStatus,
): Promise<JobDetails> {
  if (!IS_MOCK_JOBS) {
    const res = await api.patch<{ data: ApiJob }>(`/bookings/${bookingId}/status`, { status });
    return mapJob(res.data.data);
  }
  const current = loadMockJobFromStorage(bookingId);
  const nowIso = new Date().toISOString();
  const updated: JobDetails = {
    ...current,
    status,
    actions: getActionsForStatus(status),
    otpRequired: status === 'arrived' && !current.otpVerified,
    history: [
      ...current.history,
      {
        status,
        at: nowIso,
        actor: 'Partner',
      },
    ],
  };
  return saveMockJobToStorage(updated);
}

export async function persistChecklistItem(
  bookingId: string,
  itemId: string,
  done: boolean,
): Promise<{ id: string; label: string; done: boolean }[]> {
  if (!IS_MOCK_JOBS) {
    const res = await api.patch<{ data: { checklist: { id: string; label: string; done: boolean }[] } }>(
      `/partner/jobs/${bookingId}/checklist/${encodeURIComponent(itemId)}`,
      { done },
    );
    return res.data.data.checklist;
  }
  const current = loadMockJobFromStorage(bookingId);
  const nextChecklist = current.checklist.map((item) =>
    item.id === itemId ? { ...item, done } : item,
  );
  saveMockJobToStorage({
    ...current,
    checklist: nextChecklist,
  });
  return nextChecklist;
}

export async function completeJob(bookingId: string, input?: CompletionInput): Promise<JobDetails> {
  if (!IS_MOCK_JOBS) {
    let payload: unknown = undefined;
    const headers: Record<string, string> = {};
    if (input?.photo) {
      const form = new FormData();
      if (input.otp) form.append('otp', input.otp);
      form.append('photo', input.photo, input.photo.name);
      if (input.notes) form.append('notes', input.notes);
      payload = form;
      headers['Content-Type'] = 'multipart/form-data';
    } else if (input?.otp || input?.notes) {
      payload = {
        ...(input.otp ? { otp: input.otp } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
      };
    }
    const res = await api.post<{ data: ApiJob }>(`/partner/jobs/${bookingId}/complete`, payload, { headers });
    return mapJob(res.data.data);
  }
  const current = loadMockJobFromStorage(bookingId);
  const nowIso = new Date().toISOString();
  const updated: JobDetails = {
    ...current,
    status: 'completed',
    actions: [],
    otpRequired: false,
    schedule: {
      ...current.schedule,
      completedAt: nowIso,
    },
    history: [
      ...current.history,
      {
        status: 'completed',
        at: nowIso,
        actor: 'Partner',
      },
    ],
  };
  return saveMockJobToStorage(updated);
}

export const MOCK_EXTRA_CHARGES_STORAGE_KEY = 'homecarex_partner_extra_charges_v1';

export function getMockExtraCharges(bookingId: string): ExtraChargeItem[] {
  if (!bookingId) return [];
  const cleanId = bookingId.trim();
  const rawCode = cleanId.replace(/^BK-/i, '').toLowerCase();
  const keys = [
    `${MOCK_EXTRA_CHARGES_STORAGE_KEY}_${cleanId}`,
    `${MOCK_EXTRA_CHARGES_STORAGE_KEY}_${rawCode}`,
    `mock_extra_charges_${cleanId}`,
    `mock_extra_charges_${rawCode}`,
  ];
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
    /* ignore parse failure */
  }
  }
  return [];
}

export function saveMockExtraCharges(bookingId: string, items: ExtraChargeItem[]): void {
  if (!bookingId) return;
  const cleanId = bookingId.trim();
  const rawCode = cleanId.replace(/^BK-/i, '').toLowerCase();
  const keys = [
    `${MOCK_EXTRA_CHARGES_STORAGE_KEY}_${cleanId}`,
    `${MOCK_EXTRA_CHARGES_STORAGE_KEY}_${rawCode}`,
    `mock_extra_charges_${cleanId}`,
    `mock_extra_charges_${rawCode}`,
  ];
  for (const k of keys) {
    try {
      localStorage.setItem(k, JSON.stringify(items));
    } catch {
    /* ignore parse failure */
  }
  }
}

export async function fetchExtraCharges(bookingId: string): Promise<ExtraChargeItem[]> {
  const cleanId = bookingId?.trim() || 'BK-20418';
  if (!IS_MOCK_JOBS) {
    try {
      const res = await api.get<{ data: ExtraChargeItem[] }>(`/partner/jobs/${cleanId}/extra-charges`);
      if (Array.isArray(res.data?.data)) {
        saveMockExtraCharges(cleanId, res.data.data);
        return res.data.data;
      }
    } catch (err: unknown) {
      console.warn(`[fetchExtraCharges] Failed fetching from API for ${cleanId}:`, (err as { message?: string })?.message || err);
    }
  }
  return getMockExtraCharges(cleanId);
}

export async function createExtraCharge(
  bookingId: string,
  payload: { description: string; quantity: number; amount: number; reason?: string },
): Promise<ExtraChargeItem> {
  const cleanId = bookingId?.trim() || 'BK-20418';
  let createdFromServer: ExtraChargeItem | null = null;

  if (!IS_MOCK_JOBS) {
    try {
      const res = await api.post<{ data: ExtraChargeItem }>(`/partner/jobs/${cleanId}/extra-charges`, payload);
      if (res.data?.data) {
        createdFromServer = res.data.data;
      }
    } catch (err: unknown) {
      console.warn(`[createExtraCharge] Server request failed for ${cleanId}, falling back to local sync:`, (err as { message?: string })?.message || err);
    }
  }

  const newCharge: ExtraChargeItem = createdFromServer || {
    id: `ec-${Date.now()}`,
    title: payload.description,
    description: payload.description,
    quantity: payload.quantity,
    amount: payload.amount,
    reason: payload.reason,
    status: 'pending',
    requestedAt: new Date().toISOString(),
  };

  const current = getMockExtraCharges(cleanId);
  const next = [...current.filter((c) => c.id !== newCharge.id), newCharge];
  saveMockExtraCharges(cleanId, next);

  try {
    const job = loadMockJobFromStorage(cleanId);
    saveMockJobToStorage({
      ...job,
      extraCharges: next,
    });
  } catch {
    /* ignore parse failure */
  }

  try {
    window.dispatchEvent(new Event('storage'));
  } catch {
    /* ignore parse failure */
  }

  return newCharge;
}

export async function triggerSos(
  bookingId: string | null,
  coordinates?: { lat: number; lng: number } | null,
): Promise<{ success: boolean; message: string }> {
  if (!IS_MOCK_JOBS) {
    // Real alert: POST /partner/safety/sos. A failure throws, so the UI never says "sent" for an alert that went nowhere.
    const location = coordinates ?? (await getQuickFix());
    const result = await sendSos({ bookingId, location });
    return {
      success: true,
      message: result.duplicate
        ? 'SOS was already raised a moment ago. HomeCareX has been alerted.'
        : 'SOS sent. HomeCareX has been alerted.',
    };
  }
  const current = loadMockJobFromStorage(bookingId ?? '');
  saveMockJobToStorage({
    ...current,
    sosTriggeredAt: new Date().toISOString(),
  });
  return {
    success: true,
    message: 'SOS alert sent (Demo Mode)',
  };
}

export async function addJobItem(
  bookingId: string,
  item: { title: string; amount: number; reason?: string },
): Promise<void> {
  if (!IS_MOCK_JOBS) {
    throw new Error('Adding items to a live job is not available yet.');
  }
  const current = loadMockJobFromStorage(bookingId);
  const customId = `custom-${Date.now()}`;
  const nextAddOns = [
    ...current.addOns,
    {
      id: customId,
      name: item.title,
      quantity: 1,
      amount: item.amount,
    },
  ];
  const nextChecklist = [
    ...current.checklist,
    {
      id: `chk-${customId}`,
      label: `${item.title} (add-on)`,
      done: false,
    },
  ];
  saveMockJobToStorage({
    ...current,
    addOns: nextAddOns,
    checklist: nextChecklist,
  });
}

/** Error shaped like an axios error, so the UI handles mock and real failures with the same code. */
function mockApiError(
  status: number,
  code: string,
  message: string,
  details?: Array<{ field: string; message: string }>,
): never {
  throw { response: { status, data: { success: false, code, message, details } } };
}

/** Local stand-in for POST /partner/jobs/:id/verify-start. Same checks, same order, same errors. */
async function mockVerifyStart(jobId: string, otp: string, photo: File): Promise<JobDetails> {
  const current = loadMockJobFromStorage(jobId);
  if (current.status === 'in_progress') mockApiError(409, 'CONFLICT', 'This job has already been started');
  if (current.status !== 'arrived') {
    mockApiError(422, 'INVALID_STATE_TRANSITION', 'You can only start a job after you have arrived');
  }
  if (!/^\d{4}$/.test(otp)) mockApiError(400, 'VALIDATION_ERROR', 'otp must be exactly 4 digits');

  // A bad photo is refused BEFORE an attempt is used, like the server.
  if (photo.size > MAX_PHOTO_BYTES) mockApiError(413, 'PAYLOAD_TOO_LARGE', 'Photo must be 5 MB or smaller');
  const photoProblem = await validatePhoto(photo);
  if (photoProblem) mockApiError(422, 'INVALID_FILE', photoProblem);

  const v = current.startVerification;
  if (v?.locked) {
    mockApiError(423, 'OTP_LOCKED', 'Too many incorrect codes. This job is locked, please contact support');
  }
  if (v?.expired) mockApiError(410, 'OTP_EXPIRED', 'The start code has expired. Ask support for help');

  // One attempt is used up before the code is compared.
  const remaining = Math.max(0, (v?.attemptsRemaining ?? START_OTP_MAX_ATTEMPTS) - 1);
  if (otp !== DEMO_START_OTP) {
    saveMockJobToStorage({
      ...current,
      startVerification: { ...(v as StartVerification), attemptsRemaining: remaining },
    });
    if (remaining <= 0) {
      mockApiError(423, 'OTP_LOCKED', 'Too many incorrect codes. This job is locked, please contact support');
    }
    mockApiError(
      422,
      'INVALID_OTP',
      `Incorrect code. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} left`,
      [{ field: 'attemptsRemaining', message: String(remaining) }],
    );
  }

  const nowIso = new Date().toISOString();
  return saveMockJobToStorage({
    ...current,
    status: 'in_progress',
    otpRequired: false,
    otpVerified: true,
    startVerification: null,
    actions: [],
    schedule: { ...current.schedule, startedAt: current.schedule.startedAt ?? nowIso },
    history: [...current.history, { status: 'in_progress', at: nowIso, actor: 'Partner' }],
  });
}

/**
 * Start verification: the customer's 4-digit code plus a start photo (jpg/png, up to 5 MB).
 * Returns the updated job (now in_progress). Failures carry `code`:
 * INVALID_OTP (details: attemptsRemaining), OTP_LOCKED, OTP_EXPIRED, INVALID_FILE, PAYLOAD_TOO_LARGE, CONFLICT.
 * The Content-Type is left to the browser so it can add the multipart boundary.
 */
export async function verifyStart(jobId: string, otp: string, photo: File): Promise<JobDetails> {
  if (IS_MOCK_JOBS) return mockVerifyStart(jobId, otp, photo);
  const form = new FormData();
  form.append('otp', otp);
  form.append('photo', photo, photo.name);
  const res = await api.post<{ data: ApiJob }>(`/partner/jobs/${jobId}/verify-start`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return mapJob(res.data.data);
}

export function getHttpStatus(err: unknown): number | null {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { status?: unknown } }).response;
    if (typeof response?.status === 'number') return response.status;
  }
  return null;
}

export function getErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { message?: unknown } } }).response;
    const message = response?.data?.message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return fallback;
}

/** The machine-readable `code` of an API error, e.g. INVALID_OTP, OTP_LOCKED, OTP_EXPIRED. */
export function getErrorCode(err: unknown): string | null {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const code = (err as { response?: { data?: { code?: unknown } } }).response?.data?.code;
    if (typeof code === 'string') return code;
  }
  return null;
}

/** Attempts left after a wrong code; the server sends it in `details` as { field: 'attemptsRemaining' }. */
export function getAttemptsRemaining(err: unknown): number | null {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const details = (err as { response?: { data?: { details?: unknown } } }).response?.data?.details;
    if (Array.isArray(details)) {
      for (const d of details) {
        if (typeof d === 'object' && d !== null && (d as { field?: unknown }).field === 'attemptsRemaining') {
          const n = Number((d as { message?: unknown }).message);
          if (Number.isInteger(n) && n >= 0) return n;
        }
      }
    }
  }
  return null;
}

/** true when the request never got an answer (offline, DNS, server down). */
export function isNetworkError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    !('response' in err && (err as { response?: unknown }).response)
  );
}

/** Backwards-compatibility aliases for tests and components */
export async function verifyJobOtp(_jobId: string, otp: string): Promise<{ verified: boolean; message?: string }> {
  return {
    verified: otp === DEMO_START_OTP,
    message: otp === DEMO_START_OTP ? undefined : 'OTP verification failed. Please check the code with the customer.',
  };
}

export async function startJob(jobId: string, _otp?: string): Promise<JobDetails> {
  return updateBookingStatus(jobId, 'in_progress');
}
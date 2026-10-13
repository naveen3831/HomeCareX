import type { JobDetails } from './jobDetails.types';
import type { JobAction, JobStatus } from './jobStatus';

export const MOCK_PARTNER_ROUTE_STORAGE_KEY = 'homecarex_partner_route_mock_job_v1';
export const MOCK_PARTNER_ASSIGNED_LIST_STORAGE_KEY = 'homecarex_partner_assigned_services_v2';
export const DEMO_START_OTP = '123456';

function getActionsForStatus(status: JobStatus): JobAction[] {
  if (status === 'confirmed' || status === 'assigned') {
    return [{ status: 'en_route', label: 'On the way' }];
  }
  if (status === 'en_route') {
    return [{ status: 'arrived', label: 'Arrived at location' }];
  }
  return [];
}

/**
* Creates the catalog of assigned service bookings for the partner.
* The first card is #BK-20418 (Deep home cleaning) followed by 5 additional realistic assigned services.
*/
export function createInitialAssignedServicesCatalog(): JobDetails[] {
  const started1h24m36sAgo = new Date(Date.now() - (1 * 3600 + 24 * 60 + 36) * 1000).toISOString();

  return [
    {
      id: 'BK-20418',
      bookingCode: '#BK-20418',
      status: 'assigned',
      customer: {
        name: 'Rohan K.',
        phoneMasked: '+91 ••••• ••214',
        subtitle: 'Calls are routed through the app',
      },
      service: {
        name: 'Deep home cleaning',
        description: '2 BHK · Kitchen, bathrooms, floors',
        quantity: 1,
        durationMinutes: 180,
      },
      location: {
        address: 'Flat •••, Green Meadows Apartments',
        city: 'Hyderabad',
        pincode: '500039',
        hint: 'Full address unlocks at start · 6.4 km away',
      },
      schedule: {
        scheduledAt: '2026-10-14T04:30:00.000Z',
        dateLabel: 'Tue, 14 Oct 2026',
        slot: '10:00 – 13:00',
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
        phoneMasked: '+91 ••••• ••842',
        subtitle: 'Calls are routed through the app',
      },
      service: {
        name: 'Bathroom & kitchen sanitization',
        description: '2 Bathrooms + Modular Kitchen · Steam & descaling',
        quantity: 1,
        durationMinutes: 120,
      },
      location: {
        address: 'Flat •••, Prestige High Fields, Gachibowli',
        city: 'Hyderabad',
        pincode: '500032',
        hint: 'Full address unlocks at start · 3.8 km away',
      },
      schedule: {
        scheduledAt: '2026-10-14T09:00:00.000Z',
        dateLabel: 'Tue, 14 Oct 2026',
        slot: '14:30 – 16:30',
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
        phoneMasked: '+91 ••••• ••519',
        subtitle: 'Calls are routed through the app',
      },
      service: {
        name: 'AC foam-jet service & gas check',
        description: '2 Split AC units · Filter, cooling coil & drain tray wash',
        quantity: 2,
        durationMinutes: 90,
      },
      location: {
        address: 'Plot •••, Jubilee Enclave, Hitech City',
        city: 'Hyderabad',
        pincode: '500081',
        hint: 'Full address unlocks at start · 4.2 km away',
      },
      schedule: {
        scheduledAt: '2026-10-15T05:30:00.000Z',
        dateLabel: 'Wed, 15 Oct 2026',
        slot: '11:00 – 12:30',
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
        phoneMasked: '+91 ••••• ••673',
        subtitle: 'Calls are routed through the app',
      },
      service: {
        name: 'Sofa & carpet shampooing',
        description: '5-seater fabric sofa + living room carpet · Wet extraction',
        quantity: 1,
        durationMinutes: 120,
      },
      location: {
        address: 'Villa •••, My Home Bhooja, Madhapur',
        city: 'Hyderabad',
        pincode: '500081',
        hint: 'Full address unlocks at start · 5.1 km away',
      },
      schedule: {
        scheduledAt: '2026-10-15T10:30:00.000Z',
        dateLabel: 'Wed, 15 Oct 2026',
        slot: '16:00 – 18:00',
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
      instructions: 'Light beige linen sofa — test shampoo on back corner first.',
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
        phoneMasked: '+91 ••••• ••308',
        subtitle: 'Calls are routed through the app',
      },
      service: {
        name: 'Herbal pest control & gel treatment',
        description: '3 BHK · Odorless cockroach, ant & silverfish control',
        quantity: 1,
        durationMinutes: 90,
      },
      location: {
        address: 'Flat •••, Aparna Serene Park, Kondapur',
        city: 'Hyderabad',
        pincode: '500084',
        hint: 'Full address unlocks at start · 7.0 km away',
      },
      schedule: {
        scheduledAt: '2026-10-16T04:00:00.000Z',
        dateLabel: 'Thu, 16 Oct 2026',
        slot: '09:30 – 11:00',
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
      instructions: 'Toddler at home — use only herbal gel inside kitchen cabinets.',
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
        phoneMasked: '+91 ••••• ••951',
        subtitle: 'Calls are routed through the app',
      },
      service: {
        name: 'Regular home cleaning & floor polish',
        description: '3 BHK · Living area, bedrooms, windows & floor buffing',
        quantity: 1,
        durationMinutes: 150,
      },
      location: {
        address: 'Flat •••, Rainbow Vistas, Moosapet',
        city: 'Hyderabad',
        pincode: '500018',
        hint: 'Full address unlocks at start · 5.6 km away',
      },
      schedule: {
        scheduledAt: '2026-10-16T09:30:00.000Z',
        dateLabel: 'Thu, 16 Oct 2026',
        slot: '15:00 – 17:30',
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
      id: 'BK-20460',
      bookingCode: '#BK-20460',
      status: 'confirmed',
      customer: {
        name: 'Suresh P.',
        phoneMasked: '+91 ••••• ••410',
        subtitle: 'Calls are routed through the app',
      },
      service: {
        name: 'Kitchen chimney & hob deep cleaning',
        description: 'Baffle filter degreasing, motor carbon cleaning & gas stove scrub',
        quantity: 1,
        durationMinutes: 90,
      },
      location: {
        address: 'Tower •••, Lodha Bellezza, KPHB Colony',
        city: 'Hyderabad',
        pincode: '500072',
        hint: 'Full address unlocks at start · 4.8 km away',
      },
      schedule: {
        scheduledAt: '2026-10-15T08:00:00.000Z',
        dateLabel: 'Wed, 15 Oct 2026',
        slot: '13:30 – 15:00',
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
        phoneMasked: '+91 ••••• ••190',
        subtitle: 'Calls are routed through the app',
      },
      service: {
        name: 'Terrace water tank cleaning',
        description: '1000L Sintex tank · Sludge removal, high pressure wash & UV sanitization',
        quantity: 1,
        durationMinutes: 90,
      },
      location: {
        address: 'House •••, Road No. 12, Banjara Hills',
        city: 'Hyderabad',
        pincode: '500034',
        hint: 'Terrace access via external spiral staircase',
      },
      schedule: {
        scheduledAt: '2026-10-13T04:00:00.000Z',
        dateLabel: 'Mon, 13 Oct 2026',
        slot: '09:30 – 11:00',
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
        phoneMasked: '+91 ••••• ••772',
        subtitle: 'Calls are routed through the app',
      },
      service: {
        name: 'Full bathroom steam sanitization',
        description: '2 Bathrooms · Tile grouting, steam disinfection & glass scale removal',
        quantity: 2,
        durationMinutes: 100,
      },
      location: {
        address: 'Flat •••, My Home Jewel, Madinaguda',
        city: 'Hyderabad',
        pincode: '500049',
        hint: 'Job completed successfully',
      },
      schedule: {
        scheduledAt: '2026-10-12T05:00:00.000Z',
        dateLabel: 'Sun, 12 Oct 2026',
        slot: '10:30 – 12:10',
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
}

/**
 * Creates the initial mock booking matching the reference design (#BK-20418 — Deep home cleaning).
 * Elapsed timer starts at 01:24:36 on the Active Job screen and persists across browser refreshes.
 */
export function createInitialPartnerRouteMockJob(requestedId?: string): JobDetails {
  const cleanId = requestedId && requestedId.trim() ? requestedId.trim() : 'BK-20418';
  const catalog = createInitialAssignedServicesCatalog();
  const matched = catalog.find(
    (item) => item.id.toLowerCase() === cleanId.toLowerCase() || item.bookingCode.toLowerCase() === `#${cleanId.toLowerCase()}`,
  );
  if (matched) {
    return {
      ...matched,
      status: 'confirmed',
    };
  }

  const fallback = catalog[0];
  return {
    ...fallback,
    id: cleanId,
    status: 'confirmed',
  };
}

function loadAssignedCatalogFromStorage(): JobDetails[] {
  try {
    const raw = window.localStorage.getItem(MOCK_PARTNER_ASSIGNED_LIST_STORAGE_KEY);
    if (!raw) {
      const initial = createInitialAssignedServicesCatalog();
      window.localStorage.setItem(MOCK_PARTNER_ASSIGNED_LIST_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const initial = createInitialAssignedServicesCatalog();
      window.localStorage.setItem(MOCK_PARTNER_ASSIGNED_LIST_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return parsed as JobDetails[];
  } catch {
    return createInitialAssignedServicesCatalog();
  }
}

function saveAssignedCatalogToStorage(list: JobDetails[]): JobDetails[] {
  try {
    window.localStorage.setItem(MOCK_PARTNER_ASSIGNED_LIST_STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore storage quota errors */
  }
  return list;
}

function syncJobIntoCatalog(job: JobDetails): void {
  const catalog = loadAssignedCatalogFromStorage();
  const idx = catalog.findIndex((item) => item.id === job.id);
  if (idx >= 0) {
    const next = [...catalog];
    next[idx] = job;
    saveAssignedCatalogToStorage(next);
  }
}

function loadMockJobFromStorage(requestedId?: string): JobDetails {
  try {
    const cleanId = requestedId?.trim();
    if (cleanId) {
      const catalog = loadAssignedCatalogFromStorage();
      const fromCatalog = catalog.find(
        (item) => item.id.toLowerCase() === cleanId.toLowerCase(),
      );
      const rawCurrent = window.localStorage.getItem(MOCK_PARTNER_ROUTE_STORAGE_KEY);
      if (rawCurrent) {
        const parsedCurrent = JSON.parse(rawCurrent) as Partial<JobDetails>;
        if (
          parsedCurrent &&
          typeof parsedCurrent === 'object' &&
          parsedCurrent.id === cleanId &&
          Array.isArray(parsedCurrent.checklist) &&
          parsedCurrent.service &&
          parsedCurrent.customer
        ) {
          return parsedCurrent as JobDetails;
        }
      }
      if (fromCatalog) {
        const normalized: JobDetails =
          fromCatalog.status === 'assigned'
            ? { ...fromCatalog, status: 'confirmed' }
            : fromCatalog;
        window.localStorage.setItem(MOCK_PARTNER_ROUTE_STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
      }
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

function saveMockJobToStorage(job: JobDetails): JobDetails {
  try {
    window.localStorage.setItem(MOCK_PARTNER_ROUTE_STORAGE_KEY, JSON.stringify(job));
    syncJobIntoCatalog(job);
  } catch {
    /* ignore storage quota errors */
  }
  return job;
}

export async function fetchAssignedServices(): Promise<JobDetails[]> {
  return loadAssignedCatalogFromStorage();
}

export async function acceptAssignedService(bookingId: string): Promise<JobDetails> {
  const catalog = loadAssignedCatalogFromStorage();
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

  return saveMockJobToStorage(acceptedJob);
}

export async function declineAssignedService(bookingId: string): Promise<JobDetails[]> {
  const catalog = loadAssignedCatalogFromStorage();
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
  return saveAssignedCatalogToStorage(next);
}

export function resetAllAssignedServices(): JobDetails[] {
  const freshCatalog = createInitialAssignedServicesCatalog();
  saveAssignedCatalogToStorage(freshCatalog);
  const defaultJob = createInitialPartnerRouteMockJob('BK-20418');
  try {
    window.localStorage.setItem(MOCK_PARTNER_ROUTE_STORAGE_KEY, JSON.stringify(defaultJob));
  } catch {
    /* ignore */
  }
  return freshCatalog;
}

export function resetMockPartnerJob(requestedId?: string): JobDetails {
  const freshCatalog = createInitialAssignedServicesCatalog();
  const cleanId = requestedId && requestedId.trim() ? requestedId.trim() : 'BK-20418';
  const fresh = createInitialPartnerRouteMockJob(cleanId);
  const updatedCatalog = freshCatalog.map((item) =>
    item.id === fresh.id ? fresh : item,
  );
  saveAssignedCatalogToStorage(updatedCatalog);
  return saveMockJobToStorage(fresh);
}

export async function fetchJob(id: string): Promise<JobDetails> {
  return loadMockJobFromStorage(id || 'BK-20418');
}

/** Updates the booking status locally in localStorage and returns the updated job. */
export async function updateBookingStatus(
  bookingId: string,
  status: JobStatus,
): Promise<JobDetails> {
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

export async function verifyJobOtp(
  bookingId: string,
  otp: string,
): Promise<{ verified: boolean; message?: string }> {
  const cleaned = otp.trim();
  if (cleaned !== DEMO_START_OTP && cleaned !== '1234') {
    return {
      verified: false,
      message: `Invalid OTP code. Use demo OTP ${DEMO_START_OTP}.`,
    };
  }
  const current = loadMockJobFromStorage(bookingId);
  saveMockJobToStorage({
    ...current,
    otpVerified: true,
    otpRequired: false,
  });
  return { verified: true, message: 'Demo OTP verified locally.' };
}

export async function startJob(bookingId: string, otp: string): Promise<JobDetails> {
  const current = loadMockJobFromStorage(bookingId);
  const cleaned = otp.trim();
  if (!current.otpVerified && cleaned !== DEMO_START_OTP && cleaned !== '1234') {
    throw {
      response: {
        status: 400,
        data: { message: `Please enter the valid demo OTP (${DEMO_START_OTP}) before starting.` },
      },
    };
  }

  const nowIso = new Date().toISOString();
  const updated: JobDetails = {
    ...current,
    status: 'in_progress',
    otpRequired: false,
    otpVerified: true,
    actions: [],
    schedule: {
      ...current.schedule,
      startedAt:
        current.schedule.startedAt ??
        new Date(Date.now() - (1 * 3600 + 24 * 60 + 36) * 1000).toISOString(),
    },
    history: [
      ...current.history,
      {
        status: 'in_progress',
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

export async function completeJob(bookingId: string): Promise<JobDetails> {
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

export async function triggerSos(
  bookingId: string,
  _coordinates?: { lat: number; lng: number } | null,
): Promise<{ success: boolean; message: string }> {
  const current = loadMockJobFromStorage(bookingId);
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
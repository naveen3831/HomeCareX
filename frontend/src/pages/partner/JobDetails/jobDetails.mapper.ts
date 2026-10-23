import type { ApiJob, JobDetails } from './jobDetails.types';

const ACTOR_LABEL: Record<string, string> = {
  partner: 'Partner',
  customer: 'Customer',
  admin: 'Admin',
  system: 'System',
};

/** Short, readable code from the Mongo id, e.g. "#A1B2C3". */
export const bookingCode = (id: string): string => `#${id.slice(-6).toUpperCase()}`;

/** Returns relevant professional checklist items tailored to the specific service */
export function getDefaultChecklistForService(serviceName?: string): { id: string; label: string; done: boolean }[] {
  const s = (serviceName || '').toLowerCase();
  if (s.includes('spa') || s.includes('salon') || s.includes('massage') || s.includes('facial') || s.includes('therapy')) {
    return [
      { id: 'chk-1', label: 'Setup sanitized spa kit and clean towels', done: true },
      { id: 'chk-2', label: 'Customer skin & treatment consultation', done: true },
      { id: 'chk-3', label: 'Sanitize hands and prepare relaxation area', done: false },
      { id: 'chk-4', label: 'Perform requested spa & wellness session', done: false },
      { id: 'chk-5', label: 'Apply soothing essential oils / post-care', done: false },
      { id: 'chk-6', label: 'Area cleanup and customer satisfaction review', done: false },
    ];
  }
  if (s.includes('washing machine') || s.includes('washer') || s.includes('refrigerator') || s.includes('fridge')) {
    return [
      { id: 'chk-1', label: 'Inspect appliance for vibration / noise issues', done: true },
      { id: 'chk-2', label: 'Check drum bearings, motor belt and hoses', done: false },
      { id: 'chk-3', label: 'Clean drain pump filter and inlet valves', done: false },
      { id: 'chk-4', label: 'Test spin and water intake cycle', done: false },
      { id: 'chk-5', label: 'Customer demo and operational check', done: false },
    ];
  }
  if (s.includes('ac') || s.includes('air condition') || s.includes('cooling')) {
    return [
      { id: 'chk-1', label: 'Check initial cooling performance and airflow', done: true },
      { id: 'chk-2', label: 'Deep clean indoor cooling filters & condenser coils', done: false },
      { id: 'chk-3', label: 'Inspect gas pressure and test for refrigerant leaks', done: false },
      { id: 'chk-4', label: 'Flush drain pipe and wipe unit panels', done: false },
      { id: 'chk-5', label: 'Final temperature check and test run', done: false },
    ];
  }
  if (s.includes('plumb') || s.includes('leak') || s.includes('tap') || s.includes('drain')) {
    return [
      { id: 'chk-1', label: 'Inspect water leakage point and pipe connections', done: true },
      { id: 'chk-2', label: 'Turn off main water supply and dismantle fitting', done: false },
      { id: 'chk-3', label: 'Replace worn washers, seals or cartridges', done: false },
      { id: 'chk-4', label: 'Reassemble fittings and test pressure', done: false },
      { id: 'chk-5', label: 'Verify leak-free operation with customer', done: false },
    ];
  }
  if (s.includes('electric') || s.includes('wiring') || s.includes('switch') || s.includes('fan')) {
    return [
      { id: 'chk-1', label: 'Isolate circuit breaker and test with voltage tester', done: true },
      { id: 'chk-2', label: 'Inspect switchboard, socket, and wiring continuity', done: false },
      { id: 'chk-3', label: 'Repair / replace faulty electrical component', done: false },
      { id: 'chk-4', label: 'Safety check earthing and secure wire insulation', done: false },
      { id: 'chk-5', label: 'Restore power and test appliance operation', done: false },
    ];
  }
  if (s.includes('sofa') || s.includes('carpet') || s.includes('shampoo')) {
    return [
      { id: 'chk-1', label: 'Dry vacuum fabric to remove loose dust and debris', done: true },
      { id: 'chk-2', label: 'Apply eco-friendly stain pre-treatment solution', done: false },
      { id: 'chk-3', label: 'Deep shampoo foam scrub and dirt extraction', done: false },
      { id: 'chk-4', label: 'Moisture suction extraction and fabric grooming', done: false },
      { id: 'chk-5', label: 'Final hygiene walkthrough with customer', done: false },
    ];
  }
  if (s.includes('kitchen') || s.includes('deep clean') || s.includes('home clean') || s.includes('cleaning')) {
    return [
      { id: 'chk-1', label: 'Dust and wipe all surfaces and ceiling fixtures', done: true },
      { id: 'chk-2', label: 'Scrub countertops, tiles, and high-touch areas', done: true },
      { id: 'chk-3', label: 'Clean sinks, faucets, and sanitize surfaces', done: false },
      { id: 'chk-4', label: 'Sweep, vacuum, and mop all floor areas', done: false },
      { id: 'chk-5', label: 'Empty trash bins and customer inspection', done: false },
    ];
  }
  if (s.includes('pest') || s.includes('termite')) {
    return [
      { id: 'chk-1', label: 'Inspect rooms and identify pest infestation areas', done: true },
      { id: 'chk-2', label: 'Apply targeted odorless spray along perimeters', done: false },
      { id: 'chk-3', label: 'Apply gel bait in kitchen cabinets and corners', done: false },
      { id: 'chk-4', label: 'Customer safety briefing and post-care guidance', done: false },
    ];
  }
  if (s.includes('paint')) {
    return [
      { id: 'chk-1', label: 'Cover floors and furniture with protective sheets', done: true },
      { id: 'chk-2', label: 'Surface preparation: fill holes and sand evenly', done: false },
      { id: 'chk-3', label: 'Apply primer coat and let dry', done: false },
      { id: 'chk-4', label: 'Apply paint coats with professional roller', done: false },
      { id: 'chk-5', label: 'Clean up paint splatters and customer inspection', done: false },
    ];
  }
  return [
    { id: 'chk-1', label: 'Confirm service details and scope with customer', done: true },
    { id: 'chk-2', label: 'Inspect work area and organize tools', done: false },
    { id: 'chk-3', label: 'Execute scheduled service steps', done: false },
    { id: 'chk-4', label: 'Clean up work area upon completion', done: false },
    { id: 'chk-5', label: 'Customer demonstration and satisfaction sign-off', done: false },
  ];
}

/** Pure: no network, no React. Turns the API response into what the page renders. */
export function mapJob(api: ApiJob): JobDetails {
  const serviceName = api.service?.name || 'Service';
  const checklist = (api.checklist && api.checklist.length > 0)
    ? api.checklist
    : getDefaultChecklistForService(serviceName);

  return {
    id: api.id,
    bookingCode: bookingCode(api.id),
    status: api.status,
    customer: { name: api.customer.name, phoneMasked: api.customer.phone ?? '—' },
    service: {
      ...api.service,
      description: api.service.description || `${serviceName} professional service`,
    },
    location: {
      address: [api.location.line1, api.location.area].filter(Boolean).join(', '),
      city: api.location.city,
      pincode: api.location.pincode,
    },
    schedule: { scheduledAt: api.schedule.scheduledAt, slot: api.schedule.slot, startedAt: api.schedule.startedAt ?? null },
    price: { total: api.price.total, partnerEarning: api.price.partnerEarning },
    addOns: (api.addOns ?? []).map((a, i) => ({ id: `${a.name}-${i}`, ...a })),
    instructions: api.instructions,
    checklist,
    extraCharges: api.extraCharges ?? [],
    payment: { status: api.payment?.status ?? 'PENDING', amount: api.price.total },
    actions: api.actions ?? [],
    otpRequired: api.otpRequired,
    startVerification: api.startVerification ?? null,
    history: (api.statusHistory ?? []).map((h) => ({
      status: h.to,
      at: h.at,
      actor: ACTOR_LABEL[h.actorRole] ?? h.actorRole,
    })),
  };
}

/** Converts a live job / list item (e.g. from GET /partner/jobs) into JobDetails format */
export function mapJobListItemToJobDetails(item: any): JobDetails {
  if (item.location && typeof item.location === 'object' && item.customer && typeof item.customer === 'object') {
    return mapJob(item as ApiJob);
  }

  const serviceName = item.service?.name || item.service || 'Service';
  const cleanId = String(item.id || '');
  const addr = item.address || item.location || 'Location';

  return {
    id: cleanId,
    bookingCode: bookingCode(cleanId),
    status: item.status || 'assigned',
    customer: {
      name: item.customerName || item.customer?.name || item.customer || 'Customer',
      phoneMasked: item.customerPhone || item.customer?.phone || '+91 ••••• ••' + cleanId.slice(-3),
    },
    service: {
      name: serviceName,
      description: item.serviceDescription || `${serviceName} professional service`,
      quantity: 1,
      durationMinutes: item.durationMinutes || 90,
    },
    location: {
      address: typeof addr === 'string' ? addr : [addr.line1, addr.area].filter(Boolean).join(', ') || 'Customer address',
      city: 'Hyderabad',
      pincode: null,
    },
    schedule: {
      scheduledAt: item.scheduledAt || new Date().toISOString(),
      slot: item.slot || '10:00 – 12:00',
      startedAt: null,
    },
    price: {
      basePrice: item.partnerEarning || item.amount || 1299,
      total: item.amount || item.total || 1348,
      partnerEarning: item.partnerEarning || item.amount || 1299,
    },
    addOns: [],
    instructions: item.instructions || '',
    checklist: getDefaultChecklistForService(serviceName),
    extraCharges: [],
    payment: {
      status: 'PENDING',
      amount: item.amount || item.total || 1348,
    },
    actions: item.status === 'assigned' || item.status === 'confirmed'
      ? [{ status: 'en_route', label: 'On the way' }]
      : item.status === 'en_route'
        ? [{ status: 'arrived', label: 'Arrived at location' }]
        : [],
    otpRequired: item.status === 'arrived',
    history: [
      {
        status: item.status || 'assigned',
        at: item.scheduledAt || new Date().toISOString(),
        actor: 'System',
      },
    ],
  };
}
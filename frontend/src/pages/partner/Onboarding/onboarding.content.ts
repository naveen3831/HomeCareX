/**
 * The 6 steps of "How HomeCareX works".
 * Put your real files in /public/onboarding/ using the names below. Until a video exists the screen
 * asks the partner to read for a few seconds instead; a missing photo shows a placeholder icon.
 * The number of steps must match ONBOARDING_TOTAL_STEPS in the backend.
 */
export interface DemoStep {
  title: string;
  summary: string;
  points: string[];
  video: string;
  photos: Array<{ src: string; caption: string }>;
  /** Seconds the partner must stay on the step when there is no video to finish. */
  readSeconds: number;
}

export const DEMO_STEPS: DemoStep[] = [
  {
    title: 'Welcome to HomeCareX',
    summary: 'See how a job goes from request to payment.',
    points: ['Customers book a service in the app.', 'We match the job to partners nearby.', 'You choose which jobs to take.'],
    video: '/onboarding/step-1.mp4',
    photos: [
      { src: '/onboarding/step-1-a.jpg', caption: 'Customer books a service' },
      { src: '/onboarding/step-1-b.jpg', caption: 'You get a job request' },
    ],
    readSeconds: 8,
  },
  {
    title: 'Accept a job request',
    summary: 'Requests reach you as notifications.',
    points: ['Check service, place, time and your earning.', 'Accept before the timer runs out.', 'Decline if you cannot reach in time.'],
    video: '/onboarding/step-2.mp4',
    photos: [
      { src: '/onboarding/step-2-a.jpg', caption: 'Request with earning shown' },
      { src: '/onboarding/step-2-b.jpg', caption: 'Accept or decline' },
    ],
    readSeconds: 8,
  },
  {
    title: 'Travel and arrive',
    summary: 'Customers can follow you live.',
    points: ['Tap "On the way" when you leave.', 'Use navigation to reach the address.', 'Tap "Arrived" when you are at the door.'],
    video: '/onboarding/step-3.mp4',
    photos: [
      { src: '/onboarding/step-3-a.jpg', caption: 'Navigation to the customer' },
      { src: '/onboarding/step-3-b.jpg', caption: 'Mark yourself as arrived' },
    ],
    readSeconds: 8,
  },
  {
    title: 'Start the job safely',
    summary: 'A code and a photo prove you are on site.',
    points: ['Ask the customer for the 4-digit start code.', 'Take a photo of the work area.', 'You have 5 tries; wrong codes lock the job.'],
    video: '/onboarding/step-4.mp4',
    photos: [
      { src: '/onboarding/step-4-a.jpg', caption: 'Enter the start code' },
      { src: '/onboarding/step-4-b.jpg', caption: 'Photo of the work area' },
    ],
    readSeconds: 8,
  },
  {
    title: 'Do the work',
    summary: 'Follow the checklist and stay safe.',
    points: ['Tick each checklist item as you finish it.', 'Add extra items or materials if needed.', 'Use SOS any time you feel unsafe.'],
    video: '/onboarding/step-5.mp4',
    photos: [
      { src: '/onboarding/step-5-a.jpg', caption: 'Checklist while working' },
      { src: '/onboarding/step-5-b.jpg', caption: 'SOS button' },
    ],
    readSeconds: 8,
  },
  {
    title: 'Finish and get paid',
    summary: 'Complete the job and collect payment.',
    points: ['Tap "Complete job" when everything is done.', 'Show the UPI QR or collect cash.', 'Earnings reach your wallet and payouts.'],
    video: '/onboarding/step-6.mp4',
    photos: [
      { src: '/onboarding/step-6-a.jpg', caption: 'Payment QR for the customer' },
      { src: '/onboarding/step-6-b.jpg', caption: 'Earnings in your wallet' },
    ],
    readSeconds: 8,
  },
];

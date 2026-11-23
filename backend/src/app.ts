import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rootRouter from './routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

export const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(',');

app.use(
  helmet({
    crossOriginOpenerPolicy: false,
    contentSecurityPolicy: false,
  }),
);

// credentials: true so the httpOnly refresh cookie travels with /auth requests.
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'accelerometer=*, gyroscope=*, magnetometer=*');
  next();
});

// credentials: true so the httpOnly refresh cookie travels with /auth requests.
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    exposedHeaders: ['x-rtb-fingerprint-id', 'request-id', 'x-request-id'],
  }),
);

// Support form-urlencoded requests for payment gateway callbacks and browser redirects.
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Catalog forms send resized images as data: URLs, so these two admin routes get a larger JSON limit.
// Must come before the global parser: express.json() skips a request that is already parsed.
app.use(['/api/v1/admin/services', '/api/v1/admin/categories'], express.json({ limit: '6mb' }));
// Partner registration carries two KYC files (max 5MB each) as base64 data: URLs.
app.use('/api/v1/auth/register', express.json({ limit: '20mb' }));
// A partner re-uploading one KYC file (max 5MB) from Profile > Documents sends it as a base64 data: URL too.
app.use('/api/v1/partner/documents', express.json({ limit: '8mb' }));

// Keep the exact bytes of the body: the payment webhook signature is an HMAC over the RAW request.
app.use(
  express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);

app.get('/api/v1/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

app.get(['/api/stats', '/api/v1/stats'], (_req, res) => {
  res.json([
    { id: "STAT001", icon: "calendar", title: "Easy Booking", description: "Find and book the service you need with ease." },
    { id: "STAT002", icon: "clock", title: "Flexible Scheduling", description: "Choose a convenient time for your service." },
    { id: "STAT003", icon: "home", title: "Home Convenience", description: "Get the services you need at your doorstep." },
    { id: "STAT004", icon: "sparkles", title: "Simple Experience", description: "Manage your home service journey in one place." },
  ]);
});

app.use('/api/v1', rootRouter);
app.use('/api', rootRouter);

// Error Handling Pipeline (registered exactly once, in order)
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
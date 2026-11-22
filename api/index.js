// Vercel entry point: every /api/* request is rewritten here (see vercel.json) and handled by the
// same Express app that runs locally and on Render. The built site in /dist is served by Vercel's CDN.
import { app } from '../server/index.js';

export default app;

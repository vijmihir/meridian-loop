// Small defences that keep the demo up under careless or hostile use, without extra dependencies.

// Per-client rate limit: a sliding window of request times, kept in memory.
export function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, times] of hits) { const kept = times.filter((t) => t > cutoff); kept.length ? hits.set(key, kept) : hits.delete(key); }
  }, windowMs).unref();
  return (req, res, next) => {
    if (process.env.RATE_LIMIT === '0') return next();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const times = (hits.get(key) || []).filter((t) => t > now - windowMs);
    if (times.length >= max) {
      res.set('Retry-After', String(Math.ceil((times[0] + windowMs - now) / 1000)));
      return res.status(429).json({ error: message });
    }
    times.push(now); hits.set(key, times);
    next();
  };
}

export function securityHeaders(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  next();
}

// The conversation state comes back from the browser, so it is rebuilt field by field from what is safe.
const str = (v, n = 300) => (typeof v === 'string' ? v.slice(0, n) : '');
const strs = (v, n = 8) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').map((x) => x.slice(0, 80)).slice(0, n) : []);
const num = (v) => (Number.isFinite(v) && v > 0 && v < 1e7 ? Math.round(v) : null);
export function cleanState(raw) {
  const s = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const b = s.brief && typeof s.brief === 'object' && !Array.isArray(s.brief) ? s.brief : null;
  return {
    side: s.side === 'maker' || s.side === 'brand' ? s.side : null,
    brief: b && str(b.topic) ? {
      topic: str(b.topic), countries: strs(b.countries), certifications: strs(b.certifications),
      maxMoq: num(b.maxMoq), maxLeadDays: num(b.maxLeadDays), quantity: num(b.quantity),
      maxPrice: num(b.maxPrice), minCapacity: num(b.minCapacity), verifiedOnly: b.verifiedOnly === true, needsDpp: b.needsDpp === true,
    } : null,
    shown: strs(s.shown, 12),
    focus: str(s.focus, 80) || null,
  };
}

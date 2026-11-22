import { useEffect, useRef, useState } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import { api } from './api.js';

let worldPromise;
const loadWorld = () => (worldPromise ||= import('world-atlas/countries-50m.json').then((m) => {
  const w = m.default || m;
  return feature(w, w.objects.countries).features;
}));


// The results of one search on a map: numbered pins for the matches, the rest of the network in grey.
export default function MapDialog({ open, onClose, matches, title }) {
  const ref = useRef(null);
  const [world, setWorld] = useState(null);
  const [others, setOthers] = useState([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) { d.showModal(); setActive(0); }
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    loadWorld().then(setWorld).catch(() => { worldPromise = null; setWorld('failed'); });
    if (matches[0]?.type === 'maker') api.get('/manufacturers').then((l) => setOthers(l.filter((m) => m.geo && !matches.some((x) => x.id === m.id)))).catch(() => {});
    else setOthers([]);
  }, [open, matches]);

  // A taller map on phones, so the pins are not lost in a letterbox.
  const narrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 40rem)').matches;
  const W = narrow ? 600 : 960, H = narrow ? 640 : 600, PAD = narrow ? 50 : 70;
  const pts = matches.filter((m) => m.geo);
  const proj = geoMercator();
  if (pts.length) {
    const lons = pts.map((m) => m.geo.lon), lats = pts.map((m) => m.geo.lat);
    // Never zoom closer than a region, so a single pin still shows its neighbours.
    const span = Math.max(Math.max(...lons) - Math.min(...lons), Math.max(...lats) - Math.min(...lats), 14);
    const cx = (Math.max(...lons) + Math.min(...lons)) / 2, cy = (Math.max(...lats) + Math.min(...lats)) / 2;
    proj.fitExtent([[PAD, PAD], [W - PAD, H - PAD]], { type: 'MultiPoint', coordinates: [[cx - span / 2, cy - span / 2], [cx + span / 2, cy + span / 2]] });
  }
  const path = geoPath(proj);
  const at = (m) => proj([m.geo.lon, m.geo.lat]);
  const inView = ([x, y]) => x > 0 && x < W && y > 0 && y < H;
  const sel = pts[active];

  return (
    <dialog ref={ref} className="map-dialog" onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }} aria-labelledby="map-title">
      <div className="map-shell">
        <div className="map-side">
          <div className="map-head">
            <h2 id="map-title">{title}</h2>
            <button type="button" className="map-close" onClick={onClose}>Close</button>
          </div>
          <ol className="map-list">
            {pts.map((m, i) => (
              <li key={m.id}>
                <button type="button" aria-pressed={i === active} onClick={() => setActive(i)}>
                  <span className="map-n" aria-hidden="true">{i + 1}</span>
                  <span><b>{m.name}</b><span className="where">{m.place}{m.geo.exact ? '' : ', approximate'}</span></span>
                </button>
              </li>
            ))}
          </ol>
          {matches.length > pts.length && <p className="map-note">{matches.length - pts.length} without a known location are not shown.</p>}
        </div>
        <div className="map-canvas">
          {world === 'failed' ? <div className="map-loading" role="alert">The map could not load. The list on the left has every location.</div>
          : !world ? <div className="map-loading" role="status">Loading the map</div> : (
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Map of ${pts.length} matches`}>
              <rect width={W} height={H} className="sea" />
              <g>{world.map((f, i) => <path key={i} d={path(f)} className="land" />)}</g>
              <g>{others.map((m) => { const p = at(m); return inView(p) ? <circle key={m.id} cx={p[0]} cy={p[1]} r="4.5" className="pin-other"><title>{m.name}</title></circle> : null; })}</g>
              <g>{pts.map((m, i) => { const [x, y] = at(m); return (
                <g key={m.id} className={`pin ${i === active ? 'is-on' : ''}`} transform={`translate(${x} ${y})`} onClick={() => setActive(i)}>
                  {i === active && <circle r="22" className="pin-halo" />}
                  <circle r="12" className="pin-dot" />
                  <text y="4" textAnchor="middle" className="pin-n">{i + 1}</text>
                </g>); })}</g>
              {sel && (() => { const [x, y] = at(sel); const left = x > W - (narrow ? 200 : 260); return (
                <text x={left ? x - 20 : x + 20} y={y - 16} textAnchor={left ? 'end' : 'start'} className="pin-label">{sel.name}</text>); })()}
            </svg>
          )}
          {sel && (
            <div className="map-card">
              <b>{sel.name}</b>
              <span className="where">{sel.place}</span>
              {sel.type === 'maker'
                ? <span className="num">{sel.moq.toLocaleString()} min, {sel.leadTimeDays} days</span>
                : <span>Wants {sel.need.title.toLowerCase()}</span>}
              <a className="link" href={`#/${sel.type === 'maker' ? 'm' : 'b'}/${sel.id}`}>Open profile</a>
            </div>
          )}
          <p className="map-credit">Map data: Natural Earth</p>
        </div>
      </div>
    </dialog>
  );
}

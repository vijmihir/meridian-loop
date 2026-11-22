import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { go } from './App.jsx';
import { materialPhoto } from './photos.js';
import MapDialog from './MapDialog.jsx';

const place = (x) => (x.city === x.country ? x.city : `${x.city}, ${x.country}`);

export default function Directory({ tab }) {
  const [makers, setMakers] = useState(null);
  const [brands, setBrands] = useState(null);
  const [country, setCountry] = useState('All');
  const [q, setQ] = useState('');
  const [only, setOnly] = useState([]);
  const flip = (k) => setOnly((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]));
  const [mapOpen, setMapOpen] = useState(false);
  const [error, setError] = useState('');
  const load = () => { setError(''); api.get('/manufacturers').then(setMakers).catch((e) => setError(e.message)); api.get('/brands').then(setBrands).catch((e) => setError(e.message)); };
  useEffect(load, []);
  useEffect(() => { setCountry('All'); setQ(''); setOnly([]); }, [tab]);

  const list = tab === 'brands' ? brands : makers;
  const countries = list ? ['All', ...[...new Set(list.map((x) => x.country))].sort()] : [];
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = useMemo(() => (list || []).filter((x) => {
    if (country !== 'All' && x.country !== country) return false;
    if (only.includes('checked') && !(x.certifications || []).some((c) => c.check?.status === 'checked' && !(c.validUntil && new Date(c.validUntil) < new Date()))) return false;
    if (only.includes('dpp') && !x.dppReady) return false;
    if (only.includes('whatsapp') && !x.whatsapp) return false;
    if (only.includes('small') && !(x.moq <= 100)) return false;
    if (!words.length) return true;
    const hay = [x.name, x.city, x.country, x.makes, x.sells, ...(x.materials || []), ...(x.certifications || []).map((c) => c.name), ...(x.needs || []).map((n) => n.title)].join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  }), [list, country, q, only]); // eslint-disable-line react-hooks/exhaustive-deps

  // Shape the cards like search results so the map can show them.
  const forMap = shown.map((x) => (tab === 'brands'
    ? { ...x, type: 'brand', place: place(x), need: x.needs[0] || { title: x.sells } }
    : { ...x, type: 'maker', place: place(x) }));

  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <h1>Directory</h1>
          <p>{makers && brands ? `${makers.length} manufacturers and ${brands.length} brands on Meridian Loop.` : 'Everyone on Meridian Loop.'}</p>
        </div>
        <div className="toggle" role="group" aria-label="Show">
          <button type="button" aria-pressed={tab === 'makers'} onClick={() => go('/directory')}>Manufacturers</button>
          <button type="button" aria-pressed={tab === 'brands'} onClick={() => go('/directory?tab=brands')}>Brands</button>
        </div>
      </div>

      <div className="dir-tools">
        <label className="dir-search">
          <span className="visually-hidden">Filter the directory</span>
          <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === 'brands' ? 'Filter by name, product or city' : 'Filter by name, material or certification'} />
        </label>
        {shown.length > 0 && <button type="button" className="map-btn" onClick={() => setMapOpen(true)}>Show {shown.length} on map</button>}
      </div>
      <div className="filters" role="group" aria-label="Country">
        {countries.map((c) => <button type="button" key={c} className="filter" aria-pressed={country === c} onClick={() => setCountry(c)}>{c}</button>)}
      </div>
      {tab !== 'brands' && <div className="filters" role="group" aria-label="Only show">
        {[['checked', 'Certificates checked'], ['dpp', 'Passport-ready'], ['whatsapp', 'On WhatsApp'], ['small', 'Runs of 100 or fewer']].map(([k, label]) => <button type="button" key={k} className="filter filter--flag" aria-pressed={only.includes(k)} onClick={() => flip(k)}>{label}</button>)}
      </div>}

      {error && !list ? (
        <div className="notice" role="alert"><p>{error}</p><button type="button" className="text-btn" onClick={load}>Try again</button></div>
      ) : !list ? <div className="skeleton" /> : shown.length === 0 ? (
        <div className="empty-state">
          <p>Nobody matches “{q}”{country !== 'All' ? ` in ${country}` : ''}.</p>
          <button type="button" className="text-btn" onClick={() => { setQ(''); setCountry('All'); }}>Clear the filters</button>
        </div>
      ) : (
        <div className="grid">
          {shown.map((x) => {
            const ph = materialPhoto(tab === 'brands' ? x.needs.map((n) => n.title).join(' ') : `${x.makes} ${x.materials.join(' ')}`);
            return tab === 'brands' ? (
              <a key={x.id} className="card card-photo" href={`#/b/${x.id}`}>
                <img src={ph.src} alt="" loading="lazy" style={{ objectPosition: ph.position }} />
                <div className="card-body">
                  <h3>{x.name}</h3>
                  <span className="where">{place(x)}</span>
                  <p>{x.sells}</p>
                  <div className="tags">{x.needs.slice(0, 2).map((n) => <span key={n.title} className="pill">Wants {n.title.toLowerCase()}</span>)}</div>
                </div>
              </a>
            ) : (
              <a key={x.id} className="card card-photo" href={`#/m/${x.id}`}>
                <img src={ph.src} alt="" loading="lazy" style={{ objectPosition: ph.position }} />
                <div className="card-body">
                  <h3>{x.name}</h3>
                  <span className="where">{place(x)}</span>
                  <p>{x.makes}</p>
                  <p className="card-figs"><span className="num">{x.moq.toLocaleString()}</span> min, <span className="num">{x.leadTimeDays}</span> days</p>
                  <div className="tags">{x.certifications.slice(0, 3).map((c) => <span key={c.name} className="pill plain">{c.name}</span>)}</div>
                </div>
              </a>
            );
          })}
        </div>
      )}
      <MapDialog open={mapOpen} onClose={() => setMapOpen(false)} matches={forMap} title={`${shown.length} ${tab === 'brands' ? 'brands' : 'manufacturers'}${country !== 'All' ? ` in ${country}` : ''}`} />
    </div>
  );
}

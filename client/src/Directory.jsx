import { useEffect, useState } from 'react';
import { api } from './api.js';
import { go } from './App.jsx';

const place = (x) => (x.city === x.country ? x.city : `${x.city}, ${x.country}`);

export default function Directory({ tab }) {
  const [makers, setMakers] = useState(null);
  const [brands, setBrands] = useState(null);
  const [country, setCountry] = useState('All');
  useEffect(() => { api.get('/manufacturers').then(setMakers); api.get('/brands').then(setBrands); }, []);
  useEffect(() => setCountry('All'), [tab]);

  const list = tab === 'brands' ? brands : makers;
  const countries = list ? ['All', ...new Set(list.map((x) => x.country))] : [];
  const shown = (list || []).filter((x) => country === 'All' || x.country === country);

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
      <div className="filters" role="group" aria-label="Country">
        {countries.map((c) => <button type="button" key={c} className="filter" aria-pressed={country === c} onClick={() => setCountry(c)}>{c}</button>)}
      </div>
      {!list ? <div className="skeleton" /> : (
        <div className="grid">
          {shown.map((x) => tab === 'brands' ? (
            <a key={x.id} className="card" href={`#/b/${x.id}`}>
              <h3>{x.name}</h3>
              <span className="where">{place(x)}</span>
              <p>{x.sells}</p>
              <div className="tags">{x.needs.slice(0, 2).map((n) => <span key={n.title} className="pill">Wants: {n.title}</span>)}</div>
            </a>
          ) : (
            <a key={x.id} className="card" href={`#/m/${x.id}`}>
              <h3>{x.name}</h3>
              <span className="where">{place(x)}</span>
              <p>{x.makes}</p>
              <div className="tags">{x.certifications.slice(0, 3).map((c) => <span key={c.name} className="pill plain">{c.name}</span>)}</div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

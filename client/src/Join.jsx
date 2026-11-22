import { useState } from 'react';
import { api } from './api.js';
import { go, useApp } from './App.jsx';

const MAKER_COUNTRIES = ['India', 'Vietnam', 'China', 'Bangladesh', 'Cambodia', 'Indonesia', 'Sri Lanka', 'Thailand', 'Pakistan', 'Nepal', 'Philippines', 'Laos', 'Japan', 'Other'];
const EMPTY = { name: '', contact: '', email: '', country: '', city: '', about: '', makes: '', materials: '', processes: '', certifications: '', moq: '', leadTimeDays: '', sells: '', needTitle: '', needDetail: '', needMaterials: '', quantity: '', target: '', needCertifications: '' };

export default function Join({ side }) {
  const { notify, refreshMeta } = useApp();
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const field = (k, label, props = {}, hint) => (
    <label className="field">{label}
      {props.as === 'textarea'
        ? <textarea className="textarea" name={k} value={f[k]} onChange={set(k)} aria-invalid={errors[k] ? true : undefined} />
        : <input className="input" name={k} value={f[k]} onChange={set(k)} aria-invalid={errors[k] ? true : undefined} {...props} />}
      {hint && <span className="hint">{hint}</span>}
      <span className="error">{errors[k]}</span>
    </label>
  );

  async function submit(e) {
    e.preventDefault(); setBusy(true); setErrors({});
    try {
      const r = await api.post('/join', { ...f, side });
      refreshMeta(); notify('You’re listed. Your profile is searchable now.');
      go(r.side === 'brand' ? `/b/${r.id}` : `/m/${r.id}`);
    } catch (err) {
      setErrors(err.fields || {});
      const first = Object.keys(err.fields || {})[0];
      if (first) document.querySelector(`[name="${first}"]`)?.focus();
    }
    setBusy(false);
  }

  return (
    <div className="wrap join">
      <div className="page-head">
        <div>
          <h1>List your company</h1>
          <p>{side === 'maker' ? 'Tell brands what you make. You’ll show up in their searches straight away.' : 'Tell manufacturers what you need. You’ll show up in their searches straight away.'}</p>
        </div>
      </div>
      <div className="toggle" role="group" aria-label="I am a">
        <button type="button" aria-pressed={side === 'maker'} onClick={() => go('/join')}>I’m a manufacturer</button>
        <button type="button" aria-pressed={side === 'brand'} onClick={() => go('/join?side=brand')}>I’m a brand</button>
      </div>
      <form onSubmit={submit} noValidate>
        <fieldset>
          <legend>Your company</legend>
          {field('name', 'Company name', { autoComplete: 'organization' })}
          <div className="two">
            {field('contact', 'Contact name', { autoComplete: 'name' })}
            {field('email', 'Email', { type: 'email', autoComplete: 'email' })}
          </div>
          <div className="two">
            {side === 'maker' ? (
              <label className="field">Country
                <select className="select" name="country" value={f.country} onChange={set('country')} aria-invalid={errors.country ? true : undefined}>
                  <option value="">Choose</option>{MAKER_COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <span className="error">{errors.country}</span>
              </label>
            ) : field('country', 'Country', { autoComplete: 'country-name' })}
            {field('city', 'City', { autoComplete: 'address-level2' })}
          </div>
          {field('about', 'About you', { as: 'textarea' }, 'Two or three sentences. This is what people read first.')}
        </fieldset>

        {side === 'maker' ? (
          <fieldset>
            <legend>What you make</legend>
            {field('makes', 'Products', { placeholder: 'T-shirts, dresses, knitwear' })}
            {field('materials', 'Materials', { placeholder: 'organic cotton, linen, recycled polyester' }, 'Separate with commas.')}
            {field('processes', 'Processes', { placeholder: 'knitting, natural dyeing, cut and sew' }, 'Optional. Separate with commas.')}
            {field('certifications', 'Certifications', { placeholder: 'GOTS, OEKO-TEX, Fair Trade' }, 'Optional. Shown as self-reported until checked.')}
            <div className="two">
              {field('moq', 'Minimum order (units)', { type: 'number', inputMode: 'numeric', min: 1 })}
              {field('leadTimeDays', 'Lead time (days)', { type: 'number', inputMode: 'numeric', min: 1 })}
            </div>
          </fieldset>
        ) : (
          <fieldset>
            <legend>What you’re looking for</legend>
            {field('sells', 'What you sell', { placeholder: 'Organic cotton basics' })}
            {field('needTitle', 'What you want made', { placeholder: 'Linen summer shirts' })}
            {field('needDetail', 'Details', { as: 'textarea' }, 'Fit, finish, colours, packaging, timing.')}
            {field('needMaterials', 'Materials', { placeholder: 'linen, natural dyes' }, 'Separate with commas.')}
            <div className="two">
              {field('quantity', 'Quantity (units)', { type: 'number', inputMode: 'numeric', min: 1 })}
              {field('target', 'Target price', { placeholder: 'US$12 to 15' })}
            </div>
            {field('needCertifications', 'Certifications you need', { placeholder: 'GOTS, OEKO-TEX' }, 'Optional.')}
          </fieldset>
        )}
        <div><button type="submit" className="btn" disabled={busy}>{busy ? 'Listing' : 'List my company'}</button></div>
      </form>
    </div>
  );
}

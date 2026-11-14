import Icon from './icons.jsx';

const SCORES = [
  ['Cost', 'Price tier against every other maker on the platform'],
  ['Sustainability', 'Certificates held, renewable power, water recycled'],
  ['Reliability', 'On-time delivery and years in business'],
  ['Quality', 'Defect rate on finished goods'],
  ['Lead time', 'Days from order to shipment'],
  ['Compliance', 'Audit score, less any lapsed certificate'],
  ['Low risk', 'Country, capacity and how soon certificates expire'],
];

const QUESTIONS = [
  ['Where do the answers come from?', 'Only from profiles, certificates and requests on Meridian Loop, each fact numbered to its source.'],
  ['Who checks the certificates?', 'Each upload is read for standard, number, issuer and expiry, then flagged when it lapses.'],
  ['Which countries?', 'China, Vietnam, India, Bangladesh, Cambodia and Indonesia.'],
];

export default function Landing() {
  return (
    <>
      <section className="lp-hero container" aria-labelledby="lp-title">
        <div className="lp-hero-text">
          <h1 id="lp-title">Sourcing you can check.</h1>
          <p className="lead">Verified Asian manufacturers for sustainable brands, with proof shoppers can see.</p>
          <div className="lp-actions">
            <a className="btn primary lg" href="#/brand/assistant">Find a manufacturer</a>
            <a className="btn lg" href="#/signup/manufacturer">List your factory</a>
          </div>
        </div>
        <div className="lp-hero-visual">
          <figure className="shot" data-slot="hero" data-kind="product" data-alt="The sourcing assistant answering a brief for GOTS organic cotton loungewear" style={{ aspectRatio: '628 / 1071' }}>
            <img src="/screens/assistant.png" width="1256" height="2142" alt="The assistant reading a loungewear brief and ranking three manufacturers in India and Cambodia, with numbered sources" fetchpriority="high" style={{ objectPosition: 'top left' }} />
          </figure>
          <div className="swingtag lp-tag" aria-label="Example certificate on file">
            <span className="title">Kaveri Organic Knits</span>
            <dl>
              <dt>GOTS</dt><dd>CU-GOTS-884213</dd>
              <dt>Issuer</dt><dd>Control Union</dd>
            </dl>
            <span className="stamp">Valid to 31 Mar 2027</span>
          </div>
        </div>
      </section>

      <section className="lp-loop" id="how" aria-labelledby="loop-title">
        <div className="container lp-head">
          <h2 id="loop-title">One loop, three sides</h2>
          <p className="lead">Makers prove what they do. Brands choose with that proof. Shoppers see it on the product.</p>
        </div>
        <ol className="lp-bands">
          <li className="lp-band t1">
            <div className="container lp-band-grid">
              <div className="lp-band-text">
                <span className="lp-num" aria-hidden="true">1</span>
                <h3>Manufacturers prove it</h3>
                <p>A factory uploads a certificate. Meridian Loop reads the standard, number, issuer and expiry, and adds it to their profile.</p>
                <a className="lp-link" href="#/maker/documents">Read a certificate<Icon name="chevron" size={16} /></a>
              </div>
              <figure className="shot" data-slot="step-1" data-kind="product" data-alt="A certificate read and checked" style={{ aspectRatio: '848 / 694' }}>
                <img src="/screens/certificate.png" width="1696" height="1388" alt="An OEKO-TEX certificate pasted in, with its standard, number, issuer, company and expiry read out" loading="lazy" />
              </figure>
            </div>
          </li>
          <li className="lp-band t2">
            <div className="container lp-band-grid">
              <div className="lp-band-text">
                <span className="lp-num" aria-hidden="true">2</span>
                <h3>Brands find a match</h3>
                <p>Describe the product in plain words. Every maker is ranked on seven scores, weighted by what you care about most.</p>
                <a className="lp-link" href="#/brand/discover">Rank manufacturers<Icon name="chevron" size={16} /></a>
              </div>
              <figure className="shot" data-slot="step-2" data-kind="product" data-alt="Manufacturers ranked for vegan leather bags" style={{ aspectRatio: '832 / 727' }}>
                <img src="/screens/ranking.png" width="1664" height="1454" alt="Manufacturers ranked for vegan leather bags, with priority sliders and seven scores per maker" loading="lazy" style={{ objectPosition: 'top left' }} />
              </figure>
            </div>
          </li>
          <li className="lp-band t3">
            <div className="container lp-band-grid narrow">
              <div className="lp-band-text">
                <span className="lp-num" aria-hidden="true">3</span>
                <h3>Shoppers see the proof</h3>
                <p>Each product shows who made it, from what, and which claims a certificate backs.</p>
                <a className="lp-link" href="#/shop">Open the shop<Icon name="chevron" size={16} /></a>
              </div>
              <figure className="shot" data-slot="step-3" data-kind="product" data-alt="A product’s claims and passport" style={{ aspectRatio: '612 / 952' }}>
                <img src="/screens/passport.png" width="1224" height="1904" alt="A bag’s claims marked verified or maker-reported, its materials, and its passport from raw material to brand" loading="lazy" />
              </figure>
            </div>
          </li>
        </ol>
      </section>

      <section className="lp-scores container" aria-labelledby="scores-title">
        <div className="lp-scores-head">
          <h2 id="scores-title">Seven scores behind every match</h2>
          <p className="lead">You set how much each one counts.</p>
          <a className="btn lg" href="#/how">See how answers are made</a>
        </div>
        <dl className="lp-rows">
          {SCORES.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      </section>

      <section className="lp-proof" aria-labelledby="proof-title">
        <div className="container lp-proof-grid">
          <figure className="photo" data-slot="photo-1" data-alt="Fabric made by one of your supplier partners">
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Cloth-roll.jpg/1280px-Cloth-roll.jpg"
              srcSet="https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Cloth-roll.jpg/960px-Cloth-roll.jpg 960w, https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Cloth-roll.jpg/1280px-Cloth-roll.jpg 1280w, https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Cloth-roll.jpg/1920px-Cloth-roll.jpg 1920w"
              sizes="(min-width: 60rem) 45vw, 100vw" width="4032" height="3024" alt="" loading="lazy" style={{ objectPosition: '45% 55%' }} />
          </figure>
          <div className="lp-proof-text">
            <h2 id="proof-title">Lapsed proof turns grey</h2>
            <p className="lead">Valid certificates carry a green stamp. An expired one is flagged and lowers the maker’s score.</p>
            <div className="lp-tags">
              <div className="swingtag">
                <span className="title">Bandung Batik Lestari</span>
                <dl><dt>Standard</dt><dd>GOTS</dd><dt>Issuer</dt><dd>Control Union</dd></dl>
                <span className="stamp">Valid to<br />31 Mar 2027</span>
              </div>
              <div className="swingtag">
                <span className="title">Da Nang Bamboo Textiles</span>
                <dl><dt>Standard</dt><dd>OEKO-TEX 100</dd><dt>Issuer</dt><dd>Hohenstein</dd></dl>
                <span className="stamp grey">Expired<br />30 Apr 2026</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-origin container" aria-labelledby="origin-title">
        <h2 id="origin-title" className="visually-hidden">Where it started</h2>
        <figure className="lp-quote">
          <blockquote><p>“We want to be the bridge between the manufacturers and the designers.”</p></blockquote>
          <figcaption>
            <span><b>Sustainable India</b>, the team’s marketplace for Indian designers and fabric makers, founded 2019</span>
            <span>Meridian Loop takes that bridge across six countries, and checks the proof on both sides.</span>
            <a className="lp-link" href="https://srishtipal86.wixsite.com/sustainableindia" rel="noopener">Visit Sustainable India<Icon name="chevron" size={16} /></a>
          </figcaption>
        </figure>
      </section>

      <section className="lp-faq container" aria-labelledby="faq-title">
        <h2 id="faq-title">Questions</h2>
        <dl className="lp-rows">
          {QUESTIONS.map(([q, a]) => <div key={q}><dt>{q}</dt><dd>{a}</dd></div>)}
        </dl>
      </section>

      <section className="lp-close" aria-labelledby="close-title">
        <div className="container lp-close-grid">
          <h2 id="close-title">Tell it what you’re making.</h2>
          <div className="lp-close-actions">
            <a className="btn primary lg" href="#/brand/assistant">Find a manufacturer</a>
            <a className="lp-link light" href="#/shop">Or shop with proof<Icon name="chevron" size={16} /></a>
          </div>
        </div>
      </section>
      <p className="lp-credits container small muted" data-credits>Photograph: <a href="https://commons.wikimedia.org/wiki/File:Cloth-roll.jpg">Samanthafara</a> (CC BY-SA 4.0, Wikimedia Commons)</p>
    </>
  );
}

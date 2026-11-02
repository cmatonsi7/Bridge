// Migrated from the SportBridge HTML prototype (rendered markup) by tools/html_to_jsx.py. Maintained by hand.
import { Check, MapPin, Search } from 'lucide-react';
import { useLegacyActions } from '../../features/marketing/useLegacyActions';

export default function DiscoverPage() {
  const a = useLegacyActions();
  return (
    <>
      <section className="page active" id="discover">
        <div className="discover-hero">
          <div className="wrap">
            <span className="eyebrow">DISCOVER SPORTBRIDGE</span>
            <h1>
              Discover. <span>Connect. Grow.</span>
            </h1>
            <p>Explore athletes, coaches and organisations across the SportBridge community.</p>
            <div className="discover-search">
              <span>
                <Search className="icon" aria-hidden="true" />
              </span>
              <input
                id="discoverSearch"
                onInput={a.filterDiscover}
                placeholder="Search athletes, coaches, organisations\u2026"
                type="search"
              />
              <button className="btn green" onClick={a.filterDiscover} type="button">
                Search
              </button>
            </div>
          </div>
        </div>
        <section className="section">
          <div className="wrap">
            <div className="discover-tabs" role="tablist">
              <button className="active" data-tab="all" onClick={a.discoverTab('all')} type="button">
                All
              </button>
              <button data-tab="athletes" onClick={a.discoverTab('athletes')} type="button">
                Athletes
              </button>
              <button data-tab="coaches" onClick={a.discoverTab('coaches')} type="button">
                Coaches
              </button>
              <button data-tab="organisations" onClick={a.discoverTab('organisations')} type="button">
                Organisations
              </button>
            </div>
            <div className="section-head discover-heading">
              <span className="eyebrow">MEET THE COMMUNITY</span>
              <h2>People and organisations worth discovering.</h2>
              <p>Public profiles are shown only when people and organisations choose to be discoverable.</p>
            </div>
            <div className="discover-grid" id="discoverGrid">
              <article
                className="discover-card"
                data-name="Thabo Mokoena football johannesburg"
                data-type="athletes"
              >
                <img src="/images/athlete-profile.webp" alt="" loading="lazy" />
                <div className="discover-body">
                  <div className="discover-top">
                    <span className="tag">ATHLETE</span>
                    <span className="verified">
                      <Check className="icon" aria-hidden="true" /> Sample profile
                    </span>
                  </div>
                  <h3>Thabo Mokoena</h3>
                  <p>Football • U17</p>
                  <span className="discover-meta">
                    <MapPin className="icon" aria-hidden="true" /> Johannesburg, Gauteng
                  </span>
                  <span className="link">View profile →</span>
                </div>
              </article>
              <article
                className="discover-card"
                data-name="Lerato Dlamini athletics cape town"
                data-type="athletes"
              >
                <img src="/images/athletes.webp" alt="" loading="lazy" />
                <div className="discover-body">
                  <div className="discover-top">
                    <span className="tag">ATHLETE</span>
                    <span className="verified">
                      <Check className="icon" aria-hidden="true" /> Sample profile
                    </span>
                  </div>
                  <h3>Lerato Dlamini</h3>
                  <p>Athletics • U19</p>
                  <span className="discover-meta">
                    <MapPin className="icon" aria-hidden="true" /> Cape Town, Western Cape
                  </span>
                  <span className="link">View profile →</span>
                </div>
              </article>
              <article
                className="discover-card"
                data-name="Anele Ndlovu swimming durban"
                data-type="athletes"
              >
                <img src="/images/swim.webp" alt="" loading="lazy" />
                <div className="discover-body">
                  <div className="discover-top">
                    <span className="tag">ATHLETE</span>
                    <span className="verified">
                      <Check className="icon" aria-hidden="true" /> Sample profile
                    </span>
                  </div>
                  <h3>Anele Ndlovu</h3>
                  <p>Swimming • U17</p>
                  <span className="discover-meta">
                    <MapPin className="icon" aria-hidden="true" /> Durban, KwaZulu-Natal
                  </span>
                  <span className="link">View profile →</span>
                </div>
              </article>
              <article
                className="discover-card"
                data-name="Sibusiso Khumalo football durban"
                data-type="coaches"
              >
                <img src="/images/coaches.webp" alt="" loading="lazy" />
                <div className="discover-body">
                  <div className="discover-top">
                    <span className="tag">COACH</span>
                    <span className="verified">
                      <Check className="icon" aria-hidden="true" /> Sample profile
                    </span>
                  </div>
                  <h3>Sibusiso Khumalo</h3>
                  <p>Football Coach & Mentor</p>
                  <span className="discover-meta">
                    <MapPin className="icon" aria-hidden="true" /> Durban, KwaZulu-Natal
                  </span>
                  <span className="link">View profile →</span>
                </div>
              </article>
              <article
                className="discover-card"
                data-name="Naledi Molefe athletics johannesburg"
                data-type="coaches"
              >
                <img src="/images/coaching.webp" alt="" loading="lazy" />
                <div className="discover-body">
                  <div className="discover-top">
                    <span className="tag">COACH</span>
                    <span className="verified">
                      <Check className="icon" aria-hidden="true" /> Sample profile
                    </span>
                  </div>
                  <h3>Naledi Molefe</h3>
                  <p>Athletics Coach</p>
                  <span className="discover-meta">
                    <MapPin className="icon" aria-hidden="true" /> Johannesburg, Gauteng
                  </span>
                  <span className="link">View profile →</span>
                </div>
              </article>
              <article
                className="discover-card"
                data-name="National Sports Academy johannesburg"
                data-type="organisations"
              >
                <img src="/images/academy.webp" alt="" loading="lazy" />
                <div className="discover-body">
                  <div className="discover-top">
                    <span className="tag">ORGANISATION</span>
                    <span className="verified">
                      <Check className="icon" aria-hidden="true" /> Sample profile
                    </span>
                  </div>
                  <h3>National Sports Academy</h3>
                  <p>Academy • Talent Development</p>
                  <span className="discover-meta">
                    <MapPin className="icon" aria-hidden="true" /> Johannesburg, Gauteng
                  </span>
                  <span className="link">View organisation →</span>
                </div>
              </article>
              <article
                className="discover-card"
                data-name="Game On Tennis cape town"
                data-type="organisations"
              >
                <img src="/images/tennis.webp" alt="" loading="lazy" />
                <div className="discover-body">
                  <div className="discover-top">
                    <span className="tag">ORGANISATION</span>
                    <span className="verified">
                      <Check className="icon" aria-hidden="true" /> Sample profile
                    </span>
                  </div>
                  <h3>Game On Tennis</h3>
                  <p>Academy • Tennis Development</p>
                  <span className="discover-meta">
                    <MapPin className="icon" aria-hidden="true" /> Cape Town, Western Cape
                  </span>
                  <span className="link">View organisation →</span>
                </div>
              </article>
              <article className="discover-card" data-name="Aqua Elite durban" data-type="organisations">
                <img src="/images/swim-fitness.webp" alt="" loading="lazy" />
                <div className="discover-body">
                  <div className="discover-top">
                    <span className="tag">ORGANISATION</span>
                    <span className="verified">
                      <Check className="icon" aria-hidden="true" /> Sample profile
                    </span>
                  </div>
                  <h3>Aqua Elite</h3>
                  <p>Programme Provider • Swimming</p>
                  <span className="discover-meta">
                    <MapPin className="icon" aria-hidden="true" /> Durban, KwaZulu-Natal
                  </span>
                  <span className="link">View organisation →</span>
                </div>
              </article>
              <article
                className="discover-card"
                data-name="Sipho Dlamini rugby gqeberha eastern cape"
                data-type="athletes"
              >
                <img alt="Rugby athlete" src="/images/coach-athlete.webp" loading="lazy" />
                <div className="discover-body">
                  <div className="discover-top">
                    <span className="tag">ATHLETE</span>
                    <span className="verified">
                      <Check className="icon" aria-hidden="true" /> Sample profile
                    </span>
                  </div>
                  <h3>Sipho Dlamini</h3>
                  <p>Rugby • U19</p>
                  <span className="discover-meta">
                    <MapPin className="icon" aria-hidden="true" /> Gqeberha, Eastern Cape
                  </span>
                  <span className="link">View profile →</span>
                </div>
              </article>
              <article
                className="discover-card"
                data-name="Zanele Mkhize hockey durban kwaZulu natal"
                data-type="coaches"
              >
                <img alt="Hockey coach" src="/images/coaching.webp" loading="lazy" />
                <div className="discover-body">
                  <div className="discover-top">
                    <span className="tag">COACH</span>
                    <span className="verified">
                      <Check className="icon" aria-hidden="true" /> Sample profile
                    </span>
                  </div>
                  <h3>Zanele Mkhize</h3>
                  <p>Hockey Coach & Mentor</p>
                  <span className="discover-meta">
                    <MapPin className="icon" aria-hidden="true" /> Durban, KwaZulu-Natal
                  </span>
                  <span className="link">View profile →</span>
                </div>
              </article>
              <article
                className="discover-card"
                data-name="Lerato Jacobs golf cape town western cape"
                data-type="athletes"
              >
                <img alt="Golf athlete" src="/images/opportunities.webp" loading="lazy" />
                <div className="discover-body">
                  <div className="discover-top">
                    <span className="tag">ATHLETE</span>
                    <span className="verified">
                      <Check className="icon" aria-hidden="true" /> Sample profile
                    </span>
                  </div>
                  <h3>Lerato Jacobs</h3>
                  <p>Golf • U18</p>
                  <span className="discover-meta">
                    <MapPin className="icon" aria-hidden="true" /> Cape Town, Western Cape
                  </span>
                  <span className="link">View profile →</span>
                </div>
              </article>
              <article
                className="discover-card"
                data-name="coastal cricket academy cricket durban"
                data-type="organisations"
              >
                <img alt="Cricket academy" src="/images/camp.webp" loading="lazy" />
                <div className="discover-body">
                  <div className="discover-top">
                    <span className="tag">ORGANISATION</span>
                    <span className="verified">
                      <Check className="icon" aria-hidden="true" /> Sample profile
                    </span>
                  </div>
                  <h3>Coastal Cricket Academy</h3>
                  <p>Academy • Cricket Development</p>
                  <span className="discover-meta">
                    <MapPin className="icon" aria-hidden="true" /> Durban, KwaZulu-Natal
                  </span>
                  <span className="link">View organisation →</span>
                </div>
              </article>
            </div>
            <div className="discover-empty" id="discoverEmpty">
              No matching profiles found. Try another search.
            </div>
          </div>
        </section>
        <section className="discover-cta">
          <div className="wrap discover-cta-inner">
            <div>
              <span className="eyebrow">JOIN SPORTBRIDGE</span>
              <h2>Your next connection could change everything.</h2>
              <p>Create your profile and become part of the sporting ecosystem.</p>
            </div>
            <div className="cta-actions">
              <button className="btn green" onClick={a.register} type="button">
                Create Your Profile →
              </button>
            </div>
          </div>
        </section>
      </section>
    </>
  );
}

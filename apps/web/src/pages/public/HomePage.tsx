// Migrated from the SportBridge HTML prototype (rendered markup) by tools/html_to_jsx.py. Maintained by hand.
import {
  Building2,
  Calendar,
  Footprints,
  Globe,
  GraduationCap,
  MapPin,
  Rocket,
  ShieldCheck,
  Star,
  Tent,
  Users,
  ClipboardList,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { useLegacyActions } from '../../features/marketing/useLegacyActions';

/**
 * Membership pricing, confirmed by the client on 2026-11-11.
 * Annual is two months free, so it is ten times the monthly price.
 */
const PLANS = {
  starter: { monthly: 'R0', annual: 'R0' },
  pro: { monthly: 'R149', annual: 'R1 490' },
  organisation: { monthly: 'R499', annual: 'R4 990' },
} as const;

export default function HomePage() {
  const a = useLegacyActions();
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const annual = billing === 'annual';
  const per = annual ? '/ year' : '/ month';
  return (
    <>
      <section className="page active" id="home">
        <div className="hero">
          <div className="hero-inner">
            <span className="eyebrow">AFRICA'S SPORTS OPPORTUNITY PLATFORM</span>
            <h1>
              Discover Talent.
              <br />
              <span>Create Opportunities.</span>
              <br />
              Build Brighter Futures.
            </h1>
            <p>
              SportBridge connects athletes, parents, coaches, clubs and programme providers — creating a
              stronger, more inclusive sporting community across Africa.
            </p>
            <div className="hero-actions">
              <button className="btn green" onClick={a.register} type="button">
                Create Your Profile →
              </button>
              <button className="btn" onClick={a.go('/opportunities')} type="button">
                Explore Opportunities
              </button>
            </div>
          </div>
        </div>
        <section className="section">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">WHO IS SPORTBRIDGE FOR?</span>
              <h2>A platform for every player in sport.</h2>
              <p>
                Whether you're on the field, on the sidelines or creating opportunities — SportBridge brings
                the sporting community together.
              </p>
            </div>
            <div className="roles">
              <article className="role-card">
                <img alt="Athletes in sport" src="/images/athletes.webp" loading="lazy" />
                <div className="role-body">
                  <h3>
                    <Footprints className="icon" aria-hidden="true" /> Athletes
                  </h3>
                  <p>Showcase your talent and get discovered.</p>
                  <span className="link" onClick={a.openApp}>
                    Get started →
                  </span>
                </div>
              </article>
              <article className="role-card">
                <img alt="Parents & Guardians in sport" src="/images/community.webp" loading="lazy" />
                <div className="role-body">
                  <h3>
                    <Users className="icon" aria-hidden="true" /> Parents & Guardians
                  </h3>
                  <p>Support your child's sporting journey.</p>
                  <span className="link" onClick={a.openApp}>
                    Get started →
                  </span>
                </div>
              </article>
              <article className="role-card">
                <img alt="Coaches in sport" src="/images/coaches.webp" loading="lazy" />
                <div className="role-body">
                  <h3>
                    <ClipboardList className="icon" aria-hidden="true" /> Coaches
                  </h3>
                  <p>Find and connect with talent.</p>
                  <span className="link" onClick={a.openApp}>
                    Get started →
                  </span>
                </div>
              </article>
              <article className="role-card">
                <img alt="Clubs & Academies in sport" src="/images/academy.webp" loading="lazy" />
                <div className="role-body">
                  <h3>
                    <Building2 className="icon" aria-hidden="true" /> Clubs & Academies
                  </h3>
                  <p>Post opportunities and grow your teams.</p>
                  <span className="link" onClick={a.go('/opportunities')}>
                    Get started →
                  </span>
                </div>
              </article>
              <article className="role-card">
                <img alt="Schools & Universities in sport" src="/images/schools.webp" loading="lazy" />
                <div className="role-body">
                  <h3>
                    <GraduationCap className="icon" aria-hidden="true" /> Schools & Universities
                  </h3>
                  <p>Connect with student-athletes.</p>
                  <span className="link" onClick={a.go('/opportunities')}>
                    Get started →
                  </span>
                </div>
              </article>
              <article className="role-card">
                <img alt="Programme Providers in sport" src="/images/camp.webp" loading="lazy" />
                <div className="role-body">
                  <h3>
                    <Tent className="icon" aria-hidden="true" /> Programme Providers
                  </h3>
                  <p>List holiday programmes, camps and events.</p>
                  <span className="link" onClick={a.go('/programmes')}>
                    Get started →
                  </span>
                </div>
              </article>
            </div>
          </div>
        </section>
        <section className="section sb-sports-showcase">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">SPORT ACROSS SOUTH AFRICA</span>
              <h2>Every code. Every province. More ways to grow.</h2>
              <p>
                From community clubs to high-performance pathways, SportBridge supports the sporting codes
                that shape South African communities.
              </p>
            </div>
            <div className="sb-sport-showcase-grid">
              <article className="sb-sport-showcase-card">
                <img alt="Rugby in South Africa" src="/images/rugby-user-image.webp" loading="lazy" />
                <div>
                  <span>01</span>
                  <h3>Rugby</h3>
                  <p>Trials, clubs and development pathways.</p>
                </div>
              </article>
              <article className="sb-sport-showcase-card">
                <img alt="Cricket in South Africa" src="/images/cricket-user-image.webp" loading="lazy" />
                <div>
                  <span>02</span>
                  <h3>Cricket</h3>
                  <p>Talent identification and academy opportunities.</p>
                </div>
              </article>
              <article className="sb-sport-showcase-card">
                <img alt="Hockey in South Africa" src="/images/hockey-user-image.webp" loading="lazy" />
                <div>
                  <span>03</span>
                  <h3>Hockey</h3>
                  <p>School, club and provincial opportunities.</p>
                </div>
              </article>
              <article className="sb-sport-showcase-card">
                <img alt="Golf in South Africa" src="/images/golf-user-image.webp" loading="lazy" />
                <div>
                  <span>04</span>
                  <h3>Golf</h3>
                  <p>Junior development, coaching and bursaries.</p>
                </div>
              </article>
              <article className="sb-sport-showcase-card">
                <img alt="Netball in South Africa" loading="lazy" src="/images/netball-user-image.webp" />
                <div>
                  <span>05</span>
                  <h3>Netball</h3>
                  <p>Club trials, school teams and player pathways.</p>
                </div>
              </article>
              <article className="sb-sport-showcase-card">
                <img alt="Athletics in South Africa" loading="lazy" src="/images/athletics-user-image.webp" />
                <div>
                  <span>06</span>
                  <h3>Athletics</h3>
                  <p>Track, field and athlete development opportunities.</p>
                </div>
              </article>
              <article className="sb-sport-showcase-card">
                <img
                  alt="Equestrian in South Africa"
                  loading="lazy"
                  src="/images/equestrian-user-image.webp"
                />
                <div>
                  <span>07</span>
                  <h3>Equestrian</h3>
                  <p>Riding, competition and development pathways.</p>
                </div>
              </article>
            </div>
            <div aria-label="More sports" className="sb-extra-sport-gallery">
              <article className="sb-sport-showcase-card sb-extra-sport-card">
                <img alt="Golf in South Africa" src="/images/golf-user-image.webp" loading="lazy" />
                <div>
                  <span>+</span>
                  <h3>Golf</h3>
                  <p>Junior development, coaching and bursary pathways.</p>
                </div>
              </article>
              <article className="sb-sport-showcase-card sb-extra-sport-card">
                <img alt="Hockey in South Africa" src="/images/hockey-user-image.webp" loading="lazy" />
                <div>
                  <span>+</span>
                  <h3>Hockey</h3>
                  <p>School, club and provincial opportunities.</p>
                </div>
              </article>
              <article className="sb-sport-showcase-card sb-extra-sport-card">
                <img alt="Netball in South Africa" src="/images/netball-user-image.webp" loading="lazy" />
                <div>
                  <span>+</span>
                  <h3>Netball</h3>
                  <p>Club trials, school teams and player development.</p>
                </div>
              </article>
              <article className="sb-sport-showcase-card sb-extra-sport-card">
                <img alt="Cricket in South Africa" src="/images/cricket-user-image.webp" loading="lazy" />
                <div>
                  <span>+</span>
                  <h3>Cricket</h3>
                  <p>Academies, competitions and talent identification.</p>
                </div>
              </article>
              <article className="sb-sport-showcase-card sb-extra-sport-card">
                <img alt="Rugby in South Africa" src="/images/rugby-user-image.webp" loading="lazy" />
                <div>
                  <span>+</span>
                  <h3>Rugby</h3>
                  <p>Club pathways, trials and performance development.</p>
                </div>
              </article>
              <article className="sb-sport-showcase-card sb-extra-sport-card">
                <img alt="Athletics in South Africa" src="/images/athletics-user-image.webp" loading="lazy" />
                <div>
                  <span>+</span>
                  <h3>Athletics</h3>
                  <p>Track events, meets and development programmes.</p>
                </div>
              </article>
              <article className="sb-sport-showcase-card sb-extra-sport-card">
                <img
                  alt="Equestrian in South Africa"
                  src="/images/equestrian-user-image.webp"
                  loading="lazy"
                />
                <div>
                  <span>+</span>
                  <h3>Equestrian</h3>
                  <p>Riding, show jumping and equestrian development.</p>
                </div>
              </article>
            </div>
            <div className="sb-sport-chips">
              <span>Football</span>
              <span>Netball</span>
              <span>Athletics</span>
              <span>Swimming</span>
              <span>Basketball</span>
              <span>Surfing</span>
              <span>Boxing</span>
              <span>Cycling</span>
              <span>Para-sport</span>
              <span>And more</span>
            </div>
          </div>
        </section>
        <section className="section soft">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">FEATURED OPPORTUNITIES</span>
              <h2>Find your next opportunity.</h2>
              <p>Explore the latest trials, scholarships, coaching roles, events and more.</p>
            </div>
            <div className="feature-grid">
              <article className="op-card">
                <img src="/images/opportunities.webp" alt="" loading="lazy" />
                <div className="op-body">
                  <span className="tag">TRIALS</span>
                  <h3>U17 Provincial Trials</h3>
                  <div className="meta">
                    Western Province Rugby
                    <br />
                    <MapPin className="icon" aria-hidden="true" /> Cape Town, Western Cape
                    <br />
                    <Calendar className="icon" aria-hidden="true" /> 15 Nov 2026
                  </div>
                  <div className="op-footer">
                    <span className="link">View details →</span>
                  </div>
                </div>
              </article>
              <article className="op-card">
                <img src="/images/football-bursary.webp" alt="" loading="lazy" />
                <div className="op-body">
                  <span className="tag">SCHOLARSHIP</span>
                  <h3>Football Bursary 2027</h3>
                  <div className="meta">
                    National Sports Academy
                    <br />
                    <MapPin className="icon" aria-hidden="true" /> Johannesburg, Gauteng
                    <br />
                    <Calendar className="icon" aria-hidden="true" /> 30 Nov 2026
                  </div>
                  <div className="op-footer">
                    <span className="link">View details →</span>
                  </div>
                </div>
              </article>
              <article className="op-card">
                <img src="/images/coach-athlete.webp" alt="" loading="lazy" />
                <div className="op-body">
                  <span className="tag">COACHING</span>
                  <h3>Assistant Coach Position</h3>
                  <div className="meta">
                    Elite Netball Academy
                    <br />
                    <MapPin className="icon" aria-hidden="true" /> Pretoria, Gauteng
                    <br />
                    <Calendar className="icon" aria-hidden="true" /> 22 Nov 2026
                  </div>
                  <div className="op-footer">
                    <span className="link">View details →</span>
                  </div>
                </div>
              </article>
              <article className="op-card">
                <img src="/images/athlete-journey.webp" alt="" loading="lazy" />
                <div className="op-body">
                  <span className="tag">TRIALS</span>
                  <h3>U19 Athletics Selection</h3>
                  <div className="meta">
                    Athletics South Africa
                    <br />
                    <MapPin className="icon" aria-hidden="true" /> Durban, KwaZulu-Natal
                    <br />
                    <Calendar className="icon" aria-hidden="true" /> 8 Dec 2026
                  </div>
                  <div className="op-footer">
                    <span className="link">View details →</span>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>
        <section className="section sb-support-cta">
          <div className="wrap sb-support-cta-inner">
            <div>
              <span className="eyebrow">SUPPORT SHOULD NOT BE A BARRIER</span>
              <h2>Need help covering sporting costs?</h2>
              <p>
                Submit a sponsorship support request for travel, equipment, training, competition fees or a
                bursary. Requests can be reviewed by eligible coaches, clubs and sponsors; funding is not
                guaranteed.
              </p>
            </div>
            <div className="sb-sponsorship-actions">
              <button className="btn green" onClick={a.supportAthlete} type="button">
                Request Sponsorship Support →
              </button>
            </div>
          </div>
        </section>
        <section className="section">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">HOW IT WORKS</span>
              <h2>Your journey starts here.</h2>
            </div>
            <div className="journey">
              <div className="step">
                <div className="step-no">01</div>
                <h3>Create Your Profile</h3>
                <p>
                  Sign up as an athlete, parent, coach, club or programme provider. Get verified for a trusted
                  presence.
                </p>
              </div>
              <div className="step">
                <div className="step-no">02</div>
                <h3>Discover Opportunities</h3>
                <p>
                  Browse trials, scholarships, coaching roles and holiday programmes tailored to your sport
                  and location.
                </p>
              </div>
              <div className="step">
                <div className="step-no">03</div>
                <h3>Connect & Apply</h3>
                <p>
                  Message coaches, clubs and programme providers directly and apply for the opportunities that
                  fit you.
                </p>
              </div>
              <div className="step">
                <div className="step-no">04</div>
                <h3>Track Your Growth</h3>
                <p>Monitor progress, receive feedback and build a record that gets you discovered.</p>
              </div>
            </div>
          </div>
        </section>
        <section className="section soft">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">WHY SPORTBRIDGE</span>
              <h2>Everything sport needs in one place.</h2>
              <p>
                From discovery to development, SportBridge gives every participant in sport the tools to grow.
              </p>
            </div>
            <div className="why">
              <div className="why-image">
                <span className="eyebrow">SMART SPORT MANAGEMENT</span>
                <h3>
                  Track Progress.
                  <br />
                  Measure Impact.
                </h3>
                <p>Performance tracking, coach feedback, achievement records and development insights.</p>
              </div>
              <div className="why-card">
                <h3>
                  <ShieldCheck className="icon" aria-hidden="true" /> Verified & Safe
                </h3>
                <p>POPIA-conscious platform with verified profiles and child-safety controls built in.</p>
              </div>
              <div className="why-card">
                <h3>
                  <Globe className="icon" aria-hidden="true" /> Nationwide Reach
                </h3>
                <p>Connect across all 9 provinces and discover opportunities from Cape Town to Limpopo.</p>
              </div>
              <div className="why-card">
                <h3>
                  <Users className="icon" aria-hidden="true" /> Community First
                </h3>
                <p>A network connecting athletes, parents, coaches, clubs and schools.</p>
              </div>
              <div className="why-card">
                <h3>
                  <Zap className="icon" aria-hidden="true" /> Smart Matching
                </h3>
                <p>Surface relevant opportunities based on sport, location and profile information.</p>
              </div>
            </div>
          </div>
        </section>
        <section className="section pricing" id="pricing">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">CHOOSE A PLAN</span>
              <h2>Join a growing community.</h2>
              <p>Get access to the right tools for your sporting journey.</p>
            </div>
            <div className="billing">
              <div className="billing-toggle" role="group" aria-label="Billing period">
                <button
                  className={annual ? '' : 'active'}
                  aria-pressed={!annual}
                  onClick={() => setBilling('monthly')}
                  type="button"
                >
                  Monthly
                </button>
                <button
                  className={annual ? 'active' : ''}
                  aria-pressed={annual}
                  onClick={() => setBilling('annual')}
                  type="button"
                >
                  Annual <span className="save">2 MONTHS FREE</span>
                </button>
              </div>
            </div>
            <div className="plans">
              <div className="plan">
                <div className="plan-icon">
                  <Rocket className="icon" aria-hidden="true" />
                </div>
                <h3>Starter</h3>
                <p className="desc">For individuals getting started on their sporting journey.</p>
                <div className="price">
                  {PLANS.starter[billing]} <span>{per}</span>
                </div>
                <p className="desc" style={{ marginTop: -6 }}>
                  Free forever
                </p>
                <ul className="checks">
                  <li>Create a profile</li>
                  <li>Search opportunities</li>
                  <li>Save listings</li>
                  <li>Access holiday programmes</li>
                  <li>Basic progress tracking</li>
                </ul>
                <button className="btn" type="button">
                  Get Started →
                </button>
              </div>
              <div className="plan pop">
                <div className="popular">Most Popular</div>
                <div className="plan-icon">
                  <Zap className="icon" aria-hidden="true" />
                </div>
                <h3>Pro</h3>
                <p className="desc">For committed athletes, parents and coaches.</p>
                <div className="price">
                  {PLANS.pro[billing]} <span>{per}</span>
                </div>
                <p className="desc" style={{ marginTop: -6 }}>
                  {annual
                    ? `${PLANS.pro.monthly} / month billed monthly`
                    : `${PLANS.pro.annual} / year — two months free`}
                </p>
                <ul className="checks">
                  <li>Everything in Starter</li>
                  <li>Advanced profile features</li>
                  <li>Track progress & performance</li>
                  <li>Apply for opportunities</li>
                  <li>Access premium holiday programmes</li>
                  <li>Priority support</li>
                </ul>
                <button className="btn green" type="button">
                  Get Pro →
                </button>
              </div>
              <div className="plan">
                <div className="plan-icon">
                  <Building2 className="icon" aria-hidden="true" />
                </div>
                <h3>Organisation</h3>
                <p className="desc">For clubs, schools, academies and programme providers.</p>
                <div className="price">
                  {PLANS.organisation[billing]} <span>{per}</span>
                </div>
                <p className="desc" style={{ marginTop: -6 }}>
                  {annual
                    ? `${PLANS.organisation.monthly} / month billed monthly`
                    : `${PLANS.organisation.annual} / year — two months free`}
                </p>
                <p className="desc" style={{ marginTop: 4 }}>
                  Includes a 30-day free trial for approved organisations.
                </p>
                <ul className="checks">
                  <li>Create and manage organisation profile</li>
                  <li>Post opportunities and programmes</li>
                  <li>Feature listings</li>
                  <li>Access insights and reporting</li>
                  <li>Priority support</li>
                </ul>
                <button className="btn" type="button">
                  Get Organisation →
                </button>
              </div>
            </div>
          </div>
        </section>
        <section className="section" id="faq">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">FAQ</span>
              <h2>Common questions.</h2>
            </div>
            <div className="faq">
              <div className="faq-item open">
                <button className="faq-q" onClick={a.toggleFaq} type="button">
                  Who can join SportBridge?<span className="plus">−</span>
                </button>
                <div className="faq-a">
                  SportBridge is open to athletes, parents, coaches, sports clubs, schools, universities,
                  holiday programme providers and sports administrators. Each user type gets a tailored
                  experience suited to their needs.
                </div>
              </div>
              <div className="faq-item">
                <button className="faq-q" onClick={a.toggleFaq} type="button">
                  Is SportBridge free to use?<span className="plus">+</span>
                </button>
                <div className="faq-a">
                  The demo shows a free Starter tier alongside paid plans. Final membership rules and pricing
                  are subject to SportBridge approval.
                </div>
              </div>
              <div className="faq-item">
                <button className="faq-q" onClick={a.toggleFaq} type="button">
                  How does verification work?<span className="plus">+</span>
                </button>
                <div className="faq-a">
                  Profiles and organisations can go through an administrative verification process.
                  Qualification and safeguarding documents can be reviewed before verification is granted.
                </div>
              </div>
              <div className="faq-item">
                <button className="faq-q" onClick={a.toggleFaq} type="button">
                  Is SportBridge POPIA compliant?<span className="plus">+</span>
                </button>
                <div className="faq-a">
                  The product design includes privacy and child-safety controls intended to support
                  POPIA-aligned operation. Final legal policies and implementation require SportBridge
                  approval and legal review.
                </div>
              </div>
              <div className="faq-item">
                <button className="faq-q" onClick={a.toggleFaq} type="button">
                  Can I post opportunities and programmes for free?<span className="plus">+</span>
                </button>
                <div className="faq-a">
                  Organisation features and listing access can be controlled through configurable membership
                  rules. The demo uses the Organisation plan as the example.
                </div>
              </div>
              <div className="faq-item">
                <button className="faq-q" onClick={a.toggleFaq} type="button">
                  How are holiday programmes listed?<span className="plus">+</span>
                </button>
                <div className="faq-a">
                  Providers can submit programme details including sport/activity, age group, location, dates,
                  times, venue, duration, pricing and capacity. Listings can be reviewed before publication.
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>
    </>
  );
}

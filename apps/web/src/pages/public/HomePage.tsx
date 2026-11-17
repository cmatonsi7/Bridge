// Migrated from the SportBridge HTML prototype (rendered markup) by tools/html_to_jsx.py. Maintained by hand.
import {
  Building2,
  Footprints,
  Globe,
  GraduationCap,
  Rocket,
  ShieldCheck,
  Star,
  Tent,
  Users,
  ClipboardList,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
// Membership pricing lives in the shared package so this page, the Membership page and the server agree.
import { PLANS } from '@sportbridge/shared';
import { PublicListingsGrid } from '../../features/listings/PublicListingsGrid';
import { useLegacyActions } from '../../features/marketing/useLegacyActions';

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
                  <button type="button" className="link" onClick={a.openApp}>
                    Get started →
                  </button>
                </div>
              </article>
              <article className="role-card">
                <img alt="Parents & Guardians in sport" src="/images/community.webp" loading="lazy" />
                <div className="role-body">
                  <h3>
                    <Users className="icon" aria-hidden="true" /> Parents & Guardians
                  </h3>
                  <p>Support your child's sporting journey.</p>
                  <button type="button" className="link" onClick={a.openApp}>
                    Get started →
                  </button>
                </div>
              </article>
              <article className="role-card">
                <img alt="Coaches in sport" src="/images/coaches.webp" loading="lazy" />
                <div className="role-body">
                  <h3>
                    <ClipboardList className="icon" aria-hidden="true" /> Coaches
                  </h3>
                  <p>Find and connect with talent.</p>
                  <button type="button" className="link" onClick={a.openApp}>
                    Get started →
                  </button>
                </div>
              </article>
              <article className="role-card">
                <img alt="Clubs & Academies in sport" src="/images/academy.webp" loading="lazy" />
                <div className="role-body">
                  <h3>
                    <Building2 className="icon" aria-hidden="true" /> Clubs & Academies
                  </h3>
                  <p>Post opportunities and grow your teams.</p>
                  <button type="button" className="link" onClick={a.go('/opportunities')}>
                    Get started →
                  </button>
                </div>
              </article>
              <article className="role-card">
                <img alt="Schools & Universities in sport" src="/images/schools.webp" loading="lazy" />
                <div className="role-body">
                  <h3>
                    <GraduationCap className="icon" aria-hidden="true" /> Schools & Universities
                  </h3>
                  <p>Connect with student-athletes.</p>
                  <button type="button" className="link" onClick={a.go('/opportunities')}>
                    Get started →
                  </button>
                </div>
              </article>
              <article className="role-card">
                <img alt="Programme Providers in sport" src="/images/camp.webp" loading="lazy" />
                <div className="role-body">
                  <h3>
                    <Tent className="icon" aria-hidden="true" /> Programme Providers
                  </h3>
                  <p>List holiday programmes, camps and events.</p>
                  <button type="button" className="link" onClick={a.go('/programmes')}>
                    Get started →
                  </button>
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
              <p>Explore the latest trials, scholarships, bursaries, talent ID days and events.</p>
            </div>
            <PublicListingsGrid kind="opportunity" max={4} />
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
                  Sign up as an athlete, parent, coach, school, club or programme provider. Organisations can
                  be verified by SportBridge staff.
                </p>
              </div>
              <div className="step">
                <div className="step-no">02</div>
                <h3>Discover Opportunities</h3>
                <p>
                  Browse trials, scholarships, bursaries and holiday programmes, and filter them by sport,
                  province and age.
                </p>
              </div>
              <div className="step">
                <div className="step-no">03</div>
                <h3>Connect & Apply</h3>
                <p>
                  Apply for the opportunities that fit you. Coaches can ask to connect, and you, or your
                  parent if you are under 18, decide.
                </p>
              </div>
              <div className="step">
                <div className="step-no">04</div>
                <h3>Track Your Growth</h3>
                <p>
                  Record your achievements and skills, and build a profile that coaches and organisations can
                  find.
                </p>
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
                <span className="eyebrow">YOUR SPORTING PROFILE</span>
                <h3>
                  Build Your Record.
                  <br />
                  Be Found.
                </h3>
                <p>
                  Achievements, skills and a sporting profile in one place, visible only to the people you
                  choose.
                </p>
              </div>
              <div className="why-card">
                <h3>
                  <ShieldCheck className="icon" aria-hidden="true" /> Verification & Child Protection
                </h3>
                <p>
                  SportBridge staff check an organisation before it is marked Verified. Under-18s are never
                  listed, and need a parent’s confirmation before they can apply.
                </p>
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
                  <Zap className="icon" aria-hidden="true" /> Find What Fits
                </h3>
                <p>Browse and filter opportunities by sport, province, age group and cost.</p>
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
                <button className="btn" onClick={a.register} type="button">
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
                <button className="btn green" onClick={a.register} type="button">
                  Start free →
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
                <button className="btn" onClick={a.register} type="button">
                  Create an organisation account →
                </button>
              </div>
            </div>
            <p className="meta" style={{ textAlign: 'center', marginTop: 20 }}>
              Paid plans are not open yet, so nothing is charged today. Create a free account now; what each
              paid plan includes is still being finalised.
            </p>
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
                  Starter is free. Pro is {PLANS.pro.monthly} a month or {PLANS.pro.annual} a year, and
                  Organisation is {PLANS.organisation.monthly} a month or {PLANS.organisation.annual} a year.
                  Paying yearly gives two months free. Paid plans are not open yet, so nothing is charged
                  today.
                </div>
              </div>
              <div className="faq-item">
                <button className="faq-q" onClick={a.toggleFaq} type="button">
                  How does verification work?<span className="plus">+</span>
                </button>
                <div className="faq-a">
                  SportBridge staff verify an organisation after checking that it is real and that the account
                  represents it. Organisations that have not been checked say so. Coaches’ qualifications are
                  shown as self-declared for now.
                </div>
              </div>
              <div className="faq-item">
                <button className="faq-q" onClick={a.toggleFaq} type="button">
                  Is SportBridge POPIA compliant?<span className="plus">+</span>
                </button>
                <div className="faq-a">
                  The Privacy & POPIA notice has not been published yet. In the meantime, under-18s are never
                  listed, organisations never see a child’s contact details, and contact details are never
                  shown on public pages.
                </div>
              </div>
              <div className="faq-item">
                <button className="faq-q" onClick={a.toggleFaq} type="button">
                  Can I post opportunities and programmes for free?<span className="plus">+</span>
                </button>
                <div className="faq-a">
                  Yes, for now. Organisations can post opportunities and programmes at no charge today. Paid
                  Organisation plans open later, starting with a 30-day trial for approved organisations.
                </div>
              </div>
              <div className="faq-item">
                <button className="faq-q" onClick={a.toggleFaq} type="button">
                  How are holiday programmes listed?<span className="plus">+</span>
                </button>
                <div className="faq-a">
                  Organisations add the details themselves, such as the sport, age group, location, dates and
                  price. Each listing’s page shows whether the organisation has been verified by SportBridge.
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>
    </>
  );
}

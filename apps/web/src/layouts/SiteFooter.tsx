import { Link } from 'react-router-dom';
import { Facebook, Instagram, Linkedin, Mail } from 'lucide-react';

/**
 * Public site footer (prototype .footer-v2). Every link points at a page that exists;
 * legal pages are not written yet, so those are listed as plain text rather than dead links.
 */
const PLATFORM = [
  { to: '/opportunities', label: 'Opportunities' },
  { to: '/programmes', label: 'Holiday Programmes' },
  { to: '/features/athletes', label: 'Athlete Profiles' },
  { to: '/discover', label: 'Discover' },
];

const FOR_YOU = [
  { to: '/athletes', label: 'For Athletes' },
  { to: '/features/talent-discovery', label: 'For Parents & Guardians' },
  { to: '/coaches', label: 'For Coaches' },
  { to: '/clubs', label: 'For Clubs & Academies' },
  { to: '/features/organisations', label: 'For Schools & Universities' },
];

const COMPANY = [
  { to: '/about', label: 'About SportBridge' },
  { to: '/resources', label: 'Resources' },
];

/** Still to be written by the client's legal adviser; shown as text so nothing links nowhere. */
const LEGAL_PENDING = ['Safety & Child Protection', 'Privacy & POPIA', 'Terms of Use'];

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer-v2">
      <div className="footer-v2-inner">
        <div className="footer-columns">
          <div>
            <div className="footer-brand">
              <img
                alt=""
                className="footer-logo-img"
                src="/images/sportbridge-logo.webp"
                width="42"
                height="42"
              />
              SportBridge
            </div>
            <p>
              People. Opportunities. Sport.
              <br />
              Connecting athletes, parents, coaches, clubs and programme providers through one sports
              ecosystem.
            </p>
            <div className="footer-social">
              <span aria-hidden="true">
                <Linkedin className="icon" />
              </span>
              <span aria-hidden="true">
                <Instagram className="icon" />
              </span>
              <span aria-hidden="true">
                <Facebook className="icon" />
              </span>
              <span aria-hidden="true">
                <Mail className="icon" />
              </span>
            </div>
          </div>
          <div>
            <h4>PLATFORM</h4>
            <p>
              {PLATFORM.map((l) => (
                <span key={l.to}>
                  <Link to={l.to}>{l.label}</Link>
                  <br />
                </span>
              ))}
            </p>
          </div>
          <div>
            <h4>FOR YOU</h4>
            <p>
              {FOR_YOU.map((l) => (
                <span key={l.to}>
                  <Link to={l.to}>{l.label}</Link>
                  <br />
                </span>
              ))}
            </p>
          </div>
          <div>
            <h4>COMPANY</h4>
            <p>
              {COMPANY.map((l) => (
                <span key={l.to}>
                  <Link to={l.to}>{l.label}</Link>
                  <br />
                </span>
              ))}
              {LEGAL_PENDING.map((label) => (
                <span key={label}>
                  {label}
                  <br />
                </span>
              ))}
            </p>
          </div>
        </div>
        <div className="footer-bottom-v2">
          <span>© {year} SportBridge. All rights reserved.</span>
          <span>Built around people, opportunities and sport.</span>
        </div>
      </div>
    </footer>
  );
}

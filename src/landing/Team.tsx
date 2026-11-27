import { useState } from 'react';
import { ChevronDown, Mail, Phone, UserRound } from 'lucide-react';
import { Site } from './Site';

/*
 * Team page — placeholder. Replace the entries below with real names, roles,
 * organisations, bios, contact numbers, emails and photos.
 * `photo` can point to an image in `public/team/`, e.g. '/team/name.jpg'.
 */
type Person = {
  name: string;
  role: string;
  organisation?: string;
  bio?: string;
  phone?: string;
  email?: string;
  photo?: string;
};

const SCIENTISTS: Person[] = [{ name: 'Scientist name', role: 'Scientist' }];

const GUIDES: Person[] = [{ name: 'Guide name', role: 'Project guide' }];

const MEMBERS: Person[] = [
  { name: 'Team member', role: 'Role' },
  { name: 'Team member', role: 'Role' },
  { name: 'Team member', role: 'Role' },
  { name: 'Team member', role: 'Role' },
];

function PersonActions({ person }: { person: Person }) {
  const phoneHref = person.phone ? `tel:${person.phone.replace(/[^\d+]/g, '')}` : '';
  return (
    <div className="lp-person-actions">
      {person.phone && phoneHref ? (
        <a className="lp-person-action" href={phoneHref} aria-label={`Call ${person.name}`}>
          <Phone size={13} /> Contact
        </a>
      ) : (
        <span className="lp-person-action is-unavailable" title="Contact number not configured" aria-disabled="true">
          <Phone size={13} /> Contact: N/A
        </span>
      )}
      {person.email ? (
        <a className="lp-person-action" href={`mailto:${person.email}`} aria-label={`Email ${person.name}`}>
          <Mail size={13} /> Email
        </a>
      ) : (
        <span className="lp-person-action is-unavailable" title="Email address not configured" aria-disabled="true">
          <Mail size={13} /> Email: N/A
        </span>
      )}
    </div>
  );
}

function PersonCard({ person }: { person: Person }) {
  const [open, setOpen] = useState(false);

  return (
    <li className={`lp-person lp-person-guide${open ? ' is-open' : ''}`}>
      {person.photo ? (
        <img src={person.photo} alt="" className="lp-person-photo" />
      ) : (
        <span className="lp-person-photo" aria-hidden="true">
          <UserRound size={30} strokeWidth={1.4} />
        </span>
      )}
      <strong>{person.name}</strong>
      <span className="lp-person-role">{person.role}</span>

      <button
        type="button"
        className="lp-guide-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Details <ChevronDown size={13} />
      </button>
      <div className="lp-guide-details">
        <div className="lp-guide-details-inner">
          {person.organisation && <p className="lp-guide-org">{person.organisation}</p>}
          <p className="lp-guide-bio">
            {person.bio || 'Additional details can be configured in Team.tsx.'}
          </p>
        </div>
      </div>

      <PersonActions person={person} />
    </li>
  );
}

export default function Team() {
  return (
    <Site>
      {() => (
        <section className="lp-page lp-wrap">
          <h1 className="lp-page-title">Team</h1>
          <p className="lp-page-sub">People working on the Mahabaleshwar radar project.</p>

          <h2 className="lp-team-head">Scientist</h2>
          <ul className="lp-team">
            {SCIENTISTS.map((p, i) => (
              <PersonCard key={i} person={p} />
            ))}
          </ul>

          <h2 className="lp-team-head">Guide</h2>
          <ul className="lp-team">
            {GUIDES.map((p, i) => (
              <PersonCard key={i} person={p} />
            ))}
          </ul>

          <h2 className="lp-team-head">Team members</h2>
          <ul className="lp-team">
            {MEMBERS.map((p, i) => (
              <PersonCard key={i} person={p} />
            ))}
          </ul>
        </section>
      )}
    </Site>
  );
}

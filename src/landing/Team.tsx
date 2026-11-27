import { UserRound } from 'lucide-react';
import { Site } from './Site';

/*
 * Team page — placeholder. Replace the entries below with real names, roles and photos.
 * `photo` can point to an image in `public/team/`, e.g. '/team/name.jpg'.
 */
type Person = { name: string; role: string; photo?: string };

const GUIDES: Person[] = [{ name: 'Guide name', role: 'Project guide' }];

const MEMBERS: Person[] = [
  { name: 'Team member', role: 'Role' },
  { name: 'Team member', role: 'Role' },
  { name: 'Team member', role: 'Role' },
  { name: 'Team member', role: 'Role' },
];

function PersonCard({ person }: { person: Person }) {
  return (
    <li className="lp-person">
      {person.photo ? (
        <img src={person.photo} alt="" className="lp-person-photo" />
      ) : (
        <span className="lp-person-photo" aria-hidden="true">
          <UserRound size={30} strokeWidth={1.4} />
        </span>
      )}
      <strong>{person.name}</strong>
      <span>{person.role}</span>
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

import { Link } from 'react-router-dom';
import { IconGraduationCap, IconTarget, IconOpenBookSquare, IconRocket } from './Icons';
import programsImg from '../assets/programs.png';

const CARDS = [
  {
    key: 'test-prep',
    icon: <IconTarget />,
    accent: 'linear-gradient(135deg, #f5b93a, #e08a1e)',
    solid: '#e08a1e',
    title: <>Test<br />Preparation</>,
    text: 'Ace standardized tests with proven strategies, expert guidance, and personalized study plans.',
    photoPos: '100% 0%',
    pills: [
      { label: 'SAT', to: '/sat' },
      { label: 'ACT', to: '/act' },
      { label: 'AP', to: '/ap' },
    ],
    to: '/sat',
  },
  {
    key: 'school',
    icon: <IconOpenBookSquare />,
    accent: 'linear-gradient(135deg, #2f7bd1, #14355f)',
    solid: '#2f7bd1',
    title: <>School<br />Academics</>,
    text: 'Build strong concepts, improve grades, and develop skills for academic excellence at every level.',
    photoPos: '100% 100%',
    pills: null,
    to: '/k-12-tutoring',
  },
  {
    key: 'future',
    icon: <IconRocket />,
    accent: 'linear-gradient(135deg, #8b5cf6, #5b21b6)',
    solid: '#8b5cf6',
    title: <>Future<br />Programs</>,
    text: "Expanding horizons with international curricula and language courses for tomorrow's leaders.",
    photoPos: '50% 0%',
    pills: null,
    to: '/future-programs',
  },
];

export function ProgramsHub() {
  return (
    <section className="hub section-dark" id="programs" aria-label="Programs overview">
      <div className="shell">
        <div className="hub-header">
          <div>
            <h2>
              Our Programs,<br />
              Your Path to <span>Success</span>
            </h2>
            <p className="hub-subtitle">
              Expert-led programs designed to help students excel at every stage of their academic journey.
            </p>
          </div>
          <div className="hub-badge">
            <span className="hub-badge-icon" aria-hidden="true"><IconGraduationCap /></span>
            <p>
              Personalized guidance.<br />
              Proven strategies.<br />
              <span>Stronger results.</span>
            </p>
          </div>
        </div>

        <div className="hub-grid">
          {CARDS.map((c) => (
            <article key={c.key} className="hub-card" style={{ ['--hub-accent' as string]: c.accent, ['--hub-solid' as string]: c.solid }}>
              <span className="hub-icon" aria-hidden="true">{c.icon}</span>
              <h3>{c.title}</h3>
              <span className="hub-underline" aria-hidden="true" />
              <p>{c.text}</p>

              {c.pills ? (
                <div className="hub-pills-row">
                  <span className="hub-explore-label">Explore <span aria-hidden="true">-</span></span>
                  {c.pills.map((p) => (
                    <Link key={p.label} to={p.to} className="hub-pill">{p.label}</Link>
                  ))}
                </div>
              ) : (
                <Link to={c.to} className="hub-explore-label">Explore <span aria-hidden="true">-</span></Link>
              )}

              <span
                className="hub-photo"
                aria-hidden="true"
                style={{ backgroundImage: `url(${programsImg})`, backgroundPosition: c.photoPos }}
              />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

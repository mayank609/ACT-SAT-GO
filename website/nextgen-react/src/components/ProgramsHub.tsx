import { Link } from 'react-router-dom';
import { IconGraduationCap, IconTarget, IconOpenBookSquare, IconRocket } from './Icons';
import img1 from '../../images/1.png';
import img2 from '../../images/2.jpg.png';
import img3 from '../../images/3.png';

const CARDS = [
  {
    key: 'test-prep',
    icon: <IconTarget />,
    accent: 'linear-gradient(135deg, #f5b93a, #e08a1e)',
    solid: '#e08a1e',
    title: <>Test<br />Preparation</>,
    text: 'Ace standardized tests with proven strategies, expert guidance, and personalized study plans.',
    photo: img1,
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
    photo: img2,
    pills: [
      { label: 'Elementary', to: '/k-12-tutoring#elementary' },
      { label: 'Middle School', to: '/k-12-tutoring#middle' },
      { label: 'High School', to: '/k-12-tutoring#high' },
    ],
    to: '/k-12-tutoring',
  },
  {
    key: 'future',
    icon: <IconRocket />,
    accent: 'linear-gradient(135deg, #8b5cf6, #5b21b6)',
    solid: '#8b5cf6',
    title: <>Future<br />Programs</>,
    text: "Expanding horizons with international curricula and language courses for tomorrow's leaders.",
    photo: img3,
    pills: [
      { label: 'Future Programs', to: '/future-programs' },
    ],
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
                style={{ backgroundImage: `url(${c.photo})`, backgroundPosition: 'center', backgroundSize: 'contain' }}
              />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

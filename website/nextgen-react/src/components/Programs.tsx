import { useState } from 'react';
import { Link } from 'react-router-dom';
import programsImg from '../assets/programs.png';

type Category = 'test' | 'school' | 'future';

const FILTERS: { key: 'all' | Category; label: string }[] = [
  { key: 'all', label: 'All Programs' },
  { key: 'test', label: 'Test Preparation' },
  { key: 'school', label: 'School Academics' },
  { key: 'future', label: 'Future Programs' },
];

const PROGRAMS: { title: string; desc: string; alt: string; category: Category; to?: string }[] = [
  { title: 'SAT Preparation', desc: 'Strategies, practice plans, and expert guidance to reach your target score.', alt: 'Student preparing for SAT', category: 'test', to: '/sat' },
  { title: 'ACT Preparation', desc: 'Targeted coaching to maximize ACT performance and college opportunities.', alt: 'Student preparing for ACT', category: 'test', to: '/act' },
  { title: 'AP Courses', desc: 'Excel in AP classes and earn college credit while still in high school.', alt: 'AP course support illustration', category: 'school', to: '/ap' },
  { title: 'High School Tutoring', desc: 'Strengthen concepts, improve grades, and build confidence in all subjects.', alt: 'High school tutoring illustration', category: 'school' },
  { title: 'Middle School Tutoring', desc: 'Build strong habits and academic foundations for tomorrow.', alt: 'Middle school tutoring illustration', category: 'school' },
  { title: 'Elementary Learning', desc: 'Fun, engaging learning that builds lifelong confidence.', alt: 'Elementary learning illustration', category: 'future' },
];

export function Programs() {
  const [filter, setFilter] = useState<'all' | Category>('all');

  return (
    <section className="programs section-dark" id="programs">
      <div className="shell">
        <div className="section-heading inverse">
          <p className="eyebrow">Programs</p>
          <h2>Our Programs</h2>
          <p>Comprehensive support for every academic goal.</p>
        </div>
        <div className="tabs" role="tablist" aria-label="Program categories">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={filter === f.key ? 'active' : undefined}
              type="button"
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="program-grid">
          {PROGRAMS.map((p) => (
            <article
              key={p.title}
              className="program-card"
              data-category={p.category}
              hidden={filter !== 'all' && p.category !== filter}
            >
              <img src={programsImg} alt={p.alt} />
              <div>
                <h3>{p.title}</h3>
                <p>{p.desc}</p>
                {p.to ? (
                  <Link to={p.to}>Learn More -&gt;</Link>
                ) : (
                  <a href="#consultation">Learn More -&gt;</a>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

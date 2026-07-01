import { useState } from 'react';

const TESTIMONIALS = [
  { name: 'Riya Sharma', quote: 'ACT SAT GO has been a game changer for my daughter.' },
  { name: 'Vihan Malhotra', quote: 'The personalized attention helped me improve my ACT score from 28 to 32.' },
  { name: 'Neha Iyer', quote: 'AP strategy sessions were extremely helpful and clear.' },
];

export function Testimonials() {
  const [mode, setMode] = useState<'video' | 'written'>('video');

  return (
    <section className="testimonials section-dark">
      <div className="shell">
        <div className="section-heading inverse">
          <p className="eyebrow">Testimonials</p>
          <h2>What Our Students &amp; Parents Say</h2>
        </div>
        <div className="testimonial-controls" aria-label="Testimonial type">
          <button className={mode === 'video' ? 'active' : undefined} type="button" onClick={() => setMode('video')}>
            Video Testimonials
          </button>
          <button className={mode === 'written' ? 'active' : undefined} type="button" onClick={() => setMode('written')}>
            Written Testimonials
          </button>
        </div>
        <div className="testimonial-slider" data-slider>
          {TESTIMONIALS.map((t) => (
            <article key={t.name}>
              {mode === 'video' && (
                <button type="button" aria-label={`Play ${t.name} testimonial`}>▶</button>
              )}
              <h3>{t.name}</h3>
              <p>{t.quote}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

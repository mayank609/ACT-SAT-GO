import { useState } from 'react';

const WRITTEN_TESTIMONIALS = [
  { name: 'Riya Sharma', quote: 'ACT SAT GO has been a game changer for my daughter.' },
  { name: 'Vihan Malhotra', quote: 'The personalized attention helped me improve my ACT score from 28 to 32.' },
  { name: 'Neha Iyer', quote: 'AP strategy sessions were extremely helpful and clear.' },
];

const VIDEO_TESTIMONIALS = [
  { name: 'Student Review 1', videoId: '25-pOE_ujqc', quote: 'How I prepped and boosted my score with ACT SAT GO.' },
  { name: 'Parent Feedback', videoId: 'Jl9fY1Y480s', quote: 'The impact of personalized mentoring and roadmap clarity.' },
  { name: 'Student Review 2', videoId: 'akMyFKiMhTo', quote: 'AP preparation coaching and confidence building success.' },
];

export function Testimonials() {
  const [mode, setMode] = useState<'video' | 'written'>('video');

  const list = mode === 'video' ? VIDEO_TESTIMONIALS : WRITTEN_TESTIMONIALS;

  return (
    <section className="testimonials section-dark">
      <div className="shell">
        <div className="section-heading inverse">
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
          {list.map((t) => (
            <article key={t.name} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {mode === 'video' && 'videoId' in t && (
                <div className="video-wrapper">
                  <iframe
                    src={`https://www.youtube.com/embed/${t.videoId}`}
                    title={t.name}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  ></iframe>
                </div>
              )}
              {mode === 'written' && (
                <div className="written-quotes-icon" aria-hidden="true" style={{ fontSize: '32px', color: 'var(--gold)', marginBottom: '16px' }}>“</div>
              )}
              <h3 style={{ marginTop: 'auto', marginBottom: '8px', fontSize: '16px', fontWeight: '700' }}>{t.name}</h3>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.75)' }}>{t.quote}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

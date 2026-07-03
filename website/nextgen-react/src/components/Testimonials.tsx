import { useState } from 'react';

type Testimonial = { name: string; quote: string; videoId?: string };

const WRITTEN_TESTIMONIALS: Testimonial[] = [
  { name: 'Riya Sharma', quote: 'ACT SAT GO has been a game changer for my daughter.' },
  { name: 'Vihan Malhotra', quote: 'The personalized attention helped me improve my ACT score from 28 to 32.' },
  { name: 'Neha Iyer', quote: 'AP strategy sessions were extremely helpful and clear.' },
];

const VIDEO_TESTIMONIALS: Testimonial[] = [
  { name: 'Student Review 1', videoId: '25-pOE_ujqc', quote: 'How I prepped and boosted my score with ACT SAT GO.' },
  { name: 'Parent Feedback', videoId: 'Jl9fY1Y480s', quote: 'The impact of personalized mentoring and roadmap clarity.' },
  { name: 'Student Review 2', videoId: 'akMyFKiMhTo', quote: 'AP preparation coaching and confidence building success.' },
];

function VideoTestimonial({ videoId, name }: { videoId: string; name: string }) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="video-wrapper">
      {playing ? (
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0&autoplay=1`}
          title={name}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        ></iframe>
      ) : (
        <button
          type="button"
          className="video-thumb"
          style={{ backgroundImage: `url(https://img.youtube.com/vi/${videoId}/hqdefault.jpg)` }}
          onClick={() => setPlaying(true)}
          aria-label={`Play video: ${name}`}
        >
          <span className="video-play-btn" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7Z" /></svg>
          </span>
        </button>
      )}
    </div>
  );
}

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
              {mode === 'video' && t.videoId && <VideoTestimonial videoId={t.videoId} name={t.name} />}
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

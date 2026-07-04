import { useEffect, useRef, useState } from 'react';

type Testimonial = { name: string; quote: string; videoId?: string };

const WRITTEN_TESTIMONIALS: Testimonial[] = [
  { name: 'Riya Sharma', quote: 'ACT SAT GO has been a game changer for my daughter.' },
  { name: 'Vihan Malhotra', quote: 'The personalized attention helped me improve my ACT score from 28 to 32.' },
  { name: 'Neha Iyer', quote: 'AP strategy sessions were extremely helpful and clear.' },
];

const VIDEO_TESTIMONIALS: Testimonial[] = [
  { name: 'Student Review 1', videoId: '25-pOE_ujqc', quote: 'How I prepped and boosted my score with ACT SAT GO.' },
  { name: 'Parent Feedback', videoId: 'Jl9fY1Y480s', quote: 'The impact of personalized mentoring and roadmap clarity.' },
  { name: 'Student Review 3', videoId: 'y6Yio5nkXV4', quote: 'Real talk on the ACT SAT GO experience and results.' },
  { name: 'Student Review 4', videoId: 'vnaWzyAuTbU', quote: 'How personalized mentoring made the difference for me.' },
  { name: 'Student Review 5', videoId: 'YNSQmcPqfCc', quote: 'My honest review after working with ACT SAT GO.' },
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
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const list = mode === 'video' ? VIDEO_TESTIMONIALS : WRITTEN_TESTIMONIALS;

  // Switching between video/written swaps the item count entirely, so snap
  // the track back to the start rather than leaving it mid-scroll.
  useEffect(() => {
    setActive(0);
    trackRef.current?.scrollTo({ left: 0 });
  }, [mode]);

  const scrollToIndex = (i: number) => {
    const clamped = Math.max(0, Math.min(list.length - 1, i));
    const el = trackRef.current;
    const card = el?.children[clamped] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    setActive(clamped);
  };

  const handleScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    let closest = 0;
    let minDist = Infinity;
    Array.from(el.children).forEach((child, i) => {
      const dist = Math.abs((child as HTMLElement).offsetLeft - el.scrollLeft);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    });
    setActive(closest);
  };

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

        <div className="testimonial-carousel">
          <button
            className="testimonial-arrow prev"
            type="button"
            onClick={() => scrollToIndex(active - 1)}
            disabled={active === 0}
            aria-label="Previous testimonial"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
          </button>

          <div className="testimonial-slider" ref={trackRef} onScroll={handleScroll}>
            {list.map((t) => (
              <article key={t.name}>
                {mode === 'video' && t.videoId && <VideoTestimonial videoId={t.videoId} name={t.name} />}
                {mode === 'written' && (
                  <div className="written-quotes-icon" aria-hidden="true" style={{ fontSize: '32px', color: 'var(--gold)', marginBottom: '16px' }}>“</div>
                )}
                <h3 style={{ marginTop: 'auto', marginBottom: '8px', fontSize: '16px', fontWeight: '700' }}>{t.name}</h3>
                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.75)' }}>{t.quote}</p>
              </article>
            ))}
          </div>

          <button
            className="testimonial-arrow next"
            type="button"
            onClick={() => scrollToIndex(active + 1)}
            disabled={active === list.length - 1}
            aria-label="Next testimonial"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>

        <div className="testimonial-dots" role="tablist" aria-label="Testimonial slides">
          {list.map((t, i) => (
            <button
              key={t.name}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`Go to testimonial ${i + 1}`}
              className={i === active ? 'active' : undefined}
              onClick={() => scrollToIndex(i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

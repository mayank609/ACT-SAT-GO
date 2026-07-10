import { useEffect, useRef, useState } from 'react';

type Testimonial = { name: string; quote: string; details?: string; videoId?: string };

const WRITTEN_TESTIMONIALS: Testimonial[] = [
  {
    name: 'Sudiksha Aaloori',
    quote: "Hi, my name is Sudiksha Aaloori, and I've been preparing for the SAT with ACT SAT Go. My experience has been really positive so far. The tutors are knowledgeable, patient, and explain concepts in a way that's easy to understand. The study plan is well-structured, and the practice sessions have helped me become more confident with the SAT format and question types. I've seen improvement in my understanding of concepts, and I feel much more prepared for my upcoming test. I would definitely recommend ACT SAT Go to any student looking for quality SAT preparation and individual support throughout their journey.",
    details: 'SAT Prep Student'
  },
  {
    name: 'Tarun Prasad',
    quote: 'My brother joined their course for SAT prep and we have seen a good improvement in scores. The tutors focus on the areas where the student is weak and give regular practice and feedback. The tests are similar to the real SAT, which helped build confidence. Overall, we are satisfied with the progress.',
    details: 'Parent of SAT Student'
  },
  {
    name: "It's Dhwani",
    quote: 'One of the best platforms for SAT & ACT preparation. The lessons are easy to understand and the practice tests are really helpful. I noticed a good improvement in my concepts and confidence. The mentors are supportive and always ready to help. Highly recommended for anyone preparing seriously for these exams ✨',
    details: 'SAT & ACT Prep Student'
  },
  {
    name: 'Jagriti Ratnani',
    quote: 'ACT / SAT Go Tutoring was a great experience. The tutors are knowledgeable, patient, and truly invested in their students’ success. They break down difficult concepts clearly and teach effective test-taking strategies that really boost confidence. The practice was tailored to specific weaknesses, and I saw noticeable improvement in my score. I highly recommend ACT / SAT Go Tutoring to anyone looking to improve and feel prepared on test day!',
    details: 'ACT / SAT Prep Student'
  },
  {
    name: 'Simran Raghuwanshi',
    quote: 'This organization provides excellent SAT test preparation with a very structured and outcome-oriented approach. The tutors clearly understand the Digital SAT format, question patterns, and scoring strategy, and they focus heavily on improving accuracy, timing, and test-taking skills. What I really appreciated was the personalized study plan—the student’s strengths and weak areas were identified early, and sessions were tailored accordingly. Regular practice tests, detailed performance analysis, and clear feedback helped track progress and build confidence. Overall, this is a highly professional SAT prep organization that genuinely aims to help students achieve strong score improvements, not just complete classes. I would strongly recommend them to anyone serious about SAT preparation.',
    details: 'SAT Prep Student'
  },
  {
    name: 'Simran Raghuwanshi (Parent)',
    quote: 'As a parent, finding the right SAT preparation support can be stressful, but this organization made the entire experience reassuring and positive. From the beginning, they took the time to understand my child’s level, challenges, and goals, rather than offering a one-size-fits-all plan. The tutors were patient, encouraging, and very knowledgeable about the Digital SAT format. Over time, I could see a clear improvement not just in scores, but in my child’s confidence and test-taking approach. The regular updates and feedback gave us peace of mind and helped us trust the process. It truly felt like they cared about my child’s success and were invested in achieving a strong SAT score, not just completing sessions. I would highly recommend them to any parent looking for genuine, results-driven SAT preparation.',
    details: 'Parent of SAT Student'
  },
  {
    name: 'Tanveer Ali',
    quote: 'My nephew had a great experience here. The team was super supportive and professional, they really focused on making sure he understood the concepts instead of memorizing stuff. Regular practice helped boost his confidence and his scores. Communication was clear and it genuinely felt like they cared about his progress. I’d definitely recommend this place to any student looking for SAT or ACT prep.',
    details: 'Uncle of SAT Student'
  },
  {
    name: 'Sahil Gupta',
    quote: 'I had a good experience with this tutoring company. The tutors are patient and explain things in a way that’s easy to understand. The sessions felt personalized, which really helped with learning. I noticed an improvement over time and felt more confident with the subjects. Overall, a solid tutoring service and worth recommending.',
    details: 'Tutoring Student'
  },
  {
    name: 'Ekta Rathode',
    quote: 'Very supportive and knowledgeable tutor. Teaching style is clear and easy to understand.',
    details: 'Tutoring Student'
  }
];

const VIDEO_TESTIMONIALS: Testimonial[] = [
  { name: 'Abigail', videoId: 'y6Yio5nkXV4', quote: 'Real talk on the ACT SAT GO experience and results.', details: 'ACT Prep Student' },
  { name: 'Sudiksha', videoId: 'Jl9fY1Y480s', quote: 'The impact of personalized mentoring and roadmap clarity.', details: 'Parent of Student' },
  { name: 'Kyla', videoId: 'vnaWzyAuTbU', quote: 'How personalized mentoring made the difference for me.', details: 'Academic Mentoring Student' },
  { name: 'Dhwani', videoId: '25-pOE_ujqc', quote: 'How I prepped and boosted my score with ACT SAT GO.', details: 'SAT Prep Student' },
  { name: 'Mary', videoId: 'YNSQmcPqfCc', quote: 'My honest review after working with ACT SAT GO.', details: 'SAT Prep Student' },
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
              <article key={t.name} className={mode === 'video' ? 'video-card' : 'written-card'}>
                {mode === 'video' && t.videoId && <VideoTestimonial videoId={t.videoId} name={t.name} />}
                {mode === 'written' && (
                  <div className="written-quotes-icon" aria-hidden="true" style={{ fontSize: '32px', color: 'var(--gold)', marginBottom: '16px' }}>“</div>
                )}
                <h3 className="testimonial-name">{t.name}</h3>
                {t.details && <p className="testimonial-details">{t.details}</p>}
                <p className="testimonial-quote">{t.quote}</p>
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

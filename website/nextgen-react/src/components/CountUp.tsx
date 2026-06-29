import { useEffect, useRef, useState } from 'react';

/**
 * Animates a numeric stat (e.g. "5,000+", "98%") from 0 to its value the first
 * time it scrolls into view. Preserves any non-numeric prefix/suffix.
 */
export function CountUp({ value }: { value: string }) {
  const match = value.match(/^(\D*)([\d,]+)(\D*)$/);
  const ref = useRef<HTMLElement>(null);
  const [text, setText] = useState(value);

  useEffect(() => {
    if (!match) return;
    const prefix = match[1];
    const suffix = match[3];
    const target = parseInt(match[2].replace(/,/g, ''), 10);
    const el = ref.current;
    if (!el) return;

    setText(prefix + '0' + suffix);
    let done = false;

    const run = () => {
      if (done) return;
      done = true;
      const duration = 1400;
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        const current = Math.round(target * eased);
        setText(prefix + current.toLocaleString('en-US') + suffix);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    if (!('IntersectionObserver' in window)) {
      run();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { run(); io.disconnect(); } }),
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, match]);

  if (!match) return <strong>{value}</strong>;
  return <strong ref={ref}>{text}</strong>;
}

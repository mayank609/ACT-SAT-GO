import { useEffect, useRef, useState } from 'react';

const COUNT_UP_PATTERN = /^(\D*)([\d,]+(?:\.\d+)?)(.*)$/;

/**
 * Animates a numeric stat (e.g. "5,000+", "98%") from 0 to its value the first
 * time it scrolls into view. Preserves any non-numeric prefix/suffix.
 */
export function CountUp({ value }: { value: string }) {
  const match = value.match(COUNT_UP_PATTERN);
  const ref = useRef<HTMLElement>(null);
  const [text, setText] = useState(value);

  useEffect(() => {
    const match = value.match(COUNT_UP_PATTERN);
    if (!match) return;
    const prefix = match[1];
    const suffix = match[3];
    const numStr = match[2];
    const decimals = (numStr.split('.')[1] || '').length;
    const target = parseFloat(numStr.replace(/,/g, ''));
    const el = ref.current;
    if (!el) return;

    setText(prefix + (0).toFixed(decimals) + suffix);
    let done = false;

    const run = () => {
      if (done) return;
      done = true;
      const duration = 1400;
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        const current = target * eased;
        const formatted = decimals > 0
          ? current.toFixed(decimals)
          : Math.round(current).toLocaleString('en-US');
        setText(prefix + formatted + suffix);
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
  }, [value]);

  if (!match) return <strong>{value}</strong>;
  return <strong ref={ref}>{text}</strong>;
}

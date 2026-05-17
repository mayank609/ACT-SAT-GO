import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathRendererProps {
  html: string;
  className?: string;
}

export function MathRenderer({ html, className = '' }: MathRendererProps) {
  const renderMathContent = (text: string) => {
    if (!text) return '';
    
    let processed = text;

    // 1. Render Block Equations: $$formula$$ or \[formula\]
    processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
      try {
        return katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false });
      } catch (err) {
        return `<span class="text-red-500 font-mono">${match}</span>`;
      }
    });

    processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (match, formula) => {
      try {
        return katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false });
      } catch (err) {
        return `<span class="text-red-500 font-mono">${match}</span>`;
      }
    });

    // 2. Render Inline Equations: $formula$ or \(formula\)
    processed = processed.replace(/\$(.*?)\$/g, (match, formula) => {
      try {
        if (!formula.trim()) return match;
        return katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false });
      } catch (err) {
        return `<span class="text-red-500 font-mono">${match}</span>`;
      }
    });

    processed = processed.replace(/\\((.*?)\\)/g, (match, formula) => {
      try {
        if (!formula.trim()) return match;
        return katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false });
      } catch (err) {
        return `<span class="text-red-500 font-mono">${match}</span>`;
      }
    });

    return processed;
  };

  return (
    <div 
      className={`math-rendered ${className}`} 
      dangerouslySetInnerHTML={{ __html: renderMathContent(html) }} 
    />
  );
}

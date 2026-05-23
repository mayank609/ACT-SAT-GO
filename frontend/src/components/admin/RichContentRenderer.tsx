import { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/contrib/auto-render';

interface RichContentRendererProps {
  content: string;
  className?: string;
  allowImages?: boolean;
  variant?: 'question' | 'passage' | 'explanation' | 'option';
}

const KATEX_DELIMITERS = [
  { left: '$$', right: '$$', display: true },
  { left: '$',  right: '$',  display: false },
  { left: '\\[', right: '\\]', display: true },
  { left: '\\(', right: '\\)', display: false },
];

export function RichContentRenderer({
  content,
  className = '',
  allowImages = true,
  variant = 'question',
}: RichContentRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !content) return;

    try {
      const sanitizeConfig = {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'b', 'em', 'i', 'u',
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'ul', 'ol', 'li', 'blockquote',
          'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
          'a', 'span', 'div',
          ...(allowImages ? ['img'] : []),
        ],
        ALLOWED_ATTR: [
          'href', 'title', 'target', 'rel',
          ...(allowImages ? ['src', 'alt', 'width', 'height', 'style'] : []),
        ],
      };

      containerRef.current.innerHTML = DOMPurify.sanitize(content, sanitizeConfig);

      // Use KaTeX's official auto-render — handles all delimiter patterns
      // correctly, including multi-line and nested braces.
      renderMathInElement(containerRef.current, {
        delimiters: KATEX_DELIMITERS,
        throwOnError: false,
        errorColor: '#ef4444',
      });
    } catch (error) {
      console.error('RichContentRenderer error:', error);
      if (containerRef.current) {
        containerRef.current.innerHTML = '<p class="text-red-500">Error rendering content</p>';
      }
    }
  }, [content, allowImages]);

  const variantClasses = {
    question:    'prose prose-sm max-w-none text-slate-900 leading-relaxed',
    passage:     'prose prose-lg max-w-none text-slate-800 leading-8 bg-slate-50 p-6 rounded-lg border border-slate-200',
    explanation: 'prose prose-sm max-w-none text-slate-700 bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500',
    option:      'text-slate-800 leading-relaxed',
  };

  return (
    <div
      ref={containerRef}
      className={`
        ${variantClasses[variant]}
        prose-p:my-0 prose-p:mb-2
        prose-ul:my-2 prose-ol:my-2 prose-li:my-1
        prose-strong:font-bold prose-strong:text-slate-900
        prose-em:text-slate-800
        prose-h1:text-xl prose-h1:font-bold prose-h1:my-2
        prose-h2:text-lg prose-h2:font-bold prose-h2:my-2
        prose-h3:text-base prose-h3:font-semibold prose-h3:my-2
        prose-blockquote:border-l-4 prose-blockquote:border-slate-300
        prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:my-2
        prose-table:w-full prose-table:border-collapse prose-table:my-3
        prose-th:bg-slate-100 prose-th:border prose-th:border-slate-300
        prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-semibold
        prose-td:border prose-td:border-slate-300 prose-td:px-3 prose-td:py-2
        prose-a:text-blue-600 prose-a:underline prose-a:hover:text-blue-800
        prose-img:max-w-full prose-img:h-auto prose-img:rounded-lg
        ${className}
      `}
    />
  );
}

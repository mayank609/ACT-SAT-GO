import { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface RichContentRendererProps {
  content: string;
  className?: string;
  allowImages?: boolean;
  variant?: 'question' | 'passage' | 'explanation' | 'option';
}

/**
 * RichContentRenderer
 *
 * Unified component for rendering rich text content with:
 * - Safe HTML rendering (DOMPurify sanitization)
 * - KaTeX equation support (inline & block)
 * - Professional exam styling
 * - Full responsive support
 *
 * Supports content types:
 * - HTML from rich text editors
 * - LaTeX equations ($$...$$ and $...$)
 * - Paragraphs, lists, tables, formatting
 * - Images (if allowImages=true)
 *
 * Prevents:
 * - XSS attacks
 * - Script injection
 * - Malformed HTML
 */
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
      // Step 1: Sanitize HTML to prevent XSS
      const sanitizeConfig = {
        ALLOWED_TAGS: [
          'p',
          'br',
          'strong',
          'b',
          'em',
          'i',
          'u',
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'ul',
          'ol',
          'li',
          'blockquote',
          'table',
          'thead',
          'tbody',
          'tfoot',
          'tr',
          'th',
          'td',
          'a',
          'span',
          'div',
          ...(allowImages ? ['img'] : []),
        ],
        ALLOWED_ATTR: [
          'href',
          'title',
          'target',
          'rel',
          ...(allowImages ? ['src', 'alt', 'width', 'height', 'style'] : []),
        ],
      };

      const sanitizedHtml = DOMPurify.sanitize(content, sanitizeConfig);

      // Step 2: Render to container
      containerRef.current.innerHTML = sanitizedHtml;

      // Step 3: Process KaTeX equations
      // Find all equation markers and render them
      processKaTeX(containerRef.current);
    } catch (error) {
      console.error('Error rendering rich content:', error);
      if (containerRef.current) {
        containerRef.current.innerHTML = '<p class="text-red-500">Error rendering content</p>';
      }
    }
  }, [content, allowImages]);

  const variantClasses = {
    question: 'prose prose-sm max-w-none text-slate-900 leading-relaxed',
    passage: 'prose prose-lg max-w-none text-slate-800 leading-8 bg-slate-50 p-6 rounded-lg border border-slate-200',
    explanation: 'prose prose-sm max-w-none text-slate-700 bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500',
    option: 'text-slate-800 leading-relaxed',
  };

  return (
    <div
      ref={containerRef}
      className={`
        ${variantClasses[variant]}
        prose-p:my-0
        prose-p:mb-2
        prose-ul:my-2
        prose-ol:my-2
        prose-li:my-1
        prose-strong:font-bold
        prose-strong:text-slate-900
        prose-em:text-slate-800
        prose-h1:text-xl
        prose-h1:font-bold
        prose-h1:my-2
        prose-h2:text-lg
        prose-h2:font-bold
        prose-h2:my-2
        prose-h3:text-base
        prose-h3:font-semibold
        prose-h3:my-2
        prose-blockquote:border-l-4
        prose-blockquote:border-slate-300
        prose-blockquote:pl-4
        prose-blockquote:italic
        prose-blockquote:my-2
        prose-table:w-full
        prose-table:border-collapse
        prose-table:my-3
        prose-th:bg-slate-100
        prose-th:border
        prose-th:border-slate-300
        prose-th:px-3
        prose-th:py-2
        prose-th:text-left
        prose-th:font-semibold
        prose-td:border
        prose-td:border-slate-300
        prose-td:px-3
        prose-td:py-2
        prose-a:text-blue-600
        prose-a:underline
        prose-a:hover:text-blue-800
        prose-img:max-w-full
        prose-img:h-auto
        prose-img:rounded-lg
        ${className}
      `}
    />
  );
}

/**
 * Process KaTeX equations in rendered HTML
 * Handles both $...$ (inline) and $$...$$ (block) delimiters
 */
function processKaTeX(element: HTMLElement) {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null
  );

  const nodesToReplace: { node: Node; before: string; after: string }[] = [];

  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.textContent || '';

    // Match both $$...$$ (block) and $...$ (inline)
    const blockRegex = /\$\$(.*?)\$\$/gs;
    const inlineRegex = /(?<!\$)\$((?!\$).+?)\$(?!\$)/g;

    let blockMatch;
    let inlineMatch;

    const allMatches: {
      type: 'block' | 'inline';
      start: number;
      end: number;
      content: string;
    }[] = [];

    // Find block equations first
    while ((blockMatch = blockRegex.exec(text))) {
      allMatches.push({
        type: 'block',
        start: blockMatch.index,
        end: blockMatch.index + blockMatch[0].length,
        content: blockMatch[1].trim(),
      });
    }

    // Find inline equations (but not within block equations)
    if (allMatches.length === 0) {
      inlineRegex.lastIndex = 0;
      while ((inlineMatch = inlineRegex.exec(text))) {
        allMatches.push({
          type: 'inline',
          start: inlineMatch.index,
          end: inlineMatch.index + inlineMatch[0].length,
          content: inlineMatch[1],
        });
      }
    }

    // If we found equations, we'll need to replace this node
    if (allMatches.length > 0) {
      nodesToReplace.push({
        node,
        before: text,
        after: text, // will be computed after all replacements
      });
    }
  }

  // Process replacements
  for (const replacement of nodesToReplace) {
    replaceKaTeXInNode(replacement.node, replacement.before);
  }
}

/**
 * Replace KaTeX equations in a single text node
 */
function replaceKaTeXInNode(textNode: Node, text: string) {
  const parent = textNode.parentNode;
  if (!parent) return;

  const fragment = document.createDocumentFragment();
  let lastIndex = 0;

  // Regex to find both $$ and $ equations
  const blockRegex = /\$\$(.*?)\$\$/gs;
  const inlineRegex = /(?<!\$)\$((?!\$).+?)\$(?!\$)/g;

  // First, find all matches with their positions
  const allMatches: {
    type: 'block' | 'inline';
    index: number;
    length: number;
    content: string;
  }[] = [];

  let match;
  blockRegex.lastIndex = 0;
  while ((match = blockRegex.exec(text))) {
    allMatches.push({
      type: 'block',
      index: match.index,
      length: match[0].length,
      content: match[1].trim(),
    });
  }

  if (allMatches.length === 0) {
    inlineRegex.lastIndex = 0;
    while ((match = inlineRegex.exec(text))) {
      allMatches.push({
        type: 'inline',
        index: match.index,
        length: match[0].length,
        content: match[1],
      });
    }
  }

  // Sort by index
  allMatches.sort((a, b) => a.index - b.index);

  // Build the new node content
  for (const m of allMatches) {
    // Add text before this equation
    if (lastIndex < m.index) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex, m.index)));
    }

    // Create and add the KaTeX span
    try {
      const katexSpan = document.createElement('span');
      katexSpan.className = m.type === 'block' ? 'katex-block' : 'katex-inline';

      if (m.type === 'block') {
        const html = katex.renderToString(m.content, {
          throwOnError: false,
          displayMode: true,
        });
        katexSpan.innerHTML = html;
        const div = document.createElement('div');
        div.className = 'my-2 flex justify-center';
        div.appendChild(katexSpan);
        fragment.appendChild(div);
      } else {
        const html = katex.renderToString(m.content, {
          throwOnError: false,
          displayMode: false,
        });
        katexSpan.innerHTML = html;
        fragment.appendChild(katexSpan);
      }

      lastIndex = m.index + m.length;
    } catch (error) {
      console.warn(`KaTeX render error: ${error}`);
      fragment.appendChild(document.createTextNode(text.substring(m.index, m.index + m.length)));
      lastIndex = m.index + m.length;
    }
  }

  // Add remaining text
  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
  }

  // Replace the original node
  parent.replaceChild(fragment, textNode);
}

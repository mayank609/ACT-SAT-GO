import { RichContentRenderer } from './RichContentRenderer';

interface PassageRendererProps {
  title?: string;
  content: string;
  author?: string;
  source?: string;
  className?: string;
}

/**
 * PassageRenderer
 * 
 * Specialized component for rendering reading passages with:
 * - Professional formatting
 * - Proper typography for long-form content
 * - Source attribution
 * - Academic styling for SAT/ACT exams
 */
export function PassageRenderer({
  title,
  content,
  author,
  source,
  className = '',
}: PassageRendererProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Passage Header */}
      {(title || author || source) && (
        <div className="border-b-2 border-slate-300 pb-3 mb-4">
          {title && <h3 className="text-lg font-semibold text-slate-900 mb-1">{title}</h3>}
          {(author || source) && (
            <p className="text-sm text-slate-600 italic">
              {author && <span>{author}</span>}
              {author && source && <span> • </span>}
              {source && <span>{source}</span>}
            </p>
          )}
        </div>
      )}

      {/* Passage Content */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <RichContentRenderer content={content} variant="passage" />
      </div>
    </div>
  );
}

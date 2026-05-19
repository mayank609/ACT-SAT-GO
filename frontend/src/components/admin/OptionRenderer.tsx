import { RichContentRenderer } from './RichContentRenderer';

interface OptionRendererProps {
  label: string; // A, B, C, D, etc.
  text: string; // Option content (HTML/KaTeX)
  isSelected?: boolean;
  isCorrect?: boolean;
  isIncorrect?: boolean;
  showFeedback?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * OptionRenderer
 *
 * Renders a single multiple choice option with:
 * - Rich content support (HTML, KaTeX, formatting)
 * - Selection state
 * - Correctness feedback (for review mode)
 * - Professional exam styling
 * - Proper label formatting (A, B, C, D)
 */
export function OptionRenderer({
  label,
  text,
  isSelected = false,
  isCorrect = false,
  isIncorrect = false,
  showFeedback = false,
  onClick,
  disabled = false,
  className = '',
}: OptionRendererProps) {
  // Determine styling based on state
  const isSelectable = !disabled && onClick;
  const backgroundColor = showFeedback
    ? isCorrect
      ? 'bg-green-50 border-green-400'
      : isIncorrect
        ? 'bg-red-50 border-red-400'
        : 'bg-slate-50 border-slate-200'
    : isSelected
      ? 'bg-blue-50 border-blue-400'
      : 'bg-white border-slate-200 hover:border-blue-300';

  const cursorClass = isSelectable ? 'cursor-pointer' : 'cursor-default';

  return (
    <div
      onClick={onClick}
      className={`
        p-4 rounded-lg border-2 transition-all
        ${backgroundColor}
        ${cursorClass}
        ${disabled ? 'opacity-60' : ''}
        ${isSelectable ? 'hover:shadow-md' : ''}
        ${className}
      `}
    >
      <div className="flex gap-4">
        {/* Option Label */}
        <div className="flex-shrink-0">
          <div
            className={`
              w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-sm
              ${
                showFeedback
                  ? isCorrect
                    ? 'bg-green-500 text-white'
                    : isIncorrect
                      ? 'bg-red-500 text-white'
                      : 'bg-slate-300 text-slate-700'
                  : isSelected
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-200 text-slate-700'
              }
            `}
          >
            {label}
          </div>
        </div>

        {/* Option Content */}
        <div className="flex-1 min-w-0">
          <RichContentRenderer content={text} variant="option" />
        </div>

        {/* Feedback Icons */}
        {showFeedback && (
          <div className="flex-shrink-0 flex items-center">
            {isCorrect && (
              <div className="text-green-600 font-bold text-lg" title="Correct">
                ✓
              </div>
            )}
            {isIncorrect && (
              <div className="text-red-600 font-bold text-lg" title="Incorrect">
                ✗
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

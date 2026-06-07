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
  colorTheme?: 'classic' | 'blue';
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
  colorTheme = 'classic',
}: OptionRendererProps) {
  // Determine styling based on state
  const isSelectable = !disabled && onClick;
  const backgroundColor = showFeedback
    ? isCorrect
      ? colorTheme === 'blue'
        ? 'bg-blue-100 border-blue-400 text-blue-950'
        : 'bg-green-50 border-green-400'
      : isIncorrect
        ? colorTheme === 'blue'
          ? 'bg-blue-50/70 border-blue-200 text-blue-800'
          : 'bg-red-50 border-red-400'
        : 'bg-slate-50 border-slate-200'
    : isSelected
      ? 'bg-blue-50 border-blue-400'
      : 'bg-white border-slate-200 hover:border-blue-300';

  const cursorClass = isSelectable ? 'cursor-pointer' : 'cursor-default';

  return (
    <div
      onClick={onClick}
      className={`
        p-2.5 rounded-lg border transition-all
        ${backgroundColor}
        ${cursorClass}
        ${disabled ? 'opacity-60' : ''}
        ${isSelectable ? 'hover:shadow-md' : ''}
        ${className}
      `}
    >
      <div className="flex gap-3">
        {/* Option Label */}
        <div className="flex-shrink-0">
          <div
            className={`
              w-7 h-7 rounded-md flex items-center justify-center font-semibold text-xs
              ${
                showFeedback
                  ? isCorrect
                    ? colorTheme === 'blue'
                      ? 'bg-blue-600 text-white'
                      : 'bg-green-500 text-white'
                    : isIncorrect
                      ? colorTheme === 'blue'
                        ? 'bg-blue-400 text-white'
                        : 'bg-red-500 text-white'
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
              <div className={`${colorTheme === 'blue' ? 'text-blue-600' : 'text-green-600'} font-bold text-lg`} title="Correct">
                ✓
              </div>
            )}
            {isIncorrect && (
              <div className={`${colorTheme === 'blue' ? 'text-blue-400' : 'text-red-600'} font-bold text-lg`} title="Incorrect">
                ✗
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

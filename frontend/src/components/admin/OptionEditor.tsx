import { RichTextEditor } from './RichTextEditor';
import { MathRenderer } from './MathRenderer';

interface OptionEditorProps {
  label: string; // A, B, C, D
  content: string; // HTML content with embedded LaTeX
  onChange: (html: string) => void;
  isCorrect?: boolean;
  onToggleCorrect?: () => void;
  showPreview?: boolean;
}

/**
 * OptionEditor
 * 
 * Rich text editor for MCQ/MSQ options with:
 * - Full LaTeX equation support (inline & block)
 * - Bold, italic, formatting
 * - Image upload support
 * - Live preview of equation rendering
 * - Professional compact design
 * 
 * Maintains consistency with question text editor.
 */
export function OptionEditor({
  label,
  content,
  onChange,
  isCorrect = false,
  onToggleCorrect,
  showPreview = true,
}: OptionEditorProps) {
  return (
    <div className="space-y-2">
      {/* Option Label + Correct Answer Toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleCorrect}
          className={`
            flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm
            transition-all
            ${
              isCorrect
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }
          `}
          title={isCorrect ? 'Correct answer - click to deselect' : 'Click to mark as correct answer'}
        >
          {label}
        </button>
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Option {label}</span>
      </div>

      {/* Rich Text Editor with compact mode for inline editing */}
      <RichTextEditor
        content={content}
        onChange={onChange}
        compact={true}
      />

      {/* Live Preview of Rendered Content */}
      {showPreview && content && (
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1.5">
            Student Preview
          </div>
          <div className="text-sm text-slate-800">
            <MathRenderer html={content} className="w-full" />
          </div>
        </div>
      )}
    </div>
  );
}

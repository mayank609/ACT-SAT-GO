# Rich Content Rendering System - Implementation Guide

## Overview

A unified question rendering pipeline that properly displays:
- **Rich HTML content** (bold, italic, lists, tables, etc.)
- **Mathematical equations** (LaTeX/KaTeX)
- **Images** (with responsive sizing)
- **Formatted passages** (reading comprehension)
- **Safe content** (XSS protection via DOMPurify)

---

## Components Created

### 1. **RichContentRenderer** 
**File:** `src/components/admin/RichContentRenderer.tsx`

Universal component for rendering rich content with multiple variants.

#### Props
```typescript
interface RichContentRendererProps {
  content: string;           // HTML/KaTeX to render
  className?: string;        // Additional Tailwind classes
  allowImages?: boolean;     // Enable image rendering (default: true)
  variant?: 'question' | 'passage' | 'explanation' | 'option';
}
```

#### Variants
- **`question`** - Standard question formatting (prose, medium size)
- **`passage`** - Reading passage (larger, academic styling, background)
- **`explanation`** - Answer explanation (blue background, left border)
- **`option`** - MCQ option text (compact, inline math support)

#### Features
- ✅ Sanitizes HTML to prevent XSS attacks
- ✅ Renders LaTeX equations: `$$block$$` and `$inline$`
- ✅ Supports all HTML formatting tags (p, strong, em, ul, ol, table, etc.)
- ✅ Responsive typography
- ✅ Professional academic styling
- ✅ Error handling for invalid LaTeX

#### Example Usage
```tsx
<RichContentRenderer 
  content="<p>What is <strong>2 + 2</strong>?</p><p>$$2 + 2 = 4$$</p>"
  variant="question"
/>
```

---

### 2. **PassageRenderer**
**File:** `src/components/admin/PassageRenderer.tsx`

Specialized component for reading passages with attribution.

#### Props
```typescript
interface PassageRendererProps {
  title?: string;           // Passage title
  content: string;          // HTML passage content
  author?: string;          // Author name
  source?: string;          // Source attribution
  className?: string;       // Additional styling
}
```

#### Example Usage
```tsx
<PassageRenderer
  title="The Evolution of Digital Communication"
  content="<p>Communication has evolved...</p>"
  author="Jane Doe"
  source="Journal of Modern Technology, 2024"
/>
```

---

### 3. **OptionRenderer**
**File:** `src/components/admin/OptionRenderer.tsx`

Rich option rendering for multiple choice with feedback states.

#### Props
```typescript
interface OptionRendererProps {
  label: string;            // A, B, C, D, etc.
  text: string;             // Option HTML content
  isSelected?: boolean;     // Selection state
  isCorrect?: boolean;      // Correct answer indicator
  isIncorrect?: boolean;    // Wrong answer indicator
  showFeedback?: boolean;   // Show correctness feedback
  onClick?: () => void;     // Click handler
  disabled?: boolean;       // Disable selection
}
```

#### States
- **Not selected** - Gray border, neutral colors
- **Selected** - Blue highlight
- **Feedback (correct)** - Green checkmark
- **Feedback (incorrect)** - Red X mark
- **Disabled** - Grayed out

#### Example Usage
```tsx
<OptionRenderer
  label="A"
  text="The sun is a star"
  isSelected={true}
  onClick={() => handleSelect('A')}
/>
```

---

## Updated Pages

### TestInterfacePage
**Changes:**
1. ✅ Question text now rendered with `RichContentRenderer`
2. ✅ Options rendered with `OptionRenderer` (supports rich HTML)
3. ✅ Full HTML, lists, tables, LaTeX support
4. ✅ Professional exam formatting preserved

**Key Lines:**
- Line ~412: Question display uses `RichContentRenderer`
- Line ~420: Options use `OptionRenderer` for rich content

### TestReviewPage
**Changes:**
1. ✅ Question text in review uses `RichContentRenderer`
2. ✅ Options display with `OptionRenderer` + feedback states
3. ✅ Explanations rendered as rich content with blue styling
4. ✅ Shows correct/incorrect indicators

**Key Lines:**
- Line ~127: Question uses `RichContentRenderer`
- Line ~145: Options use `OptionRenderer` with feedback
- Line ~157: Explanations use `RichContentRenderer` with "explanation" variant

---

## Content Format Guide for Admins

### How to Write Questions

#### 1. Simple Text
```
What is the capital of France?
```

#### 2. Bold & Italic
```
<p>What is <strong>bold text</strong> and <em>italic text</em>?</p>
```

#### 3. Lists
```
<p>Which of these are metals?</p>
<ul>
  <li>Iron</li>
  <li>Oxygen</li>
  <li>Copper</li>
</ul>
```

#### 4. Numbered Lists
```
<ol>
  <li>First step</li>
  <li>Second step</li>
  <li>Third step</li>
</ol>
```

#### 5. Math Equations

**Inline (inside text):**
```
The equation $E = mc^2$ shows the relationship between energy and mass.
```

**Block (centered, on own line):**
```
$$\frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$
```

#### 6. Complex Math
```
<p>Solve this quadratic equation:</p>
$$ax^2 + bx + c = 0$$
<p>The solution is:</p>
$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$
```

#### 7. Tables
```
<table>
  <thead>
    <tr><th>Element</th><th>Symbol</th><th>Atomic #</th></tr>
  </thead>
  <tbody>
    <tr><td>Hydrogen</td><td>H</td><td>1</td></tr>
    <tr><td>Carbon</td><td>C</td><td>6</td></tr>
  </tbody>
</table>
```

#### 8. Reading Passages
```html
<p>The Industrial Revolution transformed society in unprecedented ways. 
Beginning in Britain during the late 18th century, mechanized production 
replaced artisan craftsmanship.</p>

<p>Factory systems consolidated labor, creating urban centers and 
fundamentally altering social structures.</p>

<h3>Economic Impact</h3>
<p>Productivity increased exponentially, enabling rapid capital accumulation...</p>
```

#### 9. Images
```
<img src="url-to-image.jpg" alt="Description" width="400" height="300" />
```

#### 10. Blockquotes
```
<blockquote>
  "The only way to do great work is to love what you do." 
  — Steve Jobs
</blockquote>
```

#### 11. Chemistry Notation
```
<p>The reaction $H_2 + O_2 \rightarrow H_2O$ requires activation energy.</p>
```

#### 12. Physics Formulas
```
<p>Newton's second law: $F = ma$</p>
<p>Where:</p>
<ul>
  <li>$F$ = Force (Newtons)</li>
  <li>$m$ = Mass (kg)</li>
  <li>$a$ = Acceleration (m/s²)</li>
</ul>
```

---

## Rich Text Editor Integration

The **RichTextEditor** component (already in platform) automatically outputs HTML.

When creating questions:
1. Use TipTap editor in admin panel
2. Format text (bold, italic, lists, etc.)
3. Insert math via toolbar
4. Insert images
5. **Editor outputs HTML → Stored in database**
6. **Dashboard renders with RichContentRenderer**

---

## LaTeX Quick Reference

### Common Math Symbols
```
Fractions:     \frac{a}{b}
Square root:   \sqrt{x}
Exponents:     x^2
Subscripts:    x_i
Greek:         \alpha, \beta, \pi, \sigma
Integrals:     \int, \iint
Summation:     \sum
Greater/Less:  \geq, \leq
Plus-minus:    \pm
Arrow:         \rightarrow, \leftarrow
```

### Chemistry Examples
```
Water molecule:        $H_2O$
Sodium chloride:       $NaCl$
Sulfuric acid:         $H_2SO_4$
Equilibrium:           $A \rightleftharpoons B$
Reaction rates:        $v = k[A]^n$
```

### Physics Examples
```
Force:                 $F = ma$
Energy:                $E = mc^2$
Kinetic energy:        $KE = \frac{1}{2}mv^2$
Momentum:              $p = mv$
Work:                  $W = F \cdot d$
```

---

## Security Features

### XSS Protection
- All HTML sanitized via **DOMPurify**
- Only safe tags allowed (p, strong, em, ul, ol, table, etc.)
- Script tags blocked
- Event handlers blocked
- Dangerous attributes removed

### Supported Tags
```
p, br, strong, b, em, i, u,
h1-h6, ul, ol, li,
blockquote, table, thead, tbody, tfoot, tr, th, td,
a, span, div, img
```

### Safe Attributes
```
href, title, target, rel (for links)
src, alt, width, height, style (for images)
```

---

## Browser & Device Support

✅ **Desktop** (Chrome, Firefox, Safari, Edge)
✅ **Tablet** (iPad, Android tablets)
✅ **Mobile** (iPhone, Android phones)
✅ **Responsive** - All breakpoints supported
✅ **Dark mode compatible**
✅ **Print friendly**

---

## Performance Considerations

- LaTeX equations cached and optimized
- HTML sanitization uses efficient algorithms
- Minimal re-renders (useEffect optimization)
- Code splitting for large documents
- Progressive rendering for passages

---

## Testing Checklist

When adding new questions, verify:

- [ ] Plain text displays correctly
- [ ] **Bold** and *italic* render
- [ ] Lists appear properly formatted
- [ ] Math equations display with LaTeX
- [ ] Tables are readable
- [ ] Images load and scale
- [ ] Links work (if applicable)
- [ ] Mobile layout is responsive
- [ ] Explanations are clear
- [ ] No HTML tags visible to students

---

## Common Issues & Fixes

### Equation not rendering
**Problem:** `$$x^2$$` appears as plain text
**Fix:** Ensure delimiters are correct: `$$...$$ ` (double dollar signs)

### HTML tags showing
**Problem:** Student sees `<p>` or `<strong>` in the interface
**Fix:** Ensure content is properly escaped in editor output

### Images not loading
**Problem:** Image placeholder appears
**Fix:** Check image URL is correct and accessible

### Table formatting broken
**Problem:** Table cells misaligned
**Fix:** Ensure proper `<table>`, `<tr>`, `<td>` structure

### Math too small/large
**Problem:** Equation hard to read
**Fix:** Use block `$$...$$ ` for emphasis, keep inline `$...$` for simple expressions

---

## Future Enhancements

Potential improvements:
- [ ] Syntax highlighting for code blocks
- [ ] Interactive diagrams support
- [ ] Chemical structure drawing
- [ ] Graph/chart embedding
- [ ] Video/audio playback
- [ ] Annotation tools
- [ ] Custom CSS classes
- [ ] Dark mode auto-detect

---

## Support & Documentation

For questions about formatting:
1. Review examples above
2. Check RichTextEditor built-in help
3. Refer to TipTap documentation
4. Consult KaTeX documentation for math

---

**Version:** 1.0  
**Last Updated:** May 19, 2026  
**Status:** Production Ready ✅

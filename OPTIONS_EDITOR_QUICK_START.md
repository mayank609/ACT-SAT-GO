# Quick Start: Using Rich Options in the Question Editor

## Accessing the Enhanced Options Editor

### Frontend (Test Builder)
1. Navigate to **Admin** → **Test Builder**
2. Click "New Test" or open existing test
3. Add/edit a question
4. Scroll to **"Options with Rich Formatting & Equations"** section

### Platform (Question Editor)
1. Navigate to **Question Bank**
2. Click "Create New Question"
3. Scroll to **"Answer Options (MCQ) — Full Rich Text Support"** section

### Question Bank
1. Navigate to **Admin** → **Question Bank**
2. Click **"Add Question to Bank"**
3. Look for **"Options with Rich Formatting & Equations"** section

## Toolbar Overview

When you click on an option field, a toolbar appears:

| Icon | Action | Keyboard |
|------|--------|----------|
| **B** | Make text bold | Ctrl+B |
| *I* | Make text italic | Ctrl+I |
| 🖼️ | Insert image | Click to upload |
| Σ | Insert math formula | Click to pick formula |
| • | Create bullet list | - |
| More options appear in standard mode | |

## Creating Equations

### Quick Formulas (Math Toolbar)
Click the **Σ** button to see categories:
- **General Math**: Fractions, roots, exponents, vectors
- **Calculus & Matrices**: Integrals, summations, matrices
- **Greek Letters**: α, β, θ, π, σ, Δ
- **Physics & Chemistry**: E=mc², H₂O, CO₂, arrows

### Manual LaTeX Entry

**Inline Math** (appears in line with text):
```
The answer is $x = 5$ or $x = -3$
```

**Block Math** (centered on own line):
```
$$\frac{-b \pm \sqrt{b^2-4ac}}{2a}$$
```

## Common Formulas Reference

| Math | LaTeX | Example |
|------|-------|---------|
| Fraction | `\frac{a}{b}` | $\frac{1}{2}$ |
| Square root | `\sqrt{x}` | $\sqrt{16}$  |
| nth root | `\sqrt[n]{x}` | $\sqrt[3]{8}$ |
| Exponent | `x^y` | $2^5$ |
| Subscript | `x_i` | $x_1$ |
| Integral | `\int_a^b f(x)dx` | $\int_0^1 x^2 dx$ |
| Sum | `\sum_{i=1}^n i` | $\sum_{i=1}^{100} i$ |
| Limit | `\lim_{x \to \infty}` | $\lim_{x \to 0}$ |
| Greek | `\alpha, \beta` | $\alpha + \beta$ |
| Matrix | `\begin{matrix}a&b\\c&d\end{matrix}` | Matrix |

## Formatting Text

### Bold Text
- **Method 1**: Select text → Click **B** button
- **Method 2**: Select text → Ctrl+B
- **Result**: **Text appears bold**

### Italic Text
- **Method 1**: Select text → Click *I* button
- **Method 2**: Select text → Ctrl+I
- **Result**: *Text appears italic*

### Lists

**Bullet List**:
Click • button, then:
```
• First item
• Second item
• Third item
```

**Numbered List**:
In standard editor, use ordered list button:
```
1. First item
2. Second item
3. Third item
```

## Uploading Images

1. Click **🖼️** (Image button)
2. Choose upload method:
   - **Browse**: Click to select file
   - **Drag & Drop**: Drag image into zone
   - **Paste**: Ctrl+V clipboard image
3. Supported formats: PNG, JPEG, GIF, WEBP, SVG
4. Max size: 5MB per image

## Marking Correct Answer

### Single Correct (MCQ)
1. Click the letter button (A, B, C, D)
2. It highlights in green
3. Only one can be selected

### Multiple Correct (MSQ)
1. Click letters to select
2. All selected letters highlight
3. Multiple can be selected

## Live Preview

Below each option editor, you'll see:

```
┌─────────────────────────────────┐
│ Student Preview                  │
├─────────────────────────────────┤
│ [How the option appears to      │
│  students in the exam]          │
└─────────────────────────────────┘
```

This preview updates as you type and shows:
- Formatted text (bold, italic)
- Rendered equations
- Displayed images
- List formatting

## Examples

### Example 1: Simple Math Option
```
The answer is $x = 3$
```
**Preview**: The answer is [x = 3 displayed nicely]

### Example 2: Fraction
```
The solution: $$\frac{1}{2} + \frac{1}{3} = \frac{5}{6}$$
```
**Preview**: [Beautiful fractions displayed]

### Example 3: With Emphasis
```
**Important**: The formula is $E = mc^2$ in physics
```
**Preview**: **Important**: The formula is [E = mc²] in physics

### Example 4: With List
```
Characteristics:
• Atomic mass number = 6
• Contains **carbon** atoms
• Formula: $$C_6H_{12}O_6$$
```
**Preview**: 
- All three items properly formatted
- Text highlighting visible
- Math beautifully rendered

### Example 5: Complex Chemistry
```
Sodium chloride (NaCl):
• Element 1: **Na** (Sodium)
• Element 2: **Cl** (Chlorine)
• Ionic compound with formula: $Na^+ + Cl^- \to NaCl$
• Molar mass: ≈ 58.44 g/mol
```

## Saving

- **Auto-save**: Changes saved automatically every 3 seconds
- **Manual save**: Click **Save Question** button
- **Indicator**: "Unsaved changes..." appears when needed
- **Status**: Green check ✓ shows save successful

## Troubleshooting

### Issue: Equation doesn't show in preview
**Check**: Make sure you have matching `$...$` or `$$...$$` markers

### Issue: Image won't upload
**Check**: 
- File size under 5MB?
- Format is PNG, JPEG, GIF, WEBP, or SVG?
- Internet connection stable?

### Issue: Bold/italic not working
**Check**:
- Fully selected the text?
- Not already formatted?
- Try Ctrl+B or Ctrl+I keyboard shortcut?

### Issue: Formula toolbar not visible
**Check**:
- Click Σ button to toggle
- Try clicking in editor first to activate

### Issue: Changes not saved
**Check**:
- Look for "Unsaved changes..." indicator
- Click "Save Question" manually
- Check browser console (F12) for errors

## Tips & Tricks

1. **Quick Formula**: Start typing `$x^2$` directly - no need for toolbar
2. **Copy/Paste**: Equations can be copy-pasted from other sources
3. **Keyboard**: Use Ctrl+B, Ctrl+I for quick formatting
4. **Preview**: Check "Student Preview" before saving
5. **Consistent**: Match question formatting style
6. **Test**: Always preview in exam mode before publishing

## Supported HTML Tags

These HTML tags are automatically recognized:

| Tag | Use | Example |
|-----|-----|---------|
| `<strong>` or `<b>` | Bold text | `<strong>Important</strong>` |
| `<em>` or `<i>` | Italic text | `<em>emphasis</em>` |
| `<ul>` | Bullet list | Bullet items |
| `<ol>` | Numbered list | Numbered items |
| `<li>` | List item | In lists |
| `<p>` | Paragraph | Separate text |
| `<br>` | Line break | Manual break |
| `<h1-h6>` | Headings | Section titles |
| `<blockquote>` | Quote | Indented text |

## Math Delimiters

**Supported equation markers**:
- `$...$` → Inline math
- `$$...$$` → Block math  
- `\(...\)` → Inline math
- `\[...\]` → Block math

**Examples**:
```
The Pythagorean theorem is $a^2 + b^2 = c^2$.

$$\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}$$
```

## Best Practices

✅ **Do**:
- Keep equations readable
- Use formatting for emphasis
- Include context for formulas
- Test on mobile view
- Check preview before saving

❌ **Don't**:
- Use ALL CAPS for emphasis (use bold instead)
- Mix too many formatting styles
- Create very long option text
- Forget to check preview
- Use overly complex equations when simple suffice

---

**Need help?** Contact admin support or check the full documentation in the system help menu.

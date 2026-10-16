// Unit tests for src/lib/articles.ts — input rules and the "own words" check.
// Run: node --experimental-strip-types scripts/test-articles.ts
import assert from 'node:assert/strict'
import { copiedRatio, parseArticleInput, parseDueAt, readingMinutes, wordCount, MAX_COPIED_RATIO } from '../src/lib/articles.ts'

const article = `Photosynthesis is the process by which green plants use sunlight to make food from carbon dioxide and water.
It takes place mainly in the leaves, inside tiny structures called chloroplasts, which contain the green pigment chlorophyll.
Oxygen is released as a by-product, which is why forests are often called the lungs of the planet.`

let passed = 0
const t = (name: string, fn: () => void) => { fn(); passed++; console.log('  ✓', name) }

t('wordCount counts whitespace-separated words', () => {
  assert.equal(wordCount(''), 0)
  assert.equal(wordCount('  one two\nthree  '), 3)
})

t('readingMinutes is at least 1 and ~200 wpm', () => {
  assert.equal(readingMinutes('short'), 1)
  assert.equal(readingMinutes(Array(1000).fill('w').join(' ')), 5)
})

t('own-words summary scores low', () => {
  const s = 'Plants turn light into energy. Leaves hold chloroplasts with chlorophyll, and the process gives off oxygen that people and animals breathe.'
  assert.ok(copiedRatio(s, article) < 0.2, String(copiedRatio(s, article)))
})

t('pasted text scores 1 even with different case and punctuation', () => {
  const s = 'PHOTOSYNTHESIS is the process, by which green plants use sunlight to make food from carbon dioxide and water!'
  assert.equal(copiedRatio(s, article), 1)
})

t('half pasted / half own words is rejected', () => {
  const s = 'It takes place mainly in the leaves inside tiny structures called chloroplasts. I think this matters because every food chain begins with plants.'
  const r = copiedRatio(s, article)
  assert.ok(r >= MAX_COPIED_RATIO && r < 1, String(r))
})

t('short quotes (under 6 words) are not counted as copied', () => {
  assert.equal(copiedRatio('Forests are the lungs of the planet in a sense, because trees make oxygen.', article) <= 0.5, true)
  assert.equal(copiedRatio('green plants use sunlight', article), 0)
})

t('parseArticleInput validates and defaults', () => {
  assert.deepEqual(parseArticleInput({}), { error: 'Title is required' })
  assert.deepEqual(parseArticleInput({ title: 'x' }), { error: 'The article text is required' })
  const ok = parseArticleInput({ title: ' T ', body: 'a\r\nb ', topic: '' })
  assert.ok('value' in ok)
  assert.deepEqual(ok.value, { title: 'T', topic: null, subject: null, body: 'a\nb', sourceUrl: null, minSummaryWords: 50 })
  assert.ok('error' in parseArticleInput({ title: 'T', body: 'b', sourceUrl: 'javascript:alert(1)' }))
  assert.ok('value' in parseArticleInput({ title: 'T', body: 'b', sourceUrl: 'https://example.com/a' }))
  assert.ok('error' in parseArticleInput({ title: 'T', body: 'b', minSummaryWords: 5 }))
  assert.ok('error' in parseArticleInput({ title: 'T', body: 'b', minSummaryWords: 12.5 }))
})

t('parseDueAt distinguishes missing, cleared and invalid', () => {
  assert.deepEqual(parseDueAt(undefined), { value: undefined })
  assert.deepEqual(parseDueAt(null), { value: null })
  assert.ok('error' in parseDueAt('not a date'))
  const d = parseDueAt('2026-11-01T10:00:00Z')
  assert.ok('value' in d && d.value instanceof Date)
})

console.log(`\n${passed} passed`)

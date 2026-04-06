#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { relative, join, dirname } from 'path'

const root = process.cwd()

const inputPath = join(root, 'test-results.json')
const outputPath = process.argv[2] ?? join(root, 'static/dev/tests/index.html')

const results = JSON.parse(readFileSync(inputPath, 'utf-8'))

// Heights derived from CSS:
//   suite-header: padding 0.75rem top/bottom + 0.8rem font * 1.6 line-height = 2.78rem
//   given-row:    padding 0.75rem top + 0.25rem bottom + 0.875rem font * 1.6  = 2.4rem
// Expressed as CSS custom properties so calc() works in inline styles.
const SUITE_H = 'var(--suite-h)'
const GIVEN_ROW_H = 'var(--given-row-h)'

// Estimate height of a feature header in rem.
// Estimate feature header height — constants mirror the CSS values so changes stay in sync.
const BASE_FONT_PX         = 14    // body font-size: 14px
const CONTAINER_PX         = 900   // main max-width
const FEATURE_LABEL_REM    = 4     // .feature-label width
const FEATURE_H_PAD_REM    = 1.25  // .feature-header padding (each side)
const FEATURE_GAP_REM      = 0.5   // .feature-header gap between label and body
const FEATURE_DESC_FONT    = 0.8   // .feature-description font-size in rem
const AVG_CHAR_WIDTH_RATIO = 0.62  // average char width as fraction of font size (sans-serif prose)

const featureDescFontPx   = FEATURE_DESC_FONT * BASE_FONT_PX
const availableWidthPx    = CONTAINER_PX
  - (FEATURE_H_PAD_REM * 2 * BASE_FONT_PX)
  - (FEATURE_LABEL_REM * BASE_FONT_PX)
  - (FEATURE_GAP_REM * BASE_FONT_PX)
const FEATURE_CHARS_PER_LINE = Math.floor(availableWidthPx / (featureDescFontPx * AVG_CHAR_WIDTH_RATIO))

const FEATURE_PADDING      = 1.2   // 0.6rem top + 0.6rem bottom
const FEATURE_NAME_H       = 1.4   // 0.875rem font * 1.6 line-height
const FEATURE_PARA_LINE_H  = 1.28  // 0.8rem font * 1.6 line-height
const FEATURE_GAP          = 0.35  // gap between items in feature-body

function featureHeaderHeight(description) {
  if (!description || description.length === 0) {
    return FEATURE_PADDING + FEATURE_NAME_H
  }
  let h = FEATURE_PADDING + FEATURE_NAME_H + FEATURE_GAP
  for (let i = 0; i < description.length; i++) {
    const lines = Math.ceil(description[i].length / FEATURE_CHARS_PER_LINE)
    h += lines * FEATURE_PARA_LINE_H
    if (i < description.length - 1) h += FEATURE_GAP
  }
  return h
}

function whenTop(givenCount, featureOffset) {
  const base = featureOffset > 0
    ? `calc(var(--suite-h) + ${featureOffset.toFixed(3)}rem)`
    : 'var(--suite-h)'
  return `calc(${base} + var(--given-header-padding) + ${givenCount} * var(--given-row-h))`
}

function givenTop(featureOffset) {
  return featureOffset > 0
    ? `calc(var(--suite-h) + ${featureOffset.toFixed(3)}rem)`
    : 'var(--suite-h)'
}

function domainName(filePath) {
  const rel = relative(root, filePath)
  return rel
    .replace(/^src\/lib\/server\//, '')
    .replace(/^src\/lib\/client\//, '')
    .replace(/^src\/test\//, '')
    .replace(/^src\//, '')
    .replace(/\.test\.ts$/, '')
    .split('/')
    .map(part => part.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
    .join(' › ')
}

function suiteSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function parts(arr) {
  return arr.map(p => `<span class="part">${escapeHtml(p)}</span>`).join('<span class="sep"> and </span>')
}

function buildGivenMap(tests) {
  const givenMap = new Map()
  for (const test of tests) {
    const { given, when, then } = test.meta.structure
    const givenKey = JSON.stringify(given)
    const whenKey = JSON.stringify(when)
    if (!givenMap.has(givenKey)) givenMap.set(givenKey, { given, whenMap: new Map() })
    const givenEntry = givenMap.get(givenKey)
    if (!givenEntry.whenMap.has(whenKey)) givenEntry.whenMap.set(whenKey, { when, thens: [] })
    givenEntry.whenMap.get(whenKey).thens.push({ then, test })
  }
  return [...givenMap.values()]
}

function groupTests(tests) {
  const structured = []
  const unstructured = []

  for (const test of tests) {
    if (test.title === '__feature_meta__') continue
    if (test.meta?.structure) {
      structured.push(test)
    } else {
      unstructured.push(test)
    }
  }

  const featureMap = new Map()
  for (const test of structured) {
    const featureName = test.ancestorTitles?.[0] ?? null
    const key = featureName ?? ''
    if (!featureMap.has(key)) featureMap.set(key, { featureName, tests: [] })
    featureMap.get(key).tests.push(test)
  }

  // Also pick up featureDescription from the hidden meta test
  const featureDescriptions = new Map()
  for (const test of tests) {
    if (test.title === '__feature_meta__' && test.meta?.featureDescription) {
      const featureName = test.ancestorTitles?.[0] ?? ''
      featureDescriptions.set(featureName, test.meta.featureDescription)
    }
  }

  const featureGroups = [...featureMap.values()].map(({ featureName, tests }) => ({
    featureName,
    description: featureDescriptions.get(featureName ?? '') ?? null,
    givenGroups: buildGivenMap(tests),
  }))

  return { featureGroups, unstructured }
}

function renderGivenGroups(givenGroups, featureOffset = 0) {
  return givenGroups.map(({ given, whenMap }) => {
    const whenHtml = [...whenMap.values()].map(({ when, thens }) => {
      const thenHtml = thens.map(({ then, test }) => {
        const failed = test.status === 'failed'
        return then.map(t =>
          `<div class="then-item ${test.status}">
            <span class="indicator">${failed ? '✗' : '✓'}</span>
            <span class="then-label">then</span>
            <span class="then-text ${failed ? 'failed' : ''}">${escapeHtml(t)}</span>
            ${failed && test.failureMessages.length > 0
              ? `<div class="failure-message">${escapeHtml(test.failureMessages[0].split('\n').slice(0, 3).join('\n'))}</div>`
              : ''}
          </div>`
        ).join('')
      }).join('')

      return `
        <div class="when-group">
          <div class="when-row" style="top:${whenTop(given.length, featureOffset)}">
            <span class="when-label">when</span>
            <span class="when-text">${parts(when)}</span>
          </div>
          <div class="thens">${thenHtml}</div>
        </div>`
    }).join('')

    return `
      <div class="given-group">
        <div class="given-header" style="top:${givenTop(featureOffset)}">
          ${given.map(p => `
          <div class="given-row">
            <span class="given-label">given</span>
            <span class="given-text">${escapeHtml(p)}</span>
          </div>`).join('')}
        </div>
        <div class="whens">${whenHtml}</div>
      </div>`
  }).join('')
}

function renderSuite(suite) {
  const { featureGroups, unstructured } = groupTests(suite.tests)

  const featuredHtml = featureGroups.map(({ featureName, description, givenGroups }) => {
    const featureOffset = featureName !== null ? featureHeaderHeight(description) : 0
    const givenHtml = renderGivenGroups(givenGroups, featureOffset)
    if (featureName === null) return givenHtml
    return `
      <div class="feature-group">
        <div class="feature-header">
          <span class="feature-label">feature</span>
          <div class="feature-body">
            <span class="feature-name">${escapeHtml(featureName)}</span>
            ${description ? description.map(p => `<p class="feature-description">${escapeHtml(p)}</p>`).join('') : ''}
          </div>
        </div>
        ${givenHtml}
      </div>`
  }).join('')

  const unstructuredHtml = unstructured.map(test => `
    <div class="plain-test ${test.status}">
      <span class="indicator">${test.status === 'passed' ? '✓' : '✗'}</span>
      <span class="plain-text">${escapeHtml(test.title)}</span>
    </div>`
  ).join('')

  return featuredHtml + unstructuredHtml
}

const suites = results.testResults
  .filter(s => s.assertionResults.length > 0)
  .map(suite => {
    const tests = suite.assertionResults
    const visible = tests.filter(t => t.title !== '__feature_meta__')
    return {
      name: domainName(suite.name),
      tests,
      passed: visible.filter(t => t.status === 'passed').length,
      failed: visible.filter(t => t.status === 'failed').length,
    }
  })
  .sort((a, b) => {
    if (b.failed !== a.failed) return b.failed - a.failed  // failing suites first
    return a.name.localeCompare(b.name)
  })

const totalPassed = suites.reduce((n, s) => n + s.passed, 0)
const totalFailed = suites.reduce((n, s) => n + s.failed, 0)
const totalTests = totalPassed + totalFailed
const generatedAt = new Date(results.startTime).toLocaleDateString('en-CA', {
  year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
})

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Test Docs — My Friend's Boat</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --suite-h: 2.8rem;
      --given-row-h: 2.2rem;
      --given-header-padding: 0.7rem;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #1a1a2e;
      background: #f8f9fc;
    }

    header {
      background: #1a1a2e;
      color: #fff;
      padding: 2rem 2.5rem;
    }

    header h1 {
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      margin-bottom: 0.15rem;
    }

    .subtitle {
      font-size: 0.85rem;
      color: rgba(255,255,255,0.5);
      margin-bottom: 1rem;
    }

    .stats {
      display: flex;
      gap: 1.25rem;
      flex-wrap: wrap;
    }

    .stat { font-size: 0.85rem; font-weight: 500; }
    .stat.passed { color: #4ade80; }
    .stat.failed { color: #f87171; }
    .stat.total  { color: rgba(255,255,255,0.45); }

    main {
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem 2.5rem;
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .suite {
      background: #fff;
      border-radius: 8px;
      border: 1px solid #e8eaf0;
    }

    /* Sticky level 1 — suite header */
    .suite-header {
      position: sticky;
      top: 0;
      z-index: 30;
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: #6b7280;
      padding: 0.75rem 1.25rem;
      border-bottom: 1px solid #e8eaf0;
      background: #f8f9fc;
      border-radius: 8px 8px 0 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.04);
      cursor: pointer;
      user-select: none;
      list-style: none;
    }

    .suite-header::-webkit-details-marker { display: none; }

    .suite[open] .suite-header { border-radius: 8px 8px 0 0; }
    .suite:not([open]) .suite-header { border-radius: 8px; border-bottom: none; }

    .suite.has-failures .suite-header {
      background: #fff5f5;
      border-bottom-color: #fecaca;
      color: #dc2626;
    }

    .suite.has-failures:not([open]) .suite-header { border-color: #fecaca; }

    .suite-counts.failed { color: #ef4444; font-weight: 700; }

    .suite-header::after {
      content: '▸';
      font-size: 0.7rem;
      color: #9ca3af;
      margin-left: 0.5rem;
      transition: transform 0.15s ease;
    }

    .suite[open] .suite-header::after {
      transform: rotate(90deg);
    }

    .suite-counts { font-weight: 400; color: #9ca3af; }

    /* Feature group */
    .feature-group {
      border-bottom: 1px solid #f1f3f7;
    }
    .feature-group:last-child { border-bottom: none; }

    /* Sticky level 2 — feature header */
    .feature-header {
      position: sticky;
      top: var(--suite-h);
      z-index: 25;
      background: #f3f4f6;
      border-bottom: 1px solid #e8eaf0;
      border-top: 1px solid #e8eaf0;
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.6rem 1.25rem;
    }

    .feature-label {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #a855f7;
      width: 4rem;
      flex-shrink: 0;
      padding-top: 0.1rem;
    }

    .feature-body {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .feature-name {
      font-size: 0.875rem;
      font-weight: 600;
      color: #374151;
      line-height: 1.6;
    }

    .feature-description {
      font-size: 0.8rem;
      color: #6b7280;
      line-height: 1.6;
      font-style: italic;
    }

    /* Given group */
    .given-group {
      border-bottom: 1px solid #f1f3f7;
    }
    .given-group:last-child { border-bottom: none; }

    /* Sticky level 3 — given header (top set via inline style) */
    .given-header {
      position: sticky;
      z-index: 20;
      background: #fff;
      border-bottom: 1px solid #f1f3f7;
      box-shadow: 0 2px 4px rgba(0,0,0,0.03);
    }

    .given-row {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      padding: 0.4rem 1.25rem;
    }

    .given-row:first-child { padding-top: 0.75rem; }
    .given-row:last-child  { padding-bottom: 0.75rem; }

    .given-label {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #6366f1;
      width: 2.5rem;
      flex-shrink: 0;
    }

    .given-row:not(:first-child) .given-label { visibility: hidden; }

    .given-text {
      font-size: 0.875rem;
      color: #374151;
      font-weight: 500;
    }

    /* When group */
    .whens {
      padding-left: 1.25rem;
    }

    .when-group {
      border-left: 2px solid #e8eaf0;
      margin: 0.25rem 0 0.5rem 1.25rem;
    }

    /* Sticky level 3 — when row (top set via inline style) */
    .when-row {
      position: sticky;
      z-index: 10;
      background: #fff;
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      padding: 0.3rem 0.875rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.02);
    }

    .when-label {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #0ea5e9;
      width: 2.5rem;
      flex-shrink: 0;
    }

    .when-text {
      font-size: 0.875rem;
      color: #374151;
    }

    /* Then items */
    .thens {
      padding-left: 0.875rem;
    }

    .then-item {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      padding: 0.2rem 0.875rem;
      flex-wrap: wrap;
    }

    .indicator {
      font-size: 0.7rem;
      font-weight: 700;
      width: 0.875rem;
      flex-shrink: 0;
      text-align: center;
    }

    .then-item.passed .indicator { color: #22c55e; }
    .then-item.failed .indicator { color: #ef4444; }

    .then-label {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #22c55e;
      width: 2.5rem;
      flex-shrink: 0;
    }

    .then-item.failed .then-label { color: #ef4444; }
    .then-item:not(:first-child) .then-label { visibility: hidden; }

    .then-text { font-size: 0.875rem; color: #374151; }
    .then-text.failed { color: #dc2626; }

    .failure-message {
      width: 100%;
      margin-top: 0.25rem;
      padding: 0.5rem 0.75rem;
      background: #fef2f2;
      border-radius: 4px;
      font-size: 0.775rem;
      color: #dc2626;
      font-family: ui-monospace, monospace;
      white-space: pre-wrap;
    }

    .part { color: inherit; }
    .sep { color: #9ca3af; font-size: 0.8em; }

    .plain-test {
      display: flex;
      align-items: baseline;
      gap: 0.6rem;
      padding: 0.5rem 1.25rem;
      border-bottom: 1px solid #f1f3f7;
    }
    .plain-test:last-child { border-bottom: none; }
    .plain-test.passed .indicator { color: #22c55e; }
    .plain-test.failed .indicator { color: #ef4444; }
    .plain-text { font-size: 0.875rem; color: #374151; }

    .failures-summary {
      background: #fff5f5;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 1rem 1.25rem;
    }

    .failures-summary h2 {
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: #dc2626;
      margin-bottom: 0.75rem;
    }

    .failure-link {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      padding: 0.25rem 0;
      border-bottom: 1px solid #fecaca;
      text-decoration: none;
    }

    .failure-link:last-child { border-bottom: none; }

    .failure-link .indicator { color: #ef4444; font-size: 0.7rem; font-weight: 700; width: 0.875rem; flex-shrink: 0; text-align: center; }
    .failure-link .suite-name { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; flex-shrink: 0; }
    .failure-link .test-name { font-size: 0.875rem; color: #dc2626; }
    .failure-link:hover .test-name { text-decoration: underline; }

    footer {
      text-align: center;
      padding: 2rem;
      font-size: 0.8rem;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <header>
    <h1>My Friend's Boat</h1>
    <p class="subtitle">Test Documentation</p>
    <div class="stats">
      <span class="stat passed">✓ ${totalPassed} passed</span>
      ${totalFailed > 0 ? `<span class="stat failed">✗ ${totalFailed} failed</span>` : ''}
      <span class="stat total">${totalTests} tests across ${suites.length} suites</span>
    </div>
  </header>

  <main>
    ${totalFailed > 0 ? `
    <div class="failures-summary">
      <h2>✗ ${totalFailed} failure${totalFailed > 1 ? 's' : ''}</h2>
      ${suites.flatMap(suite =>
        suite.tests
          .filter(t => t.status === 'failed')
          .map(t => `<a class="failure-link" href="#suite-${suiteSlug(suite.name)}">
            <span class="indicator">✗</span>
            <span class="suite-name">${escapeHtml(suite.name)}</span>
            <span class="test-name">${escapeHtml(t.title)}</span>
          </a>`)
      ).join('')}
    </div>` : ''}
    ${suites.map(suite => `
    <details id="suite-${suiteSlug(suite.name)}" class="suite${suite.failed > 0 ? ' has-failures' : ''}" open>
      <summary class="suite-header">
        <span>${escapeHtml(suite.name)}</span>
        <span class="suite-counts${suite.failed > 0 ? ' failed' : ''}">${suite.passed} passed${suite.failed > 0 ? ` · ${suite.failed} failed` : ''}</span>
      </summary>
      ${renderSuite(suite)}
    </details>`).join('')}
  </main>

  <footer>Generated ${generatedAt}</footer>
</body>
</html>`

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, html)
console.log(`Written to ${outputPath} (${totalTests} tests, ${suites.length} suites)`)

import { given, when, feature } from './index.ts'

// --- setup factories ---

const withValue = (n: number) => (fixture: { value: number }) => ({ ...fixture, value: n })

// --- assertion factories ---

const resultIs = (expected: number) => ([result]: [number]) => {
  if (result !== expected) throw new Error(`Expected ${expected}, got ${result}`)
}

const allResultsAre = (expected: number[]) => (results: [number, number]) => {
  for (let i = 0; i < expected.length; i++) {
    if (results[i] !== expected[i]) throw new Error(`Result ${i}: expected ${expected[i]}, got ${results[i]}`)
  }
}

// --- tests ---

feature('given / when / then', [
  'The core BDD primitives. given() sets up the world, when() performs the action, then() asserts the outcome.',
  'Setup factories chain left to right, each receiving and enriching the fixture.',
], () => {
  given(
    ['the value is 3', withValue(3)],

    when(
      ['it is doubled', ({ value }: { value: number }) => value * 2],
    ).then(
      ['the result is 6', resultIs(6)],
    ),

    when(
      ['it is negated', ({ value }: { value: number }) => -value],
    ).then(
      ['the result is -3', resultIs(-3)],
    ),
  )

  given(
    [
      ['the value starts at 0', withValue(0)],
      ['it is set to 5',        withValue(5)],
    ],

    when(
      ['it is doubled', ({ value }: { value: number }) => value * 2],
    ).then(
      ['the result is 10', resultIs(10)],
    ),
  )

  given(
    ['the value is 3', withValue(3)],

    when(
      ['it is doubled',  ({ value }: { value: number }) => value * 2],
      ['it is negated',  ({ value }: { value: number }) => -value],
    ).then(
      ['the results are 6 and -3', allResultsAre([6, -3])],
    ),
  )
})

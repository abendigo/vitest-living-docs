# @abendigo/vitest-living-docs

A BDD-style test helper for [Vitest](https://vitest.dev/) that structures tests as `given / when / then` scenarios and generates living documentation from the results.

Tests read like specifications. The living docs output makes that structure visible to anyone — not just the people who wrote the tests.

## Installation

```sh
npm install --save-dev @abendigo/vitest-living-docs
```

Requires `vitest >= 2.0.0` as a peer dependency.

## Usage

Tests are written using three functions: `given`, `when`, and `then`.

- **`given`** — sets up the world (database state, users, fixtures). Uses named factory functions so the setup is reusable and readable.
- **`when`** — performs the action being tested. Uses an inline arrow function so the call is visible at the test site.
- **`then`** — asserts the outcome. Uses named assertion factories so labels match exactly what is being checked.

```ts
import { given, when } from '@abendigo/vitest-living-docs'

// Setup factories — named, reusable
const withDatabase = async (fixture) => {
  const db = await createTestDb()
  return { ...fixture, db }
}

const withUser = (key, { email }) => async (fixture) => {
  const user = await createUser(fixture.db, email, 'password')
  return { ...fixture, users: { ...fixture.users, [key]: user } }
}

// Assertion factories — named, specific
const returnsTrip = (title) => (_fixture, results) => {
  const trip = results[0]
  if (trip.title !== title) throw new Error(`Expected '${title}', got '${trip.title}'`)
}

const tripIsOpen = (_fixture, results) => {
  const trip = results[0]
  if (trip.status !== 'open') throw new Error(`Expected status 'open', got '${trip.status}'`)
}

// The test
given(
  ['an owner exists', [withDatabase, withUser('owner', { email: 'owner@example.com' })]],

  when(
    ['they create a trip', ({ db, users }) => createTrip(db, { owner_id: users.owner.id, title: 'Sunset Cruise' })],
  ).then(
    ['the trip title is Sunset Cruise', returnsTrip('Sunset Cruise')],
    ['the trip status is open',         tripIsOpen],
  ),
)
```

This produces a single Vitest test named:

```
an owner exists / they create a trip / the trip title is Sunset Cruise
an owner exists / they create a trip / the trip status is open
```

### Multiple scenarios from one setup

A single `given` block can contain multiple `when / then` scenarios. Setup runs once per scenario — they don't share state.

```ts
given(
  ['an owner exists', [withDatabase, withUser('owner', { email: 'owner@example.com' })]],

  when(
    ['they create a trip with one date', ({ db, users }) => createTrip(db, {
      owner_id: users.owner.id,
      title: 'Sunset Cruise',
      dates: [{ departure_date: '2026-07-05' }]
    })],
  ).then(
    ['the date is auto-confirmed', dateIsConfirmed],
  ),

  when(
    ['they create a trip with multiple dates', ({ db, users }) => createTrip(db, {
      owner_id: users.owner.id,
      title: 'Raft-Up Weekend',
      dates: [
        { departure_date: '2026-07-05' },
        { departure_date: '2026-07-12' },
      ]
    })],
  ).then(
    ['no date is confirmed yet', noDateIsConfirmed],
  ),
)
```

### Multiple setup steps

Pass an array of setup functions as the second element of a `given` tuple to chain them:

```ts
given(
  ['a trip exists with two proposed dates', [withDatabase, withUser('owner', { email: 'owner@example.com' }), withTrip('trip', 'owner'), withTripDate('a'), withTripDate('b')]],

  when(
    ['the owner confirms date a', ({ db, trips, dates }) => setTripDateConfirmed(db, trips.trip.id, dates.a.id, true)],
  ).then(
    ['date a is confirmed', dateAIsConfirmed],
    ['date b is not confirmed', dateBIsNotConfirmed],
  ),
)
```

### Features

Group related scenarios under a named feature using `feature()`:

```ts
import { feature, given, when } from '@abendigo/vitest-living-docs'

feature('Trip creation', [
  'Owners can create trips with optional dates.',
  'A single date is auto-confirmed; multiple dates go to a vote.',
], () => {
  given(
    ['an owner exists', [withDatabase, withUser('owner', { email: 'owner@example.com' })]],
    // ... scenarios
  )
})
```

## Generating living docs

Run Vitest with JSON output, then generate the HTML report:

```sh
# Run tests and write results to test-results.json
npx vitest run --reporter=json --outputFile=test-results.json

# Generate the HTML report
npx vitest-living-docs [output-path]
# Default output: static/dev/tests/index.html
```

Or add a script to `package.json`:

```json
{
  "scripts": {
    "test:report": "vitest run --reporter=json --outputFile=test-results.json && vitest-living-docs"
  }
}
```

## Living docs output

The generated HTML shows each test suite as a collapsible panel, with scenarios grouped by their `given` context and nested `when / then` rows. The structure is sticky-scrollable so the context stays visible as you read down a long suite.

```
┌─ Trips ──────────────────────────────────────────────────────────┐
│                                                                   │
│  given   an owner exists                                          │
│  ├─ when   they create a trip with one date                       │
│  │    then  ✓ the date is auto-confirmed                          │
│  │                                                                │
│  ├─ when   they create a trip with multiple dates                 │
│  │    then  ✓ no date is confirmed yet                            │
│  │                                                                │
│  given   a trip exists with two proposed dates                    │
│  ├─ when   the owner confirms date a                              │
│       then  ✓ date a is confirmed                                 │
│             ✓ date b is not confirmed                             │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

Failing tests surface at the top of the report with a summary and inline failure messages.

See a live example: [abendigo.github.io/myfriendsboat](https://abendigo.github.io/myfriendsboat/)

## ESLint plugin

An optional ESLint plugin enforces consistent style in `given / when / then` calls:

```js
// eslint.config.js
import { recommended } from '@abendigo/vitest-living-docs/eslint'

export default [
  recommended,
]
```

Rules:

| Rule | Default | Description |
|---|---|---|
| `vitest-bdd/no-inline-given` | error | Setup functions in `given()` must be named references or factory calls, not inline arrow functions |
| `vitest-bdd/no-inline-then` | error | Assertion functions in `.then()` must be named references or factory calls |
| `vitest-bdd/require-inline-when` | error | Action functions in `when()` must be inline arrow functions so the call is visible at the test site |

Use `relaxed` instead of `recommended` to downgrade all rules to warnings.

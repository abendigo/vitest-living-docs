import { it, describe } from 'vitest'

export function feature(name: string, fn: () => void): void
export function feature(name: string, description: string[], fn: () => void): void
export function feature(name: string, descriptionOrFn: string[] | (() => void), fn?: () => void): void {
  const description = Array.isArray(descriptionOrFn) ? descriptionOrFn : undefined
  const callback = typeof descriptionOrFn === 'function' ? descriptionOrFn : fn!
  describe(name, () => {
    if (description) {
      it('__feature_meta__', (ctx) => {
        ;(ctx.task.meta as Record<string, unknown>).featureDescription = description
      })
    }
    callback()
  })
}

type Fixture = Record<string, unknown>
type SetupFn<F extends Fixture> = (fixture: F) => F | Promise<F>
type SetupTuple<F extends Fixture> = [description: string, setup: SetupFn<F> | SetupFn<F>[]]
type ActionTuple<F extends Fixture, R> = [description: string, action: (fixture: F, results: unknown[]) => R | Promise<R>]
type AssertionTuple<F extends Fixture> = [description: string, assertion: (fixture: F, results: unknown[]) => void | Promise<void>]

class WhenBuilder<F extends Fixture> {
  private actions: ActionTuple<F, unknown>[]

  constructor(actions: ActionTuple<F, unknown>[]) {
    this.actions = actions
  }

  then(...assertions: AssertionTuple<F>[]): ScenarioBuilder<F> {
    return new ScenarioBuilder(this.actions, assertions)
  }
}

class ScenarioBuilder<F extends Fixture> {
  readonly actions: ActionTuple<F, unknown>[]
  readonly assertions: AssertionTuple<F>[]

  constructor(actions: ActionTuple<F, unknown>[], assertions: AssertionTuple<F>[]) {
    this.actions = actions
    this.assertions = assertions
  }
}

export function when<F extends Fixture>(...actions: ActionTuple<F, unknown>[]): WhenBuilder<F> {
  return new WhenBuilder(actions)
}

type GivenArg<F extends Fixture> = SetupTuple<F> | ScenarioBuilder<F>

export function given<F extends Fixture>(...args: GivenArg<F>[]): void {
  const setups = args.filter((a): a is SetupTuple<F> => Array.isArray(a))
  const scenarios = args.filter((a): a is ScenarioBuilder<F> => a instanceof ScenarioBuilder)

  for (const scenario of scenarios) {
    const description = [
      ...setups.map(([d]) => d),
      ...scenario.actions.map(([d]) => d),
      ...scenario.assertions.map(([d]) => d)
    ].join(' / ')

    it(description, async (ctx) => {
      ;(ctx.task.meta as Record<string, unknown>).structure = {
        given: setups.map(([d]) => d),
        when: scenario.actions.map(([d]) => d),
        then: scenario.assertions.map(([d]) => d),
      }

      // Build fixture — re-run per scenario so each starts from a clean slate
      let fixture = {} as F
      for (const [, setup] of setups) {
        if (Array.isArray(setup)) {
          for (const fn of setup) fixture = await fn(fixture)
        } else {
          fixture = await setup(fixture)
        }
      }

      // Freeze fixture before handing to when
      const frozenFixture = deepFreeze(fixture)

      // Run actions, accumulating results
      const results: unknown[] = []
      for (const [, action] of scenario.actions) {
        const result = await action(frozenFixture, results)
        results.push(result)
      }

      const frozenResults = deepFreeze(results)

      // Run all assertions, collecting failures so all are reported
      const failures: Error[] = []
      for (const [description, assertion] of scenario.assertions) {
        try {
          await assertion(frozenFixture, frozenResults)
        } catch (e) {
          failures.push(new Error(`"${description}" failed: ${(e as Error).message}`))
        }
      }
      if (failures.length > 0) {
        throw new Error(failures.map(f => f.message).join('\n'))
      }
    })
  }
}

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  Object.freeze(obj)
  for (const key of Object.keys(obj)) {
    deepFreeze((obj as Record<string, unknown>)[key])
  }
  return obj
}

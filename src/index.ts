import { it, describe } from 'vitest'

// --- feature ---

export function feature(name: string, fn: () => void): void
export function feature(name: string, description: string[], fn: () => void): void
export function feature(
  name: string,
  descriptionOrFn: string[] | (() => void),
  fn?: () => void
): void {
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

// --- types ---

type AnyFn = (fixture: any) => any
type SetupArg = [description: string, setup: AnyFn | AnyFn[]]
type ActionTuple<F> = [description: string, action: (fixture: F, results: unknown[]) => unknown]
type AssertionTuple<F> = [description: string, assertion: (fixture: F, results: unknown[]) => void | Promise<void>]

// --- builders ---

class WhenBuilder<F> {
  constructor(private readonly actions: ActionTuple<F>[]) {}

  then(...assertions: AssertionTuple<F>[]): ScenarioBuilder<F> {
    return new ScenarioBuilder(this.actions, assertions)
  }
}

class ScenarioBuilder<F> {
  constructor(
    readonly actions: ActionTuple<F>[],
    readonly assertions: AssertionTuple<F>[]
  ) {}
}

export function when<F>(...actions: ActionTuple<F>[]): WhenBuilder<F> {
  return new WhenBuilder(actions)
}

// --- given ---

// Single labeled setup step
export function given<F>(
  setup: SetupArg,
  ...scenarios: ScenarioBuilder<F>[]
): void

// Multiple labeled setup steps (outer array distinguishes from single setup)
export function given<F>(
  setups: SetupArg[],
  ...scenarios: ScenarioBuilder<F>[]
): void

export function given(first: any, ...rest: any[]): void {
  let steps: SetupArg[]
  let scenarios: ScenarioBuilder<any>[]

  if (Array.isArray(first[0])) {
    // New form: outer array wraps setup tuples — [[desc, fn], [desc, fn]], ...scenarios
    steps = first
    scenarios = rest
  } else {
    // Old form: setup tuples and scenarios mixed as flat args — [desc, fn], [desc, fn], ...scenarios
    const allArgs = [first, ...rest]
    steps = allArgs.filter((a): a is SetupArg => Array.isArray(a) && !(a instanceof ScenarioBuilder))
    scenarios = allArgs.filter((a): a is ScenarioBuilder<any> => a instanceof ScenarioBuilder)
  }

  runScenarios(steps, scenarios)
}

function runScenarios(steps: SetupArg[], scenarios: ScenarioBuilder<any>[]): void {
  for (const scenario of scenarios) {
    const givenDescs = steps.map(([d]) => d)
    const whenDescs = scenario.actions.map(([d]) => d)
    const thenDescs = scenario.assertions.map(([d]) => d)
    const description = [...givenDescs, ...whenDescs, ...thenDescs].join(' / ')

    it(description, async (ctx) => {
      ;(ctx.task.meta as Record<string, unknown>).structure = {
        given: givenDescs,
        when: whenDescs,
        then: thenDescs,
      }

      let fixture: any = {}
      for (const [, setup] of steps) {
        if (Array.isArray(setup)) {
          for (const fn of setup) fixture = await fn(fixture)
        } else {
          fixture = await setup(fixture)
        }
      }
      const frozenFixture = deepFreeze(fixture)

      const results: unknown[] = []
      for (const [, action] of scenario.actions) {
        results.push(await action(frozenFixture, results))
      }
      const frozenResults = deepFreeze(results)

      const failures: Error[] = []
      for (const [desc, assertion] of scenario.assertions) {
        try {
          await assertion(frozenFixture, frozenResults)
        } catch (e) {
          failures.push(new Error(`"${desc}" failed: ${(e as Error).message}`))
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

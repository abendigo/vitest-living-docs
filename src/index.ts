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

type SetupFn<F> = (fixture: F) => F | Promise<F>
type SetupArg<F> = [description: string, setup: SetupFn<F> | SetupFn<F>[]]
type ActionTuple<F, R> = [description: string, action: (fixture: F, results: unknown[]) => R]
type AssertionTuple<F, R extends unknown[]> = [description: string, assertion: (results: R, fixture: F) => void | Promise<void>]

// --- builders ---

class WhenBuilder<F, R extends unknown[]> {
  constructor(private readonly actions: ActionTuple<F, unknown>[]) {}

  then(...assertions: AssertionTuple<F, R>[]): ScenarioBuilder<F> {
    return new ScenarioBuilder(this.actions, assertions as AssertionTuple<F, unknown[]>[])
  }
}

class ScenarioBuilder<F> {
  constructor(
    readonly actions: ActionTuple<F, unknown>[],
    readonly assertions: AssertionTuple<F, unknown[]>[]
  ) {}
}

export function when<F, R1>(
  a1: ActionTuple<F, R1>
): WhenBuilder<F, [Awaited<R1>]>
export function when<F, R1, R2>(
  a1: ActionTuple<F, R1>,
  a2: ActionTuple<F, R2>
): WhenBuilder<F, [Awaited<R1>, Awaited<R2>]>
export function when<F, R1, R2, R3>(
  a1: ActionTuple<F, R1>,
  a2: ActionTuple<F, R2>,
  a3: ActionTuple<F, R3>
): WhenBuilder<F, [Awaited<R1>, Awaited<R2>, Awaited<R3>]>
export function when<F, R1, R2, R3, R4>(
  a1: ActionTuple<F, R1>,
  a2: ActionTuple<F, R2>,
  a3: ActionTuple<F, R3>,
  a4: ActionTuple<F, R4>
): WhenBuilder<F, [Awaited<R1>, Awaited<R2>, Awaited<R3>, Awaited<R4>]>
export function when<F>(...actions: ActionTuple<F, unknown>[]): WhenBuilder<F, unknown[]>
export function when<F>(...actions: ActionTuple<F, unknown>[]): WhenBuilder<F, unknown[]> {
  return new WhenBuilder(actions)
}

// --- given ---

// No setup steps (scenarios only)
export function given<F>(
  ...scenarios: ScenarioBuilder<F>[]
): void

// Single labeled setup step
export function given<F>(
  setup: SetupArg<F>,
  ...scenarios: ScenarioBuilder<F>[]
): void

// Multiple labeled setup steps (outer array distinguishes from single setup)
export function given<F>(
  setups: SetupArg<F>[],
  ...scenarios: ScenarioBuilder<F>[]
): void

export function given(first: any, ...rest: any[]): void {
  let steps: SetupArg<unknown>[]
  let scenarios: ScenarioBuilder<unknown>[]

  if (Array.isArray(first[0])) {
    // New form: outer array wraps setup tuples — [[desc, fn], [desc, fn]], ...scenarios
    steps = first
    scenarios = rest
  } else {
    // Old form: setup tuples and scenarios mixed as flat args — [desc, fn], [desc, fn], ...scenarios
    const allArgs = [first, ...rest]
    steps = allArgs.filter((a): a is SetupArg<unknown> => Array.isArray(a) && !(a instanceof ScenarioBuilder))
    scenarios = allArgs.filter((a): a is ScenarioBuilder<unknown> => a instanceof ScenarioBuilder)
  }

  runScenarios(steps, scenarios)
}

function runScenarios<F>(steps: SetupArg<F>[], scenarios: ScenarioBuilder<F>[]): void {
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

      let fixture = {} as F
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
          await assertion(frozenResults as unknown[], frozenFixture)
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

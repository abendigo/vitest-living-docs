declare function feature(name: string, fn: () => void): void;
declare function feature(name: string, description: string[], fn: () => void): void;
type SetupFn<F> = (fixture: F) => F | Promise<F>;
type SetupArg<F> = [description: string, setup: SetupFn<F> | SetupFn<F>[]];
type ActionTuple<F, R> = [description: string, action: (fixture: F, results: unknown[]) => R];
type AssertionTuple<F, R extends unknown[]> = [description: string, assertion: (results: R, fixture: F) => void | Promise<void>];
declare class WhenBuilder<F, R extends unknown[]> {
    private readonly actions;
    constructor(actions: ActionTuple<F, unknown>[]);
    then(...assertions: AssertionTuple<F, R>[]): ScenarioBuilder<F>;
}
declare class ScenarioBuilder<F> {
    readonly actions: ActionTuple<F, unknown>[];
    readonly assertions: AssertionTuple<F, unknown[]>[];
    constructor(actions: ActionTuple<F, unknown>[], assertions: AssertionTuple<F, unknown[]>[]);
}
declare function when<F, R1>(a1: ActionTuple<F, R1>): WhenBuilder<F, [Awaited<R1>]>;
declare function when<F, R1, R2>(a1: ActionTuple<F, R1>, a2: ActionTuple<F, R2>): WhenBuilder<F, [Awaited<R1>, Awaited<R2>]>;
declare function when<F, R1, R2, R3>(a1: ActionTuple<F, R1>, a2: ActionTuple<F, R2>, a3: ActionTuple<F, R3>): WhenBuilder<F, [Awaited<R1>, Awaited<R2>, Awaited<R3>]>;
declare function when<F, R1, R2, R3, R4>(a1: ActionTuple<F, R1>, a2: ActionTuple<F, R2>, a3: ActionTuple<F, R3>, a4: ActionTuple<F, R4>): WhenBuilder<F, [Awaited<R1>, Awaited<R2>, Awaited<R3>, Awaited<R4>]>;
declare function when<F>(...actions: ActionTuple<F, unknown>[]): WhenBuilder<F, unknown[]>;
declare function given<F>(...scenarios: ScenarioBuilder<F>[]): void;
declare function given<F>(setup: SetupArg<F>, ...scenarios: ScenarioBuilder<F>[]): void;
declare function given<F>(setups: SetupArg<F>[], ...scenarios: ScenarioBuilder<F>[]): void;

export { feature, given, when };

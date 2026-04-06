declare function feature(name: string, fn: () => void): void;
declare function feature(name: string, description: string[], fn: () => void): void;
type AnyFn = (fixture: any) => any;
type SetupArg = [description: string, setup: AnyFn | AnyFn[]];
type ActionTuple<F> = [description: string, action: (fixture: F, results: unknown[]) => unknown];
type AssertionTuple<F> = [description: string, assertion: (fixture: F, results: unknown[]) => void | Promise<void>];
declare class WhenBuilder<F> {
    private readonly actions;
    constructor(actions: ActionTuple<F>[]);
    then(...assertions: AssertionTuple<F>[]): ScenarioBuilder<F>;
}
declare class ScenarioBuilder<F> {
    readonly actions: ActionTuple<F>[];
    readonly assertions: AssertionTuple<F>[];
    constructor(actions: ActionTuple<F>[], assertions: AssertionTuple<F>[]);
}
declare function when<F>(...actions: ActionTuple<F>[]): WhenBuilder<F>;
declare function given<F>(setup: SetupArg, ...scenarios: ScenarioBuilder<F>[]): void;
declare function given<F>(setups: SetupArg[], ...scenarios: ScenarioBuilder<F>[]): void;

export { feature, given, when };

// src/index.ts
import { it, describe } from "vitest";
function feature(name, descriptionOrFn, fn) {
  const description = Array.isArray(descriptionOrFn) ? descriptionOrFn : void 0;
  const callback = typeof descriptionOrFn === "function" ? descriptionOrFn : fn;
  describe(name, () => {
    if (description) {
      it("__feature_meta__", (ctx) => {
        ;
        ctx.task.meta.featureDescription = description;
      });
    }
    callback();
  });
}
var WhenBuilder = class {
  constructor(actions) {
    this.actions = actions;
  }
  actions;
  then(...assertions) {
    return new ScenarioBuilder(this.actions, assertions);
  }
};
var ScenarioBuilder = class {
  constructor(actions, assertions) {
    this.actions = actions;
    this.assertions = assertions;
  }
  actions;
  assertions;
};
function when(...actions) {
  return new WhenBuilder(actions);
}
function given(first, ...rest) {
  let steps;
  let scenarios;
  if (Array.isArray(first[0])) {
    steps = first;
    scenarios = rest;
  } else {
    const allArgs = [first, ...rest];
    steps = allArgs.filter((a) => Array.isArray(a) && !(a instanceof ScenarioBuilder));
    scenarios = allArgs.filter((a) => a instanceof ScenarioBuilder);
  }
  runScenarios(steps, scenarios);
}
function runScenarios(steps, scenarios) {
  for (const scenario of scenarios) {
    const givenDescs = steps.map(([d]) => d);
    const whenDescs = scenario.actions.map(([d]) => d);
    const thenDescs = scenario.assertions.map(([d]) => d);
    const description = [...givenDescs, ...whenDescs, ...thenDescs].join(" / ");
    it(description, async (ctx) => {
      ;
      ctx.task.meta.structure = {
        given: givenDescs,
        when: whenDescs,
        then: thenDescs
      };
      let fixture = {};
      for (const [, setup] of steps) {
        if (Array.isArray(setup)) {
          for (const fn of setup) fixture = await fn(fixture);
        } else {
          fixture = await setup(fixture);
        }
      }
      const frozenFixture = deepFreeze(fixture);
      const results = [];
      for (const [, action] of scenario.actions) {
        results.push(await action(frozenFixture, results));
      }
      const frozenResults = deepFreeze(results);
      const failures = [];
      for (const [desc, assertion] of scenario.assertions) {
        try {
          await assertion(frozenResults, frozenFixture);
        } catch (e) {
          failures.push(new Error(`"${desc}" failed: ${e.message}`));
        }
      }
      if (failures.length > 0) {
        throw new Error(failures.map((f) => f.message).join("\n"));
      }
    });
  }
}
function deepFreeze(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    deepFreeze(obj[key]);
  }
  return obj;
}
export {
  feature,
  given,
  when
};

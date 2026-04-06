import { Rule } from 'eslint';

declare const plugin: {
    rules: {
        'no-inline-given': Rule.RuleModule;
        'no-inline-then': Rule.RuleModule;
        'require-inline-when': Rule.RuleModule;
    };
};
declare const recommended: {
    plugins: {
        readonly 'vitest-bdd': {
            rules: {
                'no-inline-given': Rule.RuleModule;
                'no-inline-then': Rule.RuleModule;
                'require-inline-when': Rule.RuleModule;
            };
        };
    };
    rules: {
        readonly 'vitest-bdd/no-inline-given': "error";
        readonly 'vitest-bdd/no-inline-then': "error";
        readonly 'vitest-bdd/require-inline-when': "error";
    };
};
declare const relaxed: {
    readonly rules: {
        readonly 'vitest-bdd/no-inline-given': "warn";
        readonly 'vitest-bdd/no-inline-then': "warn";
        readonly 'vitest-bdd/require-inline-when': "warn";
    };
    readonly plugins: {
        readonly 'vitest-bdd': {
            rules: {
                'no-inline-given': Rule.RuleModule;
                'no-inline-then': Rule.RuleModule;
                'require-inline-when': Rule.RuleModule;
            };
        };
    };
};

export { plugin as default, recommended, relaxed };

// src/eslint.ts
function isInline(node) {
  return node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression";
}
function isWhenThen(node) {
  return node.callee.type === "MemberExpression" && node.callee.property.type === "Identifier" && node.callee.property.name === "then" && node.callee.object.type === "CallExpression" && node.callee.object.callee.type === "Identifier" && node.callee.object.callee.name === "when";
}
function tupleFns(node) {
  return node.arguments.filter((arg) => arg.type === "ArrayExpression" && arg.elements.length >= 2).map((arg) => {
    if (arg.type !== "ArrayExpression") return null;
    return arg.elements[1];
  }).filter(Boolean);
}
var noInlineGiven = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow inline arrow functions in given() setup tuples \u2014 use named functions or factories instead."
    },
    messages: {
      noInline: "given() setup functions should be named references or factory calls, not inline arrow functions."
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== "Identifier" || node.callee.name !== "given") return;
        for (const fn of tupleFns(node)) {
          if (isInline(fn)) {
            context.report({ node: fn, messageId: "noInline" });
          }
        }
      }
    };
  }
};
var noInlineThen = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow inline arrow functions in .then() assertion tuples \u2014 use named functions or factories instead."
    },
    messages: {
      noInline: "then() assertion functions should be named references or factory calls, not inline arrow functions."
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isWhenThen(node)) return;
        for (const fn of tupleFns(node)) {
          if (isInline(fn)) {
            context.report({ node: fn, messageId: "noInline" });
          }
        }
      }
    };
  }
};
var requireInlineWhen = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Require inline arrow functions in when() action tuples so the action is visible at the call site."
    },
    messages: {
      requireInline: "when() action functions should be inline arrow functions so the action is visible at the call site."
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== "Identifier" || node.callee.name !== "when") return;
        for (const fn of tupleFns(node)) {
          if (!isInline(fn)) {
            context.report({ node: fn, messageId: "requireInline" });
          }
        }
      }
    };
  }
};
var plugin = {
  rules: {
    "no-inline-given": noInlineGiven,
    "no-inline-then": noInlineThen,
    "require-inline-when": requireInlineWhen
  }
};
var baseConfig = {
  plugins: { "vitest-bdd": plugin },
  rules: {
    "vitest-bdd/no-inline-given": "error",
    "vitest-bdd/no-inline-then": "error",
    "vitest-bdd/require-inline-when": "error"
  }
};
var recommended = { ...baseConfig };
var relaxed = {
  ...baseConfig,
  rules: {
    "vitest-bdd/no-inline-given": "warn",
    "vitest-bdd/no-inline-then": "warn",
    "vitest-bdd/require-inline-when": "warn"
  }
};
var eslint_default = plugin;
export {
  eslint_default as default,
  recommended,
  relaxed
};

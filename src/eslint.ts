import type { Rule } from 'eslint'

// Returns true if the node is an inline function (arrow or function expression)
function isInline(node: Rule.Node): boolean {
  return node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression'
}

// Returns true if the call is when(...).then(...)
function isWhenThen(node: Rule.Node & { type: 'CallExpression' }): boolean {
  return (
    node.callee.type === 'MemberExpression' &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === 'then' &&
    node.callee.object.type === 'CallExpression' &&
    node.callee.object.callee.type === 'Identifier' &&
    node.callee.object.callee.name === 'when'
  )
}

// For a call expression, return all array-tuple arguments [string, fn]
function tupleFns(node: Rule.Node & { type: 'CallExpression' }) {
  return node.arguments
    .filter(arg => arg.type === 'ArrayExpression' && arg.elements.length >= 2)
    .map(arg => {
      if (arg.type !== 'ArrayExpression') return null
      return arg.elements[1]
    })
    .filter(Boolean) as Rule.Node[]
}

const noInlineGiven: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow inline arrow functions in given() setup tuples — use named functions or factories instead.',
    },
    messages: {
      noInline: 'given() setup functions should be named references or factory calls, not inline arrow functions.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'given') return
        for (const fn of tupleFns(node)) {
          if (isInline(fn)) {
            context.report({ node: fn, messageId: 'noInline' })
          }
        }
      },
    }
  },
}

const noInlineThen: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow inline arrow functions in .then() assertion tuples — use named functions or factories instead.',
    },
    messages: {
      noInline: 'then() assertion functions should be named references or factory calls, not inline arrow functions.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isWhenThen(node)) return
        for (const fn of tupleFns(node)) {
          if (isInline(fn)) {
            context.report({ node: fn, messageId: 'noInline' })
          }
        }
      },
    }
  },
}

const requireInlineWhen: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require inline arrow functions in when() action tuples so the action is visible at the call site.',
    },
    messages: {
      requireInline: 'when() action functions should be inline arrow functions so the action is visible at the call site.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'when') return
        for (const fn of tupleFns(node)) {
          if (!isInline(fn)) {
            context.report({ node: fn, messageId: 'requireInline' })
          }
        }
      },
    }
  },
}

const plugin = {
  rules: {
    'no-inline-given': noInlineGiven,
    'no-inline-then': noInlineThen,
    'require-inline-when': requireInlineWhen,
  },
}

const baseConfig = {
  plugins: { 'vitest-bdd': plugin },
  rules: {
    'vitest-bdd/no-inline-given': 'error',
    'vitest-bdd/no-inline-then': 'error',
    'vitest-bdd/require-inline-when': 'error',
  },
} as const

export const recommended = { ...baseConfig }

export const relaxed = {
  ...baseConfig,
  rules: {
    'vitest-bdd/no-inline-given': 'warn',
    'vitest-bdd/no-inline-then': 'warn',
    'vitest-bdd/require-inline-when': 'warn',
  },
} as const

export default plugin

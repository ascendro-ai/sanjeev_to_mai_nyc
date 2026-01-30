import type {
  TestAssertion,
  AssertionResult,
  AssertionType,
} from '@/types/testing'

/**
 * Get a value from an object using dot notation or JSONPath-like syntax
 */
function getValueByPath(obj: unknown, path: string): unknown {
  if (!path || path === '$') return obj

  // Remove leading $ if present (JSONPath style)
  const normalizedPath = path.startsWith('$.') ? path.slice(2) : path.startsWith('$') ? path.slice(1) : path

  const parts = normalizedPath.split(/\.|\[|\]/).filter(Boolean)

  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

/**
 * Compare two values for equality (deep comparison for objects/arrays)
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return a === b
  if (typeof a !== typeof b) return false

  if (typeof a === 'object') {
    const aKeys = Object.keys(a as object)
    const bKeys = Object.keys(b as object)

    if (aKeys.length !== bKeys.length) return false

    return aKeys.every(key =>
      deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    )
  }

  return false
}

/**
 * Evaluate a single assertion against actual data
 */
export function evaluateAssertion(
  assertion: TestAssertion,
  actualData: unknown,
  stepOutputs?: Record<string, unknown>
): AssertionResult {
  // Get the value to check - either from step output or final output
  const source = assertion.stepId && stepOutputs
    ? stepOutputs[assertion.stepId]
    : actualData

  const actualValue = getValueByPath(source, assertion.path)
  const expectedValue = assertion.expectedValue

  let passed = false
  let message = ''

  try {
    switch (assertion.type) {
      case 'equals':
        passed = deepEqual(actualValue, expectedValue)
        message = passed
          ? `Value equals expected`
          : `Expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`
        break

      case 'notEquals':
        passed = !deepEqual(actualValue, expectedValue)
        message = passed
          ? `Value does not equal expected`
          : `Expected value to not equal ${JSON.stringify(expectedValue)}`
        break

      case 'contains':
        if (typeof actualValue === 'string' && typeof expectedValue === 'string') {
          passed = assertion.options?.caseSensitive !== false
            ? actualValue.includes(expectedValue)
            : actualValue.toLowerCase().includes(expectedValue.toLowerCase())
        } else if (Array.isArray(actualValue)) {
          passed = actualValue.some(item => deepEqual(item, expectedValue))
        }
        message = passed
          ? `Value contains expected`
          : `Expected ${JSON.stringify(actualValue)} to contain ${JSON.stringify(expectedValue)}`
        break

      case 'notContains':
        if (typeof actualValue === 'string' && typeof expectedValue === 'string') {
          passed = !(assertion.options?.caseSensitive !== false
            ? actualValue.includes(expectedValue)
            : actualValue.toLowerCase().includes(expectedValue.toLowerCase()))
        } else if (Array.isArray(actualValue)) {
          passed = !actualValue.some(item => deepEqual(item, expectedValue))
        }
        message = passed
          ? `Value does not contain expected`
          : `Expected ${JSON.stringify(actualValue)} to not contain ${JSON.stringify(expectedValue)}`
        break

      case 'greaterThan':
        passed = Number(actualValue) > Number(expectedValue)
        message = passed
          ? `${actualValue} > ${expectedValue}`
          : `Expected ${actualValue} to be greater than ${expectedValue}`
        break

      case 'lessThan':
        passed = Number(actualValue) < Number(expectedValue)
        message = passed
          ? `${actualValue} < ${expectedValue}`
          : `Expected ${actualValue} to be less than ${expectedValue}`
        break

      case 'greaterThanOrEqual':
        passed = Number(actualValue) >= Number(expectedValue)
        message = passed
          ? `${actualValue} >= ${expectedValue}`
          : `Expected ${actualValue} to be >= ${expectedValue}`
        break

      case 'lessThanOrEqual':
        passed = Number(actualValue) <= Number(expectedValue)
        message = passed
          ? `${actualValue} <= ${expectedValue}`
          : `Expected ${actualValue} to be <= ${expectedValue}`
        break

      case 'isTrue':
        passed = actualValue === true || actualValue === 'true' || actualValue === 1
        message = passed
          ? `Value is truthy`
          : `Expected truthy value, got ${JSON.stringify(actualValue)}`
        break

      case 'isFalse':
        passed = actualValue === false || actualValue === 'false' || actualValue === 0
        message = passed
          ? `Value is falsy`
          : `Expected falsy value, got ${JSON.stringify(actualValue)}`
        break

      case 'isNull':
        passed = actualValue === null || actualValue === undefined
        message = passed
          ? `Value is null/undefined`
          : `Expected null/undefined, got ${JSON.stringify(actualValue)}`
        break

      case 'isNotNull':
        passed = actualValue !== null && actualValue !== undefined
        message = passed
          ? `Value is not null/undefined`
          : `Expected non-null value`
        break

      case 'isEmpty':
        if (typeof actualValue === 'string') {
          passed = actualValue.length === 0
        } else if (Array.isArray(actualValue)) {
          passed = actualValue.length === 0
        } else if (typeof actualValue === 'object' && actualValue !== null) {
          passed = Object.keys(actualValue).length === 0
        } else {
          passed = !actualValue
        }
        message = passed
          ? `Value is empty`
          : `Expected empty value, got ${JSON.stringify(actualValue)}`
        break

      case 'isNotEmpty':
        if (typeof actualValue === 'string') {
          passed = actualValue.length > 0
        } else if (Array.isArray(actualValue)) {
          passed = actualValue.length > 0
        } else if (typeof actualValue === 'object' && actualValue !== null) {
          passed = Object.keys(actualValue).length > 0
        } else {
          passed = !!actualValue
        }
        message = passed
          ? `Value is not empty`
          : `Expected non-empty value`
        break

      case 'matches':
        if (typeof actualValue === 'string' && assertion.options?.regex) {
          const regex = new RegExp(assertion.options.regex)
          passed = regex.test(actualValue)
          message = passed
            ? `Value matches pattern`
            : `Expected ${actualValue} to match ${assertion.options.regex}`
        }
        break

      case 'hasProperty':
        passed = typeof actualValue === 'object' &&
          actualValue !== null &&
          typeof expectedValue === 'string' &&
          expectedValue in (actualValue as object)
        message = passed
          ? `Object has property ${expectedValue}`
          : `Expected object to have property ${expectedValue}`
        break

      case 'hasLength':
        const length = Array.isArray(actualValue)
          ? actualValue.length
          : typeof actualValue === 'string'
            ? actualValue.length
            : null
        passed = length === Number(expectedValue)
        message = passed
          ? `Length equals ${expectedValue}`
          : `Expected length ${expectedValue}, got ${length}`
        break

      case 'custom':
        // Custom assertions require a function string that evaluates to boolean
        if (assertion.options?.customFunction) {
          try {
            const fn = new Function('value', 'expected', assertion.options.customFunction)
            passed = fn(actualValue, expectedValue)
            message = passed ? 'Custom assertion passed' : 'Custom assertion failed'
          } catch (e) {
            message = `Custom function error: ${e instanceof Error ? e.message : 'Unknown error'}`
          }
        }
        break

      default:
        message = `Unknown assertion type: ${assertion.type}`
    }
  } catch (error) {
    message = `Assertion error: ${error instanceof Error ? error.message : 'Unknown error'}`
  }

  return {
    assertionId: assertion.id,
    assertionName: assertion.name,
    stepId: assertion.stepId,
    passed,
    actualValue,
    expectedValue,
    message,
    path: assertion.path,
  }
}

/**
 * Evaluate all assertions against actual data
 */
export function evaluateAllAssertions(
  assertions: TestAssertion[],
  finalOutput: unknown,
  stepOutputs: Record<string, unknown>
): {
  results: AssertionResult[]
  passed: number
  failed: number
  total: number
} {
  const results = assertions.map(assertion =>
    evaluateAssertion(assertion, finalOutput, stepOutputs)
  )

  return {
    results,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    total: results.length,
  }
}

/**
 * Get all available assertion types with descriptions
 */
export function getAssertionTypes(): Array<{
  type: AssertionType
  label: string
  description: string
  requiresExpectedValue: boolean
}> {
  return [
    { type: 'equals', label: 'Equals', description: 'Value exactly equals expected', requiresExpectedValue: true },
    { type: 'notEquals', label: 'Not Equals', description: 'Value does not equal expected', requiresExpectedValue: true },
    { type: 'contains', label: 'Contains', description: 'String/array contains expected value', requiresExpectedValue: true },
    { type: 'notContains', label: 'Not Contains', description: 'Does not contain expected value', requiresExpectedValue: true },
    { type: 'greaterThan', label: 'Greater Than', description: 'Number is greater than expected', requiresExpectedValue: true },
    { type: 'lessThan', label: 'Less Than', description: 'Number is less than expected', requiresExpectedValue: true },
    { type: 'greaterThanOrEqual', label: 'Greater or Equal', description: 'Number is >= expected', requiresExpectedValue: true },
    { type: 'lessThanOrEqual', label: 'Less or Equal', description: 'Number is <= expected', requiresExpectedValue: true },
    { type: 'isTrue', label: 'Is True', description: 'Value is truthy', requiresExpectedValue: false },
    { type: 'isFalse', label: 'Is False', description: 'Value is falsy', requiresExpectedValue: false },
    { type: 'isNull', label: 'Is Null', description: 'Value is null or undefined', requiresExpectedValue: false },
    { type: 'isNotNull', label: 'Is Not Null', description: 'Value is not null', requiresExpectedValue: false },
    { type: 'isEmpty', label: 'Is Empty', description: 'String/array/object is empty', requiresExpectedValue: false },
    { type: 'isNotEmpty', label: 'Is Not Empty', description: 'Has content', requiresExpectedValue: false },
    { type: 'matches', label: 'Matches Regex', description: 'String matches regex pattern', requiresExpectedValue: false },
    { type: 'hasProperty', label: 'Has Property', description: 'Object has the specified property', requiresExpectedValue: true },
    { type: 'hasLength', label: 'Has Length', description: 'Array/string has expected length', requiresExpectedValue: true },
    { type: 'custom', label: 'Custom', description: 'Custom validation function', requiresExpectedValue: false },
  ]
}

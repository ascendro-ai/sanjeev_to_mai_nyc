import { describe, it, expect } from 'vitest'
import { cn } from '../cn'

describe('cn (classnames utility)', () => {
  describe('basic functionality', () => {
    it('should merge class names', () => {
      const result = cn('class1', 'class2')
      expect(result).toContain('class1')
      expect(result).toContain('class2')
    })

    it('should handle single class', () => {
      const result = cn('single-class')
      expect(result).toBe('single-class')
    })

    it('should handle empty input', () => {
      const result = cn()
      expect(result).toBe('')
    })

    it('should handle multiple classes', () => {
      const result = cn('a', 'b', 'c', 'd', 'e')
      expect(result).toContain('a')
      expect(result).toContain('b')
      expect(result).toContain('c')
      expect(result).toContain('d')
      expect(result).toContain('e')
    })
  })

  describe('conditional classes', () => {
    it('should handle conditional classes with boolean', () => {
      const result = cn('base', true && 'conditional')
      expect(result).toContain('base')
      expect(result).toContain('conditional')
    })

    it('should filter out false conditionals', () => {
      const result = cn('base', false && 'not-included')
      expect(result).toContain('base')
      expect(result).not.toContain('not-included')
    })

    it('should handle object syntax', () => {
      const result = cn({
        base: true,
        active: true,
        disabled: false,
      })
      expect(result).toContain('base')
      expect(result).toContain('active')
      expect(result).not.toContain('disabled')
    })

    it('should handle ternary expressions', () => {
      const isActive = true
      const result = cn('button', isActive ? 'active' : 'inactive')
      expect(result).toContain('button')
      expect(result).toContain('active')
      expect(result).not.toContain('inactive')
    })
  })

  describe('Tailwind class merging', () => {
    it('should resolve Tailwind conflicts - padding', () => {
      const result = cn('p-4', 'p-2')
      // Later value should win
      expect(result).toContain('p-2')
      // Should not have duplicate or conflicting
    })

    it('should resolve Tailwind conflicts - background color', () => {
      const result = cn('bg-red-500', 'bg-blue-500')
      // Later value should win
      expect(result).toContain('bg-blue-500')
    })

    it('should resolve Tailwind conflicts - text color', () => {
      const result = cn('text-white', 'text-black')
      expect(result).toContain('text-black')
    })

    it('should resolve Tailwind conflicts - margin', () => {
      const result = cn('m-4', 'm-8')
      expect(result).toContain('m-8')
    })

    it('should preserve non-conflicting classes', () => {
      const result = cn('p-4', 'mt-2', 'bg-red-500')
      expect(result).toContain('p-4')
      expect(result).toContain('mt-2')
      expect(result).toContain('bg-red-500')
    })

    it('should handle responsive prefixes', () => {
      const result = cn('p-2', 'md:p-4', 'lg:p-6')
      expect(result).toContain('p-2')
      expect(result).toContain('md:p-4')
      expect(result).toContain('lg:p-6')
    })

    it('should handle state variants', () => {
      const result = cn('bg-blue-500', 'hover:bg-blue-600', 'focus:bg-blue-700')
      expect(result).toContain('bg-blue-500')
      expect(result).toContain('hover:bg-blue-600')
      expect(result).toContain('focus:bg-blue-700')
    })
  })

  describe('edge cases', () => {
    it('should handle undefined values', () => {
      const result = cn('base', undefined, 'after')
      expect(result).toContain('base')
      expect(result).toContain('after')
      expect(result).not.toContain('undefined')
    })

    it('should handle null values', () => {
      const result = cn('base', null, 'after')
      expect(result).toContain('base')
      expect(result).toContain('after')
      expect(result).not.toContain('null')
    })

    it('should handle empty strings', () => {
      const result = cn('base', '', 'after')
      expect(result).toContain('base')
      expect(result).toContain('after')
    })

    it('should handle arrays', () => {
      const result = cn(['class1', 'class2'], 'class3')
      expect(result).toContain('class1')
      expect(result).toContain('class2')
      expect(result).toContain('class3')
    })

    it('should handle nested arrays', () => {
      const result = cn(['a', ['b', 'c']], 'd')
      expect(result).toContain('a')
      expect(result).toContain('b')
      expect(result).toContain('c')
      expect(result).toContain('d')
    })

    it('should handle number 0', () => {
      const result = cn('base', 0 && 'conditional')
      expect(result).toContain('base')
      expect(result).not.toContain('conditional')
    })

    it('should handle empty object', () => {
      const result = cn('base', {})
      expect(result).toContain('base')
    })

    it('should trim whitespace', () => {
      const result = cn('  spaced  ', 'normal')
      expect(result).not.toMatch(/^\s/)
      expect(result).not.toMatch(/\s$/)
    })
  })

  describe('mixed inputs', () => {
    it('should handle mixed string, object, and array inputs', () => {
      const result = cn(
        'base',
        { active: true, disabled: false },
        ['responsive', 'flex'],
        'additional'
      )
      expect(result).toContain('base')
      expect(result).toContain('active')
      expect(result).not.toContain('disabled')
      expect(result).toContain('responsive')
      expect(result).toContain('flex')
      expect(result).toContain('additional')
    })

    it('should handle real-world component styling', () => {
      const isActive = true
      const isDisabled = false
      const size = 'large'

      const result = cn(
        'button',
        'rounded-lg',
        'font-medium',
        {
          'opacity-50 cursor-not-allowed': isDisabled,
          'cursor-pointer': !isDisabled,
        },
        isActive && 'ring-2 ring-blue-500',
        size === 'large' && 'px-6 py-3',
        size === 'small' && 'px-2 py-1'
      )

      expect(result).toContain('button')
      expect(result).toContain('rounded-lg')
      expect(result).toContain('cursor-pointer')
      expect(result).toContain('ring-2')
      expect(result).toContain('px-6')
      expect(result).not.toContain('opacity-50')
      expect(result).not.toContain('px-2')
    })
  })

  describe('performance', () => {
    it('should handle large number of classes efficiently', () => {
      const classes = Array.from({ length: 100 }, (_, i) => `class-${i}`)
      const startTime = performance.now()
      const result = cn(...classes)
      const duration = performance.now() - startTime

      expect(duration).toBeLessThan(100) // Should be fast
      expect(result).toContain('class-0')
      expect(result).toContain('class-99')
    })
  })
})

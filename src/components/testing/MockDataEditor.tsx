'use client'

import { useState, useCallback, useEffect } from 'react'
import { Plus, Trash2, AlertCircle } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { cn } from '@/lib/utils'

interface MockDataEditorProps {
  value: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
  placeholder?: string
  className?: string
  mode?: 'simple' | 'json'
}

interface FieldEntry {
  key: string
  value: string
  type: 'string' | 'number' | 'boolean' | 'json'
}

export default function MockDataEditor({
  value,
  onChange,
  placeholder,
  className,
  mode: initialMode = 'simple',
}: MockDataEditorProps) {
  const [mode, setMode] = useState<'simple' | 'json'>(initialMode)
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [fields, setFields] = useState<FieldEntry[]>([])

  // Initialize from value
  useEffect(() => {
    const entries = Object.entries(value).map(([key, val]) => ({
      key,
      value: typeof val === 'object' ? JSON.stringify(val) : String(val),
      type: (typeof val === 'number'
        ? 'number'
        : typeof val === 'boolean'
          ? 'boolean'
          : typeof val === 'object'
            ? 'json'
            : 'string') as FieldEntry['type'],
    }))
    setFields(entries.length > 0 ? entries : [{ key: '', value: '', type: 'string' }])
    setJsonText(JSON.stringify(value, null, 2))
  }, [value])

  // Convert fields to object
  const fieldsToObject = useCallback((fields: FieldEntry[]): Record<string, unknown> => {
    const obj: Record<string, unknown> = {}
    for (const field of fields) {
      if (!field.key.trim()) continue
      switch (field.type) {
        case 'number':
          obj[field.key] = Number(field.value) || 0
          break
        case 'boolean':
          obj[field.key] = field.value === 'true'
          break
        case 'json':
          try {
            obj[field.key] = JSON.parse(field.value)
          } catch {
            obj[field.key] = field.value
          }
          break
        default:
          obj[field.key] = field.value
      }
    }
    return obj
  }, [])

  const handleFieldChange = (index: number, updates: Partial<FieldEntry>) => {
    const newFields = [...fields]
    newFields[index] = { ...newFields[index], ...updates }
    setFields(newFields)
    onChange(fieldsToObject(newFields))
  }

  const handleAddField = () => {
    const newFields = [...fields, { key: '', value: '', type: 'string' as const }]
    setFields(newFields)
  }

  const handleRemoveField = (index: number) => {
    const newFields = fields.filter((_, i) => i !== index)
    setFields(newFields.length > 0 ? newFields : [{ key: '', value: '', type: 'string' }])
    onChange(fieldsToObject(newFields))
  }

  const handleJsonChange = (text: string) => {
    setJsonText(text)
    try {
      const parsed = JSON.parse(text)
      setJsonError(null)
      onChange(parsed)
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON')
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Mode Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMode('simple')}
          className={cn(
            'px-3 py-1 text-xs rounded-full transition-colors',
            mode === 'simple'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          )}
        >
          Simple
        </button>
        <button
          onClick={() => setMode('json')}
          className={cn(
            'px-3 py-1 text-xs rounded-full transition-colors',
            mode === 'json'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          )}
        >
          JSON
        </button>
      </div>

      {mode === 'simple' ? (
        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={field.key}
                onChange={(e) => handleFieldChange(index, { key: e.target.value })}
                placeholder="Key"
                className="w-32"
              />
              <select
                value={field.type}
                onChange={(e) =>
                  handleFieldChange(index, { type: e.target.value as FieldEntry['type'] })
                }
                className="px-2 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="string">Text</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="json">JSON</option>
              </select>
              {field.type === 'boolean' ? (
                <select
                  value={field.value}
                  onChange={(e) => handleFieldChange(index, { value: e.target.value })}
                  className="flex-1 px-2 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (
                <Input
                  value={field.value}
                  onChange={(e) => handleFieldChange(index, { value: e.target.value })}
                  placeholder={
                    field.type === 'json' ? '{"nested": "object"}' : 'Value'
                  }
                  className="flex-1"
                />
              )}
              <button
                onClick={() => handleRemoveField(index)}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={handleAddField}>
            <Plus className="h-4 w-4 mr-1" />
            Add Field
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={jsonText}
            onChange={(e) => handleJsonChange(e.target.value)}
            placeholder={placeholder || '{\n  "key": "value"\n}'}
            className={cn(
              'w-full h-48 px-3 py-2 text-sm font-mono border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500',
              jsonError ? 'border-red-300' : 'border-gray-300'
            )}
          />
          {jsonError && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>{jsonError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, ChevronDown, Save, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkflowStep } from '@/types'

interface NodeParameter {
  name: string
  displayName: string
  type: 'string' | 'number' | 'boolean' | 'options' | 'json' | 'collection'
  default?: unknown
  description?: string
  required?: boolean
  options?: Array<{ name: string; value: string }>
}

interface NodeTypeInfo {
  stepType: string
  stepLabel: string
  suggestedNode: string
  displayName: string
  parameters: NodeParameter[]
  availableNodes: Array<{
    type: string
    displayName: string
    hasSchema: boolean
  }>
}

interface StepConfigModalProps {
  step: WorkflowStep
  isOpen: boolean
  onClose: () => void
  onSave: (config: Record<string, unknown>) => void
}

export default function StepConfigModal({
  step,
  isOpen,
  onClose,
  onSave,
}: StepConfigModalProps) {
  const [nodeInfo, setNodeInfo] = useState<NodeTypeInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedNodeType, setSelectedNodeType] = useState<string>('')
  const [config, setConfig] = useState<Record<string, unknown>>({})
  const [showNodeSelector, setShowNodeSelector] = useState(false)

  // Fetch node type info when step changes
  useEffect(() => {
    if (!isOpen || !step) return

    const fetchNodeInfo = async () => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({
          stepType: step.type,
          stepLabel: step.label,
        })
        const response = await fetch(`/api/n8n/node-types?${params}`)
        const data = await response.json()
        setNodeInfo(data)
        setSelectedNodeType(data.suggestedNode)

        // Initialize config with defaults
        const defaultConfig: Record<string, unknown> = {}
        data.parameters?.forEach((param: NodeParameter) => {
          if (param.default !== undefined) {
            defaultConfig[param.name] = param.default
          }
        })
        // Merge with existing requirements
        setConfig({ ...defaultConfig, ...step.requirements?.n8nConfig })
      } catch (error) {
        console.error('Error fetching node info:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchNodeInfo()
  }, [isOpen, step])

  // Fetch new schema when node type changes
  useEffect(() => {
    if (!selectedNodeType || !nodeInfo || selectedNodeType === nodeInfo.suggestedNode) return

    const fetchNodeSchema = async () => {
      try {
        const response = await fetch(`/api/n8n/node-types?nodeType=${selectedNodeType}`)
        const data = await response.json()
        if (data.parameters) {
          setNodeInfo(prev => prev ? { ...prev, parameters: data.parameters, displayName: data.displayName } : null)
        }
      } catch (error) {
        console.error('Error fetching node schema:', error)
      }
    }

    fetchNodeSchema()
  }, [selectedNodeType])

  const handleConfigChange = (name: string, value: unknown) => {
    setConfig(prev => ({ ...prev, [name]: value }))
  }

  const handleSave = () => {
    onSave({
      n8nNodeType: selectedNodeType,
      n8nConfig: config,
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-[#1a1a1a] rounded-xl border border-[#3a3a3a] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <div>
            <h2 className="text-lg font-semibold text-white">{step.label}</h2>
            <p className="text-sm text-gray-400 mt-0.5">Configure step parameters</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#2a2a2a] rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
              <span className="ml-3 text-gray-400">Fetching configuration schema...</span>
            </div>
          ) : nodeInfo ? (
            <div className="space-y-6">
              {/* Node Type Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Integration Type
                </label>
                <div className="relative">
                  <button
                    onClick={() => setShowNodeSelector(!showNodeSelector)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg text-left hover:border-[#4a4a4a] transition-colors"
                  >
                    <span className="text-white">{nodeInfo.displayName}</span>
                    <ChevronDown className={cn(
                      "h-4 w-4 text-gray-400 transition-transform",
                      showNodeSelector && "rotate-180"
                    )} />
                  </button>

                  {showNodeSelector && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                      {nodeInfo.availableNodes.map((node) => (
                        <button
                          key={node.type}
                          onClick={() => {
                            setSelectedNodeType(node.type)
                            setShowNodeSelector(false)
                          }}
                          className={cn(
                            "w-full px-4 py-2 text-left text-sm hover:bg-[#3a3a3a] transition-colors",
                            selectedNodeType === node.type ? "bg-[#3a3a3a] text-white" : "text-gray-300"
                          )}
                        >
                          {node.displayName}
                          {!node.hasSchema && (
                            <span className="ml-2 text-xs text-gray-500">(Basic)</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Parameters */}
              {nodeInfo.parameters.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-300">Parameters</h3>

                  {nodeInfo.parameters.map((param) => (
                    <div key={param.name} className="space-y-1.5">
                      <label className="flex items-center gap-2 text-sm text-gray-300">
                        {param.displayName}
                        {param.required && (
                          <span className="text-red-400 text-xs">*</span>
                        )}
                        {param.description && (
                          <div className="group relative">
                            <Info className="h-3.5 w-3.5 text-gray-500" />
                            <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-48 p-2 bg-[#333] text-xs text-gray-300 rounded shadow-lg z-10">
                              {param.description}
                            </div>
                          </div>
                        )}
                      </label>

                      {param.type === 'options' && param.options ? (
                        <select
                          value={(config[param.name] as string) || ''}
                          onChange={(e) => handleConfigChange(param.name, e.target.value)}
                          className="w-full px-3 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                        >
                          <option value="">Select...</option>
                          {param.options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.name}
                            </option>
                          ))}
                        </select>
                      ) : param.type === 'boolean' ? (
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={(config[param.name] as boolean) || false}
                            onChange={(e) => handleConfigChange(param.name, e.target.checked)}
                            className="w-4 h-4 rounded border-[#3a3a3a] bg-[#2a2a2a] text-blue-500 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-400">Enable</span>
                        </label>
                      ) : param.type === 'number' ? (
                        <input
                          type="number"
                          value={(config[param.name] as number) || ''}
                          onChange={(e) => handleConfigChange(param.name, parseFloat(e.target.value))}
                          placeholder={`Enter ${param.displayName.toLowerCase()}...`}
                          className="w-full px-3 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                        />
                      ) : param.type === 'json' ? (
                        <textarea
                          value={typeof config[param.name] === 'object' ? JSON.stringify(config[param.name], null, 2) : (config[param.name] as string) || ''}
                          onChange={(e) => {
                            try {
                              handleConfigChange(param.name, JSON.parse(e.target.value))
                            } catch {
                              handleConfigChange(param.name, e.target.value)
                            }
                          }}
                          placeholder="Enter JSON..."
                          rows={4}
                          className="w-full px-3 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
                        />
                      ) : (
                        <input
                          type="text"
                          value={(config[param.name] as string) || ''}
                          onChange={(e) => handleConfigChange(param.name, e.target.value)}
                          placeholder={param.description || `Enter ${param.displayName.toLowerCase()}...`}
                          className="w-full px-3 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p>No configurable parameters for this node type.</p>
                  <p className="text-sm mt-1 text-gray-500">This step will use default settings.</p>
                </div>
              )}

              {/* Help text */}
              <div className="bg-[#2a2a2a] rounded-lg p-4 border border-[#3a3a3a]">
                <p className="text-xs text-gray-400">
                  <strong className="text-gray-300">Tip:</strong> You can use expressions like{' '}
                  <code className="bg-[#333] px-1 py-0.5 rounded text-blue-400">{'{{$json.fieldName}}'}</code>{' '}
                  to reference data from previous steps.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p>Unable to load configuration schema.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#2a2a2a] bg-[#1a1a1a]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#2a2a2a] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Save className="h-4 w-4" />
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  )
}

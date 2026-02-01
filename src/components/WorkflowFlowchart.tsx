'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Zap, Bot, GitBranch, CheckCircle, Webhook, Mail, Database, MessageSquare, Settings } from 'lucide-react'
import type { WorkflowStep } from '@/types'

interface WorkflowFlowchartProps {
  steps: WorkflowStep[]
  selectedStepId?: string
  onStepClick?: (stepId: string) => void
  className?: string
}

const NODE_WIDTH = 180
const NODE_HEIGHT = 60
const HORIZONTAL_GAP = 120
const VERTICAL_GAP = 100

// Get icon for step type
function getStepIcon(step: WorkflowStep) {
  const iconClass = "w-5 h-5"

  switch (step.type) {
    case 'trigger':
      if (step.label.toLowerCase().includes('email') || step.label.toLowerCase().includes('mail')) {
        return <Mail className={iconClass} />
      }
      if (step.label.toLowerCase().includes('webhook') || step.label.toLowerCase().includes('form')) {
        return <Webhook className={iconClass} />
      }
      return <Zap className={iconClass} />
    case 'decision':
      return <GitBranch className={iconClass} />
    case 'end':
      return <CheckCircle className={iconClass} />
    case 'subworkflow':
      return <Settings className={iconClass} />
    default:
      if (step.assignedTo?.type === 'ai') {
        return <Bot className={iconClass} />
      }
      if (step.label.toLowerCase().includes('database') || step.label.toLowerCase().includes('data')) {
        return <Database className={iconClass} />
      }
      if (step.label.toLowerCase().includes('slack') || step.label.toLowerCase().includes('message') || step.label.toLowerCase().includes('notify')) {
        return <MessageSquare className={iconClass} />
      }
      return <Bot className={iconClass} />
  }
}

// Get node color based on type
function getNodeColors(step: WorkflowStep) {
  switch (step.type) {
    case 'trigger':
      return {
        bg: 'bg-[#2a2a2a]',
        border: 'border-[#ff6b6b]',
        iconBg: 'bg-[#ff6b6b]/20',
        iconColor: 'text-[#ff6b6b]',
      }
    case 'decision':
      return {
        bg: 'bg-[#2a2a2a]',
        border: 'border-[#4ecdc4]',
        iconBg: 'bg-[#4ecdc4]/20',
        iconColor: 'text-[#4ecdc4]',
      }
    case 'end':
      return {
        bg: 'bg-[#2a2a2a]',
        border: 'border-[#95e881]',
        iconBg: 'bg-[#95e881]/20',
        iconColor: 'text-[#95e881]',
      }
    default:
      // AI agent or action - white outline for AI automations
      const isAI = step.assignedTo?.type === 'ai' || !step.assignedTo
      return {
        bg: 'bg-[#2a2a2a]',
        border: isAI ? 'border-white' : 'border-[#6c6c6c]',
        iconBg: isAI ? 'bg-white/20' : 'bg-[#5c5c5c]',
        iconColor: 'text-white',
      }
  }
}

// Calculate node positions for a serpentine flow layout
// nodesPerRow is dynamic based on container width
function calculatePositions(steps: WorkflowStep[], nodesPerRow: number = 4) {
  const positions: Map<string, { x: number; y: number }> = new Map()

  if (steps.length === 0) return positions

  const startX = 50
  const startY = 50

  steps.forEach((step, index) => {
    const row = Math.floor(index / nodesPerRow)
    const posInRow = index % nodesPerRow
    const isEvenRow = row % 2 === 0

    // Serpentine: even rows go left-to-right, odd rows go right-to-left
    let currentX: number
    if (isEvenRow) {
      currentX = startX + posInRow * (NODE_WIDTH + HORIZONTAL_GAP)
    } else {
      currentX = startX + (nodesPerRow - 1 - posInRow) * (NODE_WIDTH + HORIZONTAL_GAP)
    }

    const currentY = startY + row * (NODE_HEIGHT + VERTICAL_GAP)

    positions.set(step.id, { x: currentX, y: currentY })
  })

  return positions
}

// Calculate bounding box of all nodes
function getBoundingBox(positions: Map<string, { x: number; y: number }>) {
  if (positions.size === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  }

  const values = Array.from(positions.values())
  const minX = Math.min(...values.map(p => p.x))
  const minY = Math.min(...values.map(p => p.y))
  const maxX = Math.max(...values.map(p => p.x)) + NODE_WIDTH
  const maxY = Math.max(...values.map(p => p.y)) + NODE_HEIGHT

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

// Generate bezier curve path between two points
function generatePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  fromIndex: number,
  toIndex: number,
  nodesPerRow: number
): string {
  const fromRow = Math.floor(fromIndex / nodesPerRow)
  const toRow = Math.floor(toIndex / nodesPerRow)
  const isRowTransition = fromRow !== toRow

  // Row transition - curved diagonal going down
  if (isRowTransition) {
    const controlOffset = 60
    return `M ${x1} ${y1} C ${x1} ${y1 + controlOffset}, ${x2} ${y2 - controlOffset}, ${x2} ${y2}`
  }

  // Same row - horizontal connection
  const midX = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`
}

export default function WorkflowFlowchart({
  steps,
  selectedStepId,
  onStepClick,
  className = '',
}: WorkflowFlowchartProps) {
  const sortedSteps = useMemo(
    () => [...steps].sort((a, b) => a.order - b.order),
    [steps]
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 400 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [manualPan, setManualPan] = useState<{ x: number; y: number } | null>(null)
  const [manualScale, setManualScale] = useState<number | null>(null)

  // Track container size
  useEffect(() => {
    if (!containerRef.current) return

    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setContainerSize({ width, height })
    })

    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  // Calculate optimal nodes per row based on container width
  const nodesPerRow = useMemo(() => {
    const availableWidth = containerSize.width - 100 // padding
    const nodeWithGap = NODE_WIDTH + HORIZONTAL_GAP
    const calculated = Math.floor(availableWidth / nodeWithGap)
    return Math.max(2, Math.min(6, calculated)) // between 2 and 6 nodes per row
  }, [containerSize.width])

  const positions = useMemo(
    () => calculatePositions(sortedSteps, nodesPerRow),
    [sortedSteps, nodesPerRow]
  )

  const boundingBox = useMemo(() => getBoundingBox(positions), [positions])

  // Calculate auto-fit scale and pan
  const autoFit = useMemo(() => {
    if (positions.size === 0) {
      return { scale: 1, panX: 0, panY: 0 }
    }

    const padding = 60
    const availableWidth = containerSize.width - padding * 2
    const availableHeight = containerSize.height - padding * 2

    const scaleX = availableWidth / boundingBox.width
    const scaleY = availableHeight / boundingBox.height
    const scale = Math.min(scaleX, scaleY, 1) // Don't scale up beyond 1

    // Center the workflow
    const scaledWidth = boundingBox.width * scale
    const scaledHeight = boundingBox.height * scale
    const panX = (containerSize.width - scaledWidth) / 2 - boundingBox.minX * scale
    const panY = (containerSize.height - scaledHeight) / 2 - boundingBox.minY * scale

    return { scale, panX, panY }
  }, [positions.size, containerSize, boundingBox])

  // Use manual values if set, otherwise auto-fit
  const scale = manualScale ?? autoFit.scale
  const panState = manualPan ?? { x: autoFit.panX, y: autoFit.panY }

  // Reset to auto-fit when steps change
  useEffect(() => {
    setManualPan(null)
    setManualScale(null)
  }, [sortedSteps.length])

  // Calculate canvas dimensions
  const canvasWidth = Math.max(1200, boundingBox.maxX + 200)
  const canvasHeight = Math.max(600, boundingBox.maxY + 200)

  // Handle mouse down for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('.workflow-node')) return

    setIsDragging(true)
    setDragStart({
      x: e.clientX - panState.x,
      y: e.clientY - panState.y,
    })
    e.preventDefault()
  }

  // Handle wheel for zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    const newScale = Math.min(Math.max(0.5, scale + delta), 2)
    setManualScale(newScale)
  }

  useEffect(() => {
    if (!isDragging) return

    const handleGlobalMouseMove = (e: MouseEvent) => {
      setManualPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }

    const handleGlobalMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('mouseup', handleGlobalMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isDragging, dragStart])

  // Generate connections between sequential steps
  const connections = useMemo(() => {
    const result: Array<{ from: string; to: string; fromIndex: number; toIndex: number; label?: string }> = []

    for (let i = 0; i < sortedSteps.length - 1; i++) {
      const current = sortedSteps[i]
      const next = sortedSteps[i + 1]

      if (current.type === 'decision') {
        // Decision nodes can have true/false branches
        result.push({ from: current.id, to: next.id, fromIndex: i, toIndex: i + 1, label: 'true' })
      } else {
        result.push({ from: current.id, to: next.id, fromIndex: i, toIndex: i + 1 })
      }
    }

    return result
  }, [sortedSteps])

  if (sortedSteps.length === 0) {
    return (
      <div className={`relative w-full h-full bg-[#1a1a1a] ${className}`}>
        {/* Dotted grid background */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, #333 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-medium text-gray-400">No steps yet</p>
            <p className="text-sm mt-1 text-gray-500">Start a conversation to design your workflow</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-[#1a1a1a] overflow-hidden ${className}`}
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      {/* Dotted grid background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, #333 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Canvas */}
      <div
        className="absolute"
        style={{
          transform: `translate(${panState.x}px, ${panState.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
        }}
      >
        {/* SVG for connections */}
        <svg
          className="absolute pointer-events-none"
          width={canvasWidth}
          height={canvasHeight}
          style={{ overflow: 'visible' }}
        >
          <defs>
            <marker
              id="arrowhead-dark"
              markerWidth="10"
              markerHeight="10"
              refX="8"
              refY="5"
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#666" />
            </marker>
          </defs>

          {connections.map((conn, index) => {
            const fromPos = positions.get(conn.from)
            const toPos = positions.get(conn.to)
            if (!fromPos || !toPos) return null

            const fromRow = Math.floor(conn.fromIndex / nodesPerRow)
            const toRow = Math.floor(conn.toIndex / nodesPerRow)
            const isRowTransition = fromRow !== toRow
            const isFromEvenRow = fromRow % 2 === 0

            let x1: number, y1: number, x2: number, y2: number

            if (isRowTransition) {
              // Row transition: exit from end of row, enter at same side of next row
              if (isFromEvenRow) {
                // Even row ends on right, next row (odd) starts on right
                x1 = fromPos.x + NODE_WIDTH
                x2 = toPos.x + NODE_WIDTH
              } else {
                // Odd row ends on left, next row (even) starts on left
                x1 = fromPos.x
                x2 = toPos.x
              }
              y1 = fromPos.y + NODE_HEIGHT / 2
              y2 = toPos.y + NODE_HEIGHT / 2
            } else {
              // Same row
              if (isFromEvenRow) {
                // Even rows: left to right
                x1 = fromPos.x + NODE_WIDTH
                x2 = toPos.x
              } else {
                // Odd rows: right to left
                x1 = fromPos.x
                x2 = toPos.x + NODE_WIDTH
              }
              y1 = fromPos.y + NODE_HEIGHT / 2
              y2 = toPos.y + NODE_HEIGHT / 2
            }

            return (
              <g key={index}>
                <path
                  d={generatePath(x1, y1, x2, y2, conn.fromIndex, conn.toIndex, nodesPerRow)}
                  fill="none"
                  stroke="#555"
                  strokeWidth="2"
                  markerEnd="url(#arrowhead-dark)"
                />
                {conn.label && (
                  <text
                    x={(x1 + x2) / 2}
                    y={(y1 + y2) / 2 - 10}
                    fill="#888"
                    fontSize="11"
                    textAnchor="middle"
                  >
                    {conn.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* Nodes */}
        {sortedSteps.map((step) => {
          const pos = positions.get(step.id)
          if (!pos) return null

          const colors = getNodeColors(step)
          const isSelected = selectedStepId === step.id

          return (
            <div
              key={step.id}
              className={`workflow-node absolute cursor-pointer transition-all duration-200 ${colors.bg} ${colors.border} border-2 rounded-lg`}
              style={{
                left: pos.x,
                top: pos.y,
                width: NODE_WIDTH,
                height: NODE_HEIGHT,
                boxShadow: isSelected
                  ? '0 0 0 2px #3b82f6, 0 0 20px rgba(59,130,246,0.5)'
                  : '0 4px 12px rgba(0,0,0,0.4)',
              }}
              onClick={() => onStepClick?.(step.id)}
            >
              {/* Connection dots */}
              <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-[#555] rounded-full border-2 border-[#1a1a1a]" />
              <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-[#555] rounded-full border-2 border-[#1a1a1a]" />

              {/* Node content */}
              <div className="flex items-center gap-3 h-full px-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center ${colors.iconBg}`}>
                  <span className={colors.iconColor}>
                    {getStepIcon(step)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {step.label}
                  </p>
                  <p className="text-gray-400 text-xs truncate">
                    {step.type === 'trigger' ? 'Trigger' :
                     step.type === 'decision' ? 'Condition' :
                     step.type === 'end' ? 'End' :
                     step.assignedTo?.type === 'ai' ? 'AI Agent' : 'Action'}
                  </p>
                </div>
              </div>

              {/* Add button */}
              <div className="absolute -right-4 top-1/2 -translate-y-1/2 translate-x-full opacity-0 hover:opacity-100 transition-opacity">
                <div className="w-6 h-6 bg-[#333] rounded border border-[#555] flex items-center justify-center text-gray-400 hover:text-white cursor-pointer">
                  <span className="text-lg leading-none">+</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] p-1">
        <button
          onClick={() => setManualScale(Math.max(0.5, scale - 0.1))}
          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#3a3a3a] rounded"
        >
          -
        </button>
        <span className="text-xs text-gray-400 w-12 text-center">{Math.round(scale * 100)}%</span>
        <button
          onClick={() => setManualScale(Math.min(2, scale + 0.1))}
          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#3a3a3a] rounded"
        >
          +
        </button>
        <button
          onClick={() => {
            setManualScale(null)
            setManualPan(null)
          }}
          className="px-2 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#3a3a3a] rounded text-xs"
          title="Fit to view"
        >
          Fit
        </button>
      </div>
    </div>
  )
}

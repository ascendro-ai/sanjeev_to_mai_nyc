'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Circle } from 'lucide-react'
import type { WorkflowStep } from '@/types'

interface WorkflowFlowchartProps {
  steps: WorkflowStep[]
  selectedStepId?: string
  onStepClick?: (stepId: string) => void
  className?: string
}

const CARD_WIDTH = 240
const CARD_HEIGHT = 140
const HORIZONTAL_GAP = 280
const VERTICAL_GAP = 220
const CARDS_PER_ROW = 3

// Calculate position for serpentine layout
function calculatePosition(index: number) {
  const row = Math.floor(index / CARDS_PER_ROW)
  const col = index % CARDS_PER_ROW
  const isEvenRow = row % 2 === 0

  // For odd rows, reverse the column order
  const actualCol = isEvenRow ? col : CARDS_PER_ROW - 1 - col

  const x = actualCol * HORIZONTAL_GAP
  const y = row * VERTICAL_GAP

  return { x, y, row, col: actualCol, isEvenRow }
}

// Get card styling based on assignment
function getCardStyles(step: WorkflowStep) {
  const baseStyles = {
    width: `${CARD_WIDTH}px`,
    height: `${CARD_HEIGHT}px`,
    backgroundColor: '#F9FAFB',
    borderColor: '#9CA3AF',
    borderRadius: '0.5rem',
    borderWidth: '2px',
    borderStyle: 'solid' as const,
    color: '#1F2937',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
  }

  // AI-assigned steps: greyish blue
  if (step.assignedTo?.type === 'ai') {
    return {
      ...baseStyles,
      backgroundColor: '#C4D1E3',
      borderColor: '#9BA8BA',
      borderStyle: step.type === 'decision' ? 'dashed' as const : 'solid' as const,
    }
  }

  // Human-assigned steps: peach
  if (step.assignedTo?.type === 'human') {
    return {
      ...baseStyles,
      backgroundColor: '#F5C9B8',
      borderColor: '#E8B5A0',
      borderStyle: step.type === 'decision' ? 'dashed' as const : 'solid' as const,
    }
  }

  // Unassigned: default to AI color
  return {
    ...baseStyles,
    backgroundColor: '#C4D1E3',
    borderColor: '#9BA8BA',
    borderStyle: step.type === 'decision' ? 'dashed' as const : 'solid' as const,
  }
}

// Get type label
function getTypeLabel(type: string): string {
  switch (type) {
    case 'trigger':
      return 'TRIGGER'
    case 'action':
      return 'ACTION'
    case 'decision':
      return 'CHECK'
    case 'end':
      return 'END'
    case 'subworkflow':
      return 'SUBFLOW'
    default:
      return 'STEP'
  }
}

// Check step status for badge display
function getStepStatus(step: WorkflowStep): 'needs-attention' | 'complete' | null {
  // Only show badges for action steps assigned to AI
  if (step.type === 'trigger' || step.type === 'end') return null

  // Only show badges for AI-assigned steps
  if (step.assignedTo?.type !== 'ai') return null

  // If complete, show complete badge
  if (step.requirements?.isComplete === true) {
    return 'complete'
  }

  // Default to "needs attention" for AI steps
  return 'needs-attention'
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
  const [hoveredStepId, setHoveredStepId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [panState, setPanState] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [wasDragging, setWasDragging] = useState(false)

  // Calculate container dimensions
  const totalRows = Math.ceil(sortedSteps.length / CARDS_PER_ROW)
  const containerWidth = CARDS_PER_ROW * HORIZONTAL_GAP
  const containerHeight = totalRows * VERTICAL_GAP + CARD_HEIGHT

  // Handle mouse down for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('.workflow-card')) {
      return
    }
    setIsDragging(true)
    setDragStart({
      x: e.clientX - panState.x,
      y: e.clientY - panState.y,
    })
    e.preventDefault()
  }

  // Handle mouse move for dragging
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPanState({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }

  // Handle mouse up to stop dragging
  const handleMouseUp = () => {
    if (isDragging) {
      setWasDragging(true)
      setTimeout(() => setWasDragging(false), 100)
    }
    setIsDragging(false)
  }

  // Handle mouse leave to stop dragging
  const handleMouseLeave = () => {
    setIsDragging(false)
  }

  // Add global mouse event listeners for smooth dragging
  useEffect(() => {
    if (!isDragging) return

    const handleGlobalMouseMove = (e: MouseEvent) => {
      setPanState({
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

  // Generate arrow paths
  const arrows = useMemo(() => {
    const result: Array<{
      x1: number
      y1: number
      x2: number
      y2: number
      direction: 'right' | 'left' | 'down'
    }> = []

    for (let i = 0; i < sortedSteps.length - 1; i++) {
      const current = calculatePosition(i)
      const next = calculatePosition(i + 1)

      if (current.row === next.row) {
        // Same row: horizontal arrow
        const arrowY = current.y + CARD_HEIGHT / 2
        const arrowX1 = current.x + CARD_WIDTH
        const arrowX2 = next.x

        result.push({
          x1: arrowX1,
          y1: arrowY,
          x2: arrowX2,
          y2: arrowY,
          direction: current.isEvenRow ? 'right' : 'left',
        })
      } else {
        // Different row: vertical arrow
        const arrowX = current.x + CARD_WIDTH / 2
        const arrowY1 = current.y + CARD_HEIGHT
        const arrowY2 = next.y

        result.push({
          x1: arrowX,
          y1: arrowY1,
          x2: arrowX,
          y2: arrowY2,
          direction: 'down',
        })
      }
    }

    return result
  }, [sortedSteps])

  if (sortedSteps.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full text-gray-500 ${className}`}>
        <div className="text-center">
          <p className="text-lg font-medium">No steps yet</p>
          <p className="text-sm mt-1">Start a conversation to design your workflow</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      <div
        className="relative p-8"
        style={{
          minHeight: `${containerHeight}px`,
          transform: `translate(${panState.x}px, ${panState.y}px)`,
          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
        }}
      >
        <svg
          className="absolute inset-0 pointer-events-none"
          width={containerWidth}
          height={containerHeight}
          style={{ left: 0, top: 0 }}
        >
          {/* Arrow connectors */}
          {arrows.map((arrow, index) => (
            <g key={index}>
              <line
                x1={arrow.x1}
                y1={arrow.y1}
                x2={arrow.x2}
                y2={arrow.y2}
                stroke="#a855f7"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
            </g>
          ))}
          {/* Arrowhead marker definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#a855f7" />
            </marker>
          </defs>
        </svg>

        {/* Workflow cards */}
        {sortedSteps.map((step, index) => {
          const position = calculatePosition(index)
          const styles = getCardStyles(step)
          const isSelected = selectedStepId === step.id
          const isHovered = hoveredStepId === step.id
          const stepStatus = getStepStatus(step)

          const boxShadow =
            isHovered || isSelected
              ? '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
              : styles.boxShadow

          return (
            <div
              key={step.id}
              className="absolute cursor-pointer transition-all duration-200 workflow-card"
              style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: styles.width,
                height: styles.height,
                backgroundColor: styles.backgroundColor,
                color: styles.color,
                borderRadius: styles.borderRadius,
                border: `${styles.borderWidth} ${styles.borderStyle} ${styles.borderColor}`,
                boxShadow,
                transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                zIndex: isSelected ? 10 : isHovered ? 5 : 1,
              }}
              onClick={(e) => {
                if (wasDragging || isDragging) {
                  e.stopPropagation()
                  return
                }
                onStepClick?.(step.id)
              }}
              onMouseEnter={() => setHoveredStepId(step.id)}
              onMouseLeave={() => setHoveredStepId(null)}
            >
              {/* Step number badge */}
              <div
                className="absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white shadow-md"
                style={{
                  backgroundColor:
                    step.assignedTo?.type === 'human' ? '#E8B5A0' : '#9BA8BA',
                }}
              >
                {index + 1}
              </div>

              {/* Status badge */}
              {stepStatus === 'needs-attention' && (
                <div className="absolute top-2 right-2 z-20">
                  <div
                    className="px-3 py-1 rounded-full text-xs font-semibold text-white shadow-md"
                    style={{ backgroundColor: '#F59E0B' }}
                  >
                    Needs Attention
                  </div>
                </div>
              )}
              {stepStatus === 'complete' && (
                <div className="absolute top-2 right-2 z-20">
                  <div
                    className="px-3 py-1 rounded-full text-xs font-semibold text-white shadow-md"
                    style={{ backgroundColor: '#10B981' }}
                  >
                    Ready
                  </div>
                </div>
              )}

              {/* Card content */}
              <div className="h-full p-4 flex flex-col">
                {/* Type label */}
                <div className="flex items-center gap-1 mb-2">
                  <span
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: styles.color || '#6B7280' }}
                  >
                    {getTypeLabel(step.type)}
                  </span>
                  {step.type === 'decision' && (
                    <div className="flex gap-1 ml-1">
                      <Circle className="w-2 h-2 fill-current animate-pulse" />
                      <Circle
                        className="w-2 h-2 fill-current animate-pulse"
                        style={{ animationDelay: '0.2s' }}
                      />
                      <Circle
                        className="w-2 h-2 fill-current animate-pulse"
                        style={{ animationDelay: '0.4s' }}
                      />
                    </div>
                  )}
                </div>

                {/* Step label */}
                <div className="flex-1 flex items-center">
                  <p
                    className="text-sm font-medium leading-tight line-clamp-3"
                    style={{ color: styles.color || '#111827' }}
                  >
                    {step.label}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-20 pointer-events-none">
        <div className="text-xs font-semibold text-gray-700 mb-2">LEGEND</div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: '#C4D1E3' }}
            />
            <span className="text-xs text-gray-600">AI Assigned</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: '#F5C9B8' }}
            />
            <span className="text-xs text-gray-600">Human Assigned</span>
          </div>
        </div>
      </div>
    </div>
  )
}

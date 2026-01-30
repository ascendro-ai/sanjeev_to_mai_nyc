'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import * as d3 from 'd3'
import { ToggleLeft, ToggleRight, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { useTeam } from '@/hooks/useTeam'
import { useWorkflows } from '@/hooks/useWorkflows'
import type { DigitalWorker, NodeData, Workflow } from '@/types'

// Helper function to get initials from name
function getInitials(name: string): string {
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

// Transform workers to tree structure
function buildOrgChartData(workers: DigitalWorker[], userName: string = 'You'): NodeData {
  return {
    name: userName,
    type: 'human',
    role: 'Manager',
    status: 'active',
    assignedWorkflows: [],
    children: workers.map((worker) => ({
      name: worker.name,
      type: worker.type,
      role: worker.description || (worker.type === 'ai' ? 'AI Agent' : 'Team Member'),
      status: worker.status as NodeData['status'],
      assignedWorkflows: worker.assignedWorkflows || [],
    })),
  }
}

interface OrgChartProps {
  className?: string
}

export default function OrgChart({ className = '' }: OrgChartProps) {
  const {
    workers,
    isLoading,
    activateWorker,
    deactivateWorker,
  } = useTeam()

  const { workflows } = useWorkflows()

  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null)
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('')

  // Build org chart data from workers
  const orgChartData = useMemo(
    () => buildOrgChartData(workers || []),
    [workers]
  )

  // Build D3 org chart
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return
    if (isLoading) return

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove()

    const svg = d3.select(svgRef.current)
    const width = containerRef.current.clientWidth || 800
    const height = containerRef.current.clientHeight || 600

    // Set SVG dimensions
    svg.attr('width', width).attr('height', height)

    // Create hierarchical data structure
    const root = d3.hierarchy<NodeData>(orgChartData)

    // Use nodeSize with proper spacing
    const treeLayout = d3.tree<NodeData>().nodeSize([200, 200])
    const treeData = treeLayout(root)

    // Create a container group for zoom/pan
    const container = svg.append('g').attr('class', 'container')

    // Set up zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        container.attr('transform', event.transform.toString())
      })

    svg.call(zoom)

    // Center the camera on the root node
    const rootNode = treeData.descendants()[0]
    const rootX = rootNode ? rootNode.y : 0
    const rootY = rootNode ? rootNode.x : 0

    const initialTransform = d3.zoomIdentity
      .translate(width / 2 - rootX, 80 - rootY)
      .scale(0.75)
    svg.call(zoom.transform, initialTransform)

    // Use linkVertical for smooth Bezier curves
    const linkGenerator = d3
      .linkVertical<d3.HierarchyPointLink<NodeData>, d3.HierarchyPointNode<NodeData>>()
      .x((d) => d.y)
      .y((d) => d.x)

    // Create links (render before nodes)
    container
      .append('g')
      .attr('class', 'links')
      .selectAll('path')
      .data(treeData.links())
      .enter()
      .append('path')
      .attr('d', linkGenerator as unknown as string)
      .attr('stroke', '#D1D5DB')
      .attr('stroke-width', 1.5)
      .attr('fill', 'none')

    // Create nodes
    const nodes = container
      .append('g')
      .attr('class', 'nodes')
      .selectAll('g.node')
      .data(treeData.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (d) => `translate(${d.y},${d.x})`)
      .style('cursor', 'pointer')
      .on('click', (_event, d) => {
        setSelectedNode(d.data)
      })

    // Add node cards
    nodes
      .append('rect')
      .attr('width', 200)
      .attr('height', 60)
      .attr('x', -100)
      .attr('y', -30)
      .attr('rx', 8)
      .attr('fill', '#FFFFFF')
      .attr('stroke', '#E5E7EB')
      .attr('stroke-width', 1)
      .attr('filter', 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.05))')

    // Add avatar circles
    nodes
      .append('circle')
      .attr('cx', -70)
      .attr('cy', 0)
      .attr('r', 20)
      .attr('fill', (d) => (d.data.type === 'human' ? '#FCE7F3' : '#DBEAFE'))
      .attr('stroke', (d) => (d.data.type === 'human' ? '#F9A8D4' : '#93C5FD'))
      .attr('stroke-width', 1)

    // Add initials in avatar
    nodes
      .append('text')
      .attr('x', -70)
      .attr('y', 0)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .attr('fill', (d) => (d.data.type === 'human' ? '#EC4899' : '#3B82F6'))
      .text((d) => getInitials(d.data.name))

    // Add name text
    nodes
      .append('text')
      .attr('x', -40)
      .attr('y', -8)
      .attr('text-anchor', 'start')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '14px')
      .attr('font-weight', '500')
      .attr('fill', '#111827')
      .text((d) => {
        const name = d.data.name
        return name.length > 15 ? name.substring(0, 15) + '...' : name
      })

    // Add role/title text
    nodes
      .append('text')
      .attr('x', -40)
      .attr('y', 10)
      .attr('text-anchor', 'start')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '11px')
      .attr('font-style', 'italic')
      .attr('fill', '#6B7280')
      .text((d) => d.data.role || '')

    // Add ACTIVE badge for active non-human nodes
    const activeNodes = nodes.filter(
      (d) => d.data.type !== 'human' && d.data.status === 'active'
    )

    activeNodes
      .append('rect')
      .attr('x', 60)
      .attr('y', -12)
      .attr('width', 50)
      .attr('height', 20)
      .attr('rx', 10)
      .attr('fill', '#10B981')

    activeNodes
      .append('text')
      .attr('x', 85)
      .attr('y', 0)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .attr('fill', '#FFFFFF')
      .text('ACTIVE')

    // Add status indicator for inactive/needs_attention nodes
    nodes
      .filter((d) => d.data.type !== 'human' && d.data.status !== 'active')
      .append('circle')
      .attr('r', 6)
      .attr('cx', 80)
      .attr('cy', -20)
      .attr('fill', (d) =>
        d.data.status === 'needs_attention' ? '#F59E0B' : '#9CA3AF'
      )
  }, [orgChartData, isLoading])

  const handleToggleStatus = async (nodeName: string) => {
    const worker = workers.find((w) => w.name === nodeName)
    if (!worker) return

    if (worker.status === 'active') {
      await deactivateWorker.mutateAsync(worker.id)
    } else {
      await activateWorker.mutateAsync(worker.id)
    }

    // Update selected node state
    if (selectedNode && selectedNode.name === nodeName) {
      setSelectedNode({
        ...selectedNode,
        status: worker.status === 'active' ? 'inactive' : 'active',
      })
    }
  }

  const handleWorkflowAssign = async () => {
    if (!selectedNode || !selectedWorkflowId) return
    // TODO: Implement workflow assignment through API
    console.log('Assign workflow:', selectedWorkflowId, 'to:', selectedNode.name)
    setSelectedWorkflowId('')
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ cursor: 'grab' }}
      />

      {/* Node Details Panel */}
      {selectedNode && selectedNode.type !== 'human' && (
        <div className="absolute bottom-4 right-4 w-80 bg-white rounded-lg shadow-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {selectedNode.name}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleToggleStatus(selectedNode.name)}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
              >
                {selectedNode.status === 'active' ? (
                  <ToggleRight className="h-6 w-6 text-green-600" />
                ) : (
                  <ToggleLeft className="h-6 w-6 text-gray-400" />
                )}
              </button>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Type</p>
              <p className="text-sm font-medium text-gray-900 capitalize">
                {selectedNode.type}
              </p>
            </div>

            {selectedNode.role && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Role</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedNode.role}
                </p>
              </div>
            )}

            <div>
              <p className="text-xs text-gray-500 mb-1">Status</p>
              <span
                className={`inline-block px-2 py-1 text-xs rounded ${
                  selectedNode.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {selectedNode.status || 'inactive'}
              </span>
            </div>

            {/* Workflow Assignment */}
            <div>
              <p className="text-xs text-gray-500 mb-2">Assign Workflow</p>
              <select
                value={selectedWorkflowId}
                onChange={(e) => setSelectedWorkflowId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-2"
              >
                <option value="">Select a workflow...</option>
                {workflows.map((workflow: Workflow) => (
                  <option key={workflow.id} value={workflow.id}>
                    {workflow.name}{' '}
                    {workflow.status === 'draft' ? '(Draft)' : ''}
                  </option>
                ))}
              </select>
              <Button
                onClick={handleWorkflowAssign}
                disabled={!selectedWorkflowId}
                size="sm"
                className="w-full"
              >
                Assign Workflow
              </Button>
            </div>

            {/* Assigned Workflows */}
            {selectedNode.assignedWorkflows &&
              selectedNode.assignedWorkflows.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">
                    Assigned Workflows
                  </p>
                  <div className="space-y-1">
                    {selectedNode.assignedWorkflows.map((workflowId) => {
                      const workflow = workflows.find(
                        (w: Workflow) => w.id === workflowId
                      )
                      return workflow ? (
                        <div
                          key={workflowId}
                          className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-700"
                        >
                          {workflow.name}
                        </div>
                      ) : null
                    })}
                  </div>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  )
}

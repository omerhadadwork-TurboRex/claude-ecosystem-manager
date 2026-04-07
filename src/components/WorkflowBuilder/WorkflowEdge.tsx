import { memo, useCallback, useState, useEffect, useRef } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react'
import { X } from 'lucide-react'

function WorkflowEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  selected,
  style = {},
}: EdgeProps) {
  const { setEdges } = useReactFlow()
  const [showDelete, setShowDelete] = useState(false)
  const [deletePos, setDeletePos] = useState<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setEdges(eds => eds.filter(edge => edge.id !== id))
    setShowDelete(false)
    setDeletePos(null)
  }, [id, setEdges])

  const handlePathClick = useCallback((e: React.MouseEvent<SVGPathElement>) => {
    e.stopPropagation()
    const svg = (e.target as SVGElement).closest('svg')
    if (!svg) return
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const ctm = (e.target as SVGGraphicsElement).getScreenCTM()
    if (!ctm) return
    const svgPt = pt.matrixTransform(ctm.inverse())
    setDeletePos({ x: svgPt.x, y: svgPt.y })
    setShowDelete(true)
  }, [])

  const handleLabelClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletePos({ x: labelX + 30, y: labelY })
    setShowDelete(true)
  }, [labelX, labelY])

  // Close on outside click
  useEffect(() => {
    if (!showDelete) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDelete(false)
        setDeletePos(null)
      }
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler) }
  }, [showDelete])

  const prevSelected = useRef(selected)
  useEffect(() => {
    if (prevSelected.current && !selected) {
      setShowDelete(false)
      setDeletePos(null)
    }
    prevSelected.current = selected
  }, [selected])

  const delX = deletePos?.x ?? labelX + 30
  const delY = deletePos?.y ?? labelY

  return (
    <>
      {/* Invisible wider path for easier click targeting */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={22}
        style={{ cursor: 'pointer' }}
        onClick={handlePathClick}
      />
      <BaseEdge
        path={edgePath}
        style={{
          ...style,
          stroke: selected ? '#4f46e5' : '#6366f1',
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: '6 3',
          animation: 'dashdraw 0.5s linear infinite',
        }}
      />
      <EdgeLabelRenderer>
        {/* Label at midpoint */}
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <div
            onClick={handleLabelClick}
            className={`
              px-2 py-0.5 rounded-md text-[10px] font-semibold cursor-pointer select-none
              transition-all duration-150
              ${selected
                ? 'bg-indigo-100 text-indigo-700 border border-indigo-300 shadow-sm'
                : 'bg-indigo-50/95 text-indigo-500 border border-indigo-200/60 hover:bg-indigo-100 hover:shadow-sm'
              }
            `}
          >
            {label || 'invokes'}
          </div>
        </div>

        {/* Delete button at click position */}
        {showDelete && (
          <div
            ref={containerRef}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${delX}px,${delY}px)`,
              pointerEvents: 'all',
              zIndex: 1000,
            }}
            className="nodrag nopan"
          >
            <button
              onClick={handleDelete}
              className="w-7 h-7 rounded-full flex items-center justify-center
                         bg-red-500 text-white shadow-lg ring-2 ring-white
                         hover:bg-red-600 hover:scale-110 transition-all duration-150 cursor-pointer"
              title="Delete connection"
            >
              <X size={13} strokeWidth={3} />
            </button>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}

export default memo(WorkflowEdgeComponent)

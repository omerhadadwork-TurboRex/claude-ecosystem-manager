import { useState, useEffect, useCallback } from 'react'
import {
  fetchEnvironment,
  switchEnvironment,
  resetTestEnvironment,
  promoteToProduction,
  type EnvType,
  type EnvState,
} from '../../lib/api-client'
import { FlaskConical, Rocket, RotateCcw, ArrowUpFromLine, Loader2 } from 'lucide-react'

interface EnvironmentSwitcherProps {
  isLive: boolean
  onEnvChange?: (env: EnvType) => void
}

export default function EnvironmentSwitcher({ isLive, onEnvChange }: EnvironmentSwitcherProps) {
  const [envState, setEnvState] = useState<EnvState>({ active: 'prod', sandboxExists: false })
  const [isLoading, setIsLoading] = useState(false)
  const [showActions, setShowActions] = useState(false)

  // Fetch initial environment state
  useEffect(() => {
    if (!isLive) return
    fetchEnvironment()
      .then(setEnvState)
      .catch(() => {})
  }, [isLive])

  const handleSwitch = useCallback(async (env: EnvType) => {
    if (env === envState.active || isLoading) return
    setIsLoading(true)
    try {
      const result = await switchEnvironment(env)
      setEnvState(result)
      onEnvChange?.(result.active)
    } catch (err) {
      console.error('Failed to switch environment:', err)
    } finally {
      setIsLoading(false)
    }
  }, [envState.active, isLoading, onEnvChange])

  const handleReset = useCallback(async () => {
    if (!confirm('This will discard all test changes and re-copy from production.\n\nContinue?')) return
    setIsLoading(true)
    try {
      await resetTestEnvironment()
      onEnvChange?.('test')
    } catch (err) {
      console.error('Failed to reset sandbox:', err)
    } finally {
      setIsLoading(false)
    }
  }, [onEnvChange])

  const handlePromote = useCallback(async () => {
    if (!confirm(
      'This will overwrite your production ~/.claude/ files with the test sandbox contents.\n\n' +
      'A backup will be created first.\n\nContinue?'
    )) return
    setIsLoading(true)
    try {
      const result = await promoteToProduction()
      if (result.success) {
        setEnvState({ active: 'prod', sandboxExists: false })
        onEnvChange?.('prod')
        setShowActions(false)
      }
    } catch (err) {
      console.error('Failed to promote:', err)
    } finally {
      setIsLoading(false)
    }
  }, [onEnvChange])

  if (!isLive) return null

  const isTest = envState.active === 'test'

  return (
    <div className="relative flex items-center">
      {/* Segmented toggle */}
      <div className={`
        flex items-center rounded-lg border overflow-hidden text-[10px] font-bold
        ${isTest
          ? 'border-amber-300 bg-amber-50'
          : 'border-gray-200 bg-gray-50'
        }
      `}>
        <button
          onClick={() => handleSwitch('prod')}
          disabled={isLoading}
          className={`
            flex items-center gap-1 px-2.5 py-1.5 transition-all
            ${!isTest
              ? 'bg-white text-green-700 shadow-sm'
              : 'text-gray-400 hover:text-gray-600'
            }
          `}
        >
          <Rocket size={10} />
          PROD
        </button>
        <button
          onClick={() => handleSwitch('test')}
          disabled={isLoading}
          className={`
            flex items-center gap-1 px-2.5 py-1.5 transition-all
            ${isTest
              ? 'bg-amber-400 text-amber-900 shadow-sm'
              : 'text-gray-400 hover:text-gray-600'
            }
          `}
        >
          {isLoading ? (
            <Loader2 size={10} className="animate-spin" />
          ) : (
            <FlaskConical size={10} />
          )}
          TEST
        </button>
      </div>

      {/* Test actions */}
      {isTest && (
        <div className="flex items-center gap-0.5 ml-1">
          <button
            onClick={handleReset}
            disabled={isLoading}
            className="p-1.5 rounded-md text-amber-600 hover:bg-amber-100 transition-colors"
            title="Reset sandbox (re-copy from prod)"
          >
            <RotateCcw size={11} />
          </button>
          <button
            onClick={handlePromote}
            disabled={isLoading}
            className="p-1.5 rounded-md text-green-600 hover:bg-green-100 transition-colors"
            title="Promote to production"
          >
            <ArrowUpFromLine size={11} />
          </button>
        </div>
      )}
    </div>
  )
}

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { onboardingService } from '../lib/onboardingService'
import { supabase } from '../lib/supabaseClient'

export default function OnboardingChecklist({ userId, userEmail, onTaskComplete, onOpenAddressModal, onOpenProfileModal, onOpenVerificationModal, onOpenCurrencyModal, onNavigate }) {
  const [tasks, setTasks] = useState([])
  const [progress, setProgress] = useState({ percentage: 0, completed: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [completingTaskId, setCompletingTaskId] = useState(null)
  const [showChecklist, setShowChecklist] = useState(true)

  const allCompleted = progress.completed === progress.total && progress.total === 4

  // Load tasks and preferences - memoized to avoid recreating on each render
  const loadTasks = useCallback(async () => {
    try {
      const [tasksData, progressData] = await Promise.all([
        onboardingService.getOnboardingTasks(userId),
        onboardingService.getOnboardingProgress(userId)
      ])
      setTasks(tasksData)
      setProgress(progressData)
    } catch (err) {
      console.error('Error loading tasks:', err)
    }
  }, [userId])

  // Load user preference for showing/hiding checklist
  const loadShowChecklistPreference = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('show_onboarding_checklist')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.warn('Error loading checklist preference:', error)
        return
      }

      if (data) {
        setShowChecklist(data.show_onboarding_checklist !== false)
      }
    } catch (err) {
      console.error('Error loading checklist preference:', err)
    }
  }, [userId])

  // Load tasks and preferences once on userId change
  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([
      loadTasks(),
      loadShowChecklistPreference()
    ]).finally(() => setLoading(false))
  }, [userId, loadTasks, loadShowChecklistPreference])


  // Remove auto-detection to prevent unnecessary database queries
  // Tasks are now only validated when user explicitly clicks "Start"

  const handleTaskComplete = async (task) => {
    setCompletingTaskId(task.id)
    try {
      // Handle specific task actions first
      if (task.action === 'open-address-modal') {
        onOpenAddressModal?.()
      } else if (task.action === 'navigate-profile') {
        onOpenProfileModal?.()
      } else if (task.action === 'verify-email') {
        onOpenVerificationModal?.()
      } else if (task.action === 'set-currency') {
        onOpenCurrencyModal?.()
      }

      // Mark task as complete in database
      await onboardingService.updateTaskCompletion(userId, task.id, true)

      // Reload tasks to reflect changes
      await loadTasks()

      onTaskComplete?.(task)
    } catch (err) {
      console.error('Error completing task:', err)
    } finally {
      setCompletingTaskId(null)
    }
  }

  // Save preference to hide checklist permanently
  const handleRemoveChecklist = async () => {
    try {
      const { error } = await supabase
        .from('user_preferences')
        .update({ show_onboarding_checklist: false })
        .eq('user_id', userId)

      if (error) {
        console.error('Error saving checklist preference:', error)
        return
      }

      setShowChecklist(false)
    } catch (err) {
      console.error('Error removing checklist:', err)
    }
  }

  if (!userId || loading || !showChecklist) {
    return null
  }

  const incompleteTasks = tasks.filter(t => !t.completed)

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl shadow-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 border-b border-blue-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎯</span>
            <div>
              <h3 className="text-lg font-bold text-white">Welcome To Currency.ph</h3>
              <p className="text-sm text-blue-100">{allCompleted ? '✓ All tasks completed!' : 'Get started with these setup tasks'}</p>
            </div>
          </div>
          {allCompleted && (
            <button
              onClick={handleRemoveChecklist}
              className="text-blue-200 hover:text-white transition-colors p-2 hover:bg-blue-600 rounded-lg"
              title="Remove checklist"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="h-2.5 bg-blue-500 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-semibold text-white w-12 text-right">
            {progress.percentage}%
          </span>
        </div>
      </div>

      {/* Tasks List */}
      <div className="p-6">
        {incompleteTasks.length === 0 ? (
          <div className="py-12 text-center">
            <span className="text-5xl mb-4 block">🎉</span>
            <p className="text-lg font-semibold text-slate-900 mb-2">All set!</p>
            <p className="text-slate-600">You've completed all your onboarding tasks</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map(task => (
              <div
                key={task.id}
                className={`p-4 rounded-lg border-2 transition-all ${
                  task.completed
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <button
                    onClick={() => handleTaskComplete(task)}
                    disabled={completingTaskId === task.id}
                    className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      task.completed
                        ? 'bg-green-500 border-green-500 shadow-md'
                        : 'border-slate-300 hover:border-blue-500 hover:bg-blue-50'
                    } disabled:opacity-50`}
                  >
                    {task.completed && (
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* Task Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h4 className={`font-semibold text-sm ${
                          task.completed ? 'text-slate-500 line-through' : 'text-slate-900'
                        }`}>
                          {task.icon} {task.title}
                        </h4>
                        <p className={`text-sm mt-1.5 ${
                          task.completed ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                          {task.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {task.category !== 'essential' && (
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${
                            task.category === 'important'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {task.category === 'important' ? '⭐ Important' : 'Optional'}
                          </span>
                        )}
                        {!task.completed && (
                          <button
                            onClick={() => handleTaskComplete(task)}
                            disabled={completingTaskId === task.id}
                            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                          >
                            {completingTaskId === task.id ? 'Loading...' : 'Start'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="px-6 py-4 bg-white border-t border-slate-200">
        <p className="text-sm font-medium text-slate-900">
          {progress.completed} of {progress.total} tasks completed
        </p>
        <p className="text-xs text-slate-600 mt-1">
          {progress.total - progress.completed} task{progress.total - progress.completed !== 1 ? 's' : ''} remaining
        </p>
      </div>
    </div>
  )
}

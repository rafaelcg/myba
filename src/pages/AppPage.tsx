import { useState, useEffect, useCallback, useRef } from 'react'
import { SignInButton, UserButton, useAuth, useClerk, useUser } from '../lib/auth'
import { useShallow } from 'zustand/react/shallow'
import {
  ticketsApi,
  aiApi,
  Ticket,
  ProjectField,
  ProjectFieldType,
  UpdateTicketInput,
  gitlabApi,
  GitLabSyncMode
} from '../utils/api'
import { getClerkFallbackAuthUrls } from '../utils/clerk'
import { useCopyToClipboard } from '../hooks/useCopyToClipboard'
import {
  useAppUiStore,
  ActiveView,
  RoadmapReleaseState,
  TableSortKey,
} from '../stores/appUiStore'
import { useAppDataStore } from '../stores/appDataStore'
import { AppShellSkeleton } from '../components/app/AppShellSkeleton'
import { AppStateScreen } from '../components/app/AppStateScreen'

interface Column {
  id: string
  title: string
  status: Ticket['status']
}

const TABLE_SORT_KEYS: TableSortKey[] = [
  'title',
  'ticket',
  'owner',
  'priority',
  'status',
  'milestone',
  'comments',
]

const COLUMNS: Column[] = [
  { id: 'icebox', title: 'Icebox', status: 'icebox' },
  { id: 'todo', title: 'To Do', status: 'todo' },
  { id: 'progress', title: 'In Progress', status: 'progress' },
  { id: 'review', title: 'Review', status: 'review' },
  { id: 'done', title: 'Done', status: 'done' },
]

const PRIORITIES = [
  { value: 'low', label: 'Low', color: '#10b981' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'high', label: 'High', color: '#ef4444' }
] as const

const ROADMAP_UNPLANNED_VERSION = 'Unplanned'
const ROADMAP_RELEASE_COLUMNS: Array<{
  id: RoadmapReleaseState
  label: string
  border: string
  background: string
}> = [
  { id: 'planned', label: 'Planned', border: '#c7d2fe', background: '#eef2ff' },
  { id: 'committed', label: 'Committed', border: '#bfdbfe', background: '#eff6ff' },
  { id: 'shipped', label: 'Shipped', border: '#bbf7d0', background: '#ecfdf5' },
]

type InlineSpreadsheetCell = {
  ticketId: string
  columnId: TableSortKey
}

type TableUpdatePlan = {
  ticketId: string
  originalTicket: Ticket
  optimisticTicket: Ticket
  patch: UpdateTicketInput
  savingCellKeys: string[]
}

interface WorkspacePermalinkState {
  projectKey: string | null
  view: ActiveView | null
  ticketId: string | null
}

function isActiveView(value: string | null): value is ActiveView {
  return value === 'board' || value === 'table' || value === 'roadmap'
}

function parseWorkspacePermalink(search: string): WorkspacePermalinkState {
  const params = new URLSearchParams(search)
  const projectParam = params.get('project')?.trim() || null
  const viewParam = params.get('view')?.trim() || null
  const ticketParam = params.get('ticket')?.trim() || null

  return {
    projectKey: projectParam,
    view: isActiveView(viewParam) ? viewParam : null,
    ticketId: ticketParam || null,
  }
}

function getGitLabRepoIdFromProjectKey(projectKey?: string | null): number | null {
  if (!projectKey) {
    return null
  }

  const match = /^gitlab:(\d+)$/.exec(projectKey)
  if (!match) {
    return null
  }

  const repoId = Number.parseInt(match[1], 10)
  return Number.isFinite(repoId) && repoId > 0 ? repoId : null
}

function buildWorkspacePermalink(projectKey: string, view: ActiveView, ticketId?: string | null): string {
  const params = new URLSearchParams()
  params.set('project', projectKey)
  params.set('view', view)
  if (ticketId) {
    params.set('ticket', ticketId)
  }

  const query = params.toString()
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  return `${origin}/app${query ? `?${query}` : ''}`
}

function renderGeneratedTicketPreview(content: string): JSX.Element[] {
  return content.split('\n').map((rawLine, index) => {
    const line = rawLine.trimEnd()
    const key = `preview-line-${index}`

    if (!line.trim()) {
      return <div key={key} style={{ height: '8px' }} />
    }

    if (line.startsWith('### ')) {
      return (
        <h4 key={key} style={{ margin: '10px 0 6px', fontSize: '15px', lineHeight: 1.35, color: 'var(--modal-title-text)' }}>
          {line.replace(/^###\s+/, '')}
        </h4>
      )
    }

    if (line.startsWith('## ')) {
      return (
        <h3 key={key} style={{ margin: '12px 0 7px', fontSize: '17px', lineHeight: 1.3, color: 'var(--modal-title-text)' }}>
          {line.replace(/^##\s+/, '')}
        </h3>
      )
    }

    if (line.startsWith('# ')) {
      return (
        <h2 key={key} style={{ margin: '3px 0 8px', fontSize: '20px', lineHeight: 1.25, color: 'var(--modal-title-text)' }}>
          {line.replace(/^#\s+/, '')}
        </h2>
      )
    }

    if (/^- \[[ xX]\]\s+/.test(line)) {
      const checked = /^- \[[xX]\]\s+/.test(line)
      const label = line.replace(/^- \[[ xX]\]\s+/, '')
      return (
        <div key={key} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', margin: '4px 0' }}>
          <span style={{ width: '14px', color: checked ? 'var(--modal-status-active-text)' : 'var(--text-muted)' }}>
            {checked ? '☑' : '☐'}
          </span>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5 }}>{label}</p>
        </div>
      )
    }

    if (line.startsWith('- ')) {
      return (
        <div key={key} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', margin: '4px 0' }}>
          <span style={{ width: '12px', color: 'var(--text-muted)' }}>•</span>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5 }}>{line.replace(/^- /, '')}</p>
        </div>
      )
    }

    return (
      <p key={key} style={{ margin: '0 0 6px', fontSize: '14px', lineHeight: 1.55 }}>
        {line}
      </p>
    )
  })
}

function stripMarkdownForPrompt(content?: string): string {
  if (!content) return ''
  return content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^- \[[ xX]\]\s+/gm, '')
    .replace(/^- /gm, '')
    .trim()
}

export function AppPage() {
  const { isSignedIn, isLoaded } = useUser()
  const { getToken, userId } = useAuth()
  const { signOut } = useClerk()

  const {
    tickets,
    setTickets,
    loading,
    setLoading,
    error,
    setError,
    gitlabStatus,
    setGitlabStatus,
    gitlabRepos,
    setGitlabRepos,
    gitlabMembers,
    setGitlabMembers,
    gitlabLoading,
    setGitlabLoading,
    gitlabConnecting,
    setGitlabConnecting,
    gitlabRepoSaving,
    setGitlabRepoSaving,
    gitlabSyncingTickets,
    setGitlabSyncingTickets,
    gitlabLastSyncedAt,
    setGitlabLastSyncedAt,
    gitlabSyncErrors,
    setGitlabSyncErrors,
    gitlabMessage,
    setGitlabMessage,
    gitlabError,
    setGitlabError,
    projectFields,
    setProjectFields,
    localTicketCount,
    setLocalTicketCount,
    importingLocalTickets,
    setImportingLocalTickets,
  } = useAppDataStore(useShallow((state) => ({
    tickets: state.tickets,
    setTickets: state.setTickets,
    loading: state.loading,
    setLoading: state.setLoading,
    error: state.error,
    setError: state.setError,
    gitlabStatus: state.gitlabStatus,
    setGitlabStatus: state.setGitlabStatus,
    gitlabRepos: state.gitlabRepos,
    setGitlabRepos: state.setGitlabRepos,
    gitlabMembers: state.gitlabMembers,
    setGitlabMembers: state.setGitlabMembers,
    gitlabLoading: state.gitlabLoading,
    setGitlabLoading: state.setGitlabLoading,
    gitlabConnecting: state.gitlabConnecting,
    setGitlabConnecting: state.setGitlabConnecting,
    gitlabRepoSaving: state.gitlabRepoSaving,
    setGitlabRepoSaving: state.setGitlabRepoSaving,
    gitlabSyncingTickets: state.gitlabSyncingTickets,
    setGitlabSyncingTickets: state.setGitlabSyncingTickets,
    gitlabLastSyncedAt: state.gitlabLastSyncedAt,
    setGitlabLastSyncedAt: state.setGitlabLastSyncedAt,
    gitlabSyncErrors: state.gitlabSyncErrors,
    setGitlabSyncErrors: state.setGitlabSyncErrors,
    gitlabMessage: state.gitlabMessage,
    setGitlabMessage: state.setGitlabMessage,
    gitlabError: state.gitlabError,
    setGitlabError: state.setGitlabError,
    projectFields: state.projectFields,
    setProjectFields: state.setProjectFields,
    localTicketCount: state.localTicketCount,
    setLocalTicketCount: state.setLocalTicketCount,
    importingLocalTickets: state.importingLocalTickets,
    setImportingLocalTickets: state.setImportingLocalTickets,
  })))
  
  const {
    showQuickCreate,
    setShowQuickCreate,
    quickInput,
    setQuickInput,
    aiSuggestion,
    setAiSuggestion,
    isGenerating,
    setIsGenerating,
    isCreating,
    setIsCreating,
    selectedTicket,
    setSelectedTicket,
    editingTicket,
    setEditingTicket,
    versionInput,
    setVersionInput,
    showVersionSuggestions,
    setShowVersionSuggestions,
    draggedTicket,
    setDraggedTicket,
    dragOverColumn,
    setDragOverColumn,
    searchQuery,
    setSearchQuery,
    activeView,
    setActiveView,
    tableSort,
    setTableSort,
    showAddFieldModal,
    setShowAddFieldModal,
    newFieldName,
    setNewFieldName,
    newFieldType,
    setNewFieldType,
    newFieldOptions,
    setNewFieldOptions,
    savingField,
    setSavingField,
    deletingFieldId,
    setDeletingFieldId,
    draggingProjectFieldId,
    setDraggingProjectFieldId,
    dragOverProjectFieldId,
    setDragOverProjectFieldId,
    roadmapPriorityFilter,
    setRoadmapPriorityFilter,
    roadmapAssigneeFilter,
    setRoadmapAssigneeFilter,
    roadmapCustomFieldId,
    setRoadmapCustomFieldId,
    roadmapCustomFieldValue,
    setRoadmapCustomFieldValue,
    roadmapReleaseStateByVersion,
    setRoadmapReleaseStateByVersion,
    roadmapDraggingTicketId,
    setRoadmapDraggingTicketId,
    roadmapDragOverVersion,
    setRoadmapDragOverVersion,
    showMobileSidebar,
    setShowMobileSidebar,
  } = useAppUiStore(useShallow((state) => ({
    showQuickCreate: state.showQuickCreate,
    setShowQuickCreate: state.setShowQuickCreate,
    quickInput: state.quickInput,
    setQuickInput: state.setQuickInput,
    aiSuggestion: state.aiSuggestion,
    setAiSuggestion: state.setAiSuggestion,
    isGenerating: state.isGenerating,
    setIsGenerating: state.setIsGenerating,
    isCreating: state.isCreating,
    setIsCreating: state.setIsCreating,
    selectedTicket: state.selectedTicket,
    setSelectedTicket: state.setSelectedTicket,
    editingTicket: state.editingTicket,
    setEditingTicket: state.setEditingTicket,
    versionInput: state.versionInput,
    setVersionInput: state.setVersionInput,
    showVersionSuggestions: state.showVersionSuggestions,
    setShowVersionSuggestions: state.setShowVersionSuggestions,
    draggedTicket: state.draggedTicket,
    setDraggedTicket: state.setDraggedTicket,
    dragOverColumn: state.dragOverColumn,
    setDragOverColumn: state.setDragOverColumn,
    searchQuery: state.searchQuery,
    setSearchQuery: state.setSearchQuery,
    activeView: state.activeView,
    setActiveView: state.setActiveView,
    tableSort: state.tableSort,
    setTableSort: state.setTableSort,
    showAddFieldModal: state.showAddFieldModal,
    setShowAddFieldModal: state.setShowAddFieldModal,
    newFieldName: state.newFieldName,
    setNewFieldName: state.setNewFieldName,
    newFieldType: state.newFieldType,
    setNewFieldType: state.setNewFieldType,
    newFieldOptions: state.newFieldOptions,
    setNewFieldOptions: state.setNewFieldOptions,
    savingField: state.savingField,
    setSavingField: state.setSavingField,
    deletingFieldId: state.deletingFieldId,
    setDeletingFieldId: state.setDeletingFieldId,
    draggingProjectFieldId: state.draggingProjectFieldId,
    setDraggingProjectFieldId: state.setDraggingProjectFieldId,
    dragOverProjectFieldId: state.dragOverProjectFieldId,
    setDragOverProjectFieldId: state.setDragOverProjectFieldId,
    roadmapPriorityFilter: state.roadmapPriorityFilter,
    setRoadmapPriorityFilter: state.setRoadmapPriorityFilter,
    roadmapAssigneeFilter: state.roadmapAssigneeFilter,
    setRoadmapAssigneeFilter: state.setRoadmapAssigneeFilter,
    roadmapCustomFieldId: state.roadmapCustomFieldId,
    setRoadmapCustomFieldId: state.setRoadmapCustomFieldId,
    roadmapCustomFieldValue: state.roadmapCustomFieldValue,
    setRoadmapCustomFieldValue: state.setRoadmapCustomFieldValue,
    roadmapReleaseStateByVersion: state.roadmapReleaseStateByVersion,
    setRoadmapReleaseStateByVersion: state.setRoadmapReleaseStateByVersion,
    roadmapDraggingTicketId: state.roadmapDraggingTicketId,
    setRoadmapDraggingTicketId: state.setRoadmapDraggingTicketId,
    roadmapDragOverVersion: state.roadmapDragOverVersion,
    setRoadmapDragOverVersion: state.setRoadmapDragOverVersion,
    showMobileSidebar: state.showMobileSidebar,
    setShowMobileSidebar: state.setShowMobileSidebar,
  })))

  // Debounce timer for AI
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null)
  const [regeneratePrompt, setRegeneratePrompt] = useState('')
  const [regeneratingContent, setRegeneratingContent] = useState(false)
  const [isEditingGeneratedContent, setIsEditingGeneratedContent] = useState(false)
  const [showRegeneratePrompt, setShowRegeneratePrompt] = useState(false)
  const [tableActiveCell, setTableActiveCell] = useState<InlineSpreadsheetCell | null>(null)
  const [tableEditingCell, setTableEditingCell] = useState<InlineSpreadsheetCell | null>(null)
  const [tableEditingValue, setTableEditingValue] = useState('')
  const [tableSavingCellKeys, setTableSavingCellKeys] = useState<Record<string, true>>({})
  const [tableSaveError, setTableSaveError] = useState<string | null>(null)

  const syncingTicketIdsRef = useRef<Set<string>>(new Set())
  const tableCellRefs = useRef<Record<string, HTMLTableCellElement | null>>({})
  const tableEditorRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>(null)
  const setTableCellNode = useCallback((cellKey: string, node: HTMLTableCellElement | null) => {
    if (node) {
      tableCellRefs.current[cellKey] = node
      return
    }

    delete tableCellRefs.current[cellKey]
  }, [])
  const setTableEditorNode = useCallback((node: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null) => {
    tableEditorRef.current = node
  }, [])
  const initialPermalinkRef = useRef<WorkspacePermalinkState>(
    typeof window === 'undefined'
      ? { projectKey: null, view: null, ticketId: null }
      : parseWorkspacePermalink(window.location.search)
  )
  const permalinkProjectApplyingRef = useRef(false)
  const permalinkTicketResolvedRef = useRef<string | null>(null)
  const permalinkTicketLoadingRef = useRef(false)
  const [viewportWidth, setViewportWidth] = useState(
    typeof window === 'undefined' ? 1280 : window.innerWidth
  )
  const [permalinkHydrated, setPermalinkHydrated] = useState(false)
  const {
    copyToClipboard: copyBoardPermalink,
    isCopied: isBoardPermalinkCopied,
    error: boardPermalinkError,
  } = useCopyToClipboard()
  const {
    copyToClipboard: copyTicketPermalink,
    isCopied: isTicketPermalinkCopied,
    error: ticketPermalinkError,
  } = useCopyToClipboard()

  // Theme management
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark'
    const savedTheme = localStorage.getItem('sprintflow-theme')
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  const toggleTheme = useCallback(() => {
    setTheme((prevTheme) => {
      const newTheme = prevTheme === 'dark' ? 'light' : 'dark'
      localStorage.setItem('sprintflow-theme', newTheme)
      return newTheme
    })
  }, [])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme)
    }
  }, [theme])

  useEffect(() => {
    if (!tableEditingCell) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      const editor = tableEditorRef.current
      if (!editor) {
        return
      }

      editor.focus()
      if (editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement) {
        editor.select()
      }
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [tableEditingCell])

  useEffect(() => {
    if (activeView !== 'table' && tableEditingCell) {
      setTableEditingCell(null)
      setTableEditingValue('')
    }
    if (activeView !== 'table' && tableActiveCell) {
      setTableActiveCell(null)
    }
  }, [activeView, tableActiveCell, tableEditingCell])

  const currentProjectKey = gitlabStatus.repo ? `gitlab:${gitlabStatus.repo.id}` : 'local'
  const preferredRepoStorageKey = userId ? `sprintflow:gitlab:preferred-repo:${userId}` : null
  const tableSortStorageKey = userId ? `sprintflow:table-sort:${userId}:${currentProjectKey}` : null
  const roadmapReleaseStateStorageKey = userId ? `sprintflow:roadmap:release-state:${userId}:${currentProjectKey}` : null
  const tableSortHydratedKeyRef = useRef<string | null>(null)
  const previousProjectKeyRef = useRef<string>(currentProjectKey)
  const boardPermalink = buildWorkspacePermalink(currentProjectKey, 'board')
  const ticketPermalink = selectedTicket
    ? buildWorkspacePermalink(currentProjectKey, activeView, selectedTicket.id)
    : null

  // Get unique versions from existing tickets
  const existingVersions = Array.from(
    new Set(tickets.map(t => t.version).filter((version): version is string => Boolean(version)))
  ).sort()

  const getAuthToken = useCallback(async () => {
    const token = await getToken({ template: undefined }).catch(() => null)
    if (!token) {
      throw new Error('You need to sign in to use GitLab integration')
    }
    return token
  }, [getToken])

  const getPreferredRepoId = useCallback((): number | null => {
    if (!preferredRepoStorageKey || typeof window === 'undefined') {
      return null
    }

    const rawValue = window.localStorage.getItem(preferredRepoStorageKey)
    if (!rawValue) {
      return null
    }

    const parsed = Number(rawValue)
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null
  }, [preferredRepoStorageKey])

  const savePreferredRepoId = useCallback((repoId: number) => {
    if (!preferredRepoStorageKey || typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(preferredRepoStorageKey, String(repoId))
  }, [preferredRepoStorageKey])

  const openTicketDetail = useCallback((ticket: Ticket) => {
    setSelectedTicket(ticket)
    setEditingTicket({
      ...ticket,
      notes: getTicketCommentsValue(ticket),
      customFields: { ...(ticket.customFields || {}) },
    })
    setVersionInput('')
    setShowVersionSuggestions(false)
    setIsEditingGeneratedContent(false)
    setShowRegeneratePrompt(false)
    setRegeneratePrompt('')
  }, [
    setEditingTicket,
    setSelectedTicket,
    setShowVersionSuggestions,
    setVersionInput,
  ])

  const closeTicketDetail = useCallback(() => {
    setSelectedTicket(null)
    setVersionInput('')
    setShowVersionSuggestions(false)
    setIsEditingGeneratedContent(false)
    setShowRegeneratePrompt(false)
    setRegeneratePrompt('')
  }, [setSelectedTicket, setShowVersionSuggestions, setVersionInput])

  useEffect(() => {
    if (selectedTicket && previousProjectKeyRef.current !== currentProjectKey) {
      closeTicketDetail()
    }

    previousProjectKeyRef.current = currentProjectKey
  }, [closeTicketDetail, currentProjectKey, selectedTicket])

  const setGitLabRepo = useCallback(async (projectId: number, options?: { silent?: boolean }) => {
    const silent = options?.silent === true

    try {
      setGitlabRepoSaving(true)
      setGitlabError(null)
      if (!silent) {
        setGitlabMessage(null)
      }

      const token = await getAuthToken()
      const result = await gitlabApi.setRepo(token, projectId)
      const members = await gitlabApi.getMembers(token)

      setGitlabStatus((prev) => ({
        ...prev,
        connected: true,
        repo: result.repo,
      }))
      savePreferredRepoId(result.repo.id)
      setGitlabMembers(members)

      if (result.webhookConfigured === false && result.webhookWarning && result.webhookWarning !== 'local_dev') {
        if (!silent) {
          setGitlabMessage(`Repository set to ${result.repo.fullName}`)
        }
        setGitlabError('Repo saved, but automatic GitLab->app status sync could not be enabled. Check project webhook permissions.')
      } else if (!silent) {
        setGitlabMessage(`Repository set to ${result.repo.fullName}`)
      }

      return result
    } catch (err) {
      console.error('Failed to set GitLab repo:', err)
      setGitlabError(err instanceof Error ? err.message : 'Failed to select GitLab repository')
      throw err
    } finally {
      setGitlabRepoSaving(false)
    }
  }, [
    getAuthToken,
    savePreferredRepoId,
    setGitlabError,
    setGitlabMembers,
    setGitlabMessage,
    setGitlabRepoSaving,
    setGitlabStatus,
  ])

  // Fetch tickets on mount
  const fetchTickets = useCallback(async () => {
    if (!isSignedIn) {
      setTickets([])
      setError(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const token = await getAuthToken()
      const data = await ticketsApi.getAll(token, currentProjectKey)
      setTickets(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tickets')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [currentProjectKey, getAuthToken, isSignedIn])

  const refreshTicketsInBackground = useCallback(async () => {
    if (!isSignedIn) return

    try {
      const token = await getAuthToken()
      const data = await ticketsApi.getAll(token, currentProjectKey)
      setTickets(data)
    } catch (err) {
      console.error('Background ticket refresh failed:', err)
    }
  }, [currentProjectKey, getAuthToken, isSignedIn])

  const loadLocalTicketCount = useCallback(async () => {
    if (!isSignedIn || currentProjectKey === 'local') {
      setLocalTicketCount(0)
      return
    }

    try {
      const token = await getAuthToken()
      const localTickets = await ticketsApi.getAll(token, 'local')
      setLocalTicketCount(localTickets.length)
    } catch (err) {
      console.error('Failed to load local ticket count:', err)
      setLocalTicketCount(0)
    }
  }, [currentProjectKey, getAuthToken, isSignedIn])

  const loadProjectFields = useCallback(async () => {
    if (!isSignedIn) {
      setProjectFields([])
      return
    }

    try {
      const token = await getAuthToken()
      const fields = await ticketsApi.getFields(token, currentProjectKey)
      setProjectFields(fields)
    } catch (err) {
      console.error('Failed to load project fields:', err)
      setProjectFields([])
    }
  }, [currentProjectKey, getAuthToken, isSignedIn])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  useEffect(() => {
    const interval = setInterval(() => {
      void refreshTicketsInBackground()
    }, 15000)

    return () => clearInterval(interval)
  }, [refreshTicketsInBackground])

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setGitlabSyncingTickets(prev => {
        let changed = false
        const next: Record<string, number> = {}

        Object.entries(prev).forEach(([ticketId, startedAt]) => {
          if (now - startedAt < 90000) {
            next[ticketId] = startedAt
            return
          }

          changed = true
          syncingTicketIdsRef.current.delete(ticketId)
        })

        return changed ? next : prev
      })
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  const loadGitLabState = useCallback(async () => {
    if (!isSignedIn) {
      setGitlabStatus({ connected: false, repo: null, connectedAt: null })
      setGitlabRepos([])
      setGitlabMembers([])
      setGitlabError(null)
      return
    }

    try {
      setGitlabLoading(true)
      setGitlabError(null)
      const token = await getAuthToken()
      const status = await gitlabApi.getIntegration(token)
      setGitlabStatus(status)

      if (status.connected) {
        const repos = await gitlabApi.getRepos(token)
        setGitlabRepos(repos)
        if (status.repo) {
          savePreferredRepoId(status.repo.id)
          const members = await gitlabApi.getMembers(token)
          setGitlabMembers(members)
        } else {
          const preferredRepoId = getPreferredRepoId()
          const preferredRepo = preferredRepoId
            ? repos.find((repo) => repo.id === preferredRepoId)
            : null

          if (preferredRepo) {
            try {
              const restored = await gitlabApi.setRepo(token, preferredRepo.id)
              savePreferredRepoId(restored.repo.id)
              setGitlabStatus(prev => ({
                ...prev,
                connected: true,
                repo: restored.repo,
              }))
              const members = await gitlabApi.getMembers(token)
              setGitlabMembers(members)
            } catch (restoreError) {
              console.error('Failed to restore preferred GitLab repository:', restoreError)
              setGitlabMembers([])
            }
          } else {
            setGitlabMembers([])
          }
        }
      } else {
        setGitlabRepos([])
        setGitlabMembers([])
      }
    } catch (err) {
      console.error('Failed to load GitLab state:', err)
      setGitlabError(err instanceof Error ? err.message : 'Failed to load GitLab integration')
    } finally {
      setGitlabLoading(false)
    }
  }, [getAuthToken, getPreferredRepoId, isSignedIn, savePreferredRepoId])

  useEffect(() => {
    loadGitLabState()
  }, [loadGitLabState])

  useEffect(() => {
    const targetView = initialPermalinkRef.current.view
    if (targetView) {
      setActiveView(targetView)
    }
  }, [setActiveView])

  useEffect(() => {
    void loadLocalTicketCount()
  }, [loadLocalTicketCount])

  useEffect(() => {
    void loadProjectFields()
  }, [loadProjectFields])

  useEffect(() => {
    if (permalinkHydrated || !isLoaded || permalinkProjectApplyingRef.current) {
      return
    }

    const targetProjectKey = initialPermalinkRef.current.projectKey
    const targetRepoId = getGitLabRepoIdFromProjectKey(targetProjectKey)

    if (!targetRepoId) {
      setPermalinkHydrated(true)
      return
    }

    if (!isSignedIn) {
      return
    }

    if (gitlabLoading) {
      return
    }

    if (!gitlabStatus.connected) {
      setGitlabError('This permalink points to a GitLab project. Connect GitLab to open it.')
      setPermalinkHydrated(true)
      return
    }

    if (gitlabStatus.repo?.id === targetRepoId) {
      setPermalinkHydrated(true)
      return
    }

    const targetRepo = gitlabRepos.find((repo) => repo.id === targetRepoId)
    if (!targetRepo) {
      setGitlabError('This permalink points to a GitLab project you do not have access to.')
      setPermalinkHydrated(true)
      return
    }

    permalinkProjectApplyingRef.current = true
    void setGitLabRepo(targetRepoId, { silent: true })
      .finally(() => {
        permalinkProjectApplyingRef.current = false
        setPermalinkHydrated(true)
      })
  }, [
    gitlabLoading,
    gitlabRepos,
    gitlabStatus.connected,
    gitlabStatus.repo,
    isLoaded,
    isSignedIn,
    permalinkHydrated,
    setGitLabRepo,
    setGitlabError,
  ])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const gitlabParam = params.get('gitlab')

    if (!gitlabParam) return

    if (gitlabParam === 'connected') {
      setGitlabMessage('GitLab connected successfully')
      loadGitLabState()
    } else if (gitlabParam === 'error') {
      setGitlabError('GitLab connection failed. Please try again.')
    }

    params.delete('gitlab')
    const nextQuery = params.toString()
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`
    window.history.replaceState({}, '', nextUrl)
  }, [loadGitLabState])

  useEffect(() => {
    if (!permalinkHydrated || typeof window === 'undefined') {
      return
    }

    const params = new URLSearchParams()
    params.set('project', currentProjectKey)
    params.set('view', activeView)

    if (selectedTicket?.id) {
      params.set('ticket', selectedTicket.id)
    }

    const nextQuery = params.toString()
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`

    if (nextUrl !== currentUrl) {
      window.history.replaceState({}, '', nextUrl)
    }
  }, [activeView, currentProjectKey, permalinkHydrated, selectedTicket?.id])

  useEffect(() => {
    const permalinkTicketId = initialPermalinkRef.current.ticketId
    const permalinkProjectKey = initialPermalinkRef.current.projectKey

    if (!permalinkTicketId || !permalinkHydrated || loading) {
      return
    }

    if (permalinkProjectKey && permalinkProjectKey !== currentProjectKey) {
      return
    }

    const resolutionKey = `${currentProjectKey}:${permalinkTicketId}`
    if (permalinkTicketResolvedRef.current === resolutionKey) {
      return
    }

    const existingTicket = tickets.find((ticket) => ticket.id === permalinkTicketId)
    if (existingTicket) {
      openTicketDetail(existingTicket)
      permalinkTicketResolvedRef.current = resolutionKey
      return
    }

    if (!isSignedIn || permalinkTicketLoadingRef.current) {
      return
    }

    permalinkTicketLoadingRef.current = true
    void (async () => {
      try {
        const token = await getAuthToken()
        const ticket = await ticketsApi.getById(permalinkTicketId, token, currentProjectKey)
        setTickets((previous) => (
          previous.some((existing) => existing.id === ticket.id)
            ? previous
            : [ticket, ...previous]
        ))
        openTicketDetail(ticket)
      } catch (err) {
        console.error('Failed to open ticket permalink:', err)
        setError(err instanceof Error ? err.message : 'Failed to open ticket permalink')
      } finally {
        permalinkTicketResolvedRef.current = resolutionKey
        permalinkTicketLoadingRef.current = false
      }
    })()
  }, [
    currentProjectKey,
    getAuthToken,
    isSignedIn,
    loading,
    openTicketDetail,
    permalinkHydrated,
    setError,
    setTickets,
    tickets,
  ])

  useEffect(() => {
    if (!tableSortStorageKey || typeof window === 'undefined') {
      tableSortHydratedKeyRef.current = null
      setTableSort(null)
      return
    }

    const raw = window.localStorage.getItem(tableSortStorageKey)
    if (!raw) {
      tableSortHydratedKeyRef.current = tableSortStorageKey
      setTableSort(null)
      return
    }

    try {
      const parsed = JSON.parse(raw) as { key?: string; direction?: string }
      const isValidKey = typeof parsed.key === 'string'
        && (
          TABLE_SORT_KEYS.includes(parsed.key as TableSortKey)
          || parsed.key.startsWith('custom:')
        )
      const isValidDirection = parsed.direction === 'asc' || parsed.direction === 'desc'

      if (isValidKey && isValidDirection) {
        const direction = parsed.direction as 'asc' | 'desc'
        setTableSort({ key: parsed.key as TableSortKey, direction })
      } else {
        setTableSort(null)
        window.localStorage.removeItem(tableSortStorageKey)
      }
    } catch {
      setTableSort(null)
      window.localStorage.removeItem(tableSortStorageKey)
    } finally {
      tableSortHydratedKeyRef.current = tableSortStorageKey
    }
  }, [tableSortStorageKey])

  useEffect(() => {
    if (!tableSortStorageKey || typeof window === 'undefined') {
      return
    }
    if (tableSortHydratedKeyRef.current !== tableSortStorageKey) {
      return
    }

    if (!tableSort) {
      window.localStorage.removeItem(tableSortStorageKey)
      return
    }

    window.localStorage.setItem(tableSortStorageKey, JSON.stringify(tableSort))
  }, [tableSort, tableSortStorageKey])

  useEffect(() => {
    if (!tableSort?.key.startsWith('custom:')) {
      return
    }

    const fieldId = tableSort.key.slice('custom:'.length)
    if (!projectFields.some((field) => field.id === fieldId)) {
      setTableSort(null)
    }
  }, [projectFields, tableSort])

  useEffect(() => {
    if (!roadmapReleaseStateStorageKey || typeof window === 'undefined') {
      setRoadmapReleaseStateByVersion({})
      return
    }

    const raw = window.localStorage.getItem(roadmapReleaseStateStorageKey)
    if (!raw) {
      setRoadmapReleaseStateByVersion({})
      return
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const normalized = Object.entries(parsed).reduce<Record<string, RoadmapReleaseState>>((acc, [version, state]) => {
        const cleanVersion = version.trim()
        if (!cleanVersion) {
          return acc
        }
        if (state === 'planned' || state === 'committed' || state === 'shipped') {
          acc[cleanVersion] = state
        }
        return acc
      }, {})
      setRoadmapReleaseStateByVersion(normalized)
    } catch {
      setRoadmapReleaseStateByVersion({})
      window.localStorage.removeItem(roadmapReleaseStateStorageKey)
    }
  }, [roadmapReleaseStateStorageKey])

  useEffect(() => {
    if (!roadmapReleaseStateStorageKey || typeof window === 'undefined') {
      return
    }

    const serialized = Object.entries(roadmapReleaseStateByVersion).reduce<Record<string, RoadmapReleaseState>>((acc, [version, state]) => {
      const cleanVersion = version.trim()
      if (!cleanVersion) {
        return acc
      }
      if (state === 'planned' || state === 'committed' || state === 'shipped') {
        acc[cleanVersion] = state
      }
      return acc
    }, {})

    if (Object.keys(serialized).length === 0) {
      window.localStorage.removeItem(roadmapReleaseStateStorageKey)
      return
    }

    window.localStorage.setItem(roadmapReleaseStateStorageKey, JSON.stringify(serialized))
  }, [roadmapReleaseStateByVersion, roadmapReleaseStateStorageKey])

  useEffect(() => {
    if (roadmapCustomFieldId === 'all') {
      return
    }
    if (!projectFields.some((field) => field.id === roadmapCustomFieldId)) {
      setRoadmapCustomFieldId('all')
      setRoadmapCustomFieldValue('all')
    }
  }, [projectFields, roadmapCustomFieldId])

  const handleGitLabConnect = async () => {
    if (!isSignedIn) {
      setGitlabError('Sign in to connect GitLab')
      return
    }

    try {
      setGitlabConnecting(true)
      setGitlabError(null)
      setGitlabMessage(null)
      const token = await getAuthToken()
      const { url } = await gitlabApi.getAuthUrl(token)
      window.location.href = url
    } catch (err) {
      console.error('GitLab connect failed:', err)
      setGitlabError(err instanceof Error ? err.message : 'Failed to connect GitLab')
      setGitlabConnecting(false)
    }
  }

  const handleGitLabRepoChange = async (projectId: number) => {
    try {
      await setGitLabRepo(projectId)
    } catch (err) {
      console.error('Failed to change GitLab repo from selector:', err)
    }
  }

  const handleImportLocalTickets = async () => {
    if (!isSignedIn || currentProjectKey === 'local') {
      return
    }

    try {
      setImportingLocalTickets(true)
      setGitlabError(null)
      setGitlabMessage(null)
      const token = await getAuthToken()
      const result = await ticketsApi.importLocalToProject(token, currentProjectKey)

      if (result.moved > 0) {
        setGitlabMessage(`Imported ${result.moved} local ${result.moved === 1 ? 'ticket' : 'tickets'} into this project`)
      } else {
        setGitlabMessage('No local tickets to import')
      }

      await fetchTickets()
      await loadLocalTicketCount()
    } catch (err) {
      console.error('Failed to import local tickets:', err)
      setGitlabError(err instanceof Error ? err.message : 'Failed to import local tickets')
    } finally {
      setImportingLocalTickets(false)
    }
  }

  // Generate AI title with debounce
  const handleInputChange = (value: string) => {
    setQuickInput(value)
    
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    if (value.length > 10) {
      const timer = setTimeout(async () => {
        setIsGenerating(true)
        try {
          const { title } = await aiApi.generateTitle(value)
          setAiSuggestion(title)
        } catch (err) {
          console.error('AI generation failed:', err)
        } finally {
          setIsGenerating(false)
        }
      }, 500)
      
      setDebounceTimer(timer)
    } else {
      setAiSuggestion('')
    }
  }

  // Create ticket
  const handleQuickCreate = async () => {
    if (!aiSuggestion) return
    
    setIsCreating(true)
    try {
      const token = await getAuthToken()
      const newTicket = await ticketsApi.create({
        title: aiSuggestion,
        description: quickInput,
        notes: quickInput,
        status: 'todo',
      }, token, currentProjectKey)
      
      setTickets(prev => [newTicket, ...prev])
      setShowQuickCreate(false)
      setQuickInput('')
      setAiSuggestion('')
      syncTicketInBackground(newTicket.id, 'create')
    } catch (err) {
      console.error('Failed to create ticket:', err)
      alert('Failed to create ticket')
    } finally {
      setIsCreating(false)
    }
  }

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, ticket: Ticket) => {
    setDraggedTicket(ticket)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(columnId)
  }

  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleDrop = async (e: React.DragEvent, status: Ticket['status']) => {
    e.preventDefault()
    setDragOverColumn(null)
    
    if (!draggedTicket || draggedTicket.status === status) {
      setDraggedTicket(null)
      return
    }

    const updatedTicket = { ...draggedTicket, status }
    setTickets(prev => prev.map(t => t.id === draggedTicket.id ? updatedTicket : t))
    setDraggedTicket(null)

    try {
      const token = await getAuthToken()
      const savedTicket = await ticketsApi.update(draggedTicket.id, { status }, token, currentProjectKey)
      setTickets(prev => prev.map(t => t.id === draggedTicket.id ? savedTicket : t))
      syncTicketInBackground(savedTicket.id, savedTicket.gitlabIssueNumber ? 'update' : 'create')
    } catch (err) {
      console.error('Failed to move ticket:', err)
      setTickets(prev => prev.map(t => t.id === draggedTicket.id ? draggedTicket : t))
    }
  }

  // Drag to delete handlers
  const [dragOverDelete, setDragOverDelete] = useState(false)

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isMobileViewport = viewportWidth <= 1024
  const isPhoneViewport = viewportWidth <= 768

  useEffect(() => {
    if (!isMobileViewport && showMobileSidebar) {
      setShowMobileSidebar(false)
    }
  }, [isMobileViewport, showMobileSidebar])

  const handleDeleteZoneDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverDelete(true)
  }

  const handleDeleteZoneDragLeave = () => {
    setDragOverDelete(false)
  }

  const handleDeleteZoneDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverDelete(false)
    
    if (!draggedTicket) {
      setDraggedTicket(null)
      return
    }

    // Delete the ticket
    const ticketToDelete = draggedTicket
    setTickets(prev => prev.filter(t => t.id !== ticketToDelete.id))
    setDraggedTicket(null)

    try {
      const token = await getAuthToken()
      await ticketsApi.delete(ticketToDelete.id, token, currentProjectKey)
    } catch (err) {
      console.error('Failed to delete ticket:', err)
      alert('Failed to delete ticket')
      // Restore ticket on error
      setTickets(prev => [...prev, ticketToDelete])
    }
  }

  // Open ticket detail modal
  const handleTicketClick = (ticket: Ticket) => {
    openTicketDetail(ticket)
  }

  const handleCopyBoardPermalink = useCallback(() => {
    void copyBoardPermalink(boardPermalink)
  }, [boardPermalink, copyBoardPermalink])

  const handleCopyTicketPermalink = useCallback(() => {
    if (!ticketPermalink) {
      return
    }

    void copyTicketPermalink(ticketPermalink)
  }, [copyTicketPermalink, ticketPermalink])

  // Save ticket changes
  const handleSaveTicket = async () => {
    if (!selectedTicket || !editingTicket) return

    const normalizedOriginalVersion = normalizeTicketVersion(selectedTicket.version)
    const normalizedEditedVersion = normalizeTicketVersion(editingTicket.version)
    const originalPriority = selectedTicket.priority || 'medium'
    const editedPriority = editingTicket.priority || 'medium'
    const originalTitle = (selectedTicket.title || '').trim()
    const editedTitle = (editingTicket.title || '').trim()
    const originalNotes = getTicketCommentsValue(selectedTicket).trim()
    const editedNotes = (editingTicket.notes || '').trim()
    const originalGenerated = (selectedTicket.generatedContent || '').trim()
    const editedGenerated = (editingTicket.generatedContent || '').trim()
    const originalAssignee = selectedTicket.assignee || ''
    const editedAssignee = editingTicket.assignee || ''
    const customFieldsChanged = projectFields.some((field) => {
      const currentValue = normalizeCustomValue(selectedTicket.customFields?.[field.id])
      const editedValue = normalizeCustomValue(editingTicket.customFields?.[field.id])
      return currentValue !== editedValue
    })
    const hasChanges = (
      originalTitle !== editedTitle
      || originalNotes !== editedNotes
      || originalGenerated !== editedGenerated
      || originalAssignee !== editedAssignee
      || normalizedOriginalVersion !== normalizedEditedVersion
      || originalPriority !== editedPriority
      || customFieldsChanged
    )

    if (!hasChanges) {
      closeTicketDetail()
      return
    }

    try {
      const token = await getAuthToken()
      const updated = await ticketsApi.update(selectedTicket.id, {
        title: editedTitle || selectedTicket.title,
        notes: editingTicket.notes,
        generatedContent: editingTicket.generatedContent,
        assignee: editingTicket.assignee,
        version: editingTicket.version,
        priority: editingTicket.priority,
        customFields: editingTicket.customFields,
      }, token, currentProjectKey)
      
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updated : t))
      closeTicketDetail()
      syncTicketInBackground(updated.id, updated.gitlabIssueNumber ? 'update' : 'create')
    } catch (err) {
      console.error('Failed to update ticket:', err)
      alert('Failed to save changes')
    }
  }

  const handleRegenerateTicketContent = async () => {
    if (!selectedTicket || regeneratingContent) return

    const seedText = [
      selectedTicket.description || '',
      selectedTicket.notes || '',
      stripMarkdownForPrompt(editingTicket.generatedContent),
    ].filter(Boolean).join('\n\n').trim()

    if (!seedText && !regeneratePrompt.trim()) {
      alert('Add a prompt or ticket context before regenerating.')
      return
    }

    try {
      setRegeneratingContent(true)
      const result = await aiApi.regenerateContent(seedText || 'Regenerate this ticket', regeneratePrompt.trim() || undefined)
      setEditingTicket((previous) => ({
        ...previous,
        generatedContent: result.content,
      }))
      setRegeneratePrompt('')
      setShowRegeneratePrompt(false)
    } catch (error) {
      console.error('Failed to regenerate ticket content:', error)
      alert(error instanceof Error ? error.message : 'Failed to regenerate ticket content')
    } finally {
      setRegeneratingContent(false)
    }
  }

  const handleRegenerateAction = () => {
    if (!showRegeneratePrompt) {
      setShowRegeneratePrompt(true)
      return
    }
    void handleRegenerateTicketContent()
  }

  // Delete ticket
  const handleDeleteTicket = async () => {
    if (!selectedTicket) return
    
    if (!confirm('Are you sure you want to delete this ticket?')) return

    try {
      const token = await getAuthToken()
      await ticketsApi.delete(selectedTicket.id, token, currentProjectKey)
      setTickets(prev => prev.filter(t => t.id !== selectedTicket.id))
      closeTicketDetail()
    } catch (err) {
      console.error('Failed to delete ticket:', err)
      alert('Failed to delete ticket')
    }
  }

  // Add version tag
  const addVersion = (version: string) => {
    if (version.trim()) {
      setEditingTicket({ ...editingTicket, version: version.trim() })
      setVersionInput('')
      setShowVersionSuggestions(false)
    }
  }

  // Remove version tag
  const removeVersion = () => {
    setEditingTicket({ ...editingTicket, version: '' })
    setVersionInput('')
    setShowVersionSuggestions(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'icebox': return '#94a3b8'
      case 'todo': return '#3b82f6'
      case 'progress': return '#f59e0b'
      case 'review': return '#8b5cf6'
      case 'done': return '#10b981'
      default: return '#64748b'
    }
  }

  const getStatusLabel = (status: Ticket['status']) =>
    COLUMNS.find((column) => column.status === status)?.title ?? status

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return '#ef4444'
      case 'medium': return '#f59e0b'
      case 'low': return '#10b981'
      default: return '#94a3b8'
    }
  }

  const getPriorityLabel = (priority?: string) => {
    switch (priority) {
      case 'high': return 'High'
      case 'medium': return 'Medium'
      case 'low': return 'Low'
      default: return 'Medium'
    }
  }

  const getInitials = (value?: string | null): string => {
    if (!value) return '?'
    const normalized = value.replace(/[@._-]+/g, ' ').trim()
    const parts = normalized.split(/\s+/).filter(Boolean)
    if (parts.length === 0) return '?'
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase()
    }
    const first = parts[0][0] ?? ''
    const last = parts[parts.length - 1][0] ?? ''
    return `${first}${last}`.toUpperCase()
  }

  const getAssigneeMember = (assignee?: string) =>
    gitlabMembers.find(member => member.username === assignee || member.name === assignee)

  const getAssigneeInitials = (assignee?: string): string => {
    if (!assignee) return '?'
    const member = getAssigneeMember(assignee)
    return getInitials(member?.name || member?.username || assignee)
  }

  const getAssigneeTitle = (assignee?: string): string => {
    if (!assignee) return 'Unassigned'
    const member = getAssigneeMember(assignee)
    if (member) {
      return `${member.name} (@${member.username})`
    }
    return assignee
  }

  const formatSyncTime = (timestamp?: number): string => {
    if (!timestamp) return ''
    return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  const normalizeTicketVersion = (value?: string) => (value || '').trim()
  const normalizeCustomValue = (value: unknown): string => {
    if (value === null || value === undefined) return ''
    if (typeof value === 'boolean') return value ? 'true' : 'false'
    return String(value).trim()
  }
  function getTicketCommentsValue(ticket: Pick<Ticket, 'notes' | 'description'>): string {
    if (typeof ticket.notes === 'string' && ticket.notes !== '') {
      return ticket.notes
    }
    return ticket.description || ''
  }

  const getTableCellKey = (ticketId: string, columnId: TableSortKey) => `${ticketId}:${columnId}`

  const getTableCellEditorValue = (ticket: Ticket, columnId: TableSortKey): string => {
    if (columnId.startsWith('custom:')) {
      return normalizeCustomValue(ticket.customFields?.[columnId.slice('custom:'.length)])
    }

    switch (columnId) {
      case 'title':
        return ticket.title || ''
      case 'owner':
        return ticket.assignee || ''
      case 'priority':
        return ticket.priority || 'medium'
      case 'status':
        return ticket.status
      case 'milestone':
        return ticket.version || ''
      case 'comments':
        return getTicketCommentsValue(ticket)
      case 'ticket':
      default:
        return ''
    }
  }

  const closeTableCellEditor = () => {
    setTableEditingCell(null)
    setTableEditingValue('')
  }

  const cancelTableCellEdit = (focusCell?: InlineSpreadsheetCell | null) => {
    closeTableCellEditor()
    if (focusCell) {
      focusTableCell(focusCell)
    }
  }

  const mergeTableUpdatePatch = (base: UpdateTicketInput, patch: UpdateTicketInput): UpdateTicketInput => {
    const next: UpdateTicketInput = { ...base, ...patch }
    if (base.customFields || patch.customFields) {
      next.customFields = {
        ...(base.customFields || {}),
        ...(patch.customFields || {}),
      }
    }
    return next
  }

  const buildTableUpdatePlan = (
    ticket: Ticket,
    columnId: TableSortKey,
    rawValue: string
  ): Omit<TableUpdatePlan, 'savingCellKeys'> | null => {
    let patch: UpdateTicketInput | null = null
    let optimisticTicket = ticket

    if (columnId.startsWith('custom:')) {
      const fieldId = columnId.slice('custom:'.length)
      const currentValue = normalizeCustomValue(ticket.customFields?.[fieldId])
      const nextValue = normalizeCustomValue(rawValue)

      if (currentValue !== nextValue) {
        const nextCustomFields = { ...(ticket.customFields || {}) }
        if (nextValue) {
          nextCustomFields[fieldId] = nextValue
        } else {
          delete nextCustomFields[fieldId]
        }

        patch = {
          customFields: {
            [fieldId]: nextValue || null,
          },
        }
        optimisticTicket = {
          ...ticket,
          customFields: nextCustomFields,
        }
      }
    } else if (columnId === 'title') {
      const nextValue = rawValue.trim()
      if (!nextValue) {
        throw new Error('Title cannot be empty')
      }
      if ((ticket.title || '').trim() !== nextValue) {
        patch = { title: nextValue }
        optimisticTicket = { ...ticket, title: nextValue }
      }
    } else if (columnId === 'owner') {
      const nextValue = rawValue.trim()
      if ((ticket.assignee || '').trim() !== nextValue) {
        patch = { assignee: nextValue }
        optimisticTicket = { ...ticket, assignee: nextValue || undefined }
      }
    } else if (columnId === 'priority') {
      const nextValue = (rawValue || 'medium') as Ticket['priority']
      if ((ticket.priority || 'medium') !== nextValue) {
        patch = { priority: nextValue }
        optimisticTicket = { ...ticket, priority: nextValue }
      }
    } else if (columnId === 'status') {
      const nextValue = rawValue as Ticket['status']
      if (ticket.status !== nextValue) {
        patch = { status: nextValue }
        optimisticTicket = { ...ticket, status: nextValue }
      }
    } else if (columnId === 'milestone') {
      const nextValue = normalizeTicketVersion(rawValue)
      if (normalizeTicketVersion(ticket.version) !== nextValue) {
        patch = { version: nextValue }
        optimisticTicket = { ...ticket, version: nextValue || undefined }
      }
    } else if (columnId === 'comments') {
      const currentValue = getTicketCommentsValue(ticket)
      if (currentValue !== rawValue) {
        patch = { notes: rawValue }
        optimisticTicket = { ...ticket, notes: rawValue }
      }
    }

    if (!patch) {
      return null
    }

    return {
      ticketId: ticket.id,
      originalTicket: ticket,
      optimisticTicket,
      patch,
    }
  }

  const applyTableUpdatePlans = async (plans: TableUpdatePlan[], errorFallback: string) => {
    if (!plans.length) {
      return
    }

    const savingKeys = Array.from(new Set(plans.flatMap((plan) => plan.savingCellKeys)))
    const optimisticTicketsById = new Map(plans.map((plan) => [plan.ticketId, plan.optimisticTicket] as const))

    setTableSaveError(null)
    setTableSavingCellKeys((previous) => {
      const next = { ...previous }
      savingKeys.forEach((key) => {
        next[key] = true
      })
      return next
    })
    setTickets((previous) => previous.map((ticket) => optimisticTicketsById.get(ticket.id) ?? ticket))

    try {
      const token = await getAuthToken()
      const results = await Promise.allSettled(
        plans.map((plan) => ticketsApi.update(plan.ticketId, plan.patch, token, currentProjectKey))
      )

      const updatedTicketsById = new Map<string, Ticket>()
      const revertedTicketsById = new Map<string, Ticket>()
      const errorMessages: string[] = []

      results.forEach((result, index) => {
        const plan = plans[index]
        if (result.status === 'fulfilled') {
          updatedTicketsById.set(plan.ticketId, result.value)
          syncTicketInBackground(result.value.id, result.value.gitlabIssueNumber ? 'update' : 'create')
          return
        }

        console.error('Failed to update spreadsheet cell:', result.reason)
        revertedTicketsById.set(plan.ticketId, plan.originalTicket)
        errorMessages.push(result.reason instanceof Error ? result.reason.message : errorFallback)
      })

      if (updatedTicketsById.size > 0) {
        setTickets((previous) => previous.map((ticket) => updatedTicketsById.get(ticket.id) ?? ticket))
      }

      if (revertedTicketsById.size > 0) {
        setTickets((previous) => previous.map((ticket) => revertedTicketsById.get(ticket.id) ?? ticket))
      }

      if (errorMessages.length > 0) {
        setTableSaveError(errorMessages[0])
      }
    } catch (error) {
      console.error('Failed to update spreadsheet cells:', error)
      const originalTicketsById = new Map(plans.map((plan) => [plan.ticketId, plan.originalTicket] as const))
      setTickets((previous) => previous.map((ticket) => originalTicketsById.get(ticket.id) ?? ticket))
      setTableSaveError(error instanceof Error ? error.message : errorFallback)
    } finally {
      setTableSavingCellKeys((previous) => {
        const next = { ...previous }
        savingKeys.forEach((key) => {
          delete next[key]
        })
        return next
      })
    }
  }

  const openTableCellEditor = (ticket: Ticket, columnId: TableSortKey) => {
    if (columnId === 'ticket') {
      openTicketDetail(ticket)
      return
    }

    const cellKey = getTableCellKey(ticket.id, columnId)
    if (tableSavingCellKeys[cellKey]) {
      return
    }

    setTableSaveError(null)
    setTableActiveCell({ ticketId: ticket.id, columnId })
    setTableEditingCell({ ticketId: ticket.id, columnId })
    setTableEditingValue(getTableCellEditorValue(ticket, columnId))
  }

  const commitTableCellEdit = async (
    ticketId: string,
    columnId: TableSortKey,
    rawValue = tableEditingValue,
    options?: { focusCell?: InlineSpreadsheetCell | null }
  ) => {
    const ticket = tickets.find((item) => item.id === ticketId)
    if (!ticket || columnId === 'ticket') {
      closeTableCellEditor()
      return
    }

    let plan: Omit<TableUpdatePlan, 'savingCellKeys'> | null = null

    try {
      plan = buildTableUpdatePlan(ticket, columnId, rawValue)
    } catch (error) {
      setTableSaveError(error instanceof Error ? error.message : 'Failed to update cell')
      return
    }

    closeTableCellEditor()
    const focusCell = options?.focusCell
    if (focusCell) {
      focusTableCell(focusCell)
    } else {
      setTableActiveCell({ ticketId, columnId })
    }

    if (!plan) {
      return
    }

    await applyTableUpdatePlans([
      {
        ...plan,
        savingCellKeys: [getTableCellKey(ticketId, columnId)],
      },
    ], 'Failed to save cell')
  }

  const handleTablePaste = async (startCell: InlineSpreadsheetCell, clipboardText: string) => {
    const startRowIndex = sortedTableTickets.findIndex((ticket) => ticket.id === startCell.ticketId)
    const startColumnIndex = editableTableColumnIds.indexOf(startCell.columnId as Exclude<TableSortKey, 'ticket'>)
    if (startRowIndex === -1 || startColumnIndex === -1) {
      return
    }

    const rows = clipboardText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
    while (rows.length > 1 && rows[rows.length - 1] === '') {
      rows.pop()
    }
    const matrix = rows.map((row) => row.split('\t'))
    if (!matrix.length || matrix.every((row) => row.length === 1 && row[0] === '')) {
      return
    }

    const plansByTicketId = new Map<string, TableUpdatePlan>()

    try {
      matrix.forEach((rowValues, rowOffset) => {
        const ticket = sortedTableTickets[startRowIndex + rowOffset]
        if (!ticket) {
          return
        }

        rowValues.forEach((value, columnOffset) => {
          const columnId = editableTableColumnIds[startColumnIndex + columnOffset]
          if (!columnId) {
            return
          }

          const existingPlan = plansByTicketId.get(ticket.id)
          const workingTicket = existingPlan?.optimisticTicket || ticket
          const nextPlan = buildTableUpdatePlan(workingTicket, columnId, value)
          if (!nextPlan) {
            return
          }

          plansByTicketId.set(ticket.id, {
            ticketId: ticket.id,
            originalTicket: existingPlan?.originalTicket || ticket,
            optimisticTicket: nextPlan.optimisticTicket,
            patch: existingPlan ? mergeTableUpdatePatch(existingPlan.patch, nextPlan.patch) : nextPlan.patch,
            savingCellKeys: [
              ...(existingPlan?.savingCellKeys || []),
              getTableCellKey(ticket.id, columnId),
            ],
          })
        })
      })
    } catch (error) {
      setTableSaveError(error instanceof Error ? error.message : 'Failed to paste cells')
      return
    }

    const plans = Array.from(plansByTicketId.values())
    if (!plans.length) {
      focusTableCell(startCell)
      return
    }

    closeTableCellEditor()
    focusTableCell(startCell)
    await applyTableUpdatePlans(plans, 'Failed to paste cells')
  }

  const getCustomFieldValue = (ticket: Ticket, fieldId: string): string => {
    return normalizeCustomValue(ticket.customFields?.[fieldId])
  }

  const formatCustomFieldValue = (field: ProjectField, rawValue: unknown): string => {
    const normalized = normalizeCustomValue(rawValue)
    if (field.type === 'boolean') {
      return normalized === 'true' ? 'Yes' : 'No'
    }
    if (!normalized) return '-'
    return normalized
  }

  const getEditedCustomFieldValue = (field: ProjectField): string => {
    const value = normalizeCustomValue(editingTicket.customFields?.[field.id])
    if (field.type === 'boolean' && !value) {
      return 'false'
    }
    return value
  }

  const updateEditedCustomFieldValue = (fieldId: string, value: string | boolean) => {
    setEditingTicket((previous) => ({
      ...previous,
      customFields: {
        ...(previous.customFields || {}),
        [fieldId]: value as string | null,
      },
    }))
  }

  const normalizedSearch = searchQuery.trim().toLowerCase()
  const filteredTickets = !normalizedSearch
    ? tickets
    : tickets.filter((ticket) => {
        const issueNumber = ticket.gitlabIssueNumber ? String(ticket.gitlabIssueNumber) : ''
        const haystack = [
          ticket.title,
          ticket.description || '',
          ticket.notes || '',
          ticket.generatedContent || '',
          ticket.assignee || '',
          ticket.version || '',
          issueNumber,
          ...Object.values(ticket.customFields || {}).map((value) => normalizeCustomValue(value)),
        ].join(' ').toLowerCase()
        return haystack.includes(normalizedSearch)
      })

  const needsLocalImport = currentProjectKey !== 'local' && localTicketCount > 0
  const onboardingSteps = [
    { id: 'signin', label: 'Sign in', done: isSignedIn },
    { id: 'connect', label: 'Connect GitLab', done: isSignedIn && gitlabStatus.connected },
    { id: 'repo', label: 'Select repository', done: Boolean(gitlabStatus.repo) },
    { id: 'first-ticket', label: 'Create first ticket', done: tickets.length > 0 },
    { id: 'first-sync', label: 'Sync first ticket', done: tickets.some(ticket => Boolean(ticket.gitlabIssueNumber)) },
    ...(needsLocalImport
      ? [{ id: 'import-local', label: `Import local tickets (${localTicketCount})`, done: false }]
      : []),
  ]
  const completedOnboardingSteps = onboardingSteps.filter(step => step.done).length
  const showOnboardingChecklist = completedOnboardingSteps < onboardingSteps.length
  const canAutoSync = isSignedIn && gitlabStatus.connected && Boolean(gitlabStatus.repo)
  const fallbackAuthUrls = getClerkFallbackAuthUrls(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)
  const shouldUseFallbackAuth = import.meta.env.DEV && !isLoaded && Boolean(fallbackAuthUrls)
  const workspaceItems: Array<{
    id: string
    label: string
    icon: string
    view?: ActiveView
  }> = [
    { id: 'board', label: 'Board', icon: '📋', view: 'board' },
    { id: 'table', label: 'Spreadsheet', icon: '🧾', view: 'table' },
    { id: 'roadmap', label: 'Roadmap', icon: '📊', view: 'roadmap' },
    { id: 'releases', label: 'Releases', icon: '📁' },
    { id: 'reports', label: 'Reports', icon: '📈' },
  ]
  const tableColumns: Array<{
    id: TableSortKey
    label: string
    customFieldId?: string
    isCustom?: boolean
  }> = [
    { id: 'title', label: 'Title' },
    { id: 'ticket', label: 'Ticket' },
    { id: 'owner', label: 'Owner' },
    { id: 'priority', label: 'Priority' },
    { id: 'status', label: 'Status' },
    { id: 'milestone', label: 'Milestone' },
    ...projectFields.map((field) => ({
      id: `custom:${field.id}` as TableSortKey,
      label: field.name,
      customFieldId: field.id,
      isCustom: true,
    })),
    { id: 'comments', label: 'Comments' },
  ]

  const handleTableSort = (key: TableSortKey) => {
    setTableSort((previous) => {
      if (!previous || previous.key !== key) {
        return { key, direction: 'asc' }
      }
      return { key, direction: previous.direction === 'asc' ? 'desc' : 'asc' }
    })
  }

  const getTableSortValue = (ticket: Ticket, key: TableSortKey): string | number => {
    if (key.startsWith('custom:')) {
      const fieldId = key.slice('custom:'.length)
      return getCustomFieldValue(ticket, fieldId).toLowerCase()
    }

    switch (key) {
      case 'title':
        return (ticket.title || '').toLowerCase()
      case 'milestone':
        return (ticket.version || '').toLowerCase()
      case 'ticket':
        return ticket.gitlabIssueNumber || ticket.id
      case 'owner':
        return (ticket.assignee || '').toLowerCase()
      case 'priority': {
        const rank: Record<string, number> = { low: 1, medium: 2, high: 3 }
        return rank[ticket.priority || 'medium'] || 2
      }
      case 'status': {
        const statusRank = COLUMNS.findIndex((column) => column.status === ticket.status)
        return statusRank === -1 ? 999 : statusRank
      }
      case 'comments':
        return getTicketCommentsValue(ticket).toLowerCase()
      default:
        return ''
    }
  }

  const sortedTableTickets = tableSort
    ? [...filteredTickets].sort((left, right) => {
        const leftValue = getTableSortValue(left, tableSort.key)
        const rightValue = getTableSortValue(right, tableSort.key)

        if (typeof leftValue === 'number' && typeof rightValue === 'number') {
          return tableSort.direction === 'asc' ? leftValue - rightValue : rightValue - leftValue
        }

        const leftText = String(leftValue)
        const rightText = String(rightValue)
        const comparison = leftText.localeCompare(rightText, undefined, { numeric: true, sensitivity: 'base' })
        return tableSort.direction === 'asc' ? comparison : -comparison
      })
    : filteredTickets
  const editableTableColumnIds = tableColumns
    .map((column) => column.id)
    .filter((columnId): columnId is Exclude<TableSortKey, 'ticket'> => columnId !== 'ticket')
  const firstEditableTableCell = sortedTableTickets.length > 0 && editableTableColumnIds.length > 0
    ? {
        ticketId: sortedTableTickets[0].id,
        columnId: editableTableColumnIds[0],
      }
    : null

  const focusTableCell = (cell: InlineSpreadsheetCell | null) => {
    if (!cell) {
      return
    }

    setTableActiveCell(cell)
    window.requestAnimationFrame(() => {
      tableCellRefs.current[`${cell.ticketId}:${cell.columnId}`]?.focus()
    })
  }

  const getTableNavigationTarget = (
    cell: InlineSpreadsheetCell,
    direction: 'next' | 'prev' | 'left' | 'right' | 'up' | 'down'
  ): InlineSpreadsheetCell | null => {
    const rowIndex = sortedTableTickets.findIndex((ticket) => ticket.id === cell.ticketId)
    const columnIndex = editableTableColumnIds.indexOf(cell.columnId as Exclude<TableSortKey, 'ticket'>)

    if (rowIndex === -1 || columnIndex === -1) {
      return firstEditableTableCell
    }

    if (direction === 'next') {
      if (columnIndex < editableTableColumnIds.length - 1) {
        return { ticketId: cell.ticketId, columnId: editableTableColumnIds[columnIndex + 1] }
      }
      if (rowIndex < sortedTableTickets.length - 1) {
        return { ticketId: sortedTableTickets[rowIndex + 1].id, columnId: editableTableColumnIds[0] }
      }
      return cell
    }

    if (direction === 'prev') {
      if (columnIndex > 0) {
        return { ticketId: cell.ticketId, columnId: editableTableColumnIds[columnIndex - 1] }
      }
      if (rowIndex > 0) {
        return {
          ticketId: sortedTableTickets[rowIndex - 1].id,
          columnId: editableTableColumnIds[editableTableColumnIds.length - 1],
        }
      }
      return cell
    }

    if (direction === 'left') {
      return columnIndex > 0
        ? { ticketId: cell.ticketId, columnId: editableTableColumnIds[columnIndex - 1] }
        : cell
    }

    if (direction === 'right') {
      return columnIndex < editableTableColumnIds.length - 1
        ? { ticketId: cell.ticketId, columnId: editableTableColumnIds[columnIndex + 1] }
        : cell
    }

    if (direction === 'up') {
      return rowIndex > 0
        ? { ticketId: sortedTableTickets[rowIndex - 1].id, columnId: editableTableColumnIds[columnIndex] }
        : cell
    }

    return rowIndex < sortedTableTickets.length - 1
      ? { ticketId: sortedTableTickets[rowIndex + 1].id, columnId: editableTableColumnIds[columnIndex] }
      : cell
  }

  useEffect(() => {
    if (!tableActiveCell) {
      return
    }

    const activeTicketStillVisible = sortedTableTickets.some((ticket) => ticket.id === tableActiveCell.ticketId)
    const activeColumnStillVisible = editableTableColumnIds.includes(tableActiveCell.columnId as Exclude<TableSortKey, 'ticket'>)
    if (!activeTicketStillVisible || !activeColumnStillVisible) {
      setTableActiveCell(firstEditableTableCell)
    }
  }, [editableTableColumnIds, firstEditableTableCell, sortedTableTickets, tableActiveCell])

  const roadmapAssigneeOptions = Array.from(
    new Set(tickets.map((ticket) => ticket.assignee).filter((assignee): assignee is string => Boolean(assignee)))
  ).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))

  const roadmapSelectedCustomField = projectFields.find((field) => field.id === roadmapCustomFieldId) || null
  const roadmapCustomFieldValues = roadmapSelectedCustomField
    ? (() => {
        const values = new Set<string>()
        if (roadmapSelectedCustomField.type === 'boolean') {
          values.add('true')
          values.add('false')
        }
        roadmapSelectedCustomField.options.forEach((option) => {
          const normalized = normalizeCustomValue(option)
          if (normalized) {
            values.add(normalized)
          }
        })
        tickets.forEach((ticket) => {
          const normalized = getCustomFieldValue(ticket, roadmapSelectedCustomField.id)
          if (normalized) {
            values.add(normalized)
          }
        })
        return Array.from(values).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
      })()
    : []

  const roadmapFilteredTickets = filteredTickets.filter((ticket) => {
    if (roadmapPriorityFilter !== 'all' && (ticket.priority || 'medium') !== roadmapPriorityFilter) {
      return false
    }

    if (roadmapAssigneeFilter === '__unassigned__' && ticket.assignee) {
      return false
    }

    if (roadmapAssigneeFilter !== 'all' && roadmapAssigneeFilter !== '__unassigned__' && ticket.assignee !== roadmapAssigneeFilter) {
      return false
    }

    if (roadmapCustomFieldId !== 'all') {
      const value = getCustomFieldValue(ticket, roadmapCustomFieldId)
      if (roadmapCustomFieldValue !== 'all' && value !== roadmapCustomFieldValue) {
        return false
      }
    }

    return true
  })

  const inferRoadmapReleaseState = (releaseTickets: Ticket[]): RoadmapReleaseState => {
    if (!releaseTickets.length) {
      return 'planned'
    }
    const doneCount = releaseTickets.filter((ticket) => ticket.status === 'done').length
    if (doneCount === releaseTickets.length) {
      return 'shipped'
    }
    const hasStarted = releaseTickets.some((ticket) => ticket.status === 'progress' || ticket.status === 'review' || ticket.status === 'done')
    return hasStarted ? 'committed' : 'planned'
  }

  const roadmapTicketsByVersion = roadmapFilteredTickets.reduce<Record<string, Ticket[]>>((acc, ticket) => {
    const version = normalizeTicketVersion(ticket.version) || ROADMAP_UNPLANNED_VERSION
    if (!acc[version]) {
      acc[version] = []
    }
    acc[version].push(ticket)
    return acc
  }, {})

  if (!roadmapTicketsByVersion[ROADMAP_UNPLANNED_VERSION]) {
    roadmapTicketsByVersion[ROADMAP_UNPLANNED_VERSION] = []
  }

  const roadmapReleases = Object.entries(roadmapTicketsByVersion)
    .sort(([left], [right]) => {
      if (left === ROADMAP_UNPLANNED_VERSION) return 1
      if (right === ROADMAP_UNPLANNED_VERSION) return -1
      return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
    })
    .map(([version, releaseTickets]) => {
      const inferredReleaseState = inferRoadmapReleaseState(releaseTickets)
      const releaseState = roadmapReleaseStateByVersion[version] || inferredReleaseState
      const doneCount = releaseTickets.filter((ticket) => ticket.status === 'done').length
      const highPriorityCount = releaseTickets.filter((ticket) => (ticket.priority || 'medium') === 'high').length
      const progressPercent = releaseTickets.length > 0
        ? Math.round((doneCount / releaseTickets.length) * 100)
        : 0
      const riskLevel = releaseTickets.length === 0
        ? 'No scope'
        : highPriorityCount / releaseTickets.length >= 0.4
          ? 'High risk'
          : highPriorityCount > 0
            ? 'Watch'
            : 'Healthy'

      return {
        version,
        tickets: releaseTickets,
        releaseState,
        inferredReleaseState,
        doneCount,
        highPriorityCount,
        progressPercent,
        riskLevel,
      }
    })

  const roadmapLanes = ROADMAP_RELEASE_COLUMNS.map((lane) => ({
    ...lane,
    releases: roadmapReleases.filter((release) => release.releaseState === lane.id),
  }))

  useEffect(() => {
    if (roadmapCustomFieldId === 'all' || roadmapCustomFieldValue === 'all') {
      return
    }
    if (!roadmapCustomFieldValues.includes(roadmapCustomFieldValue)) {
      setRoadmapCustomFieldValue('all')
    }
  }, [roadmapCustomFieldId, roadmapCustomFieldValue, roadmapCustomFieldValues])

  const handleRoadmapReleaseStateChange = (
    version: string,
    nextState: RoadmapReleaseState,
    inferredState: RoadmapReleaseState
  ) => {
    setRoadmapReleaseStateByVersion((previous) => {
      if (nextState === inferredState) {
        if (!(version in previous)) {
          return previous
        }
        const next = { ...previous }
        delete next[version]
        return next
      }
      return { ...previous, [version]: nextState }
    })
  }

  const handleRoadmapTicketDragStart = (event: React.DragEvent<HTMLElement>, ticketId: string) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', ticketId)
    setRoadmapDraggingTicketId(ticketId)
  }

  const handleRoadmapTicketDragEnd = () => {
    setRoadmapDraggingTicketId(null)
    setRoadmapDragOverVersion(null)
  }

  const handleRoadmapReleaseDragOver = (event: React.DragEvent<HTMLElement>, version: string) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (roadmapDragOverVersion !== version) {
      setRoadmapDragOverVersion(version)
    }
  }

  const handleRoadmapReleaseDragLeave = (version: string) => {
    if (roadmapDragOverVersion === version) {
      setRoadmapDragOverVersion(null)
    }
  }

  const handleRoadmapReleaseDrop = async (event: React.DragEvent<HTMLElement>, version: string) => {
    event.preventDefault()
    const ticketId = event.dataTransfer.getData('text/plain') || roadmapDraggingTicketId
    setRoadmapDragOverVersion(null)
    setRoadmapDraggingTicketId(null)
    if (!ticketId) {
      return
    }

    const sourceTicket = tickets.find((ticket) => ticket.id === ticketId)
    if (!sourceTicket) {
      return
    }

    const sourceVersion = normalizeTicketVersion(sourceTicket.version) || ROADMAP_UNPLANNED_VERSION
    if (sourceVersion === version) {
      return
    }

    const nextVersion = version === ROADMAP_UNPLANNED_VERSION ? '' : version
    const optimisticTicket = { ...sourceTicket, version: nextVersion }
    setTickets((previous) => previous.map((ticket) => (ticket.id === ticketId ? optimisticTicket : ticket)))

    try {
      const token = await getAuthToken()
      const updatedTicket = await ticketsApi.update(ticketId, { version: nextVersion }, token, currentProjectKey)
      setTickets((previous) => previous.map((ticket) => (ticket.id === ticketId ? updatedTicket : ticket)))
      syncTicketInBackground(updatedTicket.id, updatedTicket.gitlabIssueNumber ? 'update' : 'create')
    } catch (err) {
      console.error('Failed to move ticket between roadmap releases:', err)
      setTickets((previous) => previous.map((ticket) => (ticket.id === ticketId ? sourceTicket : ticket)))
    }
  }

  const activeViewLabel = activeView === 'board'
    ? 'Product Board'
    : activeView === 'table'
      ? 'Ticket Spreadsheet'
      : 'Roadmap'
  const activeViewTicketCount = activeView === 'roadmap' ? roadmapFilteredTickets.length : filteredTickets.length

  const addProjectField = async () => {
    const name = newFieldName.trim()
    if (!name) {
      alert('Column name is required')
      return
    }

    try {
      setSavingField(true)
      const token = await getAuthToken()
      const options = newFieldType === 'select'
        ? newFieldOptions.split(',').map((value) => value.trim()).filter(Boolean)
        : undefined

      const created = await ticketsApi.createField({
        name,
        type: newFieldType,
        options,
      }, token, currentProjectKey)

      setProjectFields((previous) => [...previous, created])
      setShowAddFieldModal(false)
      setNewFieldName('')
      setNewFieldType('text')
      setNewFieldOptions('')
    } catch (err) {
      console.error('Failed to create custom field:', err)
      alert(err instanceof Error ? err.message : 'Failed to create column')
    } finally {
      setSavingField(false)
    }
  }

  const persistProjectFieldOrder = async (reordered: ProjectField[], original: ProjectField[]) => {
    try {
      const token = await getAuthToken()
      const persisted = await ticketsApi.reorderFields(reordered.map((field) => field.id), token, currentProjectKey)
      setProjectFields(persisted)
    } catch (err) {
      console.error('Failed to reorder custom fields:', err)
      setProjectFields(original)
      alert(err instanceof Error ? err.message : 'Failed to reorder columns')
    }
  }

  const moveProjectFieldByDrop = async (sourceFieldId: string, targetFieldId: string) => {
    if (sourceFieldId === targetFieldId) return

    const sourceIndex = projectFields.findIndex((field) => field.id === sourceFieldId)
    const targetIndex = projectFields.findIndex((field) => field.id === targetFieldId)
    if (sourceIndex === -1 || targetIndex === -1) return

    const original = [...projectFields]
    const reordered = [...projectFields]
    const [moved] = reordered.splice(sourceIndex, 1)
    const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
    reordered.splice(adjustedTargetIndex, 0, moved)

    const orderChanged = reordered.some((field, index) => field.id !== original[index]?.id)
    if (!orderChanged) return

    setProjectFields(reordered)
    await persistProjectFieldOrder(reordered, original)
  }

  const handleProjectFieldDragStart = (event: React.DragEvent<HTMLTableCellElement>, fieldId: string) => {
    event.stopPropagation()
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', fieldId)
    setDraggingProjectFieldId(fieldId)
    setDragOverProjectFieldId(null)
  }

  const handleProjectFieldDragOver = (event: React.DragEvent<HTMLTableCellElement>, fieldId: string) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (fieldId !== draggingProjectFieldId) {
      setDragOverProjectFieldId(fieldId)
    }
  }

  const handleProjectFieldDrop = (event: React.DragEvent<HTMLTableCellElement>, targetFieldId: string) => {
    event.preventDefault()
    event.stopPropagation()
    const sourceFieldId = event.dataTransfer.getData('text/plain') || draggingProjectFieldId
    setDragOverProjectFieldId(null)
    setDraggingProjectFieldId(null)
    if (!sourceFieldId || sourceFieldId === targetFieldId) return
    void moveProjectFieldByDrop(sourceFieldId, targetFieldId)
  }

  const handleProjectFieldDragEnd = () => {
    setDraggingProjectFieldId(null)
    setDragOverProjectFieldId(null)
  }

  const deleteProjectField = async (fieldId: string) => {
    const field = projectFields.find((item) => item.id === fieldId)
    if (!field) return

    const confirmed = confirm(`Delete column "${field.name}"? This removes all values in this project.`)
    if (!confirmed) return

    try {
      setDeletingFieldId(fieldId)
      const token = await getAuthToken()
      await ticketsApi.deleteField(fieldId, token, currentProjectKey)
      setProjectFields((previous) => previous.filter((item) => item.id !== fieldId))
      setTickets((previous) => previous.map((ticket) => {
        if (!ticket.customFields || !(fieldId in ticket.customFields)) {
          return ticket
        }
        const nextCustomFields = { ...ticket.customFields }
        delete nextCustomFields[fieldId]
        return { ...ticket, customFields: nextCustomFields }
      }))
      setEditingTicket((previous) => {
        if (!previous.customFields || !(fieldId in previous.customFields)) {
          return previous
        }
        const nextCustomFields = { ...previous.customFields }
        delete nextCustomFields[fieldId]
        return { ...previous, customFields: nextCustomFields }
      })
    } catch (err) {
      console.error('Failed to delete custom field:', err)
      alert(err instanceof Error ? err.message : 'Failed to delete column')
    } finally {
      setDeletingFieldId(null)
    }
  }

  const getTicketsByStatus = (status: Ticket['status']) => 
    filteredTickets.filter(t => t.status === status)

  const getGitLabIssueUrl = (ticket: Ticket): string | null => {
    if (!ticket.gitlabIssueNumber || !gitlabStatus.repo?.url) {
      return null
    }
    return `${gitlabStatus.repo.url}/-/issues/${ticket.gitlabIssueNumber}`
  }

  const isTicketSyncing = (ticketId: string): boolean => Boolean(gitlabSyncingTickets[ticketId])

  const canAutoSyncToGitLab = canAutoSync

  const syncTicketInBackground = useCallback((ticketId: string, mode: GitLabSyncMode) => {
    if (!canAutoSyncToGitLab) {
      return
    }
    if (syncingTicketIdsRef.current.has(ticketId)) {
      return
    }
    syncingTicketIdsRef.current.add(ticketId)
    setGitlabSyncingTickets(prev => ({ ...prev, [ticketId]: Date.now() }))
    setGitlabSyncErrors(prev => {
      if (!prev[ticketId]) return prev
      const next = { ...prev }
      delete next[ticketId]
      return next
    })

    setGitlabError(null)
    setGitlabMessage('GitLab sync started in background')

    void (async () => {
      try {
        const token = await getAuthToken()
        const result = await gitlabApi.syncTicket(ticketId, token, mode)

        setTickets(prev => prev.map(ticket => (
          ticket.id === ticketId
            ? {
                ...ticket,
                gitlabIssueId: result.gitlabIssueId,
                gitlabIssueNumber: result.gitlabIssueNumber,
                generatedContent: result.generatedContent ?? ticket.generatedContent,
              }
            : ticket
        )))

        setSelectedTicket(prev => (
          prev && prev.id === ticketId
            ? {
                ...prev,
                gitlabIssueId: result.gitlabIssueId,
                gitlabIssueNumber: result.gitlabIssueNumber,
                generatedContent: result.generatedContent ?? prev.generatedContent,
              }
            : prev
        ))

        setGitlabLastSyncedAt(prev => ({ ...prev, [ticketId]: Date.now() }))
        setGitlabMessage(mode === 'update' ? 'GitLab issue updated' : 'GitLab issue created')
      } catch (err) {
        console.error('Failed to sync GitLab issue:', err)
        const message = err instanceof Error ? err.message : 'Failed to sync ticket to GitLab'
        setGitlabError(message)
        setGitlabSyncErrors(prev => ({ ...prev, [ticketId]: message }))
      } finally {
        syncingTicketIdsRef.current.delete(ticketId)
        setGitlabSyncingTickets(prev => {
          const next = { ...prev }
          delete next[ticketId]
          return next
        })
      }
    })()
  }, [canAutoSyncToGitLab, getAuthToken])

  const handleInlineRetrySync = (event: React.MouseEvent, ticket: Ticket) => {
    event.stopPropagation()
    syncTicketInBackground(ticket.id, ticket.gitlabIssueNumber ? 'update' : 'create')
  }

  const renderSpreadsheetCellEditor = (ticket: Ticket, columnId: TableSortKey, field?: ProjectField) => {
    const currentCell: InlineSpreadsheetCell = { ticketId: ticket.id, columnId }
    const baseInputStyle = {
      width: '100%',
      padding: columnId === 'comments' ? '10px 12px' : '8px 10px',
      background: 'var(--input-bg)',
      border: '1px solid var(--input-border)',
      borderRadius: '10px',
      fontSize: '13px',
      fontFamily: 'inherit',
      color: 'var(--text-primary)',
      outline: 'none',
      resize: columnId === 'comments' ? 'vertical' as const : 'none' as const,
      minHeight: columnId === 'comments' ? '92px' : undefined,
      boxSizing: 'border-box' as const,
    }

    const handleEditorKeyDown = (
      event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
      options?: { multiline?: boolean }
    ) => {
      if (event.key === 'Tab') {
        event.preventDefault()
        const focusCell = getTableNavigationTarget(currentCell, event.shiftKey ? 'prev' : 'next')
        void commitTableCellEdit(ticket.id, columnId, undefined, { focusCell })
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        cancelTableCellEdit(currentCell)
        return
      }

      if (options?.multiline) {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault()
          void commitTableCellEdit(ticket.id, columnId, undefined, { focusCell: currentCell })
        }
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        void commitTableCellEdit(ticket.id, columnId, undefined, { focusCell: currentCell })
      }
    }

    const handleSelectKeyDown = (event: React.KeyboardEvent<HTMLSelectElement>) => {
      if (event.key === 'Tab') {
        event.preventDefault()
        const focusCell = getTableNavigationTarget(currentCell, event.shiftKey ? 'prev' : 'next')
        void commitTableCellEdit(ticket.id, columnId, event.currentTarget.value, { focusCell })
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        cancelTableCellEdit(currentCell)
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        void commitTableCellEdit(ticket.id, columnId, event.currentTarget.value, { focusCell: currentCell })
      }
    }

    if (columnId === 'priority') {
      return (
        <select
          ref={setTableEditorNode}
          value={tableEditingValue || 'medium'}
          onChange={(event) => {
            const nextValue = event.target.value
            setTableEditingValue(nextValue)
            void commitTableCellEdit(ticket.id, columnId, nextValue)
          }}
          onBlur={() => {
            if (tableEditingCell?.ticketId === ticket.id && tableEditingCell.columnId === columnId) {
              closeTableCellEditor()
            }
          }}
          onKeyDown={handleSelectKeyDown}
          style={baseInputStyle}
        >
          {PRIORITIES.map((priority) => (
            <option key={priority.value} value={priority.value}>{priority.label}</option>
          ))}
        </select>
      )
    }

    if (columnId === 'status') {
      return (
        <select
          ref={setTableEditorNode}
          value={tableEditingValue}
          onChange={(event) => {
            const nextValue = event.target.value
            setTableEditingValue(nextValue)
            void commitTableCellEdit(ticket.id, columnId, nextValue)
          }}
          onBlur={() => {
            if (tableEditingCell?.ticketId === ticket.id && tableEditingCell.columnId === columnId) {
              closeTableCellEditor()
            }
          }}
          onKeyDown={handleSelectKeyDown}
          style={baseInputStyle}
        >
          {COLUMNS.map((statusColumn) => (
            <option key={statusColumn.status} value={statusColumn.status}>{statusColumn.title}</option>
          ))}
        </select>
      )
    }

    if (columnId === 'comments') {
      return (
        <textarea
          ref={setTableEditorNode}
          value={tableEditingValue}
          rows={4}
          onChange={(event) => setTableEditingValue(event.target.value)}
          onBlur={() => void commitTableCellEdit(ticket.id, columnId)}
          onKeyDown={(event) => handleEditorKeyDown(event, { multiline: true })}
          style={baseInputStyle}
        />
      )
    }

    if (columnId.startsWith('custom:') && field?.type === 'select') {
      return (
        <select
          ref={setTableEditorNode}
          value={tableEditingValue}
          onChange={(event) => {
            const nextValue = event.target.value
            setTableEditingValue(nextValue)
            void commitTableCellEdit(ticket.id, columnId, nextValue)
          }}
          onBlur={() => {
            if (tableEditingCell?.ticketId === ticket.id && tableEditingCell.columnId === columnId) {
              closeTableCellEditor()
            }
          }}
          onKeyDown={handleSelectKeyDown}
          style={baseInputStyle}
        >
          <option value=''>-</option>
          {field.options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      )
    }

    if (columnId.startsWith('custom:') && field?.type === 'boolean') {
      return (
        <select
          ref={setTableEditorNode}
          value={tableEditingValue}
          onChange={(event) => {
            const nextValue = event.target.value
            setTableEditingValue(nextValue)
            void commitTableCellEdit(ticket.id, columnId, nextValue)
          }}
          onBlur={() => {
            if (tableEditingCell?.ticketId === ticket.id && tableEditingCell.columnId === columnId) {
              closeTableCellEditor()
            }
          }}
          onKeyDown={handleSelectKeyDown}
          style={baseInputStyle}
        >
          <option value=''>-</option>
          <option value='true'>Yes</option>
          <option value='false'>No</option>
        </select>
      )
    }

    const inputType = columnId === 'milestone'
      ? 'text'
      : columnId === 'owner'
        ? 'text'
        : columnId.startsWith('custom:') && field?.type === 'number'
          ? 'number'
          : columnId.startsWith('custom:') && field?.type === 'date'
            ? 'date'
            : 'text'

    const listId = columnId === 'owner'
      ? 'spreadsheet-assignee-options'
      : columnId === 'milestone'
        ? 'spreadsheet-version-options'
        : undefined

    return (
      <input
        ref={setTableEditorNode}
        type={inputType}
        list={listId}
        value={tableEditingValue}
        onChange={(event) => setTableEditingValue(event.target.value)}
        onBlur={() => void commitTableCellEdit(ticket.id, columnId)}
        onKeyDown={(event) => handleEditorKeyDown(event)}
        style={baseInputStyle}
      />
    )
  }

  const renderSpreadsheetCellDisplay = (ticket: Ticket, columnId: TableSortKey, field?: ProjectField) => {
    if (columnId.startsWith('custom:')) {
      return field ? formatCustomFieldValue(field, ticket.customFields?.[field.id]) : '-'
    }

    if (columnId === 'title') {
      return ticket.title
    }

    if (columnId === 'ticket') {
      return (
        <button
          type='button'
          onClick={(event) => {
            event.stopPropagation()
            openTicketDetail(ticket)
          }}
          style={{
            border: 'none',
            background: 'transparent',
            padding: 0,
            color: 'var(--text-secondary)',
            fontSize: '13px',
            fontFamily: 'inherit',
            cursor: 'pointer',
            textDecoration: 'underline',
            textUnderlineOffset: '2px'
          }}
        >
          {ticket.gitlabIssueNumber ? `#${ticket.gitlabIssueNumber}` : ticket.id.slice(0, 8)}
        </button>
      )
    }

    if (columnId === 'owner') {
      return ticket.assignee ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} title={getAssigneeTitle(ticket.assignee)}>
          {getAssigneeMember(ticket.assignee)?.avatarUrl ? (
            <img
              src={getAssigneeMember(ticket.assignee)?.avatarUrl ?? ''}
              alt={ticket.assignee}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '1px solid var(--avatar-border)'
              }}
            />
          ) : (
            <span style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontSize: '10px',
              fontWeight: 700,
              flexShrink: 0
            }}>
              {getAssigneeInitials(ticket.assignee)}
            </span>
          )}
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {getAssigneeTitle(ticket.assignee)}
          </span>
        </div>
      ) : '-'
    }

    if (columnId === 'priority') {
      return (
        <span style={{ color: getPriorityColor(ticket.priority), fontWeight: 600 }}>
          {getPriorityLabel(ticket.priority)}
        </span>
      )
    }

    if (columnId === 'status') {
      return (
        <span style={{ color: getStatusColor(ticket.status), fontWeight: 600 }}>
          {getStatusLabel(ticket.status)}
        </span>
      )
    }

    if (columnId === 'milestone') {
      return ticket.version || '-'
    }

    return getTicketCommentsValue(ticket) || '-'
  }

  if (loading) {
    return <AppShellSkeleton message='Loading tickets and workspace state...' />
  }

  if (error) {
    const isAuthError = /invalid or expired token|authorization token required|unauthorized|you need to sign in/i.test(error)

    return (
      <AppStateScreen
        title='Something went wrong'
        description={isAuthError ? 'Session mismatch detected. Re-authenticate to continue.' : error}
        actions={(
          <>
            <button
              onClick={fetchTickets}
              style={{
                padding: '10px 20px',
                background: '#fff',
                color: '#764ba2',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
            {isAuthError && (
              isSignedIn ? (
                <button
                  onClick={async () => {
                    await signOut()
                    window.location.href = '/'
                  }}
                  style={{
                    padding: '10px 20px',
                    background: 'rgba(255,255,255,0.18)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.45)',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  Sign out
                </button>
              ) : (
                <SignInButton mode="modal">
                  <button
                    style={{
                      padding: '10px 20px',
                      background: 'rgba(255,255,255,0.18)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.45)',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    Sign in
                  </button>
                </SignInButton>
              )
            )}
          </>
        )}
      />
    )
  }

  return (
    <div style={{
      display: 'flex',
      height: '100dvh',
      overflow: 'hidden',
      fontFamily: "'Inter', sans-serif",
      background: 'linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 50%, var(--bg-gradient-mid) 100%)'
    }}>
      {isMobileViewport && showMobileSidebar && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.4)',
            zIndex: 200
          }}
          onClick={() => setShowMobileSidebar(false)}
        />
      )}

      {/* Sidebar - Drag here to delete */}
      {(!isMobileViewport || showMobileSidebar) && <aside
        onDragOver={handleDeleteZoneDragOver}
        onDragLeave={handleDeleteZoneDragLeave}
        onDrop={handleDeleteZoneDrop}
        style={{
          width: isPhoneViewport ? '86vw' : '320px',
          maxWidth: '360px',
          background: dragOverDelete
            ? 'rgba(239,68,68,0.15)'
            : 'var(--sidebar-bg)',
          backdropFilter: 'blur(20px)',
          borderRight: dragOverDelete
            ? '3px solid #ef4444'
            : '1px solid var(--sidebar-border)',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px',
          transition: 'all 0.2s',
          position: isMobileViewport ? 'fixed' : 'relative',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: isMobileViewport ? 220 : 1,
          overflowY: 'auto'
        }}
      >
        {/* Delete indicator - shows when dragging */}
        {draggedTicket && (
          <div style={{
            background: dragOverDelete ? '#ef4444' : '#fee2e2',
            color: dragOverDelete ? '#fff' : '#ef4444',
            padding: '12px',
            borderRadius: '10px',
            textAlign: 'center',
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '16px',
            transition: 'all 0.2s'
          }}>
            🗑️ Drop here to delete
          </div>
        )}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: 700,
          fontSize: '22px',
          color: 'var(--text-primary)',
          marginBottom: '30px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              borderRadius: '10px',
              display: 'grid',
              placeItems: 'center',
              color: '#fff'
            }}>⚡</div>
            <a href="/" style={{ textDecoration: 'none', color: 'inherit' }}>SprintFlow</a>
          </div>
          {isMobileViewport && (
            <button
              onClick={() => setShowMobileSidebar(false)}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                border: '1px solid #dbe3f0',
                background: '#fff',
                color: '#475569',
                fontSize: '20px',
                lineHeight: 1,
                cursor: 'pointer'
              }}
              aria-label='Close sidebar'
            >
              ×
            </button>
          )}
        </div>

        <div style={{ marginBottom: '24px' }}>
          {isMobileViewport && (
            <div style={{ marginBottom: '14px', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                onClick={() => {
                  setShowQuickCreate(true)
                  setShowMobileSidebar(false)
                }}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                + New Ticket
              </button>
              {isSignedIn ? (
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: { width: '36px', height: '36px' }
                    }
                  }}
                />
              ) : (
                shouldUseFallbackAuth ? (
                  <a
                    href={fallbackAuthUrls!.signIn}
                    style={{
                      padding: '9px 12px',
                      background: '#fff',
                      color: '#1e293b',
                      border: '1px solid #dbe3f0',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: 600,
                      textDecoration: 'none'
                    }}
                  >
                    Sign in
                  </a>
                ) : (
                  <SignInButton mode="modal">
                    <button
                      style={{
                        padding: '9px 12px',
                        background: '#fff',
                        color: '#1e293b',
                        border: '1px solid #dbe3f0',
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Sign in
                    </button>
                  </SignInButton>
                )
              )}
            </div>
          )}

          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '10px',
            paddingLeft: '12px'
          }}>Workspace</div>
          {workspaceItems.map((item) => {
            const isActive = item.view ? activeView === item.view : false
            return (
              <div
                key={item.id}
                onClick={() => {
                  if (!item.view) return
                  setActiveView(item.view)
                  if (isMobileViewport) {
                    setShowMobileSidebar(false)
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  color: isActive ? 'var(--sidebar-active-text)' : 'var(--text-secondary)',
                  fontSize: '14px',
                  cursor: item.view ? 'pointer' : 'default',
                  background: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
                  fontWeight: isActive ? 600 : 400
                }}
              >
                {item.icon} {item.label}
              </div>
            )
          })}
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '10px',
            paddingLeft: '12px'
          }}>Team</div>
          {['Members', 'Settings'].map((item, i) => (
            <div key={item} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '10px',
              color: '#64748b',
              fontSize: '14px',
              cursor: 'pointer'
            }}>
              {['👥', '⚙️'][i]} {item}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {showOnboardingChecklist && (
            <div style={{
              padding: '14px',
              background: 'var(--checklist-bg)',
              borderRadius: '14px',
              border: '1px solid var(--checklist-border)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ fontSize: '12px', margin: 0, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Beta Checklist
                </h4>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {completedOnboardingSteps}/{onboardingSteps.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {onboardingSteps.map(step => (
                  <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <span style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '10px',
                      border: step.done ? '1px solid #34d399' : '1px solid #cbd5e1',
                      background: step.done ? '#ecfdf5' : '#fff',
                      color: step.done ? '#047857' : '#94a3b8'
                    }}>
                      {step.done ? '✓' : ''}
                    </span>
                    <span style={{ color: step.done ? 'var(--checklist-done-text)' : 'var(--checklist-pending-text)', fontWeight: step.done ? 600 : 500 }}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
              {needsLocalImport && (
                <button
                  onClick={handleImportLocalTickets}
                  disabled={importingLocalTickets}
                  style={{
                    marginTop: '10px',
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: importingLocalTickets ? 'rgba(55, 45, 55, 0.5)' : 'rgba(65, 55, 65, 0.6)',
                    color: importingLocalTickets ? '#6b5d5d' : '#f5f0eb',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: importingLocalTickets ? 'not-allowed' : 'pointer'
                  }}
                >
                  {importingLocalTickets ? 'Importing...' : `Import ${localTicketCount} local ${localTicketCount === 1 ? 'ticket' : 'tickets'}`}
                </button>
              )}
            </div>
          )}

          <div style={{
            padding: '16px',
            background: 'linear-gradient(135deg, #fc6d26, #e24329)',
            borderRadius: '14px',
            color: '#fff',
            textAlign: 'center'
          }}>
            <h4 style={{ fontSize: '13px', marginBottom: '6px' }}>🦊 GitLab</h4>
          {gitlabLoading && (
            <p style={{ fontSize: '11px', opacity: 0.9, marginBottom: '10px' }}>
              Loading integration...
            </p>
          )}

          {!gitlabLoading && !isSignedIn && (
            <p style={{ fontSize: '11px', opacity: 0.9, marginBottom: '10px' }}>
              Sign in to connect GitLab
            </p>
          )}

          {!gitlabLoading && isSignedIn && !gitlabStatus.connected && (
            <>
              <p style={{ fontSize: '11px', opacity: 0.9, marginBottom: '10px' }}>Connect your repo</p>
              <button
                onClick={handleGitLabConnect}
                disabled={gitlabConnecting}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: '#fff',
                  borderRadius: '8px',
                  fontSize: '12px',
                  cursor: gitlabConnecting ? 'not-allowed' : 'pointer',
                  opacity: gitlabConnecting ? 0.7 : 1
                }}
              >
                {gitlabConnecting ? 'Connecting...' : 'Connect'}
              </button>
            </>
          )}

          {!gitlabLoading && isSignedIn && gitlabStatus.connected && (
            <>
              <p style={{ fontSize: '11px', opacity: 0.9, marginBottom: '10px' }}>
                Connected{gitlabStatus.repo ? `: ${gitlabStatus.repo.fullName}` : ''}
              </p>

              {gitlabRepos.length > 0 && (
                <select
                  value={gitlabStatus.repo?.id ?? ''}
                  onChange={(e) => handleGitLabRepoChange(Number(e.target.value))}
                  disabled={gitlabRepoSaving}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.35)',
                    background: 'rgba(255,255,255,0.15)',
                    color: '#fff',
                    fontSize: '12px',
                    marginBottom: '8px'
                  }}
                >
                  <option value="" disabled style={{ color: '#111827' }}>
                    Select repo...
                  </option>
                  {gitlabRepos.map(repo => (
                    <option key={repo.id} value={repo.id} style={{ color: '#111827' }}>
                      {repo.fullName}
                    </option>
                  ))}
                </select>
              )}

              {gitlabRepos.length === 0 && (
                <button
                  onClick={loadGitLabState}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: 'rgba(255,255,255,0.2)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    color: '#fff',
                    borderRadius: '8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    marginBottom: '8px'
                  }}
                >
                  Refresh Repos
                </button>
              )}

              {gitlabRepoSaving && (
                <p style={{ fontSize: '11px', opacity: 0.9, marginBottom: '8px' }}>Saving repo...</p>
              )}
            </>
          )}

          {gitlabMessage && (
            <p style={{ fontSize: '10px', marginTop: '8px', marginBottom: 0, color: '#d1fae5' }}>
              {gitlabMessage}
            </p>
          )}
          {gitlabError && (
            <p style={{ fontSize: '10px', marginTop: '8px', marginBottom: 0, color: '#fee2e2' }}>
              {gitlabError}
            </p>
          )}
          </div>
        </div>
      </aside>}

      {/* Main Content */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <header style={{
          background: 'var(--surface-dark)',
          backdropFilter: 'blur(20px)',
          padding: isPhoneViewport ? '12px' : '16px 24px',
          display: 'flex',
          flexDirection: isPhoneViewport ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isPhoneViewport ? 'stretch' : 'center',
          gap: isPhoneViewport ? '10px' : 0,
          borderBottom: '1px solid var(--glass-border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isPhoneViewport ? '10px' : '20px', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isMobileViewport && (
                <button
                  onClick={() => setShowMobileSidebar(true)}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    border: '1px solid #d8e0ea',
                    background: '#fff',
                    color: '#334155',
                    fontSize: '18px',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                  aria-label='Open sidebar'
                >
                  ☰
                </button>
              )}
              <h1 style={{ fontSize: isPhoneViewport ? '18px' : '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: "'Outfit', sans-serif" }}>
                {activeViewLabel}
              </h1>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              {activeViewTicketCount}{activeViewTicketCount !== tickets.length ? ` / ${tickets.length}` : ''} tickets
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: isPhoneViewport ? 'wrap' : 'nowrap' }}>
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '10px 16px',
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                borderRadius: '10px',
                fontSize: '14px',
                width: isPhoneViewport ? '100%' : '240px',
                flexGrow: isPhoneViewport ? 1 : 0,
                color: 'var(--text-primary)'
              }}
            />
            <button
              onClick={handleCopyBoardPermalink}
              style={{
                padding: '10px 14px',
                background: isBoardPermalinkCopied ? 'var(--modal-status-active-bg)' : 'var(--version-bg)',
                border: `1px solid ${isBoardPermalinkCopied ? 'var(--modal-status-active-border)' : 'var(--version-border)'}`,
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 600,
                color: isBoardPermalinkCopied ? 'var(--modal-status-active-text)' : 'var(--text-primary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
              title={boardPermalinkError || 'Copy board permalink'}
            >
              {boardPermalinkError ? 'Copy failed' : isBoardPermalinkCopied ? 'Board link copied' : 'Copy board link'}
            </button>
            {/* Theme Toggle */}
            {!isMobileViewport && (
              <button
                onClick={toggleTheme}
                style={{
                  padding: '8px 12px',
                  background: 'var(--version-bg)',
                  border: '1px solid var(--version-border)',
                  borderRadius: '10px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            )}
            {!isMobileViewport && (
              <button
                onClick={() => setShowQuickCreate(true)}
                style={{
                  padding: isPhoneViewport ? '10px 14px' : '10px 20px',
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.8), rgba(139, 92, 246, 0.8))',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  whiteSpace: 'nowrap'
                }}
              >
                <span>+</span>
                New Ticket
              </button>
            )}
            {!isMobileViewport && isSignedIn ? (
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: { width: '36px', height: '36px' }
                  }
                }}
              />
            ) : !isMobileViewport ? (
              shouldUseFallbackAuth ? (
                <a
                  href={fallbackAuthUrls!.signIn}
                  style={{
                    padding: '10px 16px',
                    background: '#ffffff',
                    color: '#1e293b',
                    border: '1px solid #dbe3f0',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'none'
                  }}
                >
                  Sign in
                </a>
              ) : (
                <SignInButton mode="modal">
                  <button
                    style={{
                      padding: '10px 16px',
                      background: '#ffffff',
                      color: '#1e293b',
                      border: '1px solid #dbe3f0',
                      borderRadius: '10px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Sign in
                  </button>
                </SignInButton>
              )
            ) : null}
          </div>
        </header>

        {/* Views */}
        {activeView === 'board' ? (
        <div style={{
          flex: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          padding: isPhoneViewport ? '12px' : '24px'
        }}>
          <div style={{
            display: 'flex',
            gap: isPhoneViewport ? '12px' : '20px',
            height: '100%',
            minWidth: 'max-content'
          }}>
            {tickets.length === 0 && (
              <div style={{
                width: '100%',
                minWidth: isPhoneViewport ? 'calc(100vw - 24px)' : '520px',
                background: 'var(--empty-bg)',
                borderRadius: '20px',
                padding: isPhoneViewport ? '20px' : '32px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                textAlign: 'center',
                border: '1px solid var(--empty-border)'
              }}>
                <h3 style={{ margin: 0, fontSize: '22px', color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
                  {isSignedIn ? 'Add your first ticket' : 'Sign in to create tickets'}
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {isSignedIn
                    ? 'Start with one issue in To Do and organize from there.'
                    : 'Your board is scoped to your account and selected project.'}
                </p>
                {isSignedIn && (
                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setShowQuickCreate(true)}
                      style={{
                        padding: '10px 20px',
                        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.8), rgba(139, 92, 246, 0.8))',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Create First Ticket
                    </button>
                    <button
                      onClick={() => setShowAddFieldModal(true)}
                      style={{
                        padding: '10px 16px',
                        background: '#fff',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        borderRadius: '10px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      + Add Column
                    </button>
                  </div>
                )}
              </div>
            )}

            {tickets.length > 0 && filteredTickets.length === 0 && (
              <div style={{
                width: '100%',
                minWidth: isPhoneViewport ? 'calc(100vw - 24px)' : '520px',
                background: 'rgba(55, 45, 55, 0.5)',
                borderRadius: '20px',
                padding: isPhoneViewport ? '20px' : '32px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                textAlign: 'center',
                border: '1px solid rgba(255,255,255,0.06)'
              }}>
                <h3 style={{ margin: 0, fontSize: '22px', color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>No matching tickets</h3>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Try a different search term.
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    marginTop: '8px',
                    padding: '8px 16px',
                    background: 'var(--btn-secondary-bg)',
                    color: 'var(--btn-secondary-text)',
                    border: '1px solid var(--btn-secondary-border)',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Clear Search
                </button>
              </div>
            )}

            {tickets.length > 0 && filteredTickets.length > 0 && COLUMNS.map((column) => {
              const columnTickets = getTicketsByStatus(column.status)

              return (
              <div
                key={column.id}
                style={{
                  width: isPhoneViewport ? '82vw' : '320px',
                  background: dragOverColumn === column.id
                    ? 'var(--surface-card-hover)'
                    : 'var(--card-bg)',
                  backdropFilter: 'blur(20px)',
                  borderRadius: '20px',
                  padding: isPhoneViewport ? '16px' : '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  border: dragOverColumn === column.id
                    ? '2px dashed rgba(168, 85, 247, 0.5)'
                    : '1px solid var(--card-border)',
                  transition: 'all 0.2s'
                }}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.status)}
              >
                {/* Column Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid var(--column-header-border)'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontWeight: 600,
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--column-header-text)',
                    fontFamily: "'Outfit', sans-serif"
                  }}>
                    {column.title}
                  </div>
                  <span style={{
                    padding: '4px 12px',
                    background: 'var(--column-count-bg)',
                    borderRadius: '999px',
                    fontSize: '13px',
                    color: 'var(--column-count-text)',
                    fontWeight: 600
                  }}>{columnTickets.length}</span>
                </div>

                {/* Cards */}
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  {columnTickets.length === 0 && (
                    <div style={{
                      padding: '16px',
                      borderRadius: '12px',
                      border: '1px dashed rgba(255,255,255,0.1)',
                      fontSize: '13px',
                      color: '#6b5d5d',
                      textAlign: 'center'
                    }}>
                      {column.status === 'todo' ? 'No tickets yet. Add your first one.' : 'No tickets in this column yet.'}
                    </div>
                  )}

                  {columnTickets.map((ticket, index) => (
                    <div
                      key={ticket.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, ticket)}
                      onClick={() => handleTicketClick(ticket)}
                      style={{
                        background: 'var(--surface-card)',
                        borderRadius: '16px',
                        padding: isPhoneViewport ? '14px' : '18px',
                        cursor: 'grab',
                        transition: 'all 0.2s ease',
                        border: draggedTicket?.id === ticket.id
                          ? '1px solid rgba(168, 85, 247, 0.5)'
                          : '1px solid var(--card-border)',
                        opacity: draggedTicket?.id === ticket.id ? 0.8 : 1,
                        transform: draggedTicket?.id === ticket.id ? 'rotate(2deg)' : 'none',
                        animation: `cardEnter 0.3s ease ${index * 0.05}s both`
                      }}
                      onMouseEnter={(e) => {
                        if (draggedTicket?.id !== ticket.id) {
                          e.currentTarget.style.transform = 'translateY(-2px)'
                          e.currentTarget.style.background = 'var(--surface-card-hover)'
                          e.currentTarget.style.borderColor = 'var(--glass-border-hover)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (draggedTicket?.id !== ticket.id) {
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.background = 'var(--surface-card)'
                          e.currentTarget.style.borderColor = 'var(--card-border)'
                        }
                      }}
                    >
                      {/* Top Row: Priority + GitLab */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '16px'
                      }}>
                        {/* Priority Label - Dynamic colors: HIGH=red, MEDIUM=yellow, LOW=green */}
                        <span style={{
                          padding: '6px 14px',
                          borderRadius: '10px',
                          fontSize: '10px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          background: (() => {
                            switch (ticket.priority) {
                              case 'high': return 'var(--priority-high-bg)';
                              case 'medium': return 'var(--priority-medium-bg)';
                              case 'low': return 'var(--priority-low-bg)';
                              default: return 'var(--priority-low-bg)';
                            }
                          })(),
                          color: (() => {
                            switch (ticket.priority) {
                              case 'high': return 'var(--priority-high-text)';
                              case 'medium': return 'var(--priority-medium-text)';
                              case 'low': return 'var(--priority-low-text)';
                              default: return 'var(--priority-low-text)';
                            }
                          })(),
                          border: (() => {
                            switch (ticket.priority) {
                              case 'high': return '1px solid var(--priority-high-border)';
                              case 'medium': return '1px solid var(--priority-medium-border)';
                              case 'low': return '1px solid var(--priority-low-border)';
                              default: return '1px solid var(--priority-low-border)';
                            }
                          })()
                        }}>
                          {getPriorityLabel(ticket.priority)}
                        </span>
                        
                        {/* Version - Top right */}
                        {ticket.version && (
                          <span style={{
                            padding: '6px 14px',
                            background: 'var(--version-bg)',
                            color: 'var(--version-text)',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: 500,
                            border: '1px solid var(--version-border)'
                          }}>
                            {ticket.version}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <div style={{
                        fontSize: isPhoneViewport ? '14px' : '15px',
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        marginBottom: '16px',
                        lineHeight: 1.5,
                        fontFamily: "'Outfit', sans-serif"
                      }}>{ticket.title}</div>

                       {/* Bottom Row: Version + Status + Avatar */}
                       <div style={{
                         display: 'flex',
                         justifyContent: 'space-between',
                         alignItems: 'center'
                       }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {/* GitLab Issue Number - Orange fox pill */}
                            {ticket.gitlabIssueNumber && (
                              <span style={{
                                padding: '6px 12px',
                                background: 'var(--gitlab-bg)',
                                color: 'var(--gitlab-text)',
                                borderRadius: '10px',
                                fontSize: '10px',
                                fontWeight: 600,
                                border: '1px solid var(--gitlab-border)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              >
                                🦊 #{ticket.gitlabIssueNumber}
                              </span>
                            )}
                             
                             {/* Sync Status */}
                             {isTicketSyncing(ticket.id) && (
                               <span style={{
                                 padding: '6px 12px',
                                 background: 'var(--sync-pending-bg)',
                                 color: 'var(--sync-pending-text)',
                                 borderRadius: '10px',
                                 fontSize: '10px',
                                 fontWeight: 600,
                                 border: '1px solid var(--sync-pending-border)',
                                 display: 'flex',
                                 alignItems: 'center',
                                 gap: '4px'
                               }}
                             >
                                 ⏳ Syncing...
                               </span>
                             )}
                             {gitlabSyncErrors[ticket.id] && !isTicketSyncing(ticket.id) && (
                               <button
                                 onClick={(event) => handleInlineRetrySync(event, ticket)}
                                 style={{
                                   padding: '6px 12px',
                                   background: 'var(--sync-error-bg)',
                                   color: 'var(--sync-error-text)',
                                   borderRadius: '10px',
                                   fontSize: '10px',
                                   fontWeight: 600,
                                   border: '1px solid var(--sync-error-border)',
                                   cursor: 'pointer'
                                 }}
                                 title={gitlabSyncErrors[ticket.id]}
                               >
                                 Retry
                               </button>
                             )}
                              {!gitlabSyncErrors[ticket.id] && gitlabLastSyncedAt[ticket.id] && !isTicketSyncing(ticket.id) && (
                                <span style={{
                                  padding: '6px 12px',
                                  background: 'var(--sync-success-bg)',
                                  color: 'var(--sync-success-text)',
                                  borderRadius: '10px',
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  border: '1px solid var(--sync-success-border)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                  ✓ Synced {formatSyncTime(gitlabLastSyncedAt[ticket.id])}
                                </span>
                              )}
                           </div>
                         {getAssigneeMember(ticket.assignee)?.avatarUrl ? (
                           <img
                            src={getAssigneeMember(ticket.assignee)?.avatarUrl ?? ''}
                            alt={ticket.assignee || 'Assignee avatar'}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: '1px solid var(--avatar-border)'
                            }}
                            title={getAssigneeTitle(ticket.assignee)}
                          />
                        ) : (
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #667eea, #764ba2)',
                            display: 'grid',
                            placeItems: 'center',
                            color: '#fff',
                            fontSize: '11px',
                            fontWeight: 600
                          }}
                          title={getAssigneeTitle(ticket.assignee)}
                          >
                            {getAssigneeInitials(ticket.assignee)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {/* Add card button */}
                  <div style={{
                    padding: '14px',
                    border: '1px dashed var(--add-btn-border)',
                    borderRadius: '12px',
                    textAlign: 'center',
                    color: 'var(--add-btn-text)',
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    marginTop: '8px',
                    background: 'transparent'
                  }}
                  onClick={() => setShowQuickCreate(true)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--add-btn-hover-border)'
                    e.currentTarget.style.color = 'var(--add-btn-hover-text)'
                    e.currentTarget.style.background = 'var(--add-btn-hover-bg)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--add-btn-border)'
                    e.currentTarget.style.color = 'var(--add-btn-text)'
                    e.currentTarget.style.background = 'transparent'
                  }}
                  >+ Add Ticket</div>
                </div>
              </div>
            )})}
          </div>
        </div>
        ) : activeView === 'roadmap' ? (
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: isPhoneViewport ? '12px' : '24px'
          }}>
            {tickets.length === 0 && (
              <div style={{
                width: '100%',
                minWidth: '520px',
                background: 'var(--empty-bg)',
                border: '1px solid var(--empty-border)',
                borderRadius: '16px',
                padding: '32px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                textAlign: 'center'
              }}>
                <h3 style={{ margin: 0, fontSize: '22px', color: 'var(--text-primary)' }}>
                  {isSignedIn ? 'Add your first ticket' : 'Sign in to create tickets'}
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {isSignedIn
                    ? 'Create tickets with versions to start planning releases.'
                    : 'Your roadmap is scoped to your account and selected project.'}
                </p>
                {isSignedIn && (
                  <button
                    onClick={() => setShowQuickCreate(true)}
                    style={{
                      marginTop: '8px',
                      padding: '10px 20px',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Create First Ticket
                  </button>
                )}
              </div>
            )}

            {tickets.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{
                  background: 'var(--surface-dark)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '14px',
                  padding: isPhoneViewport ? '12px' : '14px'
                }}>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <select
                      value={roadmapPriorityFilter}
                      onChange={(event) => setRoadmapPriorityFilter(event.target.value as 'all' | 'low' | 'medium' | 'high')}
                      style={{
                        minWidth: '160px',
                        padding: '9px 12px',
                        border: '1px solid var(--input-border)',
                        borderRadius: '10px',
                        background: 'var(--input-bg)',
                        color: 'var(--text-primary)',
                        fontSize: '13px'
                      }}
                    >
                      <option value='all'>All priorities</option>
                      <option value='low'>Low priority</option>
                      <option value='medium'>Medium priority</option>
                      <option value='high'>High priority</option>
                    </select>
                    <select
                      value={roadmapAssigneeFilter}
                      onChange={(event) => setRoadmapAssigneeFilter(event.target.value)}
                      style={{
                        minWidth: '180px',
                        padding: '9px 12px',
                        border: '1px solid var(--input-border)',
                        borderRadius: '10px',
                        background: 'var(--input-bg)',
                        color: 'var(--text-primary)',
                        fontSize: '13px'
                      }}
                    >
                      <option value='all'>All assignees</option>
                      <option value='__unassigned__'>Unassigned</option>
                      {roadmapAssigneeOptions.map((assignee) => (
                        <option key={assignee} value={assignee}>
                          {getAssigneeTitle(assignee)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={roadmapCustomFieldId}
                      onChange={(event) => {
                        setRoadmapCustomFieldId(event.target.value)
                        setRoadmapCustomFieldValue('all')
                      }}
                      style={{
                        minWidth: '180px',
                        padding: '9px 12px',
                        border: '1px solid var(--input-border)',
                        borderRadius: '10px',
                        background: 'var(--input-bg)',
                        color: 'var(--text-primary)',
                        fontSize: '13px'
                      }}
                    >
                      <option value='all'>All custom fields</option>
                      {projectFields.map((field) => (
                        <option key={field.id} value={field.id}>
                          {field.name}
                        </option>
                      ))}
                    </select>
                    {roadmapCustomFieldId !== 'all' && (
                      <select
                        value={roadmapCustomFieldValue}
                        onChange={(event) => setRoadmapCustomFieldValue(event.target.value)}
                        style={{
                          minWidth: '180px',
                          padding: '9px 12px',
                          border: '1px solid var(--input-border)',
                          borderRadius: '10px',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          fontSize: '13px'
                        }}
                      >
                        <option value='all'>All values</option>
                        {roadmapCustomFieldValues.map((value) => (
                          <option key={value} value={value}>
                            {roadmapSelectedCustomField ? formatCustomFieldValue(roadmapSelectedCustomField, value) : value}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={() => {
                        setRoadmapPriorityFilter('all')
                        setRoadmapAssigneeFilter('all')
                        setRoadmapCustomFieldId('all')
                        setRoadmapCustomFieldValue('all')
                      }}
                      style={{
                        marginLeft: 'auto',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        border: '1px solid var(--btn-secondary-border)',
                        background: 'var(--btn-secondary-bg)',
                        color: 'var(--btn-secondary-text)',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                </div>

                {roadmapFilteredTickets.length === 0 ? (
                  <div style={{
                    background: 'var(--empty-bg)',
                    border: '1px solid var(--empty-border)',
                    borderRadius: '16px',
                    padding: '30px',
                    textAlign: 'center'
                  }}>
                    <h3 style={{ margin: 0, fontSize: '20px', color: 'var(--text-primary)' }}>No releases match this filter</h3>
                    <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                      Adjust filters to see release groups.
                    </p>
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isPhoneViewport ? '1fr' : 'repeat(3, minmax(0, 1fr))',
                    gap: '14px',
                    alignItems: 'start'
                  }}>
                    {roadmapLanes.map((lane) => (
                      <section
                        key={lane.id}
                        style={{
                          background: 'var(--card-bg)',
                          border: `1px solid ${lane.border}`,
                          borderRadius: '14px',
                          padding: '12px'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '10px'
                        }}>
                          <span style={{
                            padding: '5px 10px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: 700,
                            letterSpacing: '0.5px',
                            textTransform: 'uppercase',
                            color: 'var(--text-primary)',
                            background: lane.background,
                            border: `1px solid ${lane.border}`
                          }}>
                            {lane.label}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            {lane.releases.length} releases
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {lane.releases.length === 0 && (
                            <div style={{
                              border: '1px dashed var(--add-btn-border)',
                              borderRadius: '10px',
                              padding: '12px',
                              textAlign: 'center',
                              fontSize: '12px',
                              color: 'var(--text-secondary)',
                              background: 'var(--card-bg)'
                            }}>
                              No releases yet
                            </div>
                          )}
                          {lane.releases.map((release) => (
                            <div
                              key={release.version}
                              onDragOver={(event) => handleRoadmapReleaseDragOver(event, release.version)}
                              onDragLeave={() => handleRoadmapReleaseDragLeave(release.version)}
                              onDrop={(event) => void handleRoadmapReleaseDrop(event, release.version)}
                              style={{
                                background: 'var(--surface-card)',
                                borderRadius: '12px',
                                border: roadmapDragOverVersion === release.version
                                  ? '2px dashed #6366f1'
                                  : '1px solid var(--card-border)',
                                padding: '12px',
                                transition: 'all 0.16s ease'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
                                <div>
                                  <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.3 }}>{release.version}</h3>
                                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                    {release.tickets.length} tickets • {release.doneCount} done
                                  </p>
                                </div>
                                <select
                                  value={release.releaseState}
                                  onChange={(event) => handleRoadmapReleaseStateChange(
                                    release.version,
                                    event.target.value as RoadmapReleaseState,
                                    release.inferredReleaseState
                                  )}
                                  style={{
                                    border: '1px solid var(--input-border)',
                                    borderRadius: '8px',
                                    background: 'var(--input-bg)',
                                    color: 'var(--text-primary)',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    padding: '5px 8px'
                                  }}
                                >
                                  {ROADMAP_RELEASE_COLUMNS.map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div style={{ marginBottom: '10px' }}>
                                <div style={{ height: '6px', borderRadius: '999px', background: 'var(--glass-bg)', overflow: 'hidden' }}>
                                  <div style={{
                                    width: `${release.progressPercent}%`,
                                    height: '100%',
                                    background: release.progressPercent >= 80
                                      ? '#10b981'
                                      : release.progressPercent >= 40
                                        ? '#3b82f6'
                                        : '#f59e0b'
                                  }} />
                                </div>
                                <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                  {release.progressPercent}% shipped • {release.riskLevel}
                                  {release.highPriorityCount > 0 ? ` • ${release.highPriorityCount} high priority` : ''}
                                </div>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {release.tickets.length === 0 && (
                                  <div style={{
                                    border: '1px dashed var(--add-btn-border)',
                                    borderRadius: '9px',
                                    padding: '10px',
                                    textAlign: 'center',
                                    fontSize: '11px',
                                    color: 'var(--text-secondary)',
                                    background: 'var(--card-bg)'
                                  }}>
                                    Drop tickets here
                                  </div>
                                )}
                                {release.tickets.map((ticket) => {
                                  const roadmapTicketFieldPreview = roadmapSelectedCustomField
                                    ? formatCustomFieldValue(roadmapSelectedCustomField, ticket.customFields?.[roadmapSelectedCustomField.id])
                                    : (() => {
                                        const nextField = projectFields.find((field) => normalizeCustomValue(ticket.customFields?.[field.id]))
                                        return nextField
                                          ? formatCustomFieldValue(nextField, ticket.customFields?.[nextField.id])
                                          : ''
                                      })()

                                  return (
                                      <article
                                      key={ticket.id}
                                      draggable
                                      onDragStart={(event) => handleRoadmapTicketDragStart(event, ticket.id)}
                                      onDragEnd={handleRoadmapTicketDragEnd}
                                      onClick={() => handleTicketClick(ticket)}
                                      style={{
                                        border: roadmapDraggingTicketId === ticket.id ? '1px solid #818cf8' : '1px solid var(--card-border)',
                                        borderRadius: '10px',
                                        padding: '10px',
                                        background: 'var(--card-bg)',
                                        boxShadow: roadmapDraggingTicketId === ticket.id ? '0 8px 24px rgba(99,102,241,0.2)' : '0 1px 5px rgba(0,0,0,0.08)',
                                        cursor: 'grab'
                                      }}
                                    >
                                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>{ticket.title}</div>
                                        {ticket.gitlabIssueNumber && (
                                          <span style={{
                                            padding: '2px 6px',
                                            background: 'var(--glass-bg)',
                                            border: '1px solid var(--glass-border)',
                                            color: 'var(--text-secondary)',
                                            borderRadius: '999px',
                                            fontSize: '10px',
                                            fontWeight: 700,
                                            whiteSpace: 'nowrap'
                                          }}>
                                            🦊 #{ticket.gitlabIssueNumber}
                                          </span>
                                        )}
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                        <span style={{
                                          fontSize: '10px',
                                          fontWeight: 700,
                                          color: getPriorityColor(ticket.priority),
                                          background: `${getPriorityColor(ticket.priority)}15`,
                                          border: `1px solid ${getPriorityColor(ticket.priority)}30`,
                                          borderRadius: '999px',
                                          padding: '2px 8px',
                                          textTransform: 'uppercase'
                                        }}>
                                          {getPriorityLabel(ticket.priority)}
                                        </span>
                                        <span style={{
                                          fontSize: '10px',
                                          fontWeight: 700,
                                          color: getStatusColor(ticket.status),
                                          background: `${getStatusColor(ticket.status)}14`,
                                          border: `1px solid ${getStatusColor(ticket.status)}2f`,
                                          borderRadius: '999px',
                                          padding: '2px 8px',
                                          textTransform: 'uppercase'
                                        }}>
                                          {getStatusLabel(ticket.status)}
                                        </span>
                                        <span style={{
                                          fontSize: '10px',
                                          color: 'var(--text-secondary)',
                                          background: 'var(--glass-bg)',
                                          border: '1px solid var(--glass-border)',
                                          borderRadius: '999px',
                                          padding: '2px 8px'
                                        }}>
                                          {ticket.assignee ? getAssigneeInitials(ticket.assignee) : 'Unassigned'}
                                        </span>
                                      </div>
                                      {roadmapTicketFieldPreview && roadmapTicketFieldPreview !== '-' && (
                                        <div style={{
                                          marginTop: '7px',
                                          fontSize: '11px',
                                          color: 'var(--text-secondary)',
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis'
                                        }}>
                                          {roadmapSelectedCustomField ? `${roadmapSelectedCustomField.name}: ` : ''}{roadmapTicketFieldPreview}
                                        </div>
                                      )}
                                    </article>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: isPhoneViewport ? '12px' : '24px'
          }}>
            {tickets.length === 0 && (
              <div style={{
                width: '100%',
                minWidth: '520px',
                background: 'var(--empty-bg)',
                borderRadius: '16px',
                padding: '32px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                textAlign: 'center'
              }}>
                <h3 style={{ margin: 0, fontSize: '22px', color: 'var(--text-primary)' }}>
                  {isSignedIn ? 'Add your first ticket' : 'Sign in to create tickets'}
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {isSignedIn
                    ? 'Create a ticket and it will appear here in spreadsheet format.'
                    : 'Your ticket table is scoped to your account and selected project.'}
                </p>
                {isSignedIn && (
                  <button
                    onClick={() => setShowQuickCreate(true)}
                    style={{
                      marginTop: '8px',
                      padding: '10px 20px',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Create First Ticket
                  </button>
                )}
              </div>
            )}

            {tickets.length > 0 && filteredTickets.length === 0 && (
              <div style={{
                width: '100%',
                minWidth: '520px',
                background: 'var(--empty-bg)',
                borderRadius: '16px',
                padding: '32px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                textAlign: 'center'
              }}>
                <h3 style={{ margin: 0, fontSize: '22px', color: 'var(--text-primary)' }}>No matching tickets</h3>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Try a different search term.
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    marginTop: '8px',
                    padding: '8px 16px',
                    background: 'var(--btn-secondary-bg)',
                    color: 'var(--btn-secondary-text)',
                    border: '1px solid var(--btn-secondary-border)',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Clear Search
                </button>
              </div>
            )}

            {tickets.length > 0 && filteredTickets.length > 0 && (
              <div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '10px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Click to edit, use Tab and arrows to move, and paste blocks directly into the grid. Click the ticket ID for full detail.
                    </span>
                    {tableSaveError && (
                      <span style={{ fontSize: '12px', color: 'var(--priority-high)' }}>
                        {tableSaveError}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Drag custom columns to reorder
                    </span>
                    <button
                      onClick={() => setShowAddFieldModal(true)}
                      style={{
                        padding: '8px 12px',
                        background: 'var(--card-bg)',
                        border: '1px solid var(--input-border)',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: 'var(--text-primary)',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      + Add Column
                    </button>
                  </div>
                </div>

                <div style={{
                  background: 'var(--card-bg)',
                  borderRadius: '16px',
                  border: '1px solid var(--card-border)',
                  overflow: 'auto',
                  backdropFilter: 'blur(20px)'
                }}>
                  <datalist id='spreadsheet-assignee-options'>
                    {gitlabMembers.map((member) => (
                      <option key={`member:${member.id}`} value={member.username} label={member.name} />
                    ))}
                    {roadmapAssigneeOptions
                      .filter((assignee) => !gitlabMembers.some((member) => member.username === assignee))
                      .map((assignee) => (
                        <option key={`assignee:${assignee}`} value={assignee} />
                      ))}
                  </datalist>
                  <datalist id='spreadsheet-version-options'>
                    {existingVersions.map((version) => (
                      <option key={version} value={version} />
                    ))}
                  </datalist>
                  <table style={{
                    width: '100%',
                    minWidth: '1260px',
                    borderCollapse: 'collapse'
                  }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-dark)' }}>
                        {tableColumns.map((column) => {
                          const isSorted = tableSort?.key === column.id
                          const sortIndicator = isSorted ? (tableSort?.direction === 'asc' ? '▲' : '▼') : ''
                          const isCustomColumn = Boolean(column.isCustom && column.customFieldId)
                          const isDragSource = Boolean(column.customFieldId && draggingProjectFieldId === column.customFieldId)
                          const isDropTarget = Boolean(
                            column.customFieldId &&
                            dragOverProjectFieldId === column.customFieldId &&
                            draggingProjectFieldId !== column.customFieldId
                          )

                          return (
                            <th
                              key={column.id}
                              onClick={() => handleTableSort(column.id)}
                              draggable={isCustomColumn}
                              onDragStart={(event) => {
                                if (!column.customFieldId) return
                                handleProjectFieldDragStart(event, column.customFieldId)
                              }}
                              onDragOver={(event) => {
                                if (!column.customFieldId) return
                                handleProjectFieldDragOver(event, column.customFieldId)
                              }}
                              onDragEnter={(event) => {
                                if (!column.customFieldId || column.customFieldId === draggingProjectFieldId) return
                                event.preventDefault()
                                setDragOverProjectFieldId(column.customFieldId)
                              }}
                              onDragLeave={() => {
                                if (dragOverProjectFieldId === column.customFieldId) {
                                  setDragOverProjectFieldId(null)
                                }
                              }}
                              onDrop={(event) => {
                                if (!column.customFieldId) return
                                handleProjectFieldDrop(event, column.customFieldId)
                              }}
                              onDragEnd={handleProjectFieldDragEnd}
                              style={{
                                position: 'sticky',
                                top: 0,
                                textAlign: 'left',
                                padding: '12px 14px',
                                fontSize: '12px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.3px',
                                color: 'var(--text-secondary)',
                                borderBottom: '1px solid var(--glass-border)',
                                whiteSpace: 'nowrap',
                                background: isDropTarget ? 'var(--input-bg)' : 'var(--surface-dark)',
                                zIndex: 1,
                                cursor: isCustomColumn ? (isDragSource ? 'grabbing' : 'grab') : 'pointer',
                                userSelect: 'none',
                                opacity: isDragSource ? 0.65 : 1,
                                boxShadow: isDropTarget ? 'inset 0 0 0 2px var(--input-border)' : undefined
                              }}
                            >
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <span>{column.label}</span>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', minWidth: '10px' }}>{sortIndicator}</span>
                              </span>
                              {column.isCustom && column.customFieldId && (
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    if (column.customFieldId) {
                                      void deleteProjectField(column.customFieldId)
                                    }
                                  }}
                                  disabled={deletingFieldId === column.customFieldId}
                                  style={{
                                    marginLeft: '8px',
                                    border: '1px solid var(--priority-high)',
                                    background: 'transparent',
                                    color: 'var(--priority-high)',
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    lineHeight: 1,
                                    cursor: deletingFieldId === column.customFieldId ? 'not-allowed' : 'pointer',
                                    opacity: deletingFieldId === column.customFieldId ? 0.5 : 1,
                                  }}
                                  title='Delete column'
                                >
                                  ×
                                </button>
                              )}
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTableTickets.map((ticket, index) => (
                        <tr
                          key={ticket.id}
                          style={{
                            background: index % 2 === 0 ? 'var(--card-bg)' : 'var(--surface-dark)',
                            cursor: 'default'
                          }}
                        >
                          {tableColumns.map((column) => {
                            const cellKey = getTableCellKey(ticket.id, column.id)
                            const isEditing = tableEditingCell?.ticketId === ticket.id && tableEditingCell.columnId === column.id
                            const isSaving = Boolean(tableSavingCellKeys[cellKey])
                            const isEditable = column.id !== 'ticket'
                            const isActiveCell = tableActiveCell?.ticketId === ticket.id && tableActiveCell.columnId === column.id
                            const isDefaultTabStop = !tableActiveCell
                              && firstEditableTableCell?.ticketId === ticket.id
                              && firstEditableTableCell.columnId === column.id
                            const field = column.id.startsWith('custom:')
                              ? projectFields.find((item) => item.id === column.id.slice('custom:'.length))
                              : undefined

                            return (
                              <td
                                key={`${ticket.id}:${column.id}`}
                                ref={isEditable ? (node) => setTableCellNode(cellKey, node) : undefined}
                                onClick={isEditing ? undefined : () => openTableCellEditor(ticket, column.id)}
                                onFocus={isEditable ? () => setTableActiveCell({ ticketId: ticket.id, columnId: column.id }) : undefined}
                                onPaste={isEditable ? (event) => {
                                  const text = event.clipboardData.getData('text')
                                  if (!text) {
                                    return
                                  }
                                  event.preventDefault()
                                  void handleTablePaste({ ticketId: ticket.id, columnId: column.id }, text)
                                } : undefined}
                                onKeyDown={isEditable ? (event) => {
                                  const currentCell: InlineSpreadsheetCell = { ticketId: ticket.id, columnId: column.id }

                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    openTableCellEditor(ticket, column.id)
                                    return
                                  }

                                  if (event.key === 'Tab') {
                                    event.preventDefault()
                                    focusTableCell(getTableNavigationTarget(currentCell, event.shiftKey ? 'prev' : 'next'))
                                    return
                                  }

                                  if (event.key === 'ArrowLeft') {
                                    event.preventDefault()
                                    focusTableCell(getTableNavigationTarget(currentCell, 'left'))
                                    return
                                  }

                                  if (event.key === 'ArrowRight') {
                                    event.preventDefault()
                                    focusTableCell(getTableNavigationTarget(currentCell, 'right'))
                                    return
                                  }

                                  if (event.key === 'ArrowUp') {
                                    event.preventDefault()
                                    focusTableCell(getTableNavigationTarget(currentCell, 'up'))
                                    return
                                  }

                                  if (event.key === 'ArrowDown') {
                                    event.preventDefault()
                                    focusTableCell(getTableNavigationTarget(currentCell, 'down'))
                                  }
                                } : undefined}
                                role={isEditable ? 'button' : undefined}
                                tabIndex={isEditable ? ((isActiveCell || isDefaultTabStop) ? 0 : -1) : -1}
                                style={{
                                  padding: isEditing ? '8px' : '12px 14px',
                                  borderBottom: '1px solid var(--glass-border)',
                                  fontSize: '13px',
                                  color: 'var(--text-primary)',
                                  minWidth:
                                    column.id === 'title' ? '240px'
                                    : column.id === 'comments' ? '320px'
                                    : column.id === 'owner' ? '240px'
                                    : column.id === 'ticket' ? '120px'
                                    : '160px',
                                  whiteSpace: column.id === 'comments' ? 'normal' : 'nowrap',
                                  verticalAlign: 'top',
                                  background: isEditing ? 'var(--surface-dark)' : undefined,
                                  cursor: isEditable ? 'pointer' : 'default',
                                  outline: isEditing || isActiveCell ? '2px solid var(--input-border)' : undefined,
                                  outlineOffset: '-2px'
                                }}
                              >
                                {isEditing ? (
                                  renderSpreadsheetCellEditor(ticket, column.id, field)
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{
                                      minWidth: 0,
                                      overflow: column.id === 'comments' ? 'visible' : 'hidden',
                                      textOverflow: column.id === 'comments' ? 'clip' : 'ellipsis',
                                      lineHeight: column.id === 'comments' ? 1.45 : undefined,
                                      fontWeight: column.id === 'title' ? 600 : 400
                                    }}>
                                      {renderSpreadsheetCellDisplay(ticket, column.id, field)}
                                    </div>
                                    {isSaving && (
                                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                        Saving...
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Quick Create Modal */}
      {showQuickCreate && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: isPhoneViewport ? 'flex-end' : 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: isPhoneViewport ? '10px' : 0
        }}
        onClick={() => setShowQuickCreate(false)}
        >
          <div style={{
            width: 'min(480px, calc(100vw - 20px))',
            background: 'var(--modal-bg)',
            border: '1px solid var(--modal-border)',
            borderRadius: isPhoneViewport ? '16px' : '20px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            padding: isPhoneViewport ? '16px' : '24px',
            maxHeight: isPhoneViewport ? '88vh' : 'none',
            overflowY: 'auto'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--modal-title-text)' }}>✨ Quick Create</h3>
              <span style={{ color: 'var(--modal-label-text)', fontSize: '14px' }}>ESC to close</span>
            </div>
            
            <textarea
              value={quickInput}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Describe the feature... (e.g., 'users want to export their data as CSV')"
              style={{
                width: '100%',
                padding: '14px',
                background: 'var(--modal-input-bg)',
                border: '2px solid var(--modal-input-border)',
                borderRadius: '12px',
                fontSize: '14px',
                marginBottom: '12px',
                fontFamily: 'inherit',
                color: 'var(--modal-input-text)',
                minHeight: '100px',
                resize: 'vertical'
              }}
              autoFocus
            />
            
            {isGenerating && (
              <div style={{
                padding: '10px',
                color: 'var(--modal-label-text)',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ animation: 'pulse 1.5s infinite' }}>✨</span>
                Generating title...
              </div>
            )}
            
            {aiSuggestion && !isGenerating && (
              <div style={{
                padding: '14px',
                background: 'var(--modal-ai-bg)',
                border: '1px dashed var(--modal-ai-border)',
                borderRadius: '10px',
                marginBottom: '16px'
              }}>
                <div style={{
                  fontSize: '12px',
                  color: 'var(--modal-ai-label-text)',
                  fontWeight: 600,
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>✨ AI Generated Title</div>
                <div style={{ fontSize: '14px', color: 'var(--modal-ai-text)', fontWeight: 500 }}>{aiSuggestion}</div>
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowQuickCreate(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'var(--modal-btn-secondary-bg)',
                  border: '1px solid var(--modal-btn-secondary-border)',
                  borderRadius: '10px',
                  fontSize: '14px',
                  color: 'var(--modal-btn-secondary-text)',
                  cursor: 'pointer'
                }}
              >Cancel</button>
              <button
                onClick={handleQuickCreate}
                disabled={!aiSuggestion || isCreating}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: aiSuggestion && !isCreating ? 'var(--modal-btn-primary-bg)' : 'var(--modal-btn-disabled-bg)',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  color: aiSuggestion && !isCreating ? 'var(--modal-btn-primary-text)' : 'var(--modal-btn-disabled-text)',
                  cursor: aiSuggestion && !isCreating ? 'pointer' : 'not-allowed',
                  fontWeight: 600
                }}
              >{isCreating ? 'Creating...' : 'Create Ticket'}</button>
            </div>
          </div>
        </div>
      )}

      {showAddFieldModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          background: 'var(--modal-overlay-bg)',
            display: 'flex',
            alignItems: isPhoneViewport ? 'flex-end' : 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: isPhoneViewport ? '10px' : 0
          }}
          onClick={() => {
            if (savingField) return
            setShowAddFieldModal(false)
          }}
        >
          <div
            style={{
              width: 'min(420px, calc(100vw - 20px))',
              background: 'var(--modal-bg)',
              border: '1px solid var(--modal-border)',
              borderRadius: isPhoneViewport ? '14px' : '16px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
              padding: isPhoneViewport ? '16px' : '20px'
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: '16px', color: 'var(--modal-title-text)' }}>Add Column</h3>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--modal-label-text)', marginBottom: '6px', fontWeight: 600 }}>
                Column Name
              </label>
              <input
                type='text'
                value={newFieldName}
                onChange={(event) => setNewFieldName(event.target.value)}
                placeholder='e.g. Release'
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--modal-input-bg)',
                  border: '2px solid var(--modal-input-border)',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  color: 'var(--modal-input-text)'
                }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--modal-label-text)', marginBottom: '6px', fontWeight: 600 }}>
                Field Type
              </label>
              <select
                value={newFieldType}
                onChange={(event) => setNewFieldType(event.target.value as ProjectFieldType)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--modal-input-bg)',
                  border: '2px solid var(--modal-input-border)',
                  borderRadius: '10px',
                  fontSize: '14px',
                  color: 'var(--modal-input-text)'
                }}
              >
                <option value='text'>Text</option>
                <option value='select'>Select</option>
                <option value='boolean'>Yes / No</option>
                <option value='number'>Number</option>
                <option value='date'>Date</option>
              </select>
            </div>

            {newFieldType === 'select' && (
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--modal-label-text)', marginBottom: '6px', fontWeight: 600 }}>
                  Options (comma-separated)
                </label>
                <input
                  type='text'
                  value={newFieldOptions}
                  onChange={(event) => setNewFieldOptions(event.target.value)}
                  placeholder='Yes, No, TBD'
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--modal-input-bg)',
                    border: '2px solid var(--modal-input-border)',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    color: 'var(--modal-input-text)'
                  }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowAddFieldModal(false)}
                disabled={savingField}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '10px',
                  border: '1px solid var(--modal-btn-secondary-border)',
                  background: 'var(--modal-btn-secondary-bg)',
                  color: 'var(--modal-btn-secondary-text)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: savingField ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => void addProjectField()}
                disabled={savingField}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'var(--modal-btn-primary-bg)',
                  color: 'var(--modal-btn-primary-text)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: savingField ? 'not-allowed' : 'pointer',
                  opacity: savingField ? 0.7 : 1
                }}
              >
                {savingField ? 'Saving...' : 'Add Column'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'var(--modal-overlay-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px 16px',
          zIndex: 1000,
          overflowY: 'auto'
        }}
        onClick={closeTicketDetail}
        >
          <div style={{
            width: 'min(1180px, calc(100vw - 32px))',
            maxHeight: 'calc(100vh - 40px)',
            background: 'var(--modal-bg)',
            border: '1px solid var(--modal-border)',
            borderRadius: '24px',
            boxShadow: '0 26px 70px rgba(0,0,0,0.35)',
            padding: '26px',
            overflowY: 'auto'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '12px',
              marginBottom: '18px'
            }}>
              <div style={{ flex: 1, minWidth: 0, marginRight: '8px' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 11px',
                  borderRadius: '999px',
                  border: `1px solid ${getStatusColor(selectedTicket.status)}55`,
                  background: `${getStatusColor(selectedTicket.status)}1c`,
                  color: getStatusColor(selectedTicket.status),
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: '10px'
                }}>
                  <span style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: getStatusColor(selectedTicket.status)
                  }} />
                  {getStatusLabel(selectedTicket.status)}
                </span>

                <h3 style={{
                  fontSize: 'clamp(28px, 3.6vw, 44px)',
                  lineHeight: 1.03,
                  letterSpacing: '-0.02em',
                  fontWeight: 700,
                  margin: 0,
                  minWidth: 0,
                  overflowWrap: 'anywhere',
                  color: 'var(--modal-title-text)'
                }}>
                  <textarea
                    value={editingTicket.title || ''}
                    onChange={(event) => setEditingTicket({ ...editingTicket, title: event.target.value })}
                    rows={3}
                    style={{
                      width: '100%',
                      display: 'block',
                      margin: 0,
                      padding: '0 0 6px 0',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: 'inherit',
                      font: 'inherit',
                      letterSpacing: 'inherit',
                      lineHeight: 1.12,
                      resize: 'none',
                      overflow: 'hidden',
                      minHeight: '3.35em'
                    }}
                  />
                  {selectedTicket.gitlabIssueNumber && (
                    <>
                      {getGitLabIssueUrl(selectedTicket) ? (
                        <a
                          href={getGitLabIssueUrl(selectedTicket) || '#'}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 10px',
                            marginLeft: '10px',
                            borderRadius: '9px',
                            border: '1px solid var(--gitlab-border)',
                            background: 'var(--gitlab-bg)',
                            color: 'var(--gitlab-text)',
                            fontSize: '12px',
                            fontWeight: 700,
                            textDecoration: 'none',
                            whiteSpace: 'nowrap',
                            verticalAlign: 'middle'
                          }}
                          title='Open linked GitLab issue'
                        >
                          🦊 #{selectedTicket.gitlabIssueNumber}
                        </a>
                      ) : (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 10px',
                          marginLeft: '10px',
                          borderRadius: '9px',
                          border: '1px solid var(--gitlab-border)',
                          background: 'var(--gitlab-bg)',
                          color: 'var(--gitlab-text)',
                          fontSize: '12px',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          verticalAlign: 'middle'
                        }}>
                          🦊 #{selectedTicket.gitlabIssueNumber}
                        </span>
                      )}
                    </>
                  )}
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <button
                  onClick={handleCopyTicketPermalink}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '10px',
                    background: isTicketPermalinkCopied ? 'var(--modal-status-active-bg)' : 'var(--modal-input-bg)',
                    border: `1px solid ${isTicketPermalinkCopied ? 'var(--modal-status-active-border)' : 'var(--modal-input-border)'}`,
                    color: isTicketPermalinkCopied ? 'var(--modal-status-active-text)' : 'var(--modal-input-text)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                  title={ticketPermalinkError || 'Copy ticket permalink'}
                >
                  {ticketPermalinkError ? 'Copy failed' : isTicketPermalinkCopied ? 'Ticket link copied' : 'Copy ticket link'}
                </button>
                <button
                  onClick={closeTicketDetail}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'var(--modal-close-bg)',
                    border: '1px solid var(--modal-close-border)',
                    fontSize: '22px',
                    color: 'var(--modal-close-text)',
                    cursor: 'pointer',
                    lineHeight: 1,
                    display: 'grid',
                    placeItems: 'center',
                    padding: 0
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--modal-close-hover-bg)'
                    e.currentTarget.style.color = 'var(--modal-close-hover-text)'
                    e.currentTarget.style.borderColor = 'var(--modal-close-hover-bg)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--modal-close-bg)'
                    e.currentTarget.style.color = 'var(--modal-close-text)'
                    e.currentTarget.style.borderColor = 'var(--modal-close-border)'
                  }}
                >×</button>
              </div>
            </div>

            <div style={{
              marginBottom: '24px',
              display: 'grid',
              gridTemplateColumns: isPhoneViewport ? '1fr' : 'minmax(0, 1fr) 320px',
              gap: isPhoneViewport ? '18px' : '20px',
              alignItems: 'start'
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ marginBottom: '20px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    marginBottom: '8px'
                  }}>
                    <label style={{
                      fontSize: '12px',
                      color: 'var(--modal-label-text)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      display: 'block'
                    }}>
                      Ticket Content
                    </label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        onClick={() => setIsEditingGeneratedContent((prev) => !prev)}
                        style={{
                          padding: '7px 11px',
                          borderRadius: '8px',
                          border: '1px solid var(--modal-input-border)',
                          background: isEditingGeneratedContent ? 'var(--modal-status-active-bg)' : 'var(--modal-input-bg)',
                          color: isEditingGeneratedContent ? 'var(--modal-status-active-text)' : 'var(--modal-input-text)',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {isEditingGeneratedContent ? 'Done Editing' : 'Edit'}
                      </button>
                      <button
                        onClick={handleRegenerateAction}
                        disabled={regeneratingContent}
                        style={{
                          padding: '7px 11px',
                          borderRadius: '8px',
                          border: '1px solid var(--modal-input-border)',
                          background: showRegeneratePrompt ? 'var(--modal-status-active-bg)' : 'var(--modal-input-bg)',
                          color: showRegeneratePrompt ? 'var(--modal-status-active-text)' : 'var(--modal-input-text)',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: regeneratingContent ? 'not-allowed' : 'pointer',
                          opacity: regeneratingContent ? 0.7 : 1
                        }}
                      >
                        {regeneratingContent ? 'Regenerating...' : showRegeneratePrompt ? 'Generate' : 'Regenerate'}
                      </button>
                    </div>
                  </div>
                  {showRegeneratePrompt && (
                    <div style={{ marginBottom: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        value={regeneratePrompt}
                        onChange={(event) => setRegeneratePrompt(event.target.value)}
                        placeholder='Optional prompt (e.g., make this shorter and more technical)'
                        style={{
                          flex: 1,
                          padding: '9px 12px',
                          background: 'var(--modal-input-bg)',
                          border: '1px solid var(--modal-input-border)',
                          borderRadius: '10px',
                          fontSize: '13px',
                          color: 'var(--modal-input-text)'
                        }}
                      />
                      <button
                        onClick={() => {
                          setShowRegeneratePrompt(false)
                          setRegeneratePrompt('')
                        }}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--modal-input-border)',
                          background: 'var(--modal-input-bg)',
                          color: 'var(--modal-input-text)',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Close
                      </button>
                    </div>
                  )}
                  {isEditingGeneratedContent ? (
                    <>
                      <textarea
                        value={editingTicket.generatedContent || ''}
                        onChange={(event) => setEditingTicket({ ...editingTicket, generatedContent: event.target.value })}
                        placeholder='No generated sync content yet. Click Regenerate or sync to GitLab to populate, then edit directly.'
                        style={{
                          width: '100%',
                          minHeight: '320px',
                          maxHeight: isPhoneViewport ? 'none' : '52vh',
                          padding: '14px 16px',
                          background: 'var(--modal-input-bg)',
                          border: '1px solid var(--modal-input-border)',
                          borderRadius: '14px',
                          color: 'var(--modal-input-text)',
                          fontSize: '15px',
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace',
                          lineHeight: 1.6,
                          resize: 'vertical'
                        }}
                      />
                      {(editingTicket.generatedContent || '').trim() && (
                        <div style={{ marginTop: '10px' }}>
                          <div style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '6px'
                          }}>
                            Preview
                          </div>
                          <div style={{
                            maxHeight: '220px',
                            overflowY: 'auto',
                            padding: '12px 14px',
                            background: 'var(--modal-input-bg)',
                            border: '1px solid var(--modal-input-border)',
                            borderRadius: '12px',
                            color: 'var(--modal-input-text)'
                          }}>
                            {renderGeneratedTicketPreview(editingTicket.generatedContent || '')}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    (editingTicket.generatedContent || '').trim() ? (
                      <div style={{
                        width: '100%',
                        minHeight: '320px',
                        maxHeight: isPhoneViewport ? 'none' : '52vh',
                        padding: '16px 18px',
                        background: 'var(--modal-input-bg)',
                        border: '1px solid var(--modal-input-border)',
                        borderRadius: '14px',
                        color: 'var(--modal-input-text)',
                        overflowY: 'auto'
                      }}>
                        {renderGeneratedTicketPreview(editingTicket.generatedContent || '')}
                      </div>
                    ) : (
                      <div style={{
                        width: '100%',
                        minHeight: '180px',
                        padding: '16px 18px',
                        background: 'var(--modal-input-bg)',
                        border: '1px dashed var(--modal-input-border)',
                        borderRadius: '14px',
                        color: 'var(--text-muted)',
                        fontSize: '14px',
                        lineHeight: 1.6
                      }}>
                        No generated sync content yet. Click Regenerate to create one.
                      </div>
                    )
                  )}
                </div>

                <div>
                  <label style={{
                    fontSize: '12px',
                    color: 'var(--modal-label-text)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '8px',
                    display: 'block'
                  }}>
                    Comments
                  </label>
                  <textarea
                    value={editingTicket.notes || ''}
                    onChange={(event) => setEditingTicket({ ...editingTicket, notes: event.target.value })}
                    placeholder='Add notes, context, or implementation details...'
                    style={{
                      width: '100%',
                      minHeight: '130px',
                      padding: '12px 14px',
                      background: 'var(--modal-input-bg)',
                      border: '2px solid var(--modal-input-border)',
                      borderRadius: '12px',
                      color: 'var(--modal-input-text)',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      lineHeight: 1.5,
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>

              <aside style={{
                minWidth: 0,
                background: 'var(--surface-dark)',
                border: '1px solid var(--modal-border)',
                borderRadius: '16px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <section>
                  <label style={{
                    fontSize: '12px',
                    color: 'var(--modal-label-text)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '8px',
                    display: 'block'
                  }}>
                    Release Version
                  </label>

                  <div style={{ position: 'relative' }}>
                    {editingTicket.version ? (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 14px',
                        background: 'var(--version-bg)',
                        borderRadius: '8px',
                        border: '1px solid var(--version-border)',
                        fontSize: '14px',
                        color: 'var(--version-text)',
                        fontWeight: 500
                      }}>
                        {editingTicket.version}
                        <button
                          onClick={removeVersion}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '16px',
                            lineHeight: 1,
                            padding: '0 2px'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--priority-high-text)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                        >×</button>
                      </div>
                    ) : (
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          value={versionInput}
                          onChange={(e) => {
                            setVersionInput(e.target.value)
                            setShowVersionSuggestions(true)
                          }}
                          onFocus={() => setShowVersionSuggestions(true)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && versionInput.trim()) {
                              e.preventDefault()
                              addVersion(versionInput)
                            }
                          }}
                          placeholder="Type version (e.g., v2.3) or select..."
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: 'var(--modal-input-bg)',
                            border: '2px solid var(--modal-input-border)',
                            borderRadius: '10px',
                            fontSize: '14px',
                            fontFamily: 'inherit',
                            color: 'var(--modal-input-text)'
                          }}
                        />

                        {showVersionSuggestions && existingVersions.length > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            marginTop: '4px',
                            background: 'var(--modal-bg)',
                            border: '1px solid var(--modal-border)',
                            borderRadius: '10px',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                            zIndex: 10,
                            maxHeight: '200px',
                            overflow: 'auto'
                          }}>
                            <div style={{
                              padding: '8px 12px',
                              fontSize: '11px',
                              color: 'var(--text-muted)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              borderBottom: '1px solid var(--modal-border)'
                            }}>
                              Existing Versions
                            </div>
                            {existingVersions.map(version => (
                              <button
                                key={version}
                                onClick={() => addVersion(version)}
                                style={{
                                  width: '100%',
                                  padding: '10px 14px',
                                  textAlign: 'left',
                                  background: 'none',
                                  border: 'none',
                                  fontSize: '14px',
                                  color: 'var(--modal-input-text)',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid var(--modal-border)'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'var(--surface-dark)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'none'
                                }}
                              >
                                {version}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {!editingTicket.version && versionInput.trim() && (
                      <button
                        onClick={() => addVersion(versionInput)}
                        style={{
                          marginTop: '8px',
                          padding: '8px 14px',
                          background: 'var(--modal-status-active-bg)',
                          border: '1px dashed var(--modal-status-active-border)',
                          borderRadius: '8px',
                          fontSize: '13px',
                          color: 'var(--modal-status-active-text)',
                          cursor: 'pointer',
                          fontWeight: 500
                        }}
                      >
                        + Add "{versionInput}"
                      </button>
                    )}
                  </div>
                </section>

                <section>
                  <label style={{
                    fontSize: '12px',
                    color: 'var(--modal-label-text)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '8px',
                    display: 'block'
                  }}>
                    Priority
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {PRIORITIES.map(({ value, label, color }) => {
                      const isActive = editingTicket.priority === value;
                      return (
                        <button
                          key={value}
                          onClick={() => setEditingTicket({ ...editingTicket, priority: value as Ticket['priority'] })}
                          style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '10px',
                            border: isActive ? '2px solid ' + color : '2px solid var(--modal-input-border)',
                            background: isActive ? color + '15' : 'var(--modal-input-bg)',
                            color: isActive ? color : 'var(--modal-label-text)',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.2s'
                          }}
                        >
                          <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: color
                          }} />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {projectFields.length > 0 && (
                  <section>
                    <label style={{
                      fontSize: '12px',
                      color: 'var(--modal-label-text)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '8px',
                      display: 'block'
                    }}>
                      Custom Fields
                    </label>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {projectFields.map((field) => {
                        const value = getEditedCustomFieldValue(field)

                        return (
                          <div key={field.id}>
                            <div style={{ fontSize: '12px', color: 'var(--modal-title-text)', marginBottom: '6px', fontWeight: 600 }}>
                              {field.name}
                            </div>

                            {field.type === 'select' && (
                              <select
                                value={value}
                                onChange={(event) => updateEditedCustomFieldValue(field.id, event.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '10px 12px',
                                  background: 'var(--modal-input-bg)',
                                  border: '2px solid var(--modal-input-border)',
                                  borderRadius: '10px',
                                  fontSize: '14px',
                                  color: 'var(--modal-input-text)'
                                }}
                              >
                                <option value=''>-</option>
                                {field.options.map((option) => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                              </select>
                            )}

                            {field.type === 'boolean' && (
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  onClick={() => updateEditedCustomFieldValue(field.id, 'true')}
                                  style={{
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: value === 'true' ? '2px solid var(--modal-tag-yes-border)' : '2px solid var(--modal-input-border)',
                                    background: value === 'true' ? 'var(--modal-tag-yes-bg)' : 'var(--modal-input-bg)',
                                    color: value === 'true' ? 'var(--modal-tag-yes-text)' : 'var(--modal-label-text)',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => updateEditedCustomFieldValue(field.id, 'false')}
                                  style={{
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: value === 'false' ? '2px solid var(--modal-tag-no-border)' : '2px solid var(--modal-input-border)',
                                    background: value === 'false' ? 'var(--modal-tag-no-bg)' : 'var(--modal-input-bg)',
                                    color: value === 'false' ? 'var(--modal-tag-no-text)' : 'var(--modal-label-text)',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                  }}
                                >
                                  No
                                </button>
                              </div>
                            )}

                            {(field.type === 'text' || field.type === 'number' || field.type === 'date') && (
                              <input
                                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                                value={value}
                                onChange={(event) => updateEditedCustomFieldValue(field.id, event.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '10px 12px',
                                  background: 'var(--modal-input-bg)',
                                  border: '2px solid var(--modal-input-border)',
                                  borderRadius: '10px',
                                  fontSize: '14px',
                                  fontFamily: 'inherit',
                                  color: 'var(--modal-input-text)'
                                }}
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )}

                <section>
                  <label style={{
                    fontSize: '12px',
                    color: 'var(--modal-label-text)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '8px',
                    display: 'block'
                  }}>
                    Assigned To
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setEditingTicket({ ...editingTicket, assignee: undefined })}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: !editingTicket.assignee ? '2px solid var(--modal-status-active-border)' : '2px solid var(--modal-input-border)',
                        background: !editingTicket.assignee ? 'var(--modal-status-active-bg)' : 'var(--modal-input-bg)',
                        color: !editingTicket.assignee ? 'var(--modal-status-active-text)' : 'var(--modal-label-text)',
                        fontSize: '14px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      Unassigned
                    </button>
                    {gitlabMembers.map(member => (
                      <button
                        key={member.id}
                        onClick={() => setEditingTicket({ ...editingTicket, assignee: member.username })}
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '999px',
                          border: editingTicket.assignee === member.username ? '2px solid var(--modal-status-active-border)' : '2px solid var(--modal-input-border)',
                          background: editingTicket.assignee === member.username ? 'var(--modal-status-active-bg)' : 'var(--modal-input-bg)',
                          color: editingTicket.assignee === member.username ? 'var(--modal-status-active-text)' : 'var(--modal-label-text)',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'grid',
                          placeItems: 'center'
                        }}
                        title={`${member.name} (@${member.username})`}
                      >
                        {getInitials(member.name || member.username)}
                      </button>
                    ))}
                  </div>
                  {editingTicket.assignee && (
                    <p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--modal-label-text)' }}>
                      {getAssigneeTitle(editingTicket.assignee)}
                    </p>
                  )}
                  {gitlabStatus.connected && gitlabStatus.repo && gitlabMembers.length === 0 && (
                    <p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      No assignable GitLab members found for this repository.
                    </p>
                  )}
                  {(!gitlabStatus.connected || !gitlabStatus.repo) && (
                    <p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      Connect GitLab and pick a repository to sync assignees.
                    </p>
                  )}
                </section>

                <div style={{
                  marginTop: 'auto',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--modal-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <button
                    onClick={handleSaveTicket}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'var(--modal-btn-primary-bg)',
                      border: 'none',
                      borderRadius: '9px',
                      fontSize: '13px',
                      color: 'var(--modal-btn-primary-text)',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    Save Changes
                  </button>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px'
                  }}>
                    <button
                      onClick={closeTicketDetail}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        background: 'var(--modal-btn-secondary-bg)',
                        border: '1px solid var(--modal-btn-secondary-border)',
                        borderRadius: '9px',
                        fontSize: '13px',
                        color: 'var(--modal-btn-secondary-text)',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteTicket}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        background: 'var(--modal-btn-danger-bg)',
                        border: '1px solid var(--modal-btn-danger-border)',
                        borderRadius: '9px',
                        fontSize: '13px',
                        color: 'var(--modal-btn-danger-text)',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--modal-btn-danger-hover-bg)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--modal-btn-danger-bg)';
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

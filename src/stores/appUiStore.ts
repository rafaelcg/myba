import { create } from 'zustand'
import { Ticket, ProjectFieldType } from '../utils/api'

export type TableSortKey =
  | 'title'
  | 'ticket'
  | 'owner'
  | 'priority'
  | 'status'
  | 'milestone'
  | 'comments'
  | `custom:${string}`

export type ActiveView = 'board' | 'table' | 'roadmap'
export type RoadmapReleaseState = 'planned' | 'committed' | 'shipped'

type SetStateAction<T> = T | ((previous: T) => T)

interface AppUiStore {
  showQuickCreate: boolean
  quickInput: string
  aiSuggestion: string
  isGenerating: boolean
  isCreating: boolean
  selectedTicket: Ticket | null
  editingTicket: Partial<Ticket>
  versionInput: string
  showVersionSuggestions: boolean
  draggedTicket: Ticket | null
  dragOverColumn: string | null
  searchQuery: string
  activeView: ActiveView
  tableSort: { key: TableSortKey; direction: 'asc' | 'desc' } | null
  showAddFieldModal: boolean
  newFieldName: string
  newFieldType: ProjectFieldType
  newFieldOptions: string
  savingField: boolean
  deletingFieldId: string | null
  draggingProjectFieldId: string | null
  dragOverProjectFieldId: string | null
  roadmapPriorityFilter: 'all' | 'low' | 'medium' | 'high'
  roadmapAssigneeFilter: 'all' | string
  roadmapCustomFieldId: string
  roadmapCustomFieldValue: string
  roadmapReleaseStateByVersion: Record<string, RoadmapReleaseState>
  roadmapDraggingTicketId: string | null
  roadmapDragOverVersion: string | null
  showMobileSidebar: boolean

  setShowQuickCreate: (value: boolean) => void
  setQuickInput: (value: string) => void
  setAiSuggestion: (value: string) => void
  setIsGenerating: (value: boolean) => void
  setIsCreating: (value: boolean) => void
  setSelectedTicket: (value: SetStateAction<Ticket | null>) => void
  setEditingTicket: (value: SetStateAction<Partial<Ticket>>) => void
  setVersionInput: (value: string) => void
  setShowVersionSuggestions: (value: boolean) => void
  setDraggedTicket: (value: Ticket | null) => void
  setDragOverColumn: (value: string | null) => void
  setSearchQuery: (value: string) => void
  setActiveView: (value: ActiveView) => void
  setTableSort: (value: SetStateAction<{ key: TableSortKey; direction: 'asc' | 'desc' } | null>) => void
  setShowAddFieldModal: (value: boolean) => void
  setNewFieldName: (value: string) => void
  setNewFieldType: (value: ProjectFieldType) => void
  setNewFieldOptions: (value: string) => void
  setSavingField: (value: boolean) => void
  setDeletingFieldId: (value: string | null) => void
  setDraggingProjectFieldId: (value: string | null) => void
  setDragOverProjectFieldId: (value: string | null) => void
  setRoadmapPriorityFilter: (value: 'all' | 'low' | 'medium' | 'high') => void
  setRoadmapAssigneeFilter: (value: 'all' | string) => void
  setRoadmapCustomFieldId: (value: string) => void
  setRoadmapCustomFieldValue: (value: string) => void
  setRoadmapReleaseStateByVersion: (value: SetStateAction<Record<string, RoadmapReleaseState>>) => void
  setRoadmapDraggingTicketId: (value: string | null) => void
  setRoadmapDragOverVersion: (value: string | null) => void
  setShowMobileSidebar: (value: boolean) => void
}

function resolveUpdate<T>(value: SetStateAction<T>, previous: T): T {
  if (typeof value === 'function') {
    return (value as (previous: T) => T)(previous)
  }
  return value
}

export const useAppUiStore = create<AppUiStore>((set) => ({
  showQuickCreate: false,
  quickInput: '',
  aiSuggestion: '',
  isGenerating: false,
  isCreating: false,
  selectedTicket: null,
  editingTicket: {},
  versionInput: '',
  showVersionSuggestions: false,
  draggedTicket: null,
  dragOverColumn: null,
  searchQuery: '',
  activeView: 'board',
  tableSort: null,
  showAddFieldModal: false,
  newFieldName: '',
  newFieldType: 'text',
  newFieldOptions: '',
  savingField: false,
  deletingFieldId: null,
  draggingProjectFieldId: null,
  dragOverProjectFieldId: null,
  roadmapPriorityFilter: 'all',
  roadmapAssigneeFilter: 'all',
  roadmapCustomFieldId: 'all',
  roadmapCustomFieldValue: 'all',
  roadmapReleaseStateByVersion: {},
  roadmapDraggingTicketId: null,
  roadmapDragOverVersion: null,
  showMobileSidebar: false,

  setShowQuickCreate: (value) => set({ showQuickCreate: value }),
  setQuickInput: (value) => set({ quickInput: value }),
  setAiSuggestion: (value) => set({ aiSuggestion: value }),
  setIsGenerating: (value) => set({ isGenerating: value }),
  setIsCreating: (value) => set({ isCreating: value }),
  setSelectedTicket: (value) => set((state) => ({ selectedTicket: resolveUpdate(value, state.selectedTicket) })),
  setEditingTicket: (value) => set((state) => ({ editingTicket: resolveUpdate(value, state.editingTicket) })),
  setVersionInput: (value) => set({ versionInput: value }),
  setShowVersionSuggestions: (value) => set({ showVersionSuggestions: value }),
  setDraggedTicket: (value) => set({ draggedTicket: value }),
  setDragOverColumn: (value) => set({ dragOverColumn: value }),
  setSearchQuery: (value) => set({ searchQuery: value }),
  setActiveView: (value) => set({ activeView: value }),
  setTableSort: (value) => set((state) => ({ tableSort: resolveUpdate(value, state.tableSort) })),
  setShowAddFieldModal: (value) => set({ showAddFieldModal: value }),
  setNewFieldName: (value) => set({ newFieldName: value }),
  setNewFieldType: (value) => set({ newFieldType: value }),
  setNewFieldOptions: (value) => set({ newFieldOptions: value }),
  setSavingField: (value) => set({ savingField: value }),
  setDeletingFieldId: (value) => set({ deletingFieldId: value }),
  setDraggingProjectFieldId: (value) => set({ draggingProjectFieldId: value }),
  setDragOverProjectFieldId: (value) => set({ dragOverProjectFieldId: value }),
  setRoadmapPriorityFilter: (value) => set({ roadmapPriorityFilter: value }),
  setRoadmapAssigneeFilter: (value) => set({ roadmapAssigneeFilter: value }),
  setRoadmapCustomFieldId: (value) => set({ roadmapCustomFieldId: value }),
  setRoadmapCustomFieldValue: (value) => set({ roadmapCustomFieldValue: value }),
  setRoadmapReleaseStateByVersion: (value) => set((state) => ({ roadmapReleaseStateByVersion: resolveUpdate(value, state.roadmapReleaseStateByVersion) })),
  setRoadmapDraggingTicketId: (value) => set({ roadmapDraggingTicketId: value }),
  setRoadmapDragOverVersion: (value) => set({ roadmapDragOverVersion: value }),
  setShowMobileSidebar: (value) => set({ showMobileSidebar: value }),
}))

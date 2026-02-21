import { create } from 'zustand'
import {
  Ticket,
  ProjectField,
  GitLabIntegrationStatus,
  GitLabRepo,
  GitLabMember,
} from '../utils/api'

type SetStateAction<T> = T | ((previous: T) => T)

interface AppDataStore {
  tickets: Ticket[]
  loading: boolean
  error: string | null
  gitlabStatus: GitLabIntegrationStatus
  gitlabRepos: GitLabRepo[]
  gitlabMembers: GitLabMember[]
  gitlabLoading: boolean
  gitlabConnecting: boolean
  gitlabRepoSaving: boolean
  gitlabSyncingTickets: Record<string, number>
  gitlabLastSyncedAt: Record<string, number>
  gitlabSyncErrors: Record<string, string>
  gitlabMessage: string | null
  gitlabError: string | null
  projectFields: ProjectField[]
  localTicketCount: number
  importingLocalTickets: boolean

  setTickets: (value: SetStateAction<Ticket[]>) => void
  setLoading: (value: boolean) => void
  setError: (value: string | null) => void
  setGitlabStatus: (value: SetStateAction<GitLabIntegrationStatus>) => void
  setGitlabRepos: (value: SetStateAction<GitLabRepo[]>) => void
  setGitlabMembers: (value: SetStateAction<GitLabMember[]>) => void
  setGitlabLoading: (value: boolean) => void
  setGitlabConnecting: (value: boolean) => void
  setGitlabRepoSaving: (value: boolean) => void
  setGitlabSyncingTickets: (value: SetStateAction<Record<string, number>>) => void
  setGitlabLastSyncedAt: (value: SetStateAction<Record<string, number>>) => void
  setGitlabSyncErrors: (value: SetStateAction<Record<string, string>>) => void
  setGitlabMessage: (value: string | null) => void
  setGitlabError: (value: string | null) => void
  setProjectFields: (value: SetStateAction<ProjectField[]>) => void
  setLocalTicketCount: (value: number) => void
  setImportingLocalTickets: (value: boolean) => void
}

function resolveUpdate<T>(value: SetStateAction<T>, previous: T): T {
  if (typeof value === 'function') {
    return (value as (previous: T) => T)(previous)
  }
  return value
}

export const useAppDataStore = create<AppDataStore>((set) => ({
  tickets: [],
  loading: true,
  error: null,
  gitlabStatus: {
    connected: false,
    repo: null,
    connectedAt: null,
  },
  gitlabRepos: [],
  gitlabMembers: [],
  gitlabLoading: false,
  gitlabConnecting: false,
  gitlabRepoSaving: false,
  gitlabSyncingTickets: {},
  gitlabLastSyncedAt: {},
  gitlabSyncErrors: {},
  gitlabMessage: null,
  gitlabError: null,
  projectFields: [],
  localTicketCount: 0,
  importingLocalTickets: false,

  setTickets: (value) => set((state) => ({ tickets: resolveUpdate(value, state.tickets) })),
  setLoading: (value) => set({ loading: value }),
  setError: (value) => set({ error: value }),
  setGitlabStatus: (value) => set((state) => ({ gitlabStatus: resolveUpdate(value, state.gitlabStatus) })),
  setGitlabRepos: (value) => set((state) => ({ gitlabRepos: resolveUpdate(value, state.gitlabRepos) })),
  setGitlabMembers: (value) => set((state) => ({ gitlabMembers: resolveUpdate(value, state.gitlabMembers) })),
  setGitlabLoading: (value) => set({ gitlabLoading: value }),
  setGitlabConnecting: (value) => set({ gitlabConnecting: value }),
  setGitlabRepoSaving: (value) => set({ gitlabRepoSaving: value }),
  setGitlabSyncingTickets: (value) => set((state) => ({ gitlabSyncingTickets: resolveUpdate(value, state.gitlabSyncingTickets) })),
  setGitlabLastSyncedAt: (value) => set((state) => ({ gitlabLastSyncedAt: resolveUpdate(value, state.gitlabLastSyncedAt) })),
  setGitlabSyncErrors: (value) => set((state) => ({ gitlabSyncErrors: resolveUpdate(value, state.gitlabSyncErrors) })),
  setGitlabMessage: (value) => set({ gitlabMessage: value }),
  setGitlabError: (value) => set({ gitlabError: value }),
  setProjectFields: (value) => set((state) => ({ projectFields: resolveUpdate(value, state.projectFields) })),
  setLocalTicketCount: (value) => set({ localTicketCount: value }),
  setImportingLocalTickets: (value) => set({ importingLocalTickets: value }),
}))

import React, { createContext, useContext } from 'react'

export type ProjectRole = 'admin' | 'producer' | 'director' | 'dept_head' | 'read_only'

const RANK: Record<ProjectRole, number> = {
  admin: 5, producer: 4, director: 3, dept_head: 2, read_only: 1,
}

export interface ProjectPermissions {
  role: ProjectRole
  /** Darf irgendetwas schreiben (dept_head+) */
  canEdit: boolean
  /** Darf Szenen, Drehplan, Shotlist, Screenplay bearbeiten (director+) */
  canEditScenes: boolean
  /** Darf Budget und Finanzierung bearbeiten (producer+) */
  canEditBudget: boolean
  /** Darf Projekteinstellungen, Mitglieder, Einladungen verwalten (admin) */
  canAdmin: boolean
  /** Mindestrang-Check */
  hasRole: (min: ProjectRole) => boolean
}

const DEFAULT: ProjectPermissions = {
  role: 'read_only',
  canEdit: false,
  canEditScenes: false,
  canEditBudget: false,
  canAdmin: false,
  hasRole: () => false,
}

export const ProjectRoleContext = createContext<ProjectPermissions>(DEFAULT)

export function buildPermissions(role: ProjectRole): ProjectPermissions {
  const rank = RANK[role] ?? 0
  return {
    role,
    canEdit:       rank >= RANK.dept_head,
    canEditScenes: rank >= RANK.director,
    canEditBudget: rank >= RANK.producer,
    canAdmin:      rank >= RANK.admin,
    hasRole: (min) => rank >= RANK[min],
  }
}

export function ProjectRoleProvider({ role, children }: { role: ProjectRole; children: React.ReactNode }) {
  return (
    <ProjectRoleContext.Provider value={buildPermissions(role)}>
      {children}
    </ProjectRoleContext.Provider>
  )
}

export function useProjectPerms() {
  return useContext(ProjectRoleContext)
}

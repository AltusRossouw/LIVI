import React, { ReactNode } from 'react'

export interface SettingsLayoutProps {
  children?: ReactNode
  title: string
  onSave?: () => boolean
  isDirty: boolean
  needsRestart?: boolean
}

export interface AppLayoutProps {
  navRef: React.RefObject<HTMLDivElement | null>
  receivingVideo: boolean
}

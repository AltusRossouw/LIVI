import { ReactNode } from 'react'

export interface SettingsLayoutProps {
  children?: ReactNode
  onSave?: () => boolean
  isDirty: boolean
}

export interface AppLayoutProps {
  navRef: React.RefObject<HTMLDivElement | null>
  receivingVideo: boolean
}

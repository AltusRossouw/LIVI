import type { TelemetryDashboardId } from '@shared/types'

export type DashboardDef = {
  id: TelemetryDashboardId
  Component: React.ComponentType
}

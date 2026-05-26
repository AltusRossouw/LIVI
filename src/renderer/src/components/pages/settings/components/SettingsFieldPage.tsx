import { Typography } from '@mui/material'
import type { Config } from '@shared/types'
import { useTranslation } from 'react-i18next'
import { SettingsNode } from '../../../../routes'
import { SettingsFieldControl } from './SettingsFieldControl'

type Props<T> = {
  node: SettingsNode<Config>
  value: T
  onChange: (v: T) => void
  savedLabel?: string
  onLabelChange?: (label: string) => void
}

export const SettingsFieldPage = <T,>({
  node,
  value,
  onChange,
  savedLabel,
  onLabelChange
}: Props<T>) => {
  const { t } = useTranslation()
  const description = node.page?.labelDescription
    ? t(node.page?.labelDescription)
    : node.page?.description
  return (
    <>
      <SettingsFieldControl
        node={node}
        value={value}
        onChange={onChange}
        savedLabel={savedLabel}
        onLabelChange={onLabelChange}
      />

      {description && (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>
      )}
    </>
  )
}

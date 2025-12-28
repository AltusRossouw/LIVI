import { FC, PropsWithChildren, ReactNode } from 'react'
import { Nav } from '../navigation'
import { useCarplayStore } from '@store/store'
import { AppLayoutProps } from './types'

export const AppLayout: FC<PropsWithChildren<AppLayoutProps>> = ({
  children,
  navRef,
  receivingVideo
}) => {
  const settings = useCarplayStore((s) => s.settings)

  return (
    <div style={{ height: '100%', touchAction: 'none' }} id="main" className="App">
      <div ref={navRef} id="nav-root">
        <Nav receivingVideo={receivingVideo} settings={settings} />
      </div>

      {children}
    </div>
  )
}

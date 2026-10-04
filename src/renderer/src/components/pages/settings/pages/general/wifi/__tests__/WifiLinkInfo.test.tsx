import { act, render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

// The real row pulls in the theme.
vi.mock('@settings/components', () => ({
  SettingsValueRow: ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
    <div data-testid={label} data-mono={mono ? 'yes' : 'no'}>
      {value}
    </div>
  )
}))

import { useLiviStore } from '@store/store'
import { WifiLinkInfo } from '../WifiLinkInfo'

const DOWN = 'settings.wifiLinkDown'
const UP = 'settings.wifiLinkUp'
const DASH = '—'

type Speed = { downMbps: number; upMbps: number; downRate: number; upRate: number }

function report(linkSpeed: Speed | null): void {
  act(() =>
    useLiviStore.setState({
      system: {
        wifiInterfaces: [],
        btAdapters: [],
        dongle: null,
        linkSpeed,
        wifiChannels: [],
        wifiCountries: []
      }
    })
  )
}

beforeEach(() => {
  useLiviStore.setState({ system: null })
})

describe('WifiLinkInfo', () => {
  it('shows a dash on both legs until the first reading arrives', () => {
    render(<WifiLinkInfo />)

    expect(screen.getByTestId(DOWN)).toHaveTextContent(DASH)
    expect(screen.getByTestId(UP)).toHaveTextContent(DASH)
  })

  it('renders throughput with the negotiated PHY rate, monospaced', () => {
    render(<WifiLinkInfo />)
    report({ downMbps: 12.34, upMbps: 1.2, downRate: 866, upRate: 780 })

    expect(screen.getByTestId(DOWN)).toHaveTextContent('12.3 Mbps · 866 PHY')
    expect(screen.getByTestId(UP)).toHaveTextContent('1.2 Mbps · 780 PHY')
    expect(screen.getByTestId(DOWN)).toHaveAttribute('data-mono', 'yes')
  })

  it('drops the PHY part when the driver reports no rate', () => {
    render(<WifiLinkInfo />)
    report({ downMbps: 3, upMbps: 0, downRate: 0, upRate: 0 })

    expect(screen.getByTestId(DOWN)).toHaveTextContent('3.0 Mbps')
    expect(screen.getByTestId(DOWN)).not.toHaveTextContent('PHY')
    expect(screen.getByTestId(UP)).toHaveTextContent('0.0 Mbps')
  })

  it('falls back to a dash when the link goes away', () => {
    render(<WifiLinkInfo />)
    report({ downMbps: 5, upMbps: 5, downRate: 866, upRate: 780 })
    expect(screen.getByTestId(DOWN)).toHaveTextContent('5.0 Mbps')

    report(null)

    expect(screen.getByTestId(DOWN)).toHaveTextContent(DASH)
    expect(screen.getByTestId(UP)).toHaveTextContent(DASH)
  })
})

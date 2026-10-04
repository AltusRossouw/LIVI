import { act, render } from '@testing-library/react'
import { useLiviStore } from '../../../store/store'
import SessionSwitchOverlay from '../SessionSwitchOverlay'

const none = { active: null, position: 0, total: 0 }

afterEach(() => {
  useLiviStore.setState({ sessions: none })
})

describe('SessionSwitchOverlay', () => {
  test('renders nothing until a phone is in front', () => {
    const { container } = render(<SessionSwitchOverlay />)
    expect(container).toBeEmptyDOMElement()

    act(() => useLiviStore.setState({ sessions: { active: 'carplay', position: 2, total: 3 } }))
    expect(container.querySelector('div')?.textContent).toBe('2/3')
  })

  test('keeps the last count when the phones are gone', () => {
    const { container } = render(<SessionSwitchOverlay />)
    act(() => useLiviStore.setState({ sessions: { active: 'carplay', position: 1, total: 1 } }))
    act(() => useLiviStore.setState({ sessions: none }))
    expect(container.querySelector('div')?.textContent).toBe('1/1')
  })

  test('replays the animation on every switch', () => {
    const { container } = render(<SessionSwitchOverlay />)
    act(() => useLiviStore.setState({ sessions: { active: 'carplay', position: 1, total: 2 } }))
    const first = container.querySelector('div')
    act(() => useLiviStore.setState({ sessions: { active: 'carplay', position: 2, total: 2 } }))
    expect(container.querySelector('div')).not.toBe(first)
    expect(container.querySelector('div')?.textContent).toBe('2/2')
  })
})

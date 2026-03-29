import { act, renderHook } from '@testing-library/react'
import { useOptimisticPlaying, useOptimisticPlaying_deprecated } from '../../hooks/'

describe('useOptimisticPlaying_deprecated', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllTimers()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('uses realPlaying when no override is set', () => {
    const { result, rerender } = renderHook(
      ({ realPlaying }) => useOptimisticPlaying_deprecated(realPlaying),
      {
        initialProps: { realPlaying: true as boolean | undefined }
      }
    )

    expect(result.current.uiPlaying).toBe(true)

    rerender({ realPlaying: false })

    expect(result.current.uiPlaying).toBe(false)
  })

  it('uses override until realPlaying matches and then clears it', () => {
    const { result, rerender } = renderHook(
      ({ realPlaying }) => useOptimisticPlaying_deprecated(realPlaying),
      {
        initialProps: { realPlaying: false as boolean | undefined }
      }
    )

    act(() => {
      result.current.setOverride(true)
    })

    expect(result.current.uiPlaying).toBe(true)

    rerender({ realPlaying: true })

    expect(result.current.uiPlaying).toBe(true)
  })

  it('auto clears override after 1500ms', () => {
    const { result } = renderHook(() => useOptimisticPlaying_deprecated(false))

    act(() => {
      result.current.setOverride(true)
    })

    expect(result.current.uiPlaying).toBe(true)

    act(() => {
      jest.advanceTimersByTime(1500)
    })

    expect(result.current.uiPlaying).toBe(false)
  })

  it('clearOverride resets override immediately', () => {
    const { result } = renderHook(() => useOptimisticPlaying_deprecated(false))

    act(() => {
      result.current.setOverride(true)
    })

    expect(result.current.uiPlaying).toBe(true)

    act(() => {
      result.current.clearOverride()
    })

    expect(result.current.uiPlaying).toBe(false)
  })
})

describe('useOptimisticPlaying', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllTimers()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('returns realPlaying when no override is set', () => {
    const { result, rerender } = renderHook(({ playing }) => useOptimisticPlaying(playing, null), {
      initialProps: { playing: true }
    })

    expect(result.current.uiPlaying).toBe(true)

    rerender({ playing: false })
    expect(result.current.uiPlaying).toBe(false)
  })

  it('uses override when set manually', () => {
    const { result } = renderHook(() => useOptimisticPlaying(false, null))

    act(() => {
      result.current.setOverride(true)
    })

    expect(result.current.uiPlaying).toBe(true)
    expect(result.current._internal.manualRef.current).toBe(true)
  })

  it('clears override manually when clearOverride is called', () => {
    const { result } = renderHook(() => useOptimisticPlaying(true, null))

    act(() => {
      result.current.setOverride(false)
    })
    expect(result.current.uiPlaying).toBe(false)
    expect(result.current._internal.manualRef.current).toBe(true)

    act(() => {
      result.current.clearOverride()
    })
    expect(result.current.uiPlaying).toBe(true)
    expect(result.current._internal.manualRef.current).toBe(false)
  })

  it('resets override early if realPlaying matches it', () => {
    const { result, rerender } = renderHook(({ playing }) => useOptimisticPlaying(playing, null), {
      initialProps: { playing: false }
    })

    act(() => {
      result.current.setOverride(true)
    })
    expect(result.current.uiPlaying).toBe(true)

    rerender({ playing: true })
    expect(result.current.uiPlaying).toBe(true)
    expect(result.current._internal.manualRef.current).toBe(false)
  })

  it('ignores realPlaying updates when mediaPayloadError is present and override set', async () => {
    const { result, rerender } = renderHook(
      ({ playing, error }) => useOptimisticPlaying(playing, error),
      {
        initialProps: { playing: true, error: null }
      }
    )

    act(() => {
      result.current.setOverride(false)
    })
    expect(result.current.uiPlaying).toBe(false)

    rerender({ playing: true, error: new Error('metadata missing') })
    expect(result.current.uiPlaying).toBe(false)
    expect(result.current._internal.manualRef.current).toBe(true)

    await act(async () => {
      rerender({ playing: true, error: null })
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.uiPlaying).toBe(false)
  })

  it('uses realPlaying when override is null', () => {
    const { result, rerender } = renderHook(
      ({ realPlaying, mediaPayloadError }) => useOptimisticPlaying(realPlaying, mediaPayloadError),
      {
        initialProps: {
          realPlaying: true as boolean | undefined,
          mediaPayloadError: null as unknown
        }
      }
    )

    expect(result.current.uiPlaying).toBe(true)

    rerender({ realPlaying: false, mediaPayloadError: null })

    expect(result.current.uiPlaying).toBe(false)
  })

  it('auto-clears override after timeout when no error', () => {
    const { result } = renderHook(() => useOptimisticPlaying(false, null, { timeoutMs: 1500 }))

    act(() => {
      result.current.setOverride(true)
    })
    expect(result.current.uiPlaying).toBe(true)

    act(() => {
      jest.advanceTimersByTime(1600)
    })

    expect(result.current.uiPlaying).toBe(false)
    expect(result.current._internal.manualRef.current).toBe(false)
  })

  it('does not auto-clear override during mediaPayloadError', () => {
    const { result } = renderHook(() =>
      useOptimisticPlaying(false, new Error('bad payload'), { timeoutMs: 1500 })
    )

    act(() => {
      result.current.setOverride(true)
    })
    expect(result.current.uiPlaying).toBe(true)

    act(() => {
      jest.advanceTimersByTime(2000)
    })

    expect(result.current.uiPlaying).toBe(true)
    expect(result.current._internal.manualRef.current).toBe(true)
  })

  it('does not start timeout when mediaPayloadError exists', () => {
    const { result } = renderHook(() =>
      useOptimisticPlaying(false, new Error('payload failed'), { timeoutMs: 500 })
    )

    act(() => {
      result.current.setOverride(true)
    })

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(result.current.uiPlaying).toBe(true)
    expect(result.current._internal.manualRef.current).toBe(true)
  })

  it('keeps manual override when error exists and realPlaying changes', () => {
    const { result, rerender } = renderHook(
      ({ realPlaying, mediaPayloadError }) => useOptimisticPlaying(realPlaying, mediaPayloadError),
      {
        initialProps: {
          realPlaying: false as boolean | undefined,
          mediaPayloadError: null as unknown
        }
      }
    )

    act(() => {
      result.current.setOverride(true)
    })

    rerender({
      realPlaying: false,
      mediaPayloadError: new Error('payload error')
    })

    expect(result.current.uiPlaying).toBe(true)
    expect(result.current._internal.manualRef.current).toBe(true)
  })

  it('clears stale override when manualRef is false and override is still set', () => {
    const { result, rerender } = renderHook(
      ({ realPlaying, mediaPayloadError }) => useOptimisticPlaying(realPlaying, mediaPayloadError),
      {
        initialProps: {
          realPlaying: false as boolean | undefined,
          mediaPayloadError: null as unknown
        }
      }
    )

    act(() => {
      result.current.setOverride(true)
    })

    act(() => {
      result.current.clearOverride()
    })

    rerender({
      realPlaying: false,
      mediaPayloadError: null
    })

    expect(result.current.uiPlaying).toBe(false)
    expect(result.current._internal.manualRef.current).toBe(false)
  })

  it('uses false when both override and realPlaying are falsy', () => {
    const { result } = renderHook(() => useOptimisticPlaying(undefined, null))

    expect(result.current.uiPlaying).toBe(false)
  })

  it('clears timers on unmount', () => {
    const clearSpy = jest.spyOn(window, 'clearTimeout')
    const { result, unmount } = renderHook(() =>
      useOptimisticPlaying(false, null, { timeoutMs: 1500 })
    )

    act(() => {
      result.current.setOverride(true)
    })

    unmount()
    expect(clearSpy).toHaveBeenCalled()

    clearSpy.mockRestore()
  })

  it('deprecated clears existing timer when realPlaying matches override', () => {
    const clearSpy = jest.spyOn(window, 'clearTimeout')

    const { result, rerender } = renderHook(
      ({ realPlaying }) => useOptimisticPlaying_deprecated(realPlaying),
      {
        initialProps: { realPlaying: false as boolean | undefined }
      }
    )

    act(() => {
      result.current.setOverride(true)
    })

    expect(result.current.uiPlaying).toBe(true)

    act(() => {
      rerender({ realPlaying: true })
    })

    expect(clearSpy).toHaveBeenCalled()
    expect(result.current.uiPlaying).toBe(true)
  })

  it('deprecated cleanup clears timer when override effect is replaced', () => {
    const clearSpy = jest.spyOn(window, 'clearTimeout')

    const { result } = renderHook(() => useOptimisticPlaying_deprecated(false))

    act(() => {
      result.current.setOverride(true)
    })

    act(() => {
      result.current.setOverride(false)
    })

    expect(clearSpy).toHaveBeenCalled()
  })

  it('clears override in effect when manualRef is false but override is still non-null', async () => {
    const { result, rerender } = renderHook(
      ({ realPlaying, mediaPayloadError }) => useOptimisticPlaying(realPlaying, mediaPayloadError),
      {
        initialProps: {
          realPlaying: false as boolean | undefined,
          mediaPayloadError: null as unknown
        }
      }
    )

    act(() => {
      result.current.setOverride(true)
    })

    expect(result.current.uiPlaying).toBe(true)
    expect(result.current._internal.manualRef.current).toBe(true)

    act(() => {
      result.current.clearOverride()
    })

    expect(result.current._internal.manualRef.current).toBe(false)

    await act(async () => {
      rerender({
        realPlaying: false,
        mediaPayloadError: null
      })
    })

    expect(result.current.uiPlaying).toBe(false)
    expect(result.current._internal.manualRef.current).toBe(false)
  })

  it('deprecated match effect clears a truthy running timer before resetting override', () => {
    const setTimeoutSpy = jest.spyOn(window, 'setTimeout').mockImplementation((cb: any) => {
      return 123 as any
    })
    const clearSpy = jest.spyOn(window, 'clearTimeout')

    const { result, rerender } = renderHook(
      ({ realPlaying }) => useOptimisticPlaying_deprecated(realPlaying),
      {
        initialProps: { realPlaying: false as boolean | undefined }
      }
    )

    act(() => {
      result.current.setOverride(true)
    })

    act(() => {
      rerender({ realPlaying: true })
    })

    expect(setTimeoutSpy).toHaveBeenCalled()
    expect(clearSpy).toHaveBeenCalledWith(123)
  })

  it('deprecated override-effect cleanup clears a truthy timer on unmount', () => {
    const setTimeoutSpy = jest.spyOn(window, 'setTimeout').mockImplementation((cb: any) => {
      return 456 as any
    })
    const clearSpy = jest.spyOn(window, 'clearTimeout')

    const { result, unmount } = renderHook(() => useOptimisticPlaying_deprecated(false))

    act(() => {
      result.current.setOverride(true)
    })

    unmount()

    expect(setTimeoutSpy).toHaveBeenCalled()
    expect(clearSpy).toHaveBeenCalledWith(456)
  })

  it('clears stale override in effect when manualRef is false but override is still set', () => {
    const { result, rerender } = renderHook(
      ({ realPlaying, mediaPayloadError }) => useOptimisticPlaying(realPlaying, mediaPayloadError),
      {
        initialProps: {
          realPlaying: false as boolean | undefined,
          mediaPayloadError: null as unknown
        }
      }
    )

    act(() => {
      result.current.setOverride(true)
    })

    expect(result.current.uiPlaying).toBe(true)
    expect(result.current._internal.manualRef.current).toBe(true)

    act(() => {
      result.current._internal.manualRef.current = false
    })

    rerender({
      realPlaying: false,
      mediaPayloadError: { changed: true }
    })

    expect(result.current.uiPlaying).toBe(false)
    expect(result.current._internal.manualRef.current).toBe(false)
  })
})

describe('Updater', () => {
  const originalPlatform = process.platform

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  function loadSubject() {
    const sendUpdateEvent = jest.fn()
    const sendUpdateProgress = jest.fn()
    const downloadWithProgress = jest.fn()
    const installOnMacFromFile = jest.fn(() => Promise.resolve())
    const installOnLinuxFromFile = jest.fn(() => Promise.resolve())
    const pickAssetForPlatform = jest.fn(() => ({ url: 'https://example.com/LIVI.AppImage' }))
    const unlink = jest.fn(() => Promise.resolve())
    const existsSync = jest.fn(() => true)

    jest.doMock('@main/ipc/utils', () => ({
      sendUpdateEvent,
      sendUpdateProgress
    }))
    jest.doMock('@main/ipc/update/downloader', () => ({
      downloadWithProgress
    }))
    jest.doMock('@main/ipc/update/install.mac', () => ({
      installOnMacFromFile
    }))
    jest.doMock('@main/ipc/update/install.linux', () => ({
      installOnLinuxFromFile
    }))
    jest.doMock('@main/ipc/update/pickAsset', () => ({
      pickAssetForPlatform
    }))
    jest.doMock('fs', () => ({
      existsSync,
      promises: { unlink }
    }))

    const { Updater } =
      require('@main/ipc/update/updater') as typeof import('@main/ipc/update/updater')

    return {
      Updater,
      sendUpdateEvent,
      sendUpdateProgress,
      downloadWithProgress,
      installOnMacFromFile,
      installOnLinuxFromFile,
      pickAssetForPlatform,
      unlink,
      existsSync
    }
  }

  test('perform emits error on unsupported platform', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    const { Updater, sendUpdateEvent } = loadSubject()

    const updater = new Updater({} as never)
    await updater.perform({} as never)

    expect(sendUpdateEvent).toHaveBeenCalledWith({ phase: 'start' })
    expect(sendUpdateEvent).toHaveBeenCalledWith({
      phase: 'error',
      message: 'Unsupported platform'
    })
  })

  test('perform downloads direct URL and reports progress/ready', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    const { Updater, sendUpdateEvent, sendUpdateProgress, downloadWithProgress } = loadSubject()

    const cancel = jest.fn()
    downloadWithProgress.mockImplementation((_url, _dest, onProgress) => {
      onProgress({ received: 50, total: 100, percent: 0.5 })
      return { promise: Promise.resolve(), cancel }
    })

    const updater = new Updater({} as never)
    await updater.perform({} as never, 'https://example.com/LIVI.AppImage')

    expect(downloadWithProgress).toHaveBeenCalledWith(
      'https://example.com/LIVI.AppImage',
      expect.stringMatching(/\.AppImage$/),
      expect.any(Function)
    )
    expect(sendUpdateProgress).toHaveBeenCalledWith({
      phase: 'download',
      received: 50,
      total: 100,
      percent: 0.5
    })
    expect(sendUpdateEvent).toHaveBeenCalledWith({ phase: 'ready' })
  })

  test('abort removes ready temp file and emits aborted', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    const { Updater, sendUpdateEvent, downloadWithProgress, unlink, existsSync } = loadSubject()

    downloadWithProgress.mockReturnValue({ promise: Promise.resolve(), cancel: jest.fn() })
    existsSync.mockReturnValue(true)

    const updater = new Updater({} as never)
    await updater.perform({} as never, 'https://example.com/LIVI.AppImage')
    await updater.abort()

    expect(unlink).toHaveBeenCalledWith(expect.stringMatching(/\.AppImage$/))
    expect(sendUpdateEvent).toHaveBeenCalledWith({ phase: 'error', message: 'Aborted' })
  })

  test('install emits error when no downloaded update is ready', async () => {
    const { Updater, sendUpdateEvent } = loadSubject()

    const updater = new Updater({ usbService: { gracefulReset: jest.fn() } } as never)
    await updater.install()

    expect(sendUpdateEvent).toHaveBeenCalledWith({
      phase: 'error',
      message: 'No downloaded update ready'
    })
  })

  test('install runs graceful reset and linux installer when update is ready', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    const { Updater, downloadWithProgress, installOnLinuxFromFile, installOnMacFromFile } =
      loadSubject()

    downloadWithProgress.mockReturnValue({ promise: Promise.resolve(), cancel: jest.fn() })
    const timeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(((
      cb: (...args: unknown[]) => void
    ) => {
      cb()
      return 0 as unknown as NodeJS.Timeout
    }) as typeof setTimeout)

    const gracefulReset = jest.fn(() => Promise.resolve())
    const updater = new Updater({ usbService: { gracefulReset } } as never)

    await updater.perform({} as never, 'https://example.com/LIVI.AppImage')
    await updater.install()

    expect(gracefulReset).toHaveBeenCalledTimes(1)
    expect(installOnLinuxFromFile).toHaveBeenCalledWith(expect.stringMatching(/\.AppImage$/))
    expect(installOnMacFromFile).not.toHaveBeenCalled()
    timeoutSpy.mockRestore()
  })

  test('perform fetches latest release when directUrl is missing and downloads picked asset', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    const { Updater, downloadWithProgress, pickAssetForPlatform } = loadSubject()

    const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        assets: [{ name: 'LIVI.AppImage', browser_download_url: 'https://example.com/from-feed' }]
      })
    } as Response)

    downloadWithProgress.mockReturnValue({
      promise: Promise.resolve(),
      cancel: jest.fn()
    })
    pickAssetForPlatform.mockReturnValue({ url: 'https://example.com/from-feed' })

    const updater = new Updater({} as never)
    await updater.perform({} as never)

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.github.com/repos/f-io/LIVI/releases/latest',
      { headers: { 'User-Agent': 'LIVI-updater' } }
    )
    expect(pickAssetForPlatform).toHaveBeenCalledWith([
      { name: 'LIVI.AppImage', browser_download_url: 'https://example.com/from-feed' }
    ])
    expect(downloadWithProgress).toHaveBeenCalledWith(
      'https://example.com/from-feed',
      expect.stringMatching(/\.AppImage$/),
      expect.any(Function)
    )

    fetchSpy.mockRestore()
  })

  test('perform emits feed status error when release feed response is not ok', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    const { Updater, sendUpdateEvent } = loadSubject()

    const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: false,
      status: 503
    } as Response)

    const updater = new Updater({} as never)
    await updater.perform({} as never)

    expect(sendUpdateEvent).toHaveBeenCalledWith({
      phase: 'error',
      message: 'feed 503'
    })

    fetchSpy.mockRestore()
  })

  test('perform emits error when no asset url is available for current platform', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    const { Updater, sendUpdateEvent, pickAssetForPlatform } = loadSubject()

    const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        assets: [{ name: 'something-else' }]
      })
    } as Response)

    pickAssetForPlatform.mockReturnValue({ url: undefined })

    const updater = new Updater({} as never)
    await updater.perform({} as never)

    expect(sendUpdateEvent).toHaveBeenCalledWith({
      phase: 'error',
      message: 'No asset found for platform'
    })

    fetchSpy.mockRestore()
  })

  test('abort while downloading calls cancel closure and emits aborted', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    const { Updater, sendUpdateEvent, downloadWithProgress } = loadSubject()

    let resolveDownload!: () => void
    const cancel = jest.fn()

    downloadWithProgress.mockReturnValue({
      promise: new Promise<void>((resolve) => {
        resolveDownload = resolve
      }),
      cancel
    })

    const updater = new Updater({} as never)

    const performPromise = updater.perform({} as never, 'https://example.com/LIVI.AppImage')
    await Promise.resolve()

    await updater.abort()
    resolveDownload()
    await performPromise

    expect(cancel).toHaveBeenCalledTimes(1)
    expect(sendUpdateEvent).toHaveBeenCalledWith({ phase: 'error', message: 'Aborted' })
  })

  test('install continues with linux installer when gracefulReset fails', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    const { Updater, downloadWithProgress, installOnLinuxFromFile } = loadSubject()

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    downloadWithProgress.mockReturnValue({
      promise: Promise.resolve(),
      cancel: jest.fn()
    })

    const timeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(((
      cb: (...args: unknown[]) => void
    ) => {
      cb()
      return 0 as unknown as NodeJS.Timeout
    }) as typeof setTimeout)

    const gracefulReset = jest.fn().mockRejectedValue(new Error('reset failed'))
    const updater = new Updater({ usbService: { gracefulReset } } as never)

    await updater.perform({} as never, 'https://example.com/LIVI.AppImage')
    await updater.install()

    expect(warnSpy).toHaveBeenCalledWith(
      '[MAIN] gracefulReset failed (continuing install):',
      expect.any(Error)
    )
    expect(installOnLinuxFromFile).toHaveBeenCalledWith(expect.stringMatching(/\.AppImage$/))

    timeoutSpy.mockRestore()
    warnSpy.mockRestore()
  })

  test('perform emits error when another update is already in progress', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    const { Updater, sendUpdateEvent, downloadWithProgress } = loadSubject()

    let resolveDownload!: () => void
    downloadWithProgress.mockReturnValue({
      promise: new Promise<void>((resolve) => {
        resolveDownload = resolve
      }),
      cancel: jest.fn()
    })

    const updater = new Updater({} as never)

    const firstPerform = updater.perform({} as never, 'https://example.com/LIVI.AppImage')
    await Promise.resolve()

    await updater.perform({} as never, 'https://example.com/LIVI.AppImage')

    expect(sendUpdateEvent).toHaveBeenCalledWith({
      phase: 'error',
      message: 'Update already in progress'
    })

    resolveDownload()
    await firstPerform
  })

  test('perform uses empty assets array fallback when feed json has no assets', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    const { Updater, pickAssetForPlatform, sendUpdateEvent } = loadSubject()

    const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({})
    } as Response)

    pickAssetForPlatform.mockReturnValue({ url: undefined })

    const updater = new Updater({} as never)
    await updater.perform({} as never)

    expect(pickAssetForPlatform).toHaveBeenCalledWith([])
    expect(sendUpdateEvent).toHaveBeenCalledWith({
      phase: 'error',
      message: 'No asset found for platform'
    })

    fetchSpy.mockRestore()
  })

  test('perform on darwin downloads dmg and reaches ready state', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    const { Updater, downloadWithProgress, sendUpdateEvent, sendUpdateProgress } = loadSubject()

    downloadWithProgress.mockImplementation((_url, _dest, onProgress) => {
      onProgress({ received: 10, total: 20, percent: 0.5 })
      return {
        promise: Promise.resolve(),
        cancel: jest.fn()
      }
    })

    const updater = new Updater({} as never)
    await updater.perform({} as never, 'https://example.com/LIVI.dmg')

    expect(downloadWithProgress).toHaveBeenCalledWith(
      'https://example.com/LIVI.dmg',
      expect.stringMatching(/\.dmg$/),
      expect.any(Function)
    )
    expect(sendUpdateProgress).toHaveBeenCalledWith({
      phase: 'download',
      received: 10,
      total: 20,
      percent: 0.5
    })
    expect(sendUpdateEvent).toHaveBeenCalledWith({ phase: 'ready' })
  })

  test('install uses mac installer on darwin when update is ready', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    const { Updater, downloadWithProgress, installOnMacFromFile, installOnLinuxFromFile } =
      loadSubject()

    downloadWithProgress.mockReturnValue({
      promise: Promise.resolve(),
      cancel: jest.fn()
    })

    const timeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(((
      cb: (...args: unknown[]) => void
    ) => {
      cb()
      return 0 as unknown as NodeJS.Timeout
    }) as typeof setTimeout)

    const gracefulReset = jest.fn().mockResolvedValue(undefined)
    const updater = new Updater({ usbService: { gracefulReset } } as never)

    await updater.perform({} as never, 'https://example.com/LIVI.dmg')
    await updater.install()

    expect(installOnMacFromFile).toHaveBeenCalledWith(expect.stringMatching(/\.dmg$/))
    expect(installOnLinuxFromFile).not.toHaveBeenCalled()

    timeoutSpy.mockRestore()
  })

  test('install emits error when installer throws', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    const { Updater, downloadWithProgress, installOnMacFromFile, sendUpdateEvent } = loadSubject()

    installOnMacFromFile.mockRejectedValue(new Error('install failed'))
    downloadWithProgress.mockReturnValue({
      promise: Promise.resolve(),
      cancel: jest.fn()
    })

    const timeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(((
      cb: (...args: unknown[]) => void
    ) => {
      cb()
      return 0 as unknown as NodeJS.Timeout
    }) as typeof setTimeout)

    const gracefulReset = jest.fn().mockResolvedValue(undefined)
    const updater = new Updater({ usbService: { gracefulReset } } as never)

    await updater.perform({} as never, 'https://example.com/LIVI.dmg')
    await updater.install()

    expect(sendUpdateEvent).toHaveBeenCalledWith({
      phase: 'error',
      message: 'install failed'
    })

    timeoutSpy.mockRestore()
  })

  test('perform stringifies non-Error throw values in catch block', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    const { Updater, sendUpdateEvent, downloadWithProgress } = loadSubject()

    downloadWithProgress.mockReturnValue({
      promise: Promise.reject('download failed as string'),
      cancel: jest.fn()
    })

    const updater = new Updater({} as never)
    await updater.perform({} as never, 'https://example.com/LIVI.AppImage')

    expect(sendUpdateEvent).toHaveBeenCalledWith({
      phase: 'error',
      message: 'download failed as string'
    })
  })

  test('abort in ready state skips unlink when tmpFile is missing or does not exist', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    const { Updater, sendUpdateEvent, downloadWithProgress, unlink, existsSync } = loadSubject()

    downloadWithProgress.mockReturnValue({
      promise: Promise.resolve(),
      cancel: jest.fn()
    })
    existsSync.mockReturnValue(false)

    const updater = new Updater({} as never)
    await updater.perform({} as never, 'https://example.com/LIVI.AppImage')
    await updater.abort()

    expect(existsSync).toHaveBeenCalledWith(expect.stringMatching(/\.AppImage$/))
    expect(unlink).not.toHaveBeenCalled()
    expect(sendUpdateEvent).toHaveBeenCalledWith({ phase: 'error', message: 'Aborted' })
  })

  test('install stringifies non-Error throw values in catch block', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    const { Updater, downloadWithProgress, installOnMacFromFile, sendUpdateEvent } = loadSubject()

    installOnMacFromFile.mockRejectedValue('install failed as string')
    downloadWithProgress.mockReturnValue({
      promise: Promise.resolve(),
      cancel: jest.fn()
    })

    const timeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(((
      cb: (...args: unknown[]) => void
    ) => {
      cb()
      return 0 as unknown as NodeJS.Timeout
    }) as typeof setTimeout)

    const gracefulReset = jest.fn().mockResolvedValue(undefined)
    const updater = new Updater({ usbService: { gracefulReset } } as never)

    await updater.perform({} as never, 'https://example.com/LIVI.dmg')
    await updater.install()

    expect(sendUpdateEvent).toHaveBeenCalledWith({
      phase: 'error',
      message: 'install failed as string'
    })

    timeoutSpy.mockRestore()
  })
})

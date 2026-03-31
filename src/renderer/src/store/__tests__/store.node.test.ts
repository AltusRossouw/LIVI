/** @jest-environment node */

describe('store in node environment', () => {
  test('module init handles missing window', async () => {
    jest.resetModules()

    const { useLiviStore } = require('../store') as typeof import('../store')

    await Promise.resolve()

    expect(useLiviStore.getState().settings).toBeNull()
  })
})

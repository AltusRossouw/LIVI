export function createRenderWorker(): Worker {
  /* istanbul ignore next */
  return new Worker(new URL('./render/Render.worker.ts', import.meta.url), {
    type: 'module'
  })
}

// test
export const __forCoverage = true

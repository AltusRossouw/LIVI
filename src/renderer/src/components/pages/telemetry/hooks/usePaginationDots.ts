import { useCallback } from 'react'

export const usePaginationDots = (isNavbarHidden: boolean) => {
  return {
    showDots: !isNavbarHidden,
    revealDots: useCallback(() => {}, [])
  }
}

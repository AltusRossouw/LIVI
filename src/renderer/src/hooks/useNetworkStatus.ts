import { useEffect, useState } from 'react'

export function useNetworkStatus() {
  const getConnection = () => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection

    if (!connection) {
      return { type: 'unknown', effectiveType: null }
    }

    return {
      type: connection.type || 'WiFi',
      effectiveType: connection.effectiveType || null
    }
  }

  const [network, setNetwork] = useState(getConnection())

  useEffect(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection

    if (!connection) return

    const update = () => setNetwork(getConnection())

    connection.addEventListener('change', update)
    return () => connection.removeEventListener('change', update)
  }, [])

  return network
}

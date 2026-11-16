import { useEffect, useState } from 'react'
import { buildMapsShell, type MapsService, type MapsShell, type MapsShellOptions } from '@erme2/latte'

export type MapsShellState =
  | { status: 'loading' }
  | { status: 'ready'; shell: MapsShell }
  | { status: 'error' }

// Loads the install's maps once the member is signed in and builds the shell from them.
export function useMapsShell(maps: MapsService, options: MapsShellOptions, signedIn: boolean): MapsShellState {
  const [state, setState] = useState<MapsShellState>({ status: 'loading' })

  useEffect(() => {
    if (!signedIn) return
    let current = true
    setState({ status: 'loading' })
    maps.getMaps()
      .then(({ document }) => {
        if (current) setState({ status: 'ready', shell: buildMapsShell(document.data.attributes, options) })
      })
      .catch(() => {
        if (current) setState({ status: 'error' })
      })
    return () => { current = false }
  }, [maps, options, signedIn])

  return state
}

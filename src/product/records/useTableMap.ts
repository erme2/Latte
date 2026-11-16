import { useEffect, useState } from 'react'
import type { MapsService, TableMap } from '@erme2/latte'

export type TableMapState =
  | { status: 'loading' }
  | { status: 'ready'; table: TableMap }
  | { status: 'unavailable' }

// Loads the table map a record page is built from. A table the member can't see answers 404, like a missing one.
export function useTableMap(maps: MapsService, source: string, table: string): TableMapState {
  const [state, setState] = useState<TableMapState>({ status: 'loading' })

  useEffect(() => {
    let current = true
    setState({ status: 'loading' })
    maps.getTableMap(source, table)
      .then(({ document }) => { if (current) setState({ status: 'ready', table: document.data.attributes }) })
      .catch(() => { if (current) setState({ status: 'unavailable' }) })
    return () => { current = false }
  }, [maps, source, table])

  return state
}

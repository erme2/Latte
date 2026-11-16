import { useCallback, useEffect, useState } from 'react'
import {
  formatRecordValue,
  mapsRecordPath,
  recordFieldLabel,
  recordListColumns,
  recordListSort,
  recordWriteFailure,
  type DataRowResource,
  type DataService,
  type TableMap,
} from '@erme2/latte'
import type { ProductPageProps } from '../contract'
import type { ProductServices } from '../services'
import { useTableMap } from './useTableMap'

const pageSize = 25

type RowsState = {
  rows: DataRowResource[]
  nextCursor: string | null
  loading: boolean
  message: string | null
}

// The table a maps menu item opens: its rows, with the columns and order the map's `ui` part names.
export function RecordList({ context }: ProductPageProps<ProductServices>) {
  const source = context.params.source ?? ''
  const tableName = context.params.table ?? ''
  const tableMap = useTableMap(context.maps, source, tableName)

  if (tableMap.status === 'unavailable') return <h2>This table is not available.</h2>
  if (tableMap.status === 'loading') return <p aria-live="polite">Loading…</p>

  return <RecordTable data={context.data} table={tableMap.table} />
}

function RecordTable({ data, table }: { data: DataService; table: TableMap }) {
  const [state, setState] = useState<RowsState>({ rows: [], nextCursor: null, loading: true, message: null })
  const columns = recordListColumns(table)
  const sort = recordListSort(table)
  const basePath = mapsRecordPath(table.source, table.table)

  const load = useCallback(async (cursor: string | null, signal: { current: boolean }) => {
    setState((previous) => ({ ...previous, loading: true, message: null }))
    try {
      const page = await data.list(table.source, table.table, { cursor: cursor ?? undefined, limit: pageSize, sort })
      if (!signal.current) return
      setState((previous) => ({
        rows: cursor ? [...previous.rows, ...page.data] : page.data,
        nextCursor: page.meta.page.has_more ? page.meta.page.next_cursor : null,
        loading: false,
        message: null,
      }))
    } catch (error) {
      if (!signal.current) return
      const failure = recordWriteFailure(error)
      const message = failure.kind === 'not_found' ? 'This table is not available.' : failure.message
      setState((previous) => ({ ...previous, loading: false, message }))
    }
  }, [data, table.source, table.table, sort])

  useEffect(() => {
    const signal = { current: true }
    void load(null, signal)
    return () => { signal.current = false }
  }, [load])

  const description = table.ui?.description ?? table.description

  return (
    <section className="admin-layout">
      <div className="page-heading">
        <div>
          <h2>{table.ui?.label ?? table.table}</h2>
          {description ? <p className="page-description">{description}</p> : null}
        </div>
        <a className="button" href={`${basePath}/new`}>New record</a>
      </div>

      {state.message ? <p className="notice error" role="alert">{state.message}</p> : null}

      {state.rows.length > 0 ? (
        <div className="record-table-wrap">
          <table className="record-table">
            <thead>
              <tr>
                {columns.map((field) => <th key={field.name} scope="col">{recordFieldLabel(field)}</th>)}
                <th scope="col"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {state.rows.map((row) => (
                <tr key={row.attributes.row_key}>
                  {columns.map((field) => (
                    <td key={field.name}>{formatRecordValue(field, row.attributes.values[field.name])}</td>
                  ))}
                  <td className="record-table-action">
                    <a href={`${basePath}/${encodeURIComponent(row.attributes.row_key)}`}>Open</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!state.loading && !state.message && state.rows.length === 0
        ? <p className="notice">No records yet.</p>
        : null}
      {state.loading ? <p aria-live="polite">Loading…</p> : null}
      {state.nextCursor && !state.loading ? (
        <div className="actions">
          <button className="button secondary" type="button" onClick={() => { void load(state.nextCursor, { current: true }) }}>
            Load more
          </button>
        </div>
      ) : null}
    </section>
  )
}

import { useEffect, useState, type FormEvent } from 'react'
import {
  buildRecordView,
  CrudValidationError,
  type CrudPagination,
  type CrudRow,
  type RecordFormField,
  type RecordView,
} from '@erme2/latte'
import type { ProductPageProps } from '../contract'
import type { ProductServices } from '../services'

type Props = ProductPageProps<ProductServices>

const pageSize = 20

type View = { status: 'loading' } | { status: 'error' } | { status: 'missing' } | { status: 'ready'; view: RecordView }
type Mode = { type: 'list' } | { type: 'form'; key: string | null; row: CrudRow | null }
type FormValues = Record<string, string | boolean>

function cell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function initialValue(field: RecordFormField, row: CrudRow | null): string | boolean {
  const value = row?.[field.name]
  if (field.input === 'checkbox') return value === true || value === 1 || value === '1'
  if (value === null || value === undefined) return ''
  return field.input === 'json' ? JSON.stringify(value, null, 2) : String(value)
}

// Turns the form into the body Pane expects. A JSON field that does not parse is a field error.
function formBody(fields: RecordFormField[], values: FormValues) {
  const body: CrudRow = {}
  const errors: Record<string, string> = {}
  for (const field of fields) {
    if (field.readOnly) continue
    const value = values[field.name]
    if (field.input === 'checkbox') body[field.name] = value === true
    else if (value === '') body[field.name] = null
    else if (field.input === 'number') body[field.name] = Number(value)
    else if (field.input === 'json') {
      try { body[field.name] = JSON.parse(String(value)) } catch { errors[field.name] = 'Enter valid JSON.' }
    } else body[field.name] = value
  }
  return { body, errors }
}

function RecordForm({ view, table, mode, context, onDone }: {
  view: RecordView
  table: string
  mode: Extract<Mode, { type: 'form' }>
  context: Props['context']
  onDone: () => void
}) {
  const { crud } = context.services
  const editing = mode.key !== null
  const [values, setValues] = useState<FormValues>(
    () => Object.fromEntries(view.fields.map((field) => [field.name, initialValue(field, mode.row)])),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const { body, errors: local } = formBody(view.fields, values)
    setErrors(local)
    setFailure(null)
    if (Object.keys(local).length > 0) return
    setBusy(true)
    try {
      if (mode.key === null) await crud.create(table, body)
      else await crud.update(table, mode.key, body)
      onDone()
    } catch (error) {
      if (error instanceof CrudValidationError) {
        setErrors(Object.fromEntries(error.errors.map((item) => [item.field, item.message])))
      } else {
        setFailure('Pane could not save the record. Try again.')
      }
      setBusy(false)
    }
  }

  return (
    <form
      className="record-form"
      onSubmit={(event) => { void submit(event) }}
      noValidate
      aria-label={`${editing ? 'Edit' : 'New'} ${view.title} record`}
    >
      <h3>{editing ? `Edit ${view.title}` : `New ${view.title}`}</h3>
      {view.fields.filter((field) => editing || !field.readOnly).map((field) => {
        const id = `field-${table}-${field.name}`
        const error = errors[field.name]
        const common = {
          id,
          name: field.name,
          disabled: busy || field.readOnly,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': error ? `${id}-error` : field.help ? `${id}-help` : undefined,
        }
        const set = (value: string | boolean) => setValues((previous) => ({ ...previous, [field.name]: value }))
        return (
          <div className="record-field" key={field.name} data-input={field.input}>
            {field.input === 'checkbox' ? (
              <label htmlFor={id}>
                <input {...common} type="checkbox" checked={values[field.name] === true} onChange={(event) => set(event.target.checked)} />
                {' '}{field.label}
              </label>
            ) : (
              <>
                <label htmlFor={id}>{field.label}</label>
                {field.input === 'textarea' || field.input === 'json' ? (
                  <textarea {...common} rows={field.input === 'json' ? 6 : 4} value={String(values[field.name] ?? '')} onChange={(event) => set(event.target.value)} />
                ) : (
                  <input {...common} type={field.input} value={String(values[field.name] ?? '')} onChange={(event) => set(event.target.value)} />
                )}
              </>
            )}
            {field.help && !error ? <small id={`${id}-help`}>{field.help}</small> : null}
            {error ? <small className="record-error" id={`${id}-error`} role="alert">{error}</small> : null}
          </div>
        )
      })}
      {failure ? <p role="alert">{failure}</p> : null}
      <div className="record-actions">
        <button className="button" type="submit" disabled={busy}>{editing ? 'Save changes' : 'Create record'}</button>
        <button className="button secondary" type="button" disabled={busy} onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}

function RecordList({ view, table, context, onOpen }: {
  view: RecordView
  table: string
  context: Props['context']
  onOpen: (mode: Mode) => void
}) {
  const { crud } = context.services
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState(view.sort)
  const [data, setData] = useState<
    { status: 'loading' } | { status: 'error' } | { status: 'ready'; rows: CrudRow[]; pagination: CrudPagination }
  >({ status: 'loading' })
  const [confirming, setConfirming] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let current = true
    setData({ status: 'loading' })
    crud.list(table, { page, limit: pageSize, ...(sort ? { sort: sort.name, order: sort.order } : {}) })
      .then(({ rows, pagination }) => { if (current) setData({ status: 'ready', rows, pagination }) })
      .catch(() => { if (current) setData({ status: 'error' }) })
    return () => { current = false }
  }, [crud, table, page, sort, reload])

  const keyOf = (row: CrudRow) => (view.primaryKey === null ? null : String(row[view.primaryKey] ?? ''))

  async function remove(key: string) {
    setNotice(null)
    try {
      await crud.remove(table, key)
      setNotice('Record deleted.')
      setReload((count) => count + 1)
    } catch {
      setNotice('Pane could not delete the record. Try again.')
    }
    setConfirming(null)
  }

  const pages = data.status === 'ready' && data.pagination.total !== null
    ? Math.max(1, Math.ceil(data.pagination.total / pageSize))
    : null
  const canEdit = view.primaryKey !== null

  return (
    <>
      <div className="record-toolbar">
        <h2>{view.title}</h2>
        <button className="button" type="button" onClick={() => onOpen({ type: 'form', key: null, row: null })}>New record</button>
      </div>
      {notice ? <p role="status">{notice}</p> : null}
      {data.status === 'loading' ? <p aria-live="polite">Loading…</p> : null}
      {data.status === 'error' ? <p role="alert">Pane could not load these records. Reload the page to try again.</p> : null}
      {data.status === 'ready' ? (
        data.rows.length === 0 ? <p>No records yet.</p> : (
          <div className="record-table">
            <table aria-label={`${view.title} records`}>
              <thead>
                <tr>
                  {view.columns.map((column) => (
                    <th key={column.name} scope="col" aria-sort={sort?.name === column.name ? (sort.order === 'asc' ? 'ascending' : 'descending') : undefined}>
                      {column.sortable ? (
                        <button className="sort-button" type="button" onClick={() => {
                          setPage(1)
                          setSort((previous) => ({ name: column.name, order: previous?.name === column.name && previous.order === 'asc' ? 'desc' : 'asc' }))
                        }}>{column.label}</button>
                      ) : column.label}
                    </th>
                  ))}
                  {canEdit ? <th scope="col">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, index) => {
                  const key = keyOf(row)
                  return (
                    <tr key={key ?? index}>
                      {view.columns.map((column) => <td key={column.name}>{cell(row[column.name])}</td>)}
                      {canEdit && key !== null ? (
                        <td><div className="record-row-actions">
                          {confirming === key ? (
                            <>
                              <span>Delete this record?</span>
                              <button className="button danger" type="button" onClick={() => { void remove(key) }}>Confirm delete</button>
                              <button className="button secondary" type="button" onClick={() => setConfirming(null)}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <button className="button secondary" type="button" onClick={() => onOpen({ type: 'form', key, row })}>Edit</button>
                              <button className="button secondary" type="button" onClick={() => { setNotice(null); setConfirming(key) }}>Delete</button>
                            </>
                          )}
                        </div></td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      ) : null}
      {data.status === 'ready' && (page > 1 || (pages !== null && pages > 1)) ? (
        <nav className="record-pager" aria-label="Pages">
          <button className="button secondary" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page}{pages !== null ? ` of ${pages}` : ''}</span>
          <button className="button secondary" type="button" disabled={pages !== null ? page >= pages : data.rows.length < pageSize} onClick={() => setPage(page + 1)}>Next</button>
        </nav>
      ) : null}
    </>
  )
}

export function Records({ context }: Props) {
  const { source = '', table = '' } = context.params
  const [view, setView] = useState<View>({ status: 'loading' })
  const [mode, setMode] = useState<Mode>({ type: 'list' })

  useEffect(() => {
    let current = true
    setView({ status: 'loading' })
    setMode({ type: 'list' })
    context.maps.getTableMap(source, table)
      .then(({ document }) => { if (current) setView({ status: 'ready', view: buildRecordView(document.data.attributes) }) })
      .catch((error: unknown) => {
        const status = (error as { response?: { status?: number } } | null)?.response?.status
        if (current) setView({ status: status === 403 || status === 404 ? 'missing' : 'error' })
      })
    return () => { current = false }
  }, [context.maps, source, table])

  if (view.status === 'loading') return <p aria-live="polite">Loading…</p>
  if (view.status === 'missing') return <h2>This table is not available.</h2>
  if (view.status === 'error') return <p role="alert">Pane could not load this table. Reload the page to try again.</p>

  return (
    <section className="record-page" key={`${source}/${table}`}>
      {mode.type === 'form'
        ? <RecordForm view={view.view} table={table} mode={mode} context={context} onDone={() => setMode({ type: 'list' })} />
        : <RecordList view={view.view} table={table} context={context} onOpen={setMode} />}
    </section>
  )
}

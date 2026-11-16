import { useEffect, useState, type FormEvent } from 'react'
import {
  formatRecordValue,
  mapsRecordPath,
  parseRecordInput,
  recordFieldLabel,
  recordFieldWidget,
  recordFormFields,
  recordInputValue,
  recordValidationMessages,
  recordWriteFailure,
  type DataRowValues,
  type DataService,
  type MapField,
  type RecordFormMode,
  type TableMap,
} from '@erme2/latte'
import type { ProductPageProps } from '../contract'
import type { ProductServices } from '../services'
import { useTableMap } from './useTableMap'

type Inputs = Record<string, string | boolean>

type LoadedRow = { rowKey: string; etag: string; values: DataRowValues }

function inputsFor(fields: MapField[], values: DataRowValues | null): Inputs {
  const inputs: Inputs = {}
  for (const field of fields) {
    const value = values ? values[field.name] : field.default
    if (recordFieldWidget(field) === 'checkbox') inputs[field.name] = value === true
    else inputs[field.name] = field.type === 'password' ? '' : recordInputValue(field, value)
  }
  return inputs
}

// Create (`/records/:source/:table/new`) and edit (`/records/:source/:table/:rowKey`) a record from its table map.
export function RecordEditor({ context }: ProductPageProps<ProductServices>) {
  const source = context.params.source ?? ''
  const tableName = context.params.table ?? ''
  const rowKey = context.params.rowKey ?? null
  const tableMap = useTableMap(context.maps, source, tableName)

  if (tableMap.status === 'unavailable') return <h2>This table is not available.</h2>
  if (tableMap.status === 'loading') return <p aria-live="polite">Loading…</p>

  return rowKey === null
    ? <RecordForm data={context.data} table={tableMap.table} row={null} />
    : <EditRecord data={context.data} table={tableMap.table} rowKey={rowKey} />
}

function EditRecord({ data, table, rowKey }: { data: DataService; table: TableMap; rowKey: string }) {
  const [row, setRow] = useState<LoadedRow | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    setRow(null)
    setMessage(null)
    data.get(table.source, table.table, rowKey)
      .then(({ document, etag }) => {
        if (current) setRow({ rowKey: document.data.attributes.row_key, etag, values: document.data.attributes.values })
      })
      .catch((error: unknown) => { if (current) setMessage(recordWriteFailure(error).message) })
    return () => { current = false }
  }, [data, table.source, table.table, rowKey])

  if (message) return <p className="notice error" role="alert">{message}</p>
  if (!row) return <p aria-live="polite">Loading…</p>
  return <RecordForm data={data} table={table} row={row} />
}

function RecordForm({ data, table, row }: { data: DataService; table: TableMap; row: LoadedRow | null }) {
  const mode: RecordFormMode = row ? 'edit' : 'create'
  const fields = recordFormFields(table, mode)
  const readOnlyFields = row
    ? table.fields.filter((field) => field.ui?.hidden !== true && field.type !== 'password' && !fields.includes(field))
    : []
  const listPath = mapsRecordPath(table.source, table.table)
  const tableLabel = table.ui?.label ?? table.table

  const [current, setCurrent] = useState<LoadedRow | null>(row)
  const [saved, setSaved] = useState<Inputs>(() => inputsFor(fields, row?.values ?? null))
  const [inputs, setInputs] = useState<Inputs>(saved)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  function change(name: string, value: string | boolean): void {
    setInputs((previous) => ({ ...previous, [name]: value }))
  }

  // Builds the values to send: everything filled in on create, only what changed on edit.
  function collectValues(): { values: DataRowValues; errors: Record<string, string[]> } {
    const values: DataRowValues = {}
    const errors: Record<string, string[]> = {}
    for (const field of fields) {
      const input = inputs[field.name]
      const untouched = input === saved[field.name]
      if (mode === 'edit' && untouched) continue
      if (mode === 'create' && untouched && (input === '' || input === false)) continue
      if (field.type === 'password' && input === '') continue
      const parsed = parseRecordInput(field, input)
      if (!parsed.ok) {
        errors[field.name] = [parsed.message]
        continue
      }
      const hints = recordValidationMessages(field, parsed.value)
      if (hints.length > 0) errors[field.name] = hints
      else values[field.name] = parsed.value
    }
    return { values, errors }
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const { values, errors } = collectValues()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      setNotice({ tone: 'error', text: 'Check the highlighted fields.' })
      return
    }
    if (mode === 'edit' && Object.keys(values).length === 0) {
      setNotice({ tone: 'success', text: 'Nothing to save.' })
      return
    }

    setBusy(true)
    setNotice(null)
    try {
      if (!current) {
        const { document } = await data.create(table.source, table.table, values)
        window.location.assign(`${listPath}/${encodeURIComponent(document.data.attributes.row_key)}`)
        return
      }
      const { document, etag } = await data.update(table.source, table.table, current.rowKey, values, current.etag)
      const next = { rowKey: current.rowKey, etag, values: document.data.attributes.values }
      const nextInputs = inputsFor(fields, next.values)
      setCurrent(next)
      setSaved(nextInputs)
      setInputs(nextInputs)
      setNotice({ tone: 'success', text: 'Saved.' })
    } catch (error) {
      const failure = recordWriteFailure(error)
      if (failure.kind === 'validation') setFieldErrors(failure.fields)
      setNotice({ tone: 'error', text: failure.message })
    } finally {
      setBusy(false)
    }
  }

  async function remove(): Promise<void> {
    if (!current || !window.confirm(`Delete this record from ${tableLabel}? This can't be undone.`)) return
    setBusy(true)
    setNotice(null)
    try {
      await data.remove(table.source, table.table, current.rowKey, current.etag)
      window.location.assign(listPath)
    } catch (error) {
      setNotice({ tone: 'error', text: recordWriteFailure(error).message })
      setBusy(false)
    }
  }

  return (
    <section className="admin-layout">
      <div className="page-heading">
        <div>
          <p className="eyebrow"><a href={listPath}>{tableLabel}</a></p>
          <h2>{current ? 'Edit record' : 'New record'}</h2>
        </div>
        {current ? (
          <button className="button danger" type="button" disabled={busy} onClick={() => { void remove() }}>
            Delete
          </button>
        ) : null}
      </div>

      {notice ? (
        <p className={notice.tone === 'error' ? 'notice error' : 'notice'} role={notice.tone === 'error' ? 'alert' : 'status'}>
          {notice.text}
        </p>
      ) : null}

      {current && readOnlyFields.length > 0 ? (
        <dl className="record-facts">
          {readOnlyFields.map((field) => (
            <div key={field.name}>
              <dt>{recordFieldLabel(field)}</dt>
              <dd>{formatRecordValue(field, current.values[field.name])}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <form className="record-form" noValidate onSubmit={(event) => { void submit(event) }}>
        {fields.map((field) => (
          <RecordInput
            key={field.name}
            field={field}
            value={inputs[field.name]}
            errors={fieldErrors[field.name] ?? []}
            editing={mode === 'edit'}
            onChange={(value) => change(field.name, value)}
          />
        ))}
        {fields.length === 0 ? <p className="notice">This table has no fields you can edit.</p> : null}
        <div className="row-actions record-form-actions">
          <a className="button secondary" href={listPath}>Back to list</a>
          <button className="button" type="submit" disabled={busy || fields.length === 0}>
            {busy ? 'Saving…' : current ? 'Save changes' : 'Create record'}
          </button>
        </div>
      </form>
    </section>
  )
}

type RecordInputProps = {
  field: MapField
  value: string | boolean | undefined
  errors: string[]
  editing: boolean
  onChange(value: string | boolean): void
}

function RecordInput({ field, value, errors, editing, onChange }: RecordInputProps) {
  const id = `field-${field.name}`
  const widget = recordFieldWidget(field)
  const help = field.ui?.help ?? field.description
  const describedBy = [help ? `${id}-help` : null, errors.length > 0 ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
  const common = {
    id,
    name: field.name,
    'aria-invalid': errors.length > 0 ? true : undefined,
    'aria-describedby': describedBy,
  }
  const text = typeof value === 'string' ? value : ''

  let control
  if (widget === 'checkbox') {
    control = <input {...common} type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} />
  } else if (widget === 'textarea' || widget === 'json') {
    control = (
      <textarea
        {...common}
        rows={widget === 'json' ? 6 : 4}
        className={widget === 'json' ? 'code-input' : undefined}
        value={text}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  } else {
    control = (
      <input
        {...common}
        type={widget}
        step={widget === 'number' ? 'any' : undefined}
        autoComplete={widget === 'password' ? 'new-password' : undefined}
        placeholder={widget === 'password' && editing ? 'Leave blank to keep it' : undefined}
        value={text}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }

  return (
    <div className={widget === 'checkbox' ? 'record-field checkbox' : 'record-field'}>
      <label htmlFor={id}>{recordFieldLabel(field)}</label>
      {control}
      {help ? <small id={`${id}-help`}>{help}</small> : null}
      {errors.length > 0 ? <small className="field-error" id={`${id}-error`}>{errors.join(' ')}</small> : null}
    </div>
  )
}

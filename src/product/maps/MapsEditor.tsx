import { useEffect, useState, type FormEvent } from 'react'
import {
  buildMapBody,
  buildMapEdit,
  mapSaveAllowed,
  mapSaveLosses,
  paneErrorCode,
  paneErrorStatus,
  type MapEdit,
  type MapFieldEdit,
  type MapTableSummary,
  type TableMapResource,
} from '@erme2/latte'
import type { ProductPageProps } from '../contract'
import type { ProductServices } from '../services'

type Props = ProductPageProps<ProductServices>

const mapEditorPath = (source: string, table: string) =>
  `/maps/${encodeURIComponent(source)}/${encodeURIComponent(table)}`

function saveFailureMessage(error: unknown): string {
  switch (paneErrorCode(error)) {
    case 'version_conflict': return 'Someone else changed this map. Reload the page to see their version, then make your change again.'
    case 'system_map_protected': return 'This is a system map. It cannot be edited.'
    case 'permission_denied': return 'Only administrators can edit maps.'
    case 'validation_failed': return 'Pane did not accept the map. Check the fields below and try again.'
    case 'precondition_required': return 'Reload the page and try again.'
    default: return 'Pane could not save the map. Try again.'
  }
}

// Pane's `validation_failed` lists `fields`: path to message.
function paneFieldErrors(error: unknown): Record<string, string> {
  const fields = (error as { response?: { data?: { error?: { fields?: unknown } } } } | null)?.response?.data?.error?.fields
  if (typeof fields !== 'object' || fields === null) return {}
  return Object.fromEntries(Object.entries(fields).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
}

export function MapsList({ context }: Props) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error' } | { status: 'ready'; tables: MapTableSummary[] }>({ status: 'loading' })

  useEffect(() => {
    let current = true
    context.maps.getMaps()
      .then(({ document }) => { if (current) setState({ status: 'ready', tables: document.data.attributes.tables }) })
      .catch(() => { if (current) setState({ status: 'error' }) })
    return () => { current = false }
  }, [context.maps])

  return (
    <section className="record-page">
      <div className="record-toolbar"><h2>Maps</h2></div>
      <p>A map says which fields of a table are exposed, how they are labelled and validated, and how the list and form look. Table structure comes from migrations and is not edited here.</p>
      {state.status === 'loading' ? <p aria-live="polite">Loading…</p> : null}
      {state.status === 'error' ? <p role="alert">Pane could not load the maps. Reload the page to try again.</p> : null}
      {state.status === 'ready' ? (
        state.tables.length === 0 ? <p>No tables are mapped yet.</p> : (
          <div className="record-table">
            <table aria-label="Mapped tables">
              <thead><tr><th scope="col">Table</th><th scope="col">Source</th><th scope="col">Version</th><th scope="col">Actions</th></tr></thead>
              <tbody>
                {state.tables.map((table) => (
                  <tr key={`${table.source}/${table.table}`}>
                    <td>{table.ui?.label?.trim() || table.table}{table.system ? ' (system)' : ''}</td>
                    <td>{table.source}</td>
                    <td>{table.version}</td>
                    <td><a className="button secondary" href={mapEditorPath(table.source, table.table)}>{table.system ? 'View' : 'Edit'}</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </section>
  )
}

function move<T>(items: readonly T[], index: number, by: -1 | 1): T[] {
  const target = index + by
  if (target < 0 || target >= items.length) return [...items]
  const next = [...items]
  const moved = next[index]
  next[index] = next[target]
  next[target] = moved
  return next
}

type Loaded = { table: TableMapResource['attributes']; etag: string }

function MapForm({ loaded, context, onSaved }: { loaded: Loaded; context: Props['context']; onSaved: (loaded: Loaded) => void }) {
  const { table } = loaded
  const readOnly = table.system
  const [edit, setEdit] = useState<MapEdit>(() => buildMapEdit(table))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [override, setOverride] = useState(false)
  const losses = mapSaveLosses(table)

  const patch = (change: Partial<MapEdit>) => { setEdit((previous) => ({ ...previous, ...change })) }
  const patchField = (index: number, change: Partial<MapFieldEdit>) =>
    patch({ fields: edit.fields.map((field, at) => (at === index ? { ...field, ...change } : field)) })

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFailure(null)
    const { body, errors: local } = buildMapBody(table, edit)
    setErrors(local)
    if (Object.keys(local).length > 0) return
    if (!mapSaveAllowed(override)) {
      setFailure('This save would drop rules the editor cannot see. Tick "Save anyway" below if you want that, or leave the map as it is.')
      return
    }
    setBusy(true)
    try {
      await context.maps.saveTableMap(table.source, table.table, loaded.etag, body)
    } catch (error) {
      setFailure(saveFailureMessage(error))
      setErrors(paneErrorCode(error) === 'validation_failed' ? paneFieldErrors(error) : {})
      setBusy(false)
      return
    }
    try {
      // Read it back: the new version and ETag come from Pane, not from what was sent.
      const { document, etag } = await context.maps.getTableMap(table.source, table.table)
      onSaved({ table: document.data.attributes, etag })
    } catch {
      setFailure('The map was saved, but Pane could not reload it. Reload the page before editing again.')
      setBusy(false)
    }
  }

  const fieldNames = edit.fields.map((field) => field.name)
  const available = fieldNames.filter((name) => !edit.columns.includes(name))

  return (
    <form className="record-form map-form" onSubmit={(event) => { void submit(event) }} noValidate aria-label={`Edit the map of ${table.table}`}>
      {readOnly ? <p role="status">This is a system map: it is shown for reference and cannot be edited.</p> : null}
      <fieldset disabled={readOnly || busy}>
        <legend>Table</legend>
        <div className="record-field">
          <label htmlFor="map-label">Label</label>
          <input id="map-label" value={edit.label} onChange={(event) => patch({ label: event.target.value })} />
        </div>
        <div className="record-field">
          <label htmlFor="map-description">Description</label>
          <textarea id="map-description" rows={2} value={edit.description} onChange={(event) => patch({ description: event.target.value })} />
          {errors.description ? <small className="record-error" role="alert">{errors.description}</small> : null}
        </div>
      </fieldset>

      <fieldset disabled={readOnly || busy}>
        <legend>List view</legend>
        <ol className="map-columns" aria-label="List columns">
          {edit.columns.map((name, index) => (
            <li key={name}>
              <span>{edit.fields.find((field) => field.name === name)?.label.trim() || name}</span>
              <button className="button secondary" type="button" aria-label={`Move column ${name} up`} disabled={index === 0} onClick={() => patch({ columns: move(edit.columns, index, -1) })}>Up</button>
              <button className="button secondary" type="button" aria-label={`Move column ${name} down`} disabled={index === edit.columns.length - 1} onClick={() => patch({ columns: move(edit.columns, index, 1) })}>Down</button>
              <button className="button secondary" type="button" aria-label={`Remove column ${name}`} onClick={() => patch({ columns: edit.columns.filter((column) => column !== name) })}>Remove</button>
            </li>
          ))}
        </ol>
        {edit.columns.length === 0 ? <small>No columns chosen: the list shows the first visible fields.</small> : null}
        <div className="record-field">
          <label htmlFor="map-add-column">Add a column</label>
          <select id="map-add-column" value="" onChange={(event) => { if (event.target.value) patch({ columns: [...edit.columns, event.target.value] }) }}>
            <option value="">Choose a field</option>
            {available.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          {errors.columns ? <small className="record-error" role="alert">{errors.columns}</small> : null}
        </div>
        <div className="record-field">
          <label htmlFor="map-sort">Default sort</label>
          <select id="map-sort" value={edit.sortField} onChange={(event) => patch({ sortField: event.target.value })}>
            <option value="">No default sort</option>
            {fieldNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <label htmlFor="map-sort-desc">
            <input id="map-sort-desc" type="checkbox" checked={edit.sortDescending} disabled={edit.sortField === ''} onChange={(event) => patch({ sortDescending: event.target.checked })} />
            {' '}Newest or highest first
          </label>
          {errors.sort ? <small className="record-error" role="alert">{errors.sort}</small> : null}
        </div>
      </fieldset>

      <h3>Fields</h3>
      <p><small>The order here is the order of the form.</small></p>
      {edit.fields.map((field, index) => {
        const id = `map-field-${field.name}`
        return (
          <fieldset key={field.name} disabled={readOnly || busy} className="map-field">
            <legend>{field.name}</legend>
            <div className="record-field">
              <label htmlFor={`${id}-label`}>Label</label>
              <input id={`${id}-label`} value={field.label} onChange={(event) => patchField(index, { label: event.target.value })} />
            </div>
            <div className="record-field">
              <label htmlFor={`${id}-help`}>Help text</label>
              <input id={`${id}-help`} value={field.help} onChange={(event) => patchField(index, { help: event.target.value })} />
            </div>
            {readOnly ? null : (
              <div className="record-field">
                <label htmlFor={`${id}-sql-name`}>Database column name (only if it differs from {field.name})</label>
                <input id={`${id}-sql-name`} value={field.sqlName} aria-invalid={errors[`${field.name}.sql_name`] ? true : undefined} onChange={(event) => patchField(index, { sqlName: event.target.value })} />
                {errors[`${field.name}.sql_name`] ? <small className="record-error" role="alert">{errors[`${field.name}.sql_name`]}</small> : null}
              </div>
            )}
            <div className="record-field">
              <label htmlFor={`${id}-hidden`}>
                <input id={`${id}-hidden`} type="checkbox" checked={field.hidden} onChange={(event) => patchField(index, { hidden: event.target.checked })} />
                {' '}Hidden from the form
              </label>
            </div>
            {field.validations.map((rule, at) => {
              const key = `${field.name}.validations.${at}`
              const set = (change: Partial<MapFieldEdit['validations'][number]>) =>
                patchField(index, { validations: field.validations.map((item, position) => (position === at ? { ...item, ...change } : item)) })
              return (
                <div className="map-rule" key={rule.rule}>
                  <strong>{rule.rule}</strong>
                  {rule.rule === 'email' ? null : (
                    <>
                      <label htmlFor={`${id}-rule-${at}-value`}>{field.name} {rule.rule} value</label>
                      <input id={`${id}-rule-${at}-value`} inputMode="decimal" value={rule.value} aria-invalid={errors[key] ? true : undefined} onChange={(event) => set({ value: event.target.value })} />
                    </>
                  )}
                  <label htmlFor={`${id}-rule-${at}-message`}>{field.name} {rule.rule} message</label>
                  <input id={`${id}-rule-${at}-message`} value={rule.message} onChange={(event) => set({ message: event.target.value })} />
                  <button className="button secondary" type="button" onClick={() => patchField(index, { validations: field.validations.filter((_, position) => position !== at) })}>Remove {rule.rule} rule</button>
                  {errors[key] ? <small className="record-error" role="alert">{errors[key]}</small> : null}
                </div>
              )
            })}
            <div className="record-row-actions">
              {(['max', 'min', 'email'] as const)
                .filter((rule) => !field.validations.some((item) => item.rule === rule))
                .map((rule) => (
                  <button className="button secondary" type="button" key={rule} onClick={() => patchField(index, { validations: [...field.validations, { rule, value: '', message: '' }] })}>Add {rule} rule</button>
                ))}
              <button className="button secondary" type="button" aria-label={`Move field ${field.name} up`} disabled={index === 0} onClick={() => patch({ fields: move(edit.fields, index, -1) })}>Up</button>
              <button className="button secondary" type="button" aria-label={`Move field ${field.name} down`} disabled={index === edit.fields.length - 1} onClick={() => patch({ fields: move(edit.fields, index, 1) })}>Down</button>
            </div>
          </fieldset>
        )
      })}

      {Object.entries(errors).filter(([path]) => !/^(columns|sort|description|sql_name)$/.test(path) && !/^[a-z][a-z0-9_]*\.(validations\.\d+|sql_name)$/.test(path)).map(([path, message]) => (
        <small className="record-error" role="alert" key={path}>{path}: {message}</small>
      ))}
      {readOnly ? null : (
        <fieldset disabled={busy} className="map-guard">
          <legend>Rules a save would drop</legend>
          <p>Saving replaces the whole map, and Pane does not show Latte its private rules. These would be lost:</p>
          <ul aria-label="Rules that would be lost">
            {losses.map((loss) => <li key={`${loss.field}/${loss.rule}`}>{loss.field}: {loss.rule}</li>)}
            <li>Any unique or exists rule, SQL alias or access rule on this map (not visible here).</li>
          </ul>
          <div className="record-field">
            <label htmlFor="map-sql-name">Database table name (only if it differs from {table.table})</label>
            <input id="map-sql-name" value={edit.sqlName} aria-invalid={errors.sql_name ? true : undefined} onChange={(event) => patch({ sqlName: event.target.value })} />
            <small>Pane does not show the physical table name. Without it, a map bound to a prefixed or renamed table is rejected on save.</small>
            {errors.sql_name ? <small className="record-error" role="alert">{errors.sql_name}</small> : null}
          </div>
          <label htmlFor="map-override">
            <input id="map-override" type="checkbox" checked={override} onChange={(event) => setOverride(event.target.checked)} />
            {' '}Save anyway, dropping these rules
          </label>
        </fieldset>
      )}
      {failure ? <p role="alert">{failure}</p> : null}
      <div className="record-actions">
        {!readOnly ? <button className="button" type="submit" disabled={busy}>Save map</button> : null}
        <a className="button secondary" href="/maps">Back to maps</a>
      </div>
    </form>
  )
}

export function MapEditor({ context }: Props) {
  const { source = '', table = '' } = context.params
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error' } | { status: 'missing' } | { status: 'ready'; loaded: Loaded; saved: boolean }>({ status: 'loading' })

  useEffect(() => {
    let current = true
    setState({ status: 'loading' })
    context.maps.getTableMap(source, table)
      .then(({ document, etag }) => { if (current) setState({ status: 'ready', loaded: { table: document.data.attributes, etag }, saved: false }) })
      .catch((error: unknown) => {
        const status = paneErrorStatus(error)
        if (current) setState({ status: status === 403 || status === 404 ? 'missing' : 'error' })
      })
    return () => { current = false }
  }, [context.maps, source, table])

  if (state.status === 'loading') return <p aria-live="polite">Loading…</p>
  if (state.status === 'missing') return <h2>This map is not available.</h2>
  if (state.status === 'error') return <p role="alert">Pane could not load this map. Reload the page to try again.</p>

  return (
    <section className="record-page">
      <div className="record-toolbar"><h2>Map: {state.loaded.table.ui?.label?.trim() || state.loaded.table.table}</h2></div>
      {state.saved ? <p role="status">Map saved (version {state.loaded.table.version}).</p> : null}
      <MapForm
        // A new version remounts the form with Pane's own values.
        key={`${source}/${table}/${state.loaded.table.version}`}
        loaded={state.loaded}
        context={context}
        onSaved={(loaded) => setState({ status: 'ready', loaded, saved: true })}
      />
    </section>
  )
}

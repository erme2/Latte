import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  paneErrorCode,
  settingImage,
  settingImageMimeTypes,
  settingImageProblem,
  type SettingResource,
} from '@erme2/latte'
import type { ProductPageProps } from '../contract'
import type { ProductServices } from '../services'

type Props = ProductPageProps<ProductServices>

function settingFailureMessage(error: unknown): string {
  switch (paneErrorCode(error)) {
    case 'version_conflict': return 'Someone else changed this setting. Reload the page and try again.'
    case 'validation_failed': return 'Pane did not accept that value. Check it and try again.'
    case 'permission_denied': return 'Only administrators can change settings.'
    case 'rate_limited': return 'Too many changes. Try again in a moment.'
    default: return 'Pane could not complete the request. Try again.'
  }
}

function imageProblemMessage(problem: 'type' | 'size'): string {
  return problem === 'type' ? 'Use a PNG, JPEG or WebP image (no SVG).' : 'The image is larger than 2 MB.'
}

type RowProps = {
  setting: SettingResource
  busy: boolean
  onSet: (setting: SettingResource, value: string | number | boolean | null) => Promise<void>
  onUpload: (setting: SettingResource, file: File) => Promise<void>
  onProblem: (message: string) => void
}

function SettingRow({ setting, busy, onSet, onUpload, onProblem }: RowProps) {
  const { attributes } = setting
  const [draft, setDraft] = useState(() => String(attributes.value ?? ''))
  const label = attributes.label ?? attributes.key
  const id = `setting-${attributes.key}`
  const image = settingImage(attributes.value)

  function save(event: FormEvent) {
    event.preventDefault()
    if (attributes.type === 'number') {
      const number = Number(draft)
      if (draft.trim() === '' || !Number.isFinite(number)) return onProblem(`${label} needs a number.`)
      return void onSet(setting, number)
    }
    void onSet(setting, draft)
  }

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const problem = settingImageProblem(file)
    if (problem) return onProblem(imageProblemMessage(problem))
    void onUpload(setting, file)
  }

  return (
    <div className="resource-row setting-row">
      <div>
        <strong><label htmlFor={id}>{label}</label></strong>
        {attributes.help ? <span>{attributes.help}</span> : null}
      </div>
      {attributes.type === 'flag' ? (
        <div className="row-actions">
          <input id={id} type="checkbox" checked={attributes.value === true} disabled={busy}
            onChange={(event) => { void onSet(setting, event.target.checked) }} />
        </div>
      ) : attributes.type === 'image' ? (
        <div className="row-actions setting-image">
          {image ? <img src={image.url} alt={`${label}, current`} height="48" /> : <span>No image</span>}
          <input id={id} type="file" accept={settingImageMimeTypes.join(',')} disabled={busy} onChange={choose} />
          {image ? (
            <button className="button danger" type="button" disabled={busy}
              onClick={() => { void onSet(setting, null) }}>Remove</button>
          ) : null}
        </div>
      ) : (
        <form className="row-actions" onSubmit={save}>
          <input id={id} type={attributes.type === 'number' ? 'number' : 'text'}
            step={attributes.type === 'number' ? 'any' : undefined} value={draft} maxLength={2000}
            onChange={(event) => setDraft(event.target.value)} />
          <button className="button" type="submit"
            disabled={busy || draft === String(attributes.value ?? '')}>Save</button>
        </form>
      )}
    </div>
  )
}

export function Settings({ context }: Props) {
  const { settings } = context.services
  const [rows, setRows] = useState<SettingResource[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await settings.list())
      setError(null)
    } catch (failure) {
      setError(settingFailureMessage(failure))
    } finally {
      setLoading(false)
    }
  }, [settings])

  useEffect(() => { void load() }, [load])

  async function run(setting: SettingResource, action: () => Promise<SettingResource>) {
    setBusy(true)
    setSaved(null)
    try {
      const updated = await action()
      setRows((previous) => previous.map((row) => (row.id === updated.id ? updated : row)))
      setSaved(`${setting.attributes.label ?? setting.attributes.key} saved. Reload the page to see it in the header.`)
      setError(null)
    } catch (failure) {
      setError(settingFailureMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="admin-layout">
      <div className="page-heading">
        <div>
          <h2>Settings</h2>
          <p className="page-description">The name, tagline, logo and other settings of this install.</p>
        </div>
      </div>
      {error ? <p className="notice error" role="alert">{error}</p> : null}
      {saved ? <p className="notice" role="status">{saved}</p> : null}
      {loading ? <p aria-live="polite">Loading…</p> : rows.length === 0 ? <p>No settings are declared.</p> : (
        <div className="resource-list">
          {rows.map((row) => (
            <SettingRow key={`${row.id}-${row.attributes.version}`} setting={row} busy={busy}
              onSet={(setting, value) => run(setting, () => settings.set(setting.attributes, value))}
              onUpload={(setting, file) => run(setting, () => settings.upload(setting.attributes, file))}
              onProblem={(message) => { setSaved(null); setError(message) }} />
          ))}
        </div>
      )}
    </section>
  )
}

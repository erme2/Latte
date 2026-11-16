import { useEffect, useState } from 'react'
import type { TableMapResource } from '@erme2/latte'
import type { ProductPageProps } from './contract'
import type { ProductServices } from './services'

type PageProps = ProductPageProps<ProductServices>

export function Dashboard({ context }: PageProps) {
  return (
    <section className="activity">
      <div>
        <h2>{context.session.data.organization.attributes.name}</h2>
        <p>
          Signed in as {context.session.data.membership.attributes.role.replaceAll('_', ' ')}.
        </p>
      </div>
      <code>{context.services.connections.path}</code>
    </section>
  )
}

export function Connection({ context }: PageProps) {
  return <h2>Connection {context.params.connectionId}</h2>
}

// The table a maps menu item opens. Its list and edit views come with Latte#70.
export function Records({ context }: PageProps) {
  const { maps, params } = context
  const [table, setTable] = useState<TableMapResource['attributes'] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let current = true
    setTable(null)
    setFailed(false)
    maps.getTableMap(params.source ?? '', params.table ?? '')
      .then(({ document }) => { if (current) setTable(document.data.attributes) })
      .catch(() => { if (current) setFailed(true) })
    return () => { current = false }
  }, [maps, params.source, params.table])

  if (failed) return <h2>This table is not available.</h2>
  if (!table) return <p>Loading…</p>

  return (
    <section>
      <h2>{table.ui?.label ?? table.table}</h2>
      {table.ui?.description ?? table.description
        ? <p>{table.ui?.description ?? table.description}</p>
        : null}
    </section>
  )
}

export function Forbidden() {
  return <h2>You do not have access to this page.</h2>
}

export function NotFound() {
  return <h2>Page not found.</h2>
}

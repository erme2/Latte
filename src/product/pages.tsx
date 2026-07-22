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

export function Forbidden() {
  return <h2>You do not have access to this page.</h2>
}

export function NotFound() {
  return <h2>Page not found.</h2>
}

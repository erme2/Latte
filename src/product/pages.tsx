import type { ProductPageProps } from './contract'

export function Dashboard({ context }: ProductPageProps) {
  return (
    <section className="activity">
      <div>
        <h2>{context.session.data.organization.attributes.name}</h2>
        <p>
          Signed in as {context.session.data.membership.attributes.role.replaceAll('_', ' ')}.
        </p>
      </div>
      <code>{context.config.paneBaseUrl}/api/v1/session</code>
    </section>
  )
}

export function Forbidden() {
  return <h2>You do not have access to this page.</h2>
}

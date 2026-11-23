import { useEffect, useState } from 'react'
import { buildDashboardCards, type CrudRow, type DashboardCard } from '@erme2/latte'
import type { ProductPageProps } from '../contract'
import type { ProductServices } from '../services'

type Props = ProductPageProps<ProductServices>

type CardData =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; total: number | null; rows: CrudRow[] }

const cardKey = (card: DashboardCard) => `${card.source}/${card.table}`

function cell(value: unknown): string {
  if (value === null || value === undefined) return ''
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function DashboardCardView({ card, data }: { card: DashboardCard; data: CardData }) {
  const columns = card.columns.length > 0
    ? card.columns
    : data.status === 'ready' && data.rows[0] ? Object.keys(data.rows[0]).slice(0, 3) : []

  return (
    <article className="dashboard-card" aria-labelledby={`card-${card.table}`}>
      <h3 id={`card-${card.table}`}>{card.label}</h3>
      {data.status === 'loading' ? <p aria-live="polite">Loading…</p> : null}
      {data.status === 'error' ? <p role="alert">Pane could not load this card.</p> : null}
      {data.status === 'ready' ? (
        <>
          {card.count ? <p className="dashboard-count">{data.total === null ? '–' : data.total}</p> : null}
          {card.recent > 0 ? (
            data.rows.length === 0 ? <p>No records yet.</p> : (
              <table>
                <thead><tr>{columns.map((name) => <th key={name} scope="col">{name}</th>)}</tr></thead>
                <tbody>
                  {data.rows.map((row, index) => (
                    <tr key={index}>{columns.map((name) => <td key={name}>{cell(row[name])}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            )
          ) : null}
        </>
      ) : null}
    </article>
  )
}

export function Dashboard({ context }: Props) {
  const { crud } = context.services
  const [cards, setCards] = useState<DashboardCard[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [data, setData] = useState<Record<string, CardData>>({})

  useEffect(() => {
    let current = true
    const settle = (card: DashboardCard, value: CardData) => {
      if (current) setData((previous) => ({ ...previous, [cardKey(card)]: value }))
    }

    context.maps.getMaps()
      .then(({ document }) => {
        if (!current) return
        const built = buildDashboardCards(document.data.attributes.tables)
        setCards(built)
        for (const card of built) {
          // One row is enough for a count (Pane sends the total); recent rows are the newest by the configured sort.
          const query = { limit: Math.max(card.recent, 1), ...(card.sort ? { sort: card.sort, order: 'desc' as const } : {}) }
          crud.list(card.table, query)
            .then(({ rows, pagination }) => settle(card, { status: 'ready', total: pagination.total, rows: card.recent > 0 ? rows : [] }))
            .catch(() => settle(card, { status: 'error' }))
        }
      })
      .catch(() => { if (current) setFailed(true) })

    return () => { current = false }
  }, [context.maps, crud])

  return (
    <section className="dashboard-page">
      <div className="activity">
        <div>
          <h2>{context.session.data.application.attributes.name}</h2>
          <p>Signed in as {context.session.data.user.attributes.role === 'admin' ? 'administrator' : 'user'}.</p>
        </div>
      </div>
      {failed ? <p role="alert">The dashboard could not be loaded from Pane. Reload the page to try again.</p> : null}
      {cards !== null && cards.length === 0 ? <p>No dashboard cards are configured in the maps yet.</p> : null}
      <div className="dashboard-cards">
        {(cards ?? []).map((card) => (
          <DashboardCardView key={cardKey(card)} card={card} data={data[cardKey(card)] ?? { status: 'loading' }} />
        ))}
      </div>
    </section>
  )
}

import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { todayISO } from '../domain/dates'
import { computeOverview, type Overview } from '../domain/finance'
import type { CreditCard, Person, Transaction } from '../domain/types'
import { db } from './db'

export interface MoneyData {
  transactions: Transaction[]
  cards: CreditCard[]
  people: Person[]
  cardsById: Map<string, CreditCard>
  peopleById: Map<string, Person>
  overview: Overview
  today: string
}

/**
 * Live view of all records. Re-renders automatically whenever IndexedDB
 * changes (including from another tab). Returns undefined while loading.
 */
export function useMoneyData(): MoneyData | undefined {
  const raw = useLiveQuery(
    () =>
      db.transaction('r', db.cards, db.people, db.transactions, async () => ({
        transactions: await db.transactions.orderBy('date').reverse().toArray(),
        cards: await db.cards.toArray(),
        people: await db.people.toArray(),
      })),
    [],
  )

  return useMemo(() => {
    if (!raw) return undefined
    const today = todayISO()
    const cards = [...raw.cards].sort((a, b) => a.nickname.localeCompare(b.nickname))
    const people = [...raw.people].sort((a, b) => a.name.localeCompare(b.name))
    // Newest first; same-day entries by creation time.
    const transactions = [...raw.transactions].sort((a, b) =>
      a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date),
    )
    return {
      transactions,
      cards,
      people,
      cardsById: new Map(cards.map((c) => [c.id, c])),
      peopleById: new Map(people.map((p) => [p.id, p])),
      overview: computeOverview(transactions, cards, people, today),
      today,
    }
  }, [raw])
}

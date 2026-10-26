/**
 * DEVELOPMENT PREVIEW DATA ONLY.
 * Loaded exclusively into the separate sample database (see db.ts) and only
 * imported behind `import.meta.env.DEV`, so it is never part of a production
 * build and never touches real records.
 */
import { addDays, todayISO } from '../domain/dates'
import type { CreditCard, Person, Transaction } from '../domain/types'
import type { MoneyDB } from './db'

const R = (rupees: number) => Math.round(rupees * 100)

export async function loadSampleData(db: MoneyDB): Promise<void> {
  const today = todayISO()
  const d = (n: number) => addDays(today, -n)
  const ts = new Date().toISOString()
  const cards: CreditCard[] = [
    { id: 'card-hdfc', nickname: 'HDFC Millennia', bankName: 'HDFC Bank', last4: '4321', creditLimit: R(150000), billingDay: 5, dueDay: 25, archived: false, createdAt: ts, updatedAt: ts },
    { id: 'card-sbi', nickname: 'SBI SimplyCLICK', bankName: 'SBI Card', last4: '8765', creditLimit: R(80000), billingDay: 18, dueDay: 7, archived: false, createdAt: ts, updatedAt: ts },
  ]
  const people: Person[] = [
    { id: 'p-ravi', name: 'Ravi', notes: 'College friend', createdAt: ts, updatedAt: ts },
    { id: 'p-asha', name: 'Asha (sister)', notes: '', createdAt: ts, updatedAt: ts },
  ]
  let i = 0
  const t = (p: Partial<Transaction> & Pick<Transaction, 'type' | 'amount' | 'description' | 'date'>): Transaction => {
    i += 1
    return {
      id: `sample-${String(i)}`,
      category: 'Other',
      paymentMethod: 'upi',
      cardId: null,
      merchant: '',
      personId: null,
      recoverableAmount: 0,
      returnDirection: null,
      adjustmentTarget: null,
      adjustmentDirection: null,
      linkedTransactionId: null,
      notes: '',
      createdAt: new Date(Date.now() + i).toISOString(),
      updatedAt: ts,
      ...p,
    }
  }
  const transactions: Transaction[] = [
    t({ type: 'purchase', amount: R(25000), date: d(40), description: 'Vivo V30 phone', category: 'Electronics & Mobiles', merchant: 'Vivo official store', paymentMethod: 'credit_card', cardId: 'card-hdfc' }),
    t({ type: 'card_payment', amount: R(5000), date: d(20), description: 'HDFC bill part payment', category: 'Credit card bill', paymentMethod: 'net_banking', cardId: 'card-hdfc' }),
    t({ type: 'purchase', amount: R(2000), date: d(15), description: 'Earbuds for Ravi', category: 'Electronics & Mobiles', merchant: 'Amazon', paymentMethod: 'credit_card', cardId: 'card-sbi', personId: 'p-ravi', recoverableAmount: R(2000) }),
    t({ type: 'lent', amount: R(1000), date: d(12), description: 'Cash for movie tickets', category: 'Personal transfer', paymentMethod: 'upi', personId: 'p-ravi' }),
    t({ type: 'returned', amount: R(500), date: d(5), description: 'Ravi returned part', category: 'Personal transfer', paymentMethod: 'upi', personId: 'p-ravi', returnDirection: 'to_me', linkedTransactionId: 'sample-4' }),
    t({ type: 'cashback', amount: R(800), date: d(8), description: 'Flipkart cashback', category: 'Cashback & rewards', merchant: 'Flipkart', paymentMethod: 'credit_card', cardId: 'card-sbi' }),
    t({ type: 'purchase', amount: R(1499), date: d(3), description: 'Phone case & charger', category: 'Shopping', merchant: 'Flipkart', paymentMethod: 'credit_card', cardId: 'card-sbi' }),
    t({ type: 'refund', amount: R(499), date: d(1), description: 'Charger returned', category: 'Shopping', merchant: 'Flipkart', paymentMethod: 'credit_card', cardId: 'card-sbi', linkedTransactionId: 'sample-7' }),
    t({ type: 'borrowed', amount: R(3000), date: d(10), description: 'Borrowed for rent', category: 'Personal transfer', paymentMethod: 'upi', personId: 'p-asha' }),
    t({ type: 'received', amount: R(200), date: d(2), description: 'Birthday gift', category: 'Income', paymentMethod: 'upi' }),
  ]
  await db.transaction('rw', db.cards, db.people, db.transactions, async () => {
    await Promise.all([db.cards.clear(), db.people.clear(), db.transactions.clear()])
    await db.cards.bulkAdd(cards)
    await db.people.bulkAdd(people)
    await db.transactions.bulkAdd(transactions)
  })
}

export async function seedIfEmpty(db: MoneyDB): Promise<void> {
  if ((await db.transactions.count()) === 0 && (await db.cards.count()) === 0) await loadSampleData(db)
}

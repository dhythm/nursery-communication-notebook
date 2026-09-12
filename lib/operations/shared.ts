import type { Database } from '@/lib/db'

export type OperationDatabase = Pick<Database, 'query'>

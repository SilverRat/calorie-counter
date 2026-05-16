import mysql, { type Pool, type RowDataPacket, type ResultSetHeader } from 'mysql2/promise'

let pool: Pool | null = null

export type DbRow = RowDataPacket
export type DbResult = ResultSetHeader

export function getPool() {
  if (pool) return pool

  const host = process.env.MYSQL_HOST
  const user = process.env.MYSQL_USER
  const password = process.env.MYSQL_PASSWORD
  const database = process.env.MYSQL_DATABASE
  const port = Number(process.env.MYSQL_PORT || 3306)

  if (!host || !user || !database) {
    throw new Error('MySQL configuration missing')
  }

  pool = mysql.createPool({
    host,
    user,
    password,
    database,
    port,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
    namedPlaceholders: true,
    timezone: 'Z',
    charset: 'utf8mb4'
  })

  return pool
}

export async function query<T extends DbRow[]>(sql: string, params?: any[]) {
  const [rows] = await getPool().query<T>(sql, params)
  return rows
}

export async function execute(sql: string, params?: any[]) {
  const [result] = await getPool().execute<DbResult>(sql, params)
  return result
}

export function uuid() {
  return crypto.randomUUID()
}

export function mysqlDate(input: string | Date) {
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date')
  return d.toISOString().slice(0, 23).replace('T', ' ')
}

export function jsonParam(value: unknown) {
  return value == null ? null : JSON.stringify(value)
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database, EdgeFunctionName } from '@possibility/shared-types'

export type PossibilityClient = SupabaseClient<Database>

export interface ClientConfig {
  supabaseUrl: string
  supabaseAnonKey: string
}

export function createPossibilityClient(config: ClientConfig): PossibilityClient {
  return createClient<Database>(config.supabaseUrl, config.supabaseAnonKey)
}

export async function invokeFunction<T>(
  client: PossibilityClient,
  name: EdgeFunctionName,
  body?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.functions.invoke<T>(name, { body })
  if (error) throw error
  return data as T
}

export type { Database, EdgeFunctionName }

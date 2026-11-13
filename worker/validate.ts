import type { Context } from 'hono'
import type { z } from 'zod'

import { HttpError } from './env'

export async function parseBody<S extends z.ZodType>(c: Context, schema: S): Promise<z.infer<S>> {
  let raw: unknown
  try {
    raw = await c.req.json()
  } catch {
    throw new HttpError(400, 'Expected a JSON body')
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new HttpError(
      422,
      issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'Invalid body',
    )
  }
  return parsed.data
}

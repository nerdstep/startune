import { zValidator } from '@hono/zod-validator'
import type { z } from 'zod'

import { HttpError } from './env'

/**
 * Route middleware that validates the JSON body (or the query string) with a zod schema. The
 * parsed value is `c.req.valid('json' | 'query')`, and its type reaches the browser through Hono
 * RPC. A failure is a 422 naming the first bad field, the same `{ error }` shape as every API error.
 */
export const valid = <T extends 'json' | 'query', S extends z.ZodType>(target: T, schema: S) =>
  zValidator(target, schema, (result) => {
    if (!result.success) {
      const issue = result.error.issues[0]
      throw new HttpError(
        422,
        issue ? `${issue.path.join('.') || target}: ${issue.message}` : `Invalid ${target}`,
      )
    }
  })

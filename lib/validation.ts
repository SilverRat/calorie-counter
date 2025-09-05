import { z } from 'zod'

export const mealType = z.enum(['breakfast', 'lunch', 'dinner', 'snack'])

const datetimeWithTz = z.string().refine((v) => {
  if (typeof v !== 'string') return false
  if (!(/[zZ]|[+-]\d{2}:\d{2}$/.test(v))) return false
  return !Number.isNaN(Date.parse(v))
}, { message: 'Invalid datetime' })

export const addEntrySchema = z.object({
  occurred_at: datetimeWithTz,
  meal_type: mealType,
  item_name: z.string().min(1).max(160),
  calories: z.number().int().min(0).max(5000),
  protein: z.number().int().min(0).max(500).optional(),
  carbs: z.number().int().min(0).max(1000).optional(),
  fat: z.number().int().min(0).max(500).optional(),
  notes: z.string().max(500).optional(),
  confidence: z.number().min(0).max(1).optional()
})

export const updateEntrySchema = z.object({
  occurred_at: datetimeWithTz.optional(),
  meal_type: mealType.optional(),
  item_name: z.string().min(1).max(160).optional(),
  calories: z.number().int().min(0).max(5000).optional(),
  protein: z.number().int().min(0).max(500).optional(),
  carbs: z.number().int().min(0).max(1000).optional(),
  fat: z.number().int().min(0).max(500).optional(),
  notes: z.string().max(500).optional()
}).refine(obj => Object.keys(obj).length > 0, { message: 'No fields to update' })

export const rangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
})

import { z } from 'zod'

export const ProjectSchema = z.object({
  title: z.string().min(1, 'Titel erforderlich').max(200),
  genre: z.string().default(''),
  format: z.string().default('Kurzfilm'),
  length_minutes: z.coerce.number().int().min(0).default(0),
  status: z.string().default('Vorproduktion'),
  synopsis: z.string().default(''),
  director: z.string().default(''),
  producer: z.string().default(''),
  dop: z.string().default(''),
  production_company: z.string().default(''),
  shoot_start: z.string().optional(),
  shoot_end: z.string().optional(),
  // 'film' = klassische Produktion, 'creator' = Content-/YouTube-Kanal.
  // Wird sonst aus dem Format abgeleitet.
  project_kind: z.enum(['film', 'creator']).optional(),
})

export const RegisterSchema = z.object({
  email: z.string().email('Ungültige E-Mail'),
  password: z.string().min(8, 'Passwort mindestens 8 Zeichen'),
  name: z.string().min(1, 'Name erforderlich'),
})

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const SceneSchema = z.object({
  scene_number: z.string().default(''),
  title: z.string().default(''),
  description: z.string().default(''),
  int_ext: z.enum(['INT', 'EXT', 'INT/EXT']).default('INT'),
  day_night: z.enum(['TAG', 'NACHT', 'DÄMMERUNG']).default('TAG'),
  eighths: z.coerce.number().int().min(0).max(64).default(8),
  estimated_minutes: z.coerce.number().int().min(0).default(60),
  notes: z.string().default(''),
})

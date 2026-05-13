import { Router, Request, Response } from 'express'
import { db } from '../db'
import Anthropic from '@anthropic-ai/sdk'

const router = Router()

// POST /api/scenes/:sceneId/ai-breakdown
router.post('/scenes/:sceneId/ai-breakdown', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ data: null, error: 'KI nicht konfiguriert — ANTHROPIC_API_KEY fehlt' })
    }

    const { sceneId } = req.params

    // 1. Get scene
    const scene = await db.get('SELECT * FROM scenes WHERE id = ?', [sceneId]) as any
    if (!scene) return res.status(404).json({ data: null, error: 'Szene nicht gefunden' })

    // 2. Get screenplay blocks
    const blocks = await db.all(`
      SELECT * FROM screenplay_blocks WHERE scene_id = ? ORDER BY sort_order ASC
    `, [sceneId]) as any[]

    // 3. Build scene text from blocks
    const sceneText = blocks.map((block: any) => {
      switch (block.block_type) {
        case 'scene_heading':
          return block.content?.toUpperCase() || ''
        case 'action':
          return block.content || ''
        case 'character':
          return `\n${block.content?.toUpperCase() || ''}`
        case 'dialogue':
          return block.content || ''
        case 'parenthetical':
          return `(${block.content || ''})`
        case 'transition':
          return `\n${block.content?.toUpperCase() || ''}`
        default:
          return block.content || ''
      }
    }).filter(Boolean).join('\n')

    if (!sceneText.trim()) {
      return res.status(400).json({ data: null, error: 'Szene hat keinen Text für die Analyse' })
    }

    // 4. Call Anthropic API
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const msg = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Du bist ein erfahrener Script Supervisor. Analysiere den folgenden Szenentext und extrahiere alle Produktionselemente.\nAntworte NUR mit einem JSON-Objekt:\n{\n  "requisite": [],\n  "kostüm": [],\n  "maske": [],\n  "sfx": [],\n  "vfx": [],\n  "fahrzeuge": [],\n  "tiere": [],\n  "waffen": [],\n  "ton": [],\n  "sonstiges": []\n}\n\nSzenentext:\n${sceneText}`,
      }],
    })

    // 5. Parse JSON from response
    const responseText = msg.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('')

    let parsed: Record<string, string[]>
    try {
      // Extract JSON from response (model may include surrounding text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Kein JSON im Response')
      parsed = JSON.parse(jsonMatch[0])
    } catch (parseErr) {
      console.error('[aiBreakdown] JSON parse error:', parseErr, 'Response was:', responseText)
      return res.status(500).json({ data: null, error: 'KI-Antwort konnte nicht verarbeitet werden' })
    }

    // 6. Check existing scene_inventory items to find already-existing ones
    const existingInventory = await db.all(`
      SELECT * FROM scene_inventory WHERE scene_id = ?
    `, [sceneId]) as any[]

    const existingItems = existingInventory.map((i: any) => i.item.toLowerCase())

    const newItems: Array<{ category: string; item: string }> = []
    const alreadyExistingItems: Array<{ category: string; item: string; inventory: any }> = []

    const categoryMap: Record<string, string> = {
      'requisite': 'Requisite',
      'kostüm': 'Kostüm',
      'maske': 'Maske',
      'sfx': 'SFX',
      'vfx': 'VFX',
      'fahrzeuge': 'Fahrzeuge',
      'tiere': 'Tiere',
      'waffen': 'Waffen',
      'ton': 'Ton',
      'sonstiges': 'Sonstiges',
    }

    for (const [key, items] of Object.entries(parsed)) {
      if (!Array.isArray(items)) continue
      const category = categoryMap[key] || key

      for (const item of items) {
        if (typeof item !== 'string' || !item.trim()) continue

        const itemLower = item.toLowerCase()
        const existingMatch = existingInventory.find(
          (inv: any) => inv.item.toLowerCase() === itemLower
        )

        if (existingMatch) {
          alreadyExistingItems.push({ category, item: item.trim(), inventory: existingMatch })
        } else {
          newItems.push({ category, item: item.trim() })
        }
      }
    }

    // 7. Return results
    res.json({
      data: {
        new_items: newItems,
        existing_items: alreadyExistingItems,
        raw: parsed,
      },
      error: null,
    })
  } catch (err: any) {
    console.error('[aiBreakdown POST]', err)
    res.status(500).json({ data: null, error: err.message || 'Interner Serverfehler' })
  }
})

export default router

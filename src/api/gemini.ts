import type {
  UserProfile,
  WorkoutSession,
  Program,
  ProgramDay,
} from '../types'

// All Gemini calls go through the Netlify proxy function to avoid CORS issues
// and keep the API key server-side.
const GEMINI_PROXY = '/api/gemini'
const MODEL = 'gemini-2.5-flash'

/** Call the Edge Function proxy. Returns full text when complete. */
async function callProxy(body: {
  prompt: string
  systemInstruction?: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  maxTokens?: number
  enableSearch?: boolean
}): Promise<{ text: string; searchUsed: boolean }> {
  const res = await fetch(GEMINI_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, ...body }),
  })

  // Always read raw text first — Netlify can return plain-text errors
  const rawText = await res.text()
  let data: { text?: string; searchUsed?: boolean; error?: string }
  try {
    data = JSON.parse(rawText)
  } catch {
    // Netlify returned non-JSON (e.g. "the edge function returned an error")
    throw new Error(`Erreur serveur: ${rawText.slice(0, 200)}`)
  }

  if (!res.ok) throw new Error(data.error ?? `Proxy error ${res.status}`)
  return { text: data.text ?? '', searchUsed: !!data.searchUsed }
}

/** Detect if the user message likely needs a web search for accuracy */
function needsSearch(message: string): boolean {
  const triggers = [
    /supplément|créatine|protéine|bcaa|caféine|collagène|oméga|whey/i,
    /étude|prouvé|recherche|scientifique|vrai que/i,
    /j'ai lu|j'ai vu|on dit que|paraît que/i,
    /optimal|meilleur|efficace|combien exactement/i,
    /blessure|douleur|tendon|articulation/i,
    /technique|comment faire|placement/i,
    /fenêtre anabolique|timing|avant après séance/i,
    /ice bath|sauna|cryothérapie|foam rolling/i,
  ]
  return triggers.some(t => t.test(message))
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

export const COACH_SYSTEM_PROMPT = `Tu es APEX, un préparateur physique et coach de récupération d'élite — le niveau d'un staff médico-sportif de star NBA ou équipe de F1.
Tu gères l'INTÉGRALITÉ de l'hygiène sportive de l'athlète : entraînement, récupération, sommeil, nutrition de timing, suppléments, gestion de la charge, état psychologique.

## TES DOMAINES D'EXPERTISE

### Entraînement (Science de la force et de l'hypertrophie)
- Volume : MEV → MAV → MRV (Mike Israetel), progression sur 4-6 semaines → deload
- Surcharge progressive : +2.5kg ou +1-2 reps dès que haut de fourchette à RPE ≤ 8
- RPE travail : 7-9 (1-3 reps en réserve)
- DUP (Daily Undulating Periodization) pour intermédiaires/avancés
- Fréquence minimum : 2×/semaine par groupe musculaire
- 1RM estimé (Epley) : poids × (1 + reps/30)

### Récupération (Science de la récupération)
- Fenêtre anabolique : les 2h post-séance sont critiques (nutrition, whey, repos actif)
- DOMS vs blessure : distinguer douleur musculaire (OK) de douleur articulaire (STOP)
- Surmentraînement : énergie ≤ 2/5 sur 3 sessions consécutives → deload immédiat
- Récupération active : marche légère, mobilité le lendemain d'une séance lourde
- Temps de récupération par groupe musculaire : 48-72h minimum entre sessions lourdes

### Sommeil (Science du sommeil et performance)
- Besoin optimal athlète : 8-9h (vs 7h pour sédentaire)
- < 6h de sommeil : -10-30% de force, -40% d'endurance, cortisol +21%
- Timing entraînement : éviter 3h avant le coucher (cortisol)
- Recommande heure de coucher basée sur heure de réveil souhaitée - 8.5h
- Magnésium + ZMA le soir améliorent la qualité du sommeil
- Stratégies : obscurité totale, chambre froide (18-19°C), pas d'écrans 1h avant

### Suppléments (Timing optimal basé sur la science)
- Créatine : 3-5g/jour, moment importe peu (post-séance si possible)
- Whey : 20-40g dans les 30 min post-séance
- Caféine : 3-6mg/kg, 45-60 min avant séance, pas après 14h (qualité sommeil)
- Oméga-3 : 2-4g/jour avec repas gras (absorption)
- Vitamine D : 2000-4000 UI matin avec repas gras
- Magnésium : 300-400mg le soir (relaxation, sommeil)
- BCAA : utiles uniquement si entraînement à jeun ou calorie deficit important
- ZMA : 30-60 min avant coucher, à jeun

### Nutrition de timing (Périnutrition)
- Pre-workout (90-120 min avant) : glucides complexes + protéines légères
- Post-workout (dans les 30 min) : whey + glucides rapides (ratio 3:1 glucides/protéines)
- Fenêtre anabolique est réelle mais moins stricte qu'on croyait — total journalier prime
- Hydratation : 35-40ml/kg/jour + 500ml par heure d'entraînement intense
- Déficit calorique et musculation : max -300-500 kcal/jour pour préserver la masse

### Gestion de la charge (Load Management)
- Ratio charge aiguë/chronique (ACWR) : idéal 0.8-1.3, danger > 1.5
- Indicateurs de surcharge : FC repos élevée matin, humeur basse, performances en baisse
- Planification : périodisation ondulante hebdomadaire, deload semaine 4 de chaque mois
- "Junk volume" : séries au-delà du MRV → récupération pire, gains nuls
- Si fatigue aiguë : mieux vaut réduire le volume ET maintenir l'intensité

### Santé mentale et motivation
- Corrélation stress chronique / cortisol / prise de masse négative
- Burnout sportif : signes → perte de motivation, performance stagnante, irritabilité
- Objectifs SMART : spécifique, mesurable, atteignable, réaliste, temporel
- Visualisation et protocoles mentaux des athlètes d'élite

## COMPORTEMENT

### Proactivité
- Si sommeil < 6h détecté : propose ajustement du volume de séance
- Si énergie ≤ 2/5 deux fois d'affilée : recommande repos ou séance légère
- Si courbatures sévères (4-5/5) : déconseille séance du même groupe musculaire
- Si stress ≥ 4/5 : recommande réduction intensité, plus de récupération active
- Rappelle les suppléments dans les analyses si pertinent
- Tous les dimanches : revue hebdomadaire complète

### Style de communication
- Français, direct, factuel, motivant — comme un vrai prépa physique de star
- Chiffres concrets : "couche-toi à 22h30 pour 8h de sommeil avant ton réveil à 7h"
- Jamais condescendant, jamais vague
- Cite la science brièvement quand c'est pertinent
- Max 150 mots sauf si analyse complexe demandée

## VEILLE SCIENTIFIQUE — COMPORTEMENT RECHERCHE

Tu as accès à Google Search. Utilise-le intelligemment — pas à chaque message, mais quand c'est pertinent.

QUAND TU CHERCHES :
- Question nutrition précise → tu vérifies les méta-analyses récentes
- Protocole récupération (ice bath, sauna, foam rolling...) → études 2023-2025
- Supplément mentionné → tu vérifies l'efficacité réelle, pas le marketing
- Pattern inhabituel (stagnation, fatigue persistante, douleur) → tu cherches les causes
- Affirmation que l'athlète a lue quelque part → tu vérifies si c'est à jour

INTÉGRATION :
- Tu n'écris pas "selon l'étude de Smith...". Tu intègres naturellement.
- Tu distingues consensus fort vs études préliminaires
- Tu corriges tes recommandations si tu trouves de nouvelles données
- Tu ne donnes jamais un conseil nutritionnel précis sans vérifier

Tu te tiens à jour : Brad Schoenfeld (hypertrophie), Eric Helms (nutrition), Mike Israetel (volume), ISSN, PubMed.

## CONTEXTE REÇU
Chaque requête inclut : profil complet, dernières séances (10), données wellness (sommeil, stress, courbatures), programme actif, PRs actuels, suppléments déclarés.`

// ---------------------------------------------------------------------------
// Interview helper — APEX conducts a targeted athlete interview
// ---------------------------------------------------------------------------

const INTERVIEW_SYSTEM = `Tu es APEX, coach IA d'élite. Tu dois comprendre VRAIMENT cet athlète pour bâtir le programme parfait.

PHILOSOPHIE : Un vrai coach ne suit pas un script. Il écoute, creuse, adapte. Il cherche ce que l'athlète veut VRAIMENT — pas la catégorie qu'il a cochée, mais l'objectif concret, vivant, avec une date, une image, une raison.

RÈGLE UNIQUE : Une seule question par message. Directe. En tutoiement. Sans flatterie.

CE QUE TU DOIS DÉCOUVRIR (dans l'ordre naturel de la conversation) :
1. L'objectif RÉEL — pas "hypertrophie" en catégorie, mais "être massif cet été", "peser 90kg sec", "courir un 10km en moins de 45min", etc. La date compte autant que l'objectif.
2. Le niveau actuel — charges de référence (bench/squat/deadlift si dispo), ce qu'il fait maintenant, depuis combien de temps.
3. Ce qui a marché ou bloqué — historique de programmes, plateaux, erreurs passées.
4. Les contraintes réelles — blessures, douleurs, disponibilité vraie, récupération (sommeil, stress, boulot).
5. Ce que TU n'as pas encore — le dernier point flou qui empêche de personnaliser parfaitement.

ERREURS À NE PAS FAIRE :
- Ne jamais supposer l'objectif depuis la catégorie. "Hypertrophie" peut vouloir dire "être massif en juillet" ou "juste ne pas être maigre".
- Ne pas poser de questions génériques type "comment tu te sens ?" ou "quels sont tes objectifs ?" — trop vague.
- Ne pas répéter les infos déjà données (poids, équipement, jours dispo).
- Ne pas enchaîner plusieurs questions dans le même message.

STYLE : Coach pro direct, pas de blabla, tutoiement, questions précises comme un vrai entretien de coach.

Réponds UNIQUEMENT avec la question. Rien d'autre.`

export async function callInterview(
  profile: { name: string; weight: number; goal: string; daysPerWeek: number; availableEquipment: string[] },
  history: Array<{ role: 'apex' | 'user'; text: string }>,
  questionNumber: number
): Promise<string> {
  const historyForProxy = history.map(m => ({
    role: m.role === 'apex' ? 'assistant' : 'user' as 'user' | 'assistant',
    content: m.text,
  }))

  const totalQuestions = 5

  // Question 1 is ALWAYS about the real objective — not assumed from the profile category
  const q1Directive = questionNumber === 1
    ? `PREMIÈRE QUESTION OBLIGATOIRE : Demande-lui son objectif CONCRET et précis — pas la catégorie, le vrai but avec si possible une date ou une échéance. Ex : "C'est quoi exactement ton objectif là maintenant — t'as une date butoir, un événement, une image précise en tête ?"`
    : questionNumber === totalQuestions
    ? `DERNIÈRE QUESTION : Identifie ce qui manque encore pour personnaliser parfaitement. Creuse le point le moins clair de la conversation.`
    : `Question ${questionNumber}/${totalQuestions} — basée sur tout ce qui précède, pose la question la plus utile pour compléter ton image de cet athlète.`

  const context = `
Athlète : ${profile.name}, ${profile.weight}kg, ${profile.daysPerWeek}j/sem
Équipement : ${profile.availableEquipment.join(', ')}
Catégorie choisie : ${profile.goal} (à approfondir — ne pas supposer l'objectif réel)

${q1Directive}
`.trim()

  const { text } = await callProxy({
    prompt: context,
    systemInstruction: INTERVIEW_SYSTEM,
    history: historyForProxy,
    maxTokens: 200,
    enableSearch: false,
  })

  return text.trim()
}

// ---------------------------------------------------------------------------
// Core helper — via proxy (no streaming, but clean loading states in UI)
// ---------------------------------------------------------------------------

export async function streamResponse(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  onChunk: (text: string) => void,
  onComplete: (fullText: string) => void,
  onError: (error: Error) => void,
  systemExtra?: string,
  onSearchStart?: () => void,
  onSearchDone?: () => void,
): Promise<void> {
  try {
    const history = messages.slice(0, -1)
    const lastMessage = messages[messages.length - 1]
    const systemInstruction = systemExtra
      ? `${COACH_SYSTEM_PROMPT}\n\n${systemExtra}`
      : COACH_SYSTEM_PROMPT

    // Enable Google Search only when the message likely needs it (saves 5-10s)
    const enableSearch = needsSearch(lastMessage.content)
    const searchHint = enableSearch
      ? '\n⚑ RECHERCHE PROBABLEMENT UTILE ICI — vérifie avant de répondre.'
      : ''

    if (enableSearch && onSearchStart) onSearchStart()

    const { text, searchUsed } = await callProxy({
      prompt: lastMessage.content + searchHint,
      systemInstruction,
      history,
      maxTokens: 2048,
      enableSearch,
    })

    if (searchUsed && onSearchStart) onSearchStart()
    if (onSearchDone) onSearchDone()

    // Simulate word-by-word streaming for natural chat feel
    const words = text.split(' ')
    for (const word of words) {
      onChunk(word + ' ')
      await new Promise(r => setTimeout(r, 15))
    }
    onComplete(text)
  } catch (err) {
    if (onSearchDone) onSearchDone()
    onError(err instanceof Error ? err : new Error('Gemini API error'))
  }
}

// ---------------------------------------------------------------------------
// JSON repair — handles truncated responses
// ---------------------------------------------------------------------------

function repairTruncatedJSON(raw: string): string {
  // Strip markdown fences
  let s = raw.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/\s*```$/m, '').trim()

  // Find the first JSON start
  const startIdx = s.search(/[{[]/)
  if (startIdx === -1) throw new Error('No JSON structure found in response')
  s = s.slice(startIdx)

  // Walk character by character tracking state
  const stack: string[] = []
  let inString = false
  let escaped = false
  let lastTopLevelClose = -1

  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (escaped) { escaped = false; continue }
    if (c === '\\' && inString) { escaped = true; continue }
    if (c === '"') { inString = !inString; continue }
    if (inString) continue

    if (c === '{' || c === '[') {
      stack.push(c === '{' ? '}' : ']')
    } else if (c === '}' || c === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === c) {
        stack.pop()
        if (stack.length === 0) lastTopLevelClose = i
      }
    }
  }

  // Case 1: complete JSON found — use it
  if (lastTopLevelClose !== -1) {
    const candidate = s.slice(0, lastTopLevelClose + 1)
    try { JSON.parse(candidate); return candidate } catch { /* fall through */ }
  }

  // Case 2: truncated — close open strings then brackets
  if (inString) s += '"'
  s = s.trimEnd()

  // Remove trailing comma before closing (invalid JSON)
  s = s.replace(/,\s*$/, '')

  // Close all open brackets
  for (let i = stack.length - 1; i >= 0; i--) {
    s += stack[i]
  }

  JSON.parse(s) // throws if still invalid
  return s
}

// ---------------------------------------------------------------------------
// JSON generation helper — with auto-repair and retry
// ---------------------------------------------------------------------------

export async function generateJSON<T>(
  prompt: string,
  options?: { enableSearch?: boolean; maxTokens?: number }
): Promise<T> {
  // 7 000 tokens: enough for a 4-week program and safe within Vercel's 30s edge timeout
  const maxTokens = options?.maxTokens ?? 7000

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= 1; attempt++) {
    const effectivePrompt = attempt === 0
      ? prompt
      : prompt + '\n\n⚠️ PRIORITÉ ABSOLUE: JSON ULTRA-COMPACT. Ferme TOUS les { } [ ]. Pas de texte superflu.'

    try {
      const { text } = await callProxy({
        prompt: effectivePrompt,
        systemInstruction: COACH_SYSTEM_PROMPT,
        maxTokens,
        enableSearch: options?.enableSearch ?? false,
      })

      const repaired = repairTruncatedJSON(text)
      return JSON.parse(repaired) as T
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`[generateJSON] attempt ${attempt + 1} failed:`, lastError.message.slice(0, 80))
    }
  }

  throw lastError ?? new Error('generateJSON failed after 2 attempts')
}

// ---------------------------------------------------------------------------
// Prompt builders — unchanged, model-agnostic
// ---------------------------------------------------------------------------

export function buildFeasibilityPrompt(profile: UserProfile): string {
  return `
Tu es APEX. Évalue la faisabilité de l'objectif de cet athlète.

PROFIL :
- Nom : ${profile.name}
- Âge : ${profile.age} ans
- Poids : ${profile.weight} kg | Taille : ${profile.height} cm
- Expérience : ${profile.experience}
- Objectif principal : ${profile.goal}
- Description de l'objectif : ${profile.goalDescription}
- Jours d'entraînement/semaine : ${profile.daysPerWeek}
- Blessures/limitations : ${profile.injuries || 'Aucune'}
- Équipements disponibles : ${profile.availableEquipment.join(', ')}

TÂCHE : Analyse si l'objectif est réaliste au regard du profil.

Réponds UNIQUEMENT avec un JSON valide (aucun wrapper markdown) :
{
  "feasible": boolean,
  "message": "Analyse directe en 2-3 phrases avec chiffres concrets",
  "adjustedGoal": "Objectif ajusté si nécessaire, sinon null",
  "timeline": "Délai réaliste ex: '3-4 mois pour -5kg'"
}
`
}

export function buildProgramPrompt(
  profile: UserProfile,
  history: WorkoutSession[],
  interviewContext?: string
): string {
  const hasHistory = history.length > 0
  const recentSessions = history.slice(-8)
  const historyText = hasHistory
    ? recentSessions
        .map(s => `- ${s.dayName} (${new Date(s.date).toLocaleDateString('fr-FR')}): volume=${s.totalVolume}kg, humeur=${s.mood}/5, énergie=${s.energy}/5`)
        .join('\n')
    : 'Aucun historique disponible (premier programme)'

  return `
Tu es APEX. Génère un programme 4 semaines ultra-personnalisé. JSON COMPACT uniquement.

${interviewContext ? `╔══ ENTRETIEN ATHLÈTE — LIS TOUT, ADAPTE TOUT ══╗
${interviewContext}
╚════════════════════════════════════════════════╝

ANALYSE L'ENTRETIEN avant de générer :
- Quel est l'objectif RÉEL et la date butoir ? → calibre l'intensité et le volume en conséquence
- Quel est le niveau réel ? → adapte les charges, le volume, la complexité des exercices
- Quelles sont les contraintes ? → évite les exercices problématiques, respecte la récupération
- Qu'est-ce qui a bloqué avant ? → ne répète pas les erreurs passées

` : ''}PROFIL: ${profile.weight}kg | ${profile.goal} | ${profile.daysPerWeek}j/sem | ${profile.availableEquipment.join('+')}
${profile.injuries ? `⚠️ BLESSURES/LIMITATIONS: ${profile.injuries}` : ''}
${hasHistory ? `HISTORIQUE RÉCENT (utilise pour calibrer les volumes de départ):\n${historyText}` : ''}

PRINCIPES:
- Sem1→3: accumulation (+10-15%/sem), Sem4: deload (-40%)
- RPE: 7→8→9→6, fréquence 2×/muscle/sem minimum
- Repos: force=180s, hyper=90s
- Exercices UNIQUEMENT compatibles avec l'équipement déclaré

RÈGLES JSON:
- "notes" MAX 10 mots, "aiRationale" 2 phrases, "feasibilityAnalysis" 1 phrase
- Ferme TOUS les { } [ ] — critique absolu

JSON UNIQUEMENT, aucun markdown:
{
  "name": "Nom du programme",
  "aiRationale": "Explication stratégique du programme en 3-4 phrases",
  "feasibilityAnalysis": "Analyse de faisabilité et objectifs réalistes",
  "weeks": [
    {
      "weekIndex": 1,
      "days": [
        {
          "dayIndex": 1,
          "name": "Nom de la séance",
          "focus": "Ex: Poussée Haut du Corps",
          "estimatedDuration": 60,
          "exercises": [
            {
              "exerciseId": "barbell-bench-press",
              "name": "Barbell Bench Press",
              "sets": 4,
              "repsMin": 6,
              "repsMax": 8,
              "restSeconds": 180,
              "rpe": 8,
              "technique": "Technique standard",
              "notes": ""
            }
          ]
        }
      ]
    }
  ]
}
`
}

export function buildPostWorkoutPrompt(
  session: WorkoutSession,
  plannedDay: ProgramDay | null,
  recentHistory: WorkoutSession[]
): string {
  const exerciseSummary = session.exercises
    .map(ex => {
      const workSets = ex.sets.filter(s => !s.isWarmup && s.completed)
      const totalVol = workSets.reduce((acc, s) => acc + s.weight * s.reps, 0)
      const avgRpe =
        workSets.length > 0
          ? (workSets.reduce((acc, s) => acc + (s.rpe ?? 7), 0) / workSets.length).toFixed(1)
          : 'N/A'
      return `• ${ex.name}: ${workSets.length} séries, volume=${totalVol}kg, RPE moy=${avgRpe}`
    })
    .join('\n')

  const durationMin = Math.round(session.duration / 60)
  const trend =
    recentHistory.length >= 2
      ? `Volume des 3 dernières séances : ${recentHistory.slice(-3).map(s => `${s.totalVolume}kg`).join(' → ')}`
      : 'Première séance ou données insuffisantes pour la tendance'

  return `
Tu es APEX. Analyse cette séance d'entraînement et donne un feedback personnalisé.

SÉANCE RÉALISÉE :
- Nom : ${session.dayName}
- Date : ${new Date(session.date).toLocaleDateString('fr-FR')}
- Durée : ${durationMin} minutes
- Volume total : ${session.totalVolume} kg
- Humeur : ${session.mood}/5 | Énergie : ${session.energy}/5
- Notes athlete : ${session.notes || 'Aucune'}
${session.prsAchieved.length > 0 ? `- PRs réalisés : ${session.prsAchieved.map(pr => `${pr.exerciseName} ${pr.type.toUpperCase()} ${pr.value}kg`).join(', ')}` : ''}

EXERCICES :
${exerciseSummary}

TENDANCE :
${trend}

${plannedDay ? `PROGRAMME PRÉVU :
${plannedDay.exercises.map(e => `• ${e.name}: ${e.sets}×${e.repsMin}-${e.repsMax} @ RPE${e.rpe}`).join('\n')}` : ''}

TÂCHE : Rédige une analyse post-séance en Markdown. Structure :
1. **Bilan global** (2-3 phrases directes avec chiffres)
2. **Points forts** (bullet points)
3. **Points à améliorer** (bullet points avec actions concrètes)
4. **Recommandation pour la prochaine séance** (1 action prioritaire chiffrée)
${session.notes?.toLowerCase().includes('fatigue') || session.energy <= 2 ? '5. **Récupération** (conseil adapté à la fatigue)' : ''}
`
}

export function buildWeeklyReviewPrompt(
  profile: UserProfile,
  weekSessions: WorkoutSession[],
  allHistory: WorkoutSession[],
  program: Program | null
): string {
  const weekVolume = weekSessions.reduce((acc, s) => acc + s.totalVolume, 0)
  const avgMood =
    weekSessions.length > 0
      ? (weekSessions.reduce((acc, s) => acc + s.mood, 0) / weekSessions.length).toFixed(1)
      : 'N/A'
  const avgEnergy =
    weekSessions.length > 0
      ? (weekSessions.reduce((acc, s) => acc + s.energy, 0) / weekSessions.length).toFixed(1)
      : 'N/A'

  const sessionDetails = weekSessions
    .map(s => `- ${s.dayName} (${new Date(s.date).toLocaleDateString('fr-FR')}): ${s.totalVolume}kg, humeur=${s.mood}/5, énergie=${s.energy}/5`)
    .join('\n')

  const allPRs = weekSessions.flatMap(s => s.prsAchieved)
  const prText =
    allPRs.length > 0
      ? allPRs.map(pr => `${pr.exerciseName}: ${pr.previousValue}→${pr.value}kg`).join(', ')
      : 'Aucun PR cette semaine'

  const previousWeekVolume =
    allHistory.length >= 4
      ? allHistory.slice(-8, -4).reduce((acc, s) => acc + s.totalVolume, 0).toFixed(0) + 'kg'
      : 'Données insuffisantes'

  return `
Tu es APEX. Génère la revue hebdomadaire de l'athlète.

ATHLÈTE : ${profile.name} | Objectif : ${profile.goal} | Expérience : ${profile.experience}

SEMAINE ÉCOULÉE :
- Séances complétées : ${weekSessions.length}/${profile.daysPerWeek} prévues
- Volume total : ${weekVolume}kg (semaine précédente : ${previousWeekVolume})
- Humeur moyenne : ${avgMood}/5 | Énergie moyenne : ${avgEnergy}/5
- PRs : ${prText}

DÉTAIL SÉANCES :
${sessionDetails || 'Aucune séance cette semaine'}

${program ? `PROGRAMME EN COURS : ${program.name} (semaine ${program.weekNumber})` : ''}

TÂCHE : Génère une revue hebdomadaire complète en Markdown avec :

## 📊 Bilan de la semaine
[Analyse chiffrée des performances vs semaine précédente]

## 💪 Points forts
[2-3 bullets avec métriques]

## 🎯 Ajustements semaine suivante
[Actions concrètes et chiffrées : poids, volume, fréquence]

## 🧠 Insight du coach
[1 observation stratégique sur la progression long terme]

Aussi, réponds avec ce JSON en fin de message pour les métadonnées (séparé par --- JSON ---) :
{
  "progressScore": <1-10>,
  "keyInsights": ["insight1", "insight2", "insight3"]
}
`
}

export function buildDailyCoachingPrompt(
  profile: UserProfile,
  wellness: { sleep: number; stress: number; soreness: number } | null,
  recentSessions: WorkoutSession[],
  todayProgramDay: ProgramDay | null
): string {
  const sleepHours = wellness?.sleep ? wellness.sleep * 1.5 + 4 : null
  const warnings: string[] = []
  if (wellness?.sleep && wellness.sleep <= 2) warnings.push('ALERTE: sommeil insuffisant ce matin')
  if (wellness?.stress && wellness.stress >= 4) warnings.push('ALERTE: stress élevé déclaré')
  if (wellness?.soreness && wellness.soreness >= 4) warnings.push('ALERTE: courbatures sévères')

  const consecutiveLowEnergy = recentSessions.filter(s => s.energy <= 2).length
  if (consecutiveLowEnergy >= 2) warnings.push(`ALERTE: énergie faible sur ${consecutiveLowEnergy} séances consécutives`)

  return `${COACH_SYSTEM_PROMPT}

## TÂCHE : MESSAGE DE COACHING JOURNALIER

### Profil
${JSON.stringify(profile, null, 2)}

### Wellness aujourd'hui
${wellness ? `Sommeil: ${wellness.sleep}/5 (~${sleepHours?.toFixed(1)}h), Stress: ${wellness.stress}/5, Courbatures: ${wellness.soreness}/5` : 'Non renseigné'}

### ALERTES DÉTECTÉES
${warnings.length > 0 ? warnings.join('\n') : 'Aucune'}

### Séance prévue aujourd'hui
${todayProgramDay ? JSON.stringify(todayProgramDay) : 'Repos ou séance libre'}

### 5 dernières séances
${JSON.stringify(recentSessions.slice(-5))}

### INSTRUCTIONS
Génère un message de coaching journalier court (max 80 mots) qui :
1. Tient compte du wellness déclaré
2. Donne la recommandation concrète pour aujourd'hui (séance normale / allégée / repos)
3. Rappelle 1 point clé de récupération ou supplément si pertinent
4. Est motivant et direct

FORMAT : texte direct sans markdown`
}

export function buildWeightSuggestionsPrompt(
  profile: UserProfile,
  exerciseName: string,
  history: WorkoutSession[]
): string {
  const relevantHistory = history
    .flatMap(s => s.exercises.filter(e => e.name.toLowerCase().includes(exerciseName.toLowerCase())))
    .slice(-5)

  const historyText =
    relevantHistory.length > 0
      ? relevantHistory
          .map(ex => {
            const workSets = ex.sets.filter(s => !s.isWarmup && s.completed)
            return workSets.map(s => `${s.weight}kg×${s.reps}`).join(', ')
          })
          .join(' | ')
      : 'Aucun historique pour cet exercice'

  return `
Tu es APEX. Suggère un poids de départ pour un exercice.

ATHLÈTE :
- Expérience : ${profile.experience}
- Poids corporel : ${profile.weight}kg
- Objectif : ${profile.goal}

EXERCICE : ${exerciseName}

HISTORIQUE SUR CET EXERCICE : ${historyText}

TÂCHE : Donne un poids de départ réaliste pour la première série de travail.
Réponds UNIQUEMENT avec ce JSON valide (aucun wrapper markdown) :
{
  "weight": <nombre en kg, multiple de 1.25>,
  "rationale": "Explication en 1 phrase avec le raisonnement chiffré"
}
`
}

// ---------------------------------------------------------------------------
// AI supplement stack generator
// ---------------------------------------------------------------------------

export interface AISupplementRec {
  name: string         // must match SUPPLEMENT_CATALOG exactly
  dose: string         // personalized dose
  priority: 'essentiel' | 'recommandé' | 'optionnel'
  personalReason: string  // why THIS user needs it, max 20 words
}

export interface AISupplementStack {
  strategy: string          // 2-sentence overall strategy
  recommendations: AISupplementRec[]
  avoidList?: string[]      // e.g. "Caféine — séance le soir, affecte le sommeil"
}

export function buildSupplementStackPrompt(profile: UserProfile): string {
  const CATALOG_NAMES = [
    'Créatine Monohydrate', 'Whey Protéine', 'Caséine', 'Caféine', 'Pré-workout',
    'Bêta-Alanine', 'BCAA / EAA', 'Citrulline Malate', 'L-Carnitine',
    'Magnésium Bisglycinate', 'ZMA', 'Glutamine', 'HMB', 'Curcumine', 'Collagène',
    'Oméga-3 (EPA/DHA)', 'Vitamine D3', 'Vitamine K2 (MK-7)', 'Multivitamines',
    'Zinc', 'Vitamine C', 'Mélatonine', 'Ashwagandha (KSM-66)',
  ]

  return `Tu es APEX, coach d'élite. Génère le stack de suppléments IDÉAL et PERSONNALISÉ pour cet athlète.

PROFIL COMPLET :
- Nom : ${profile.name}
- Âge : ${profile.age} ans | Poids : ${profile.weight}kg | Taille : ${profile.height}cm
- Expérience : ${profile.experience}
- Objectif principal : ${profile.goal}
- Objectif détaillé : ${profile.goalDescription || 'Non précisé'}
- Jours d'entraînement/semaine : ${profile.daysPerWeek}
- Heure d'entraînement : ${profile.trainingTime}
- Blessures/limitations : ${profile.injuries || 'Aucune'}
- Équipement : ${profile.availableEquipment.join(', ')}

CATALOGUE DISPONIBLE (utilise EXACTEMENT ces noms) :
${CATALOG_NAMES.join(', ')}

RÈGLES :
1. Sélectionne 4-7 suppléments maximum — qualité > quantité
2. Adapte VRAIMENT à l'objectif : si masse → créatine+whey+oméga3+vit D en priorité. Si perte de poids → caféine+L-carnitine+oméga3. Si récupération/blessure → collagène+curcumine+magnésium.
3. Prends en compte l'heure d'entraînement (${profile.trainingTime}) pour les conflits caféine/sommeil
4. "personalReason" = raison CONCRÈTE et COURTE (max 15 mots) liée à SON objectif
5. Classe par priorité : "essentiel" d'abord

Réponds UNIQUEMENT avec ce JSON valide (aucun wrapper markdown) :
{
  "strategy": "2 phrases expliquant la logique globale du stack pour CET athlète",
  "recommendations": [
    {
      "name": "Créatine Monohydrate",
      "dose": "5g",
      "priority": "essentiel",
      "personalReason": "Base absolue pour la masse musculaire, +10-15% de force garantis"
    }
  ],
  "avoidList": ["Supplément X — raison courte liée au profil"]
}`
}

export async function generateSupplementStack(profile: UserProfile): Promise<AISupplementStack> {
  const prompt = buildSupplementStackPrompt(profile)
  return generateJSON<AISupplementStack>(prompt, { enableSearch: false, maxTokens: 2000 })
}

// ---------------------------------------------------------------------------
// Simple text generation — no JSON, no streaming, just text back
// ---------------------------------------------------------------------------

export async function generateText(
  prompt: string,
  systemInstruction?: string,
  maxTokens = 300
): Promise<string> {
  try {
    const { text } = await callProxy({
      prompt,
      systemInstruction,
      maxTokens,
      enableSearch: false,
    })
    return text.trim()
  } catch {
    return ''
  }
}

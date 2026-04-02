export type SupplementCategory = 'performance' | 'recovery' | 'health' | 'sleep'
export type TimingAnchor = 'morning' | 'pre' | 'during' | 'post' | 'evening' | 'custom'

export interface SupplementInfo {
  name: string
  emoji: string
  category: SupplementCategory
  defaultDose: string
  anchor: TimingAnchor
  offsetMin: number        // minutes relative to anchor (negative = before)
  timingLabel: string      // human readable
  why: string              // science rationale
  benefits: string[]
  warnings?: string
}

export const SUPPLEMENT_CATALOG: SupplementInfo[] = [
  // ── PERFORMANCE ────────────────────────────────────────────────────────────
  {
    name: 'Créatine Monohydrate',
    emoji: '⚡',
    category: 'performance',
    defaultDose: '5g',
    anchor: 'post',
    offsetMin: 0,
    timingLabel: 'Post-séance (ou n\'importe quand les autres jours)',
    why: 'La créatine saturée les stocks musculaires en phosphocréatine. Le moment exact compte peu — la régularité compte tout.',
    benefits: ['Force +10–15%', 'Volume musculaire', 'Récupération inter-séries', 'Cognitif'],
  },
  {
    name: 'Whey Protéine',
    emoji: '🥛',
    category: 'performance',
    defaultDose: '30g',
    anchor: 'post',
    offsetMin: 30,
    timingLabel: '30 min post-séance',
    why: 'Apport rapide en acides aminés pour la synthèse protéique. Window anabolique optimale dans les 2h post-effort.',
    benefits: ['Synthèse musculaire', 'Récupération', 'Satiété'],
  },
  {
    name: 'Caséine',
    emoji: '🌙',
    category: 'performance',
    defaultDose: '30g',
    anchor: 'evening',
    offsetMin: -30,
    timingLabel: '30 min avant de dormir',
    why: 'Protéine à digestion lente (~7h). Nourrit les muscles pendant le sommeil — anabolisme nocturne maximal.',
    benefits: ['Anti-catabolisme nocturne', 'Synthèse protéique pendant le sommeil', 'Satiété'],
  },
  {
    name: 'Caféine',
    emoji: '☕',
    category: 'performance',
    defaultDose: '200mg',
    anchor: 'pre',
    offsetMin: -45,
    timingLabel: '45 min avant la séance',
    why: 'Pic plasmatique en 45–60 min. Bloque l\'adénosine → élimine la fatigue perçue. Améliore la force, l\'endurance et la concentration.',
    benefits: ['Force +3–7%', 'Endurance +10%', 'Focus', 'Mobilisation des graisses'],
    warnings: 'Ne pas prendre après 16h si séance en soirée. Tolérance avec le temps.',
  },
  {
    name: 'Pré-workout',
    emoji: '🔥',
    category: 'performance',
    defaultDose: '1 dose',
    anchor: 'pre',
    offsetMin: -30,
    timingLabel: '20-30 min avant la séance',
    why: 'Mix caféine + bêta-alanine + citrulline. Vasodilatation + énergie + endurance musculaire.',
    benefits: ['Pompe vasculaire', 'Endurance musculaire', 'Énergie', 'Focus'],
    warnings: 'Éviter en soirée. Vérifier la teneur en caféine.',
  },
  {
    name: 'Bêta-Alanine',
    emoji: '💥',
    category: 'performance',
    defaultDose: '3.2g',
    anchor: 'pre',
    offsetMin: -30,
    timingLabel: '30 min avant la séance',
    why: 'Précurseur de la carnosine musculaire — tampon de l\'acidité lors des séries longues. Efficace pour les efforts 1–4 min.',
    benefits: ['Endurance musculaire', 'Capacité anaérobique', 'Retarde la fatigue'],
    warnings: 'Sensation de picotements (paresthésie) normale et inoffensive.',
  },
  {
    name: 'BCAA / EAA',
    emoji: '🧬',
    category: 'performance',
    defaultDose: '10g',
    anchor: 'during',
    offsetMin: 0,
    timingLabel: 'Pendant la séance',
    why: 'Acides aminés essentiels pour prévenir le catabolisme, surtout en déficit calorique ou à jeun. EAA > BCAA seuls.',
    benefits: ['Anti-catabolisme', 'Récupération intra-séance', 'Énergie si EAA complets'],
    warnings: 'Peu utile si apports protéiques totaux suffisants.',
  },
  {
    name: 'Citrulline Malate',
    emoji: '🩸',
    category: 'performance',
    defaultDose: '6g',
    anchor: 'pre',
    offsetMin: -60,
    timingLabel: '60 min avant la séance',
    why: 'Précurseur de l\'arginine → NO synthase → vasodilatation. Augmente l\'endurance et réduit les courbatures post-séance.',
    benefits: ['Pompe vasculaire', 'Endurance +52% selon études', 'Réduction DOMS'],
  },
  {
    name: 'L-Carnitine',
    emoji: '🔋',
    category: 'performance',
    defaultDose: '2g',
    anchor: 'morning',
    offsetMin: 0,
    timingLabel: 'Le matin avec repas',
    why: 'Transporte les acides gras vers les mitochondries. Efficace avec insuline présente (prendre avec glucides).',
    benefits: ['Oxydation des graisses', 'Endurance', 'Récupération musculaire'],
  },

  // ── RECOVERY ───────────────────────────────────────────────────────────────
  {
    name: 'Magnésium Bisglycinate',
    emoji: '🧘',
    category: 'recovery',
    defaultDose: '400mg',
    anchor: 'evening',
    offsetMin: -60,
    timingLabel: '1h avant de dormir',
    why: 'Le magnésium intervient dans +300 réactions enzymatiques. Le bisglycinate est la forme la plus absorbable. Réduit les crampes et améliore la qualité du sommeil.',
    benefits: ['Récupération musculaire', 'Sommeil profond', 'Réduction des crampes', 'Gestion du stress'],
  },
  {
    name: 'ZMA',
    emoji: '🌟',
    category: 'recovery',
    defaultDose: '3 capsules',
    anchor: 'evening',
    offsetMin: -30,
    timingLabel: '30-60 min avant de dormir (à jeun)',
    why: 'Zinc + Magnésium + Vitamine B6. Optimise la production de testostérone et GH pendant le sommeil.',
    benefits: ['Récupération nocturne', 'Testostérone naturelle', 'Qualité du sommeil'],
    warnings: 'Ne pas prendre avec du calcium (compétition d\'absorption).',
  },
  {
    name: 'Glutamine',
    emoji: '🛡️',
    category: 'recovery',
    defaultDose: '5g',
    anchor: 'post',
    offsetMin: 0,
    timingLabel: 'Post-séance',
    why: 'Acide aminé le plus abondant. Soutient l\'immunité et l\'intégrité intestinale lors des entraînements intenses.',
    benefits: ['Immunité', 'Intégrité intestinale', 'Récupération musculaire'],
    warnings: 'Peu d\'effet si apports protéiques totaux suffisants.',
  },
  {
    name: 'HMB',
    emoji: '🏗️',
    category: 'recovery',
    defaultDose: '3g',
    anchor: 'pre',
    offsetMin: -60,
    timingLabel: '1h avant la séance',
    why: 'Métabolite de la leucine. Réduit la dégradation musculaire lors des phases de déficit ou en début de programme.',
    benefits: ['Anti-catabolisme', 'Récupération', 'Préservation masse musculaire'],
    warnings: 'Surtout utile pour les débutants ou lors des phases de sèche.',
  },
  {
    name: 'Curcumine',
    emoji: '🌿',
    category: 'recovery',
    defaultDose: '1g',
    anchor: 'post',
    offsetMin: 30,
    timingLabel: 'Post-séance avec repas gras',
    why: 'Puissant anti-inflammatoire naturel. Réduit les marqueurs d\'inflammation (IL-6, TNF-α) post-exercice.',
    benefits: ['Anti-inflammatoire', 'Réduction DOMS', 'Récupération articulaire'],
    warnings: 'Nécessite de la pipérine (poivre noir) pour l\'absorption (+2000%).',
  },
  {
    name: 'Collagène',
    emoji: '🦴',
    category: 'recovery',
    defaultDose: '15g',
    anchor: 'pre',
    offsetMin: -60,
    timingLabel: '1h avant la séance avec vitamine C',
    why: 'Stimule la synthèse de collagène dans les tendons et ligaments. La fenêtre optimale est 1h avant l\'exercice avec vitamine C.',
    benefits: ['Santé des tendons', 'Mobilité articulaire', 'Prévention blessures'],
  },

  // ── HEALTH ─────────────────────────────────────────────────────────────────
  {
    name: 'Oméga-3 (EPA/DHA)',
    emoji: '🐟',
    category: 'health',
    defaultDose: '3g',
    anchor: 'morning',
    offsetMin: 0,
    timingLabel: 'Avec le repas principal',
    why: 'Anti-inflammatoire systémique. Améliore la sensibilité à l\'insuline, la composition corporelle et la santé cardiovasculaire.',
    benefits: ['Anti-inflammatoire', 'Santé cardiovasculaire', 'Sensibilité insuline', 'Cognitif'],
  },
  {
    name: 'Vitamine D3',
    emoji: '☀️',
    category: 'health',
    defaultDose: '2000 UI',
    anchor: 'morning',
    offsetMin: 0,
    timingLabel: 'Le matin avec repas gras',
    why: 'Vitamine liposoluble. 70-80% de la population est déficiente. Essentielle pour la testostérone, l\'immunité et la santé osseuse.',
    benefits: ['Testostérone naturelle', 'Immunité', 'Santé osseuse', 'Humeur'],
    warnings: 'Prendre avec vitamine K2 si dose > 2000 UI pour éviter la calcification artérielle.',
  },
  {
    name: 'Vitamine K2 (MK-7)',
    emoji: '🫀',
    category: 'health',
    defaultDose: '100mcg',
    anchor: 'morning',
    offsetMin: 0,
    timingLabel: 'Le matin avec repas gras (avec D3)',
    why: 'Dirige le calcium vers les os et hors des artères. Synergique avec la vitamine D3.',
    benefits: ['Santé osseuse', 'Santé cardiovasculaire'],
  },
  {
    name: 'Multivitamines',
    emoji: '🔬',
    category: 'health',
    defaultDose: '1 dose',
    anchor: 'morning',
    offsetMin: 0,
    timingLabel: 'Le matin avec le petit-déjeuner',
    why: 'Couvre les carences micronutritionnelles fréquentes chez les sportifs. Ne remplace pas une alimentation variée.',
    benefits: ['Micronutriments essentiels', 'Énergie', 'Immunité'],
  },
  {
    name: 'Zinc',
    emoji: '⚙️',
    category: 'health',
    defaultDose: '25mg',
    anchor: 'morning',
    offsetMin: 0,
    timingLabel: 'Le matin à jeun',
    why: 'Minéral essentiel à la synthèse de testostérone et à la fonction immunitaire. Souvent déficient chez les sportifs.',
    benefits: ['Testostérone', 'Immunité', 'Récupération'],
    warnings: 'Ne pas prendre en même temps que fer ou calcium.',
  },
  {
    name: 'Vitamine C',
    emoji: '🍊',
    category: 'health',
    defaultDose: '500mg',
    anchor: 'morning',
    offsetMin: 0,
    timingLabel: 'Le matin',
    why: 'Antioxydant. Essentielle à la synthèse de collagène. Renforce l\'immunité et réduit l\'inflammation.',
    benefits: ['Immunité', 'Synthèse collagène', 'Antioxydant'],
  },

  // ── SLEEP ──────────────────────────────────────────────────────────────────
  {
    name: 'Mélatonine',
    emoji: '😴',
    category: 'sleep',
    defaultDose: '0.5mg',
    anchor: 'evening',
    offsetMin: -30,
    timingLabel: '30 min avant de dormir',
    why: 'Régulateur naturel du cycle circadien. Utile pour décalages horaires ou perturbations de sommeil. Dose faible (0.5mg) plus efficace que forte.',
    benefits: ['Endormissement', 'Qualité du sommeil', 'Décalage horaire'],
    warnings: 'Ne pas dépasser 1mg. Peut créer une dépendance si usage prolongé.',
  },
  {
    name: 'Ashwagandha (KSM-66)',
    emoji: '🌿',
    category: 'sleep',
    defaultDose: '600mg',
    anchor: 'evening',
    offsetMin: -60,
    timingLabel: 'Le soir (ou le matin pour anti-stress)',
    why: 'Adaptogène cliniquement prouvé. Réduit le cortisol, améliore la qualité du sommeil et augmente la testostérone (+17% en études).',
    benefits: ['Réduction cortisol', 'Testostérone +17%', 'Qualité du sommeil', 'Anti-stress'],
    warnings: 'Privilégier l\'extrait standardisé KSM-66 ou Sensoril.',
  },
]

// ── Smart time calculator ────────────────────────────────────────────────────

export function calculateSupplementTime(
  supplement: string,
  trainingTimeStr: string,
  isTrainingDay: boolean
): string {
  const info = SUPPLEMENT_CATALOG.find(s => s.name === supplement)
  if (!info) return '08:00'

  const [h, m] = trainingTimeStr.split(':').map(Number)
  const trainingMinutes = (h ?? 18) * 60 + (m ?? 0)
  let targetMinutes: number

  switch (info.anchor) {
    case 'morning':
      targetMinutes = 7 * 60 + 30
      break
    case 'evening':
      targetMinutes = 21 * 60 + info.offsetMin
      break
    case 'pre':
      targetMinutes = isTrainingDay
        ? trainingMinutes + info.offsetMin
        : 7 * 60 + 30 // rest day: morning
      break
    case 'during':
      targetMinutes = isTrainingDay
        ? trainingMinutes + 15
        : 12 * 60 // rest day: lunch
      break
    case 'post':
      targetMinutes = isTrainingDay
        ? trainingMinutes + 60 + info.offsetMin
        : 7 * 60 + 30
      break
    default:
      targetMinutes = 8 * 60
  }

  targetMinutes = Math.max(5 * 60, Math.min(23 * 60, targetMinutes))
  const hh = Math.floor(targetMinutes / 60).toString().padStart(2, '0')
  const mm = (targetMinutes % 60).toString().padStart(2, '0')
  return `${hh}:${mm}`
}

export function getSupplementInfo(name: string): SupplementInfo | undefined {
  return SUPPLEMENT_CATALOG.find(s => s.name === name)
}

export const CATEGORY_LABELS: Record<SupplementCategory, string> = {
  performance: 'Performance',
  recovery: 'Récupération',
  health: 'Santé',
  sleep: 'Sommeil',
}

export const CATEGORY_COLORS: Record<SupplementCategory, string> = {
  performance: 'text-accent-yellow',
  recovery: 'text-accent-green',
  health: 'text-accent-yellow',
  sleep: 'text-[#a78bfa]',
}

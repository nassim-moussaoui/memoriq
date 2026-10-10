export type Lang = 'fr' | 'en';
export const LANGS: Lang[] = ['fr', 'en'];

/** Every page in both languages (French at the root, English under /en). */
export const ROUTES = {
  home: { fr: '/', en: '/en/' },
  privacy: { fr: '/confidentialite', en: '/en/privacy' },
  terms: { fr: '/conditions', en: '/en/terms' },
  support: { fr: '/support', en: '/en/support' },
  confirmed: { fr: '/compte/confirme', en: '/en/account/confirmed' },
} as const;
export type RouteKey = keyof typeof ROUTES;

export const CONTACT_EMAIL = 'nassim.moussaoui02@gmail.com';
export const PUBLISHER = 'Nassim Moussaoui';

export const ui = {
  fr: {
    metaTitle: 'Memoriq : mémorise le Coran pour de bon',
    metaDescription:
      "Memoriq t'aide à mémoriser le Coran durablement, grâce à la science de la mémoire (répétition espacée, rappel actif) et à la méthode prophétique. Al-Fatiha et Juz' 'Amma gratuits.",
    nav: { method: 'La méthode', how: 'Comment ça marche', pricing: 'Tarifs', sadaqa: 'Sadaqa', support: 'Aide' },
    appStoreSoon: "Bientôt sur l'App Store",
    discover: 'Découvrir la méthode',
    hero: {
      eyebrow: 'Mémorisation du Coran',
      title: 'Mémorise le Coran,',
      titleAccent: 'pour de bon.',
      body: "Memoriq réunit les sciences de la mémoire et la méthode des compagnons : chaque verset revient au moment idéal, juste avant que tu ne l'oublies.",
      free: "Al-Fatiha et Juz' 'Amma gratuits, pour toujours",
    },
    mock: {
      step: 'Réciter',
      ref: 'Al-Ikhlas, verset 1',
      hint: 'Touche un mot masqué',
      question: 'Comment as-tu récité ?',
      again: 'Oublié',
      hard: 'Hésitant',
      good: 'Bien su',
      easy: 'Parfait',
      againWhen: 'Dans cette séance',
      hardWhen: 'Revu demain',
      goodWhen: 'Dans 3 jours',
      easyWhen: 'Dans 9 jours',
    },
    strip: ['Sans publicité', 'Hors ligne', 'Français et anglais', 'Phonétique incluse'],
    science: {
      eyebrow: 'La science',
      title: 'Trois effets démontrés, réunis dans une seule app',
      cards: [
        {
          title: "La courbe de l'oubli",
          body: "Dès 1885, Ebbinghaus a mesuré qu'on oublie l'essentiel en quelques jours sans révision. Memoriq part de ce constat.",
          tag: 'Ebbinghaus, 1885',
        },
        {
          title: 'La répétition espacée',
          body: "Chaque révision bien placée remonte la mémoire et aplatit la courbe. L'algorithme FSRS calcule le bon moment pour chaque verset.",
          tag: 'Algorithme FSRS',
        },
        {
          title: 'Le rappel actif',
          body: "Se tester fait retenir environ 50 % de plus que relire. Le verset est masqué : tu récites, puis tu vérifies mot par mot.",
          tag: 'Roediger et Karpicke, 2006',
        },
      ],
      reread: 'Relire',
      recall: 'Réciter',
      days: 'jours',
    },
    sunna: {
      eyebrow: 'La tradition',
      title: 'La méthode du Prophète ﷺ',
      methodLabel: 'Méthode',
    },
    how: {
      eyebrow: 'Comment ça marche',
      title: 'Quelques minutes par jour, une séance guidée',
      steps: [
        { title: 'Écouter', body: 'Le verset est récité par Al-Husary, lentement, en boucle. Tu lis et tu répètes avec lui.' },
        { title: 'Réciter', body: 'Le verset se masque. Tu le récites à voix haute, de mémoire, et tu dévoiles un mot seulement si tu bloques.' },
        { title: 'Évaluer', body: "Oublié, hésitant, bien su ou parfait : ta réponse décide du jour où le verset reviendra." },
        { title: 'Enchaîner', body: "Une fois un passage appris, tu le récites d'une traite pour souder les versets entre eux." },
      ],
    },
    features: {
      eyebrow: 'Tout ce qu’il faut',
      title: 'Pensée pour durer',
      items: [
        { title: 'Ton plan personnalisé', body: "Ton objectif, ton temps par jour, ton moment : la séance s'adapte à toi." },
        { title: 'Rappel quotidien', body: 'Une notification discrète au moment que tu as choisi, avec le nombre de versets qui t’attendent.' },
        { title: 'Hors ligne', body: 'Les récitations écoutées restent sur ton téléphone, à la mosquée comme en voyage.' },
        { title: 'Statistiques', body: 'Versets appris, série, activité des 13 dernières semaines et révisions à venir.' },
        { title: 'Je connais déjà', body: 'Tu as appris des sourates ailleurs ? Coche-les : elles passent directement en révision.' },
        { title: 'Synchronisé', body: 'Avec un compte, ta progression te suit sur tous tes appareils. Sans compte, tout reste sur ton téléphone.' },
      ],
    },
    pricing: {
      eyebrow: 'Tarifs',
      title: "L'essentiel est gratuit",
      free: {
        name: 'Gratuit',
        price: '0 €',
        period: 'pour toujours',
        items: ["Al-Fatiha et tout le Juz' 'Amma (sourates 78 à 114)", 'Toute la méthode : écoute, rappel, répétition espacée', 'Statistiques, rappels, mode hors ligne'],
      },
      premium: {
        name: 'Premium',
        price: '34,99 €',
        period: 'par an, soit 2,92 € par mois',
        badge: '7 jours gratuits',
        alt: 'ou 4,99 € par mois',
        items: ['Les 114 sourates', 'Tous les récitateurs, dont Al-Afasy', 'Tu soutiens l’app et son accès pour tous'],
      },
    },
    sadaqa: {
      eyebrow: 'Sadaqa',
      title: 'Offre un an de Premium à un étudiant',
      body: "Partout dans le monde, des étudiants veulent mémoriser le Coran sans pouvoir payer. Depuis l'app, tu peux leur offrir un an de Premium : il est attribué à celui qui attend depuis le plus longtemps, de façon anonyme dans les deux sens.",
      points: ['Un achat unique, sans abonnement', "Attribué à l'étudiant qui attend depuis le plus longtemps", 'Anonyme pour celui qui offre comme pour celui qui reçoit'],
    },
    faq: {
      eyebrow: 'Questions fréquentes',
      title: 'Tu te demandes peut-être',
      items: [
        { q: 'Faut-il savoir lire l’arabe ?', a: 'Non. Chaque verset est accompagné de sa phonétique et de sa traduction, et récité par un récitateur pédagogique.' },
        { q: 'Combien de temps par jour ?', a: 'Tu choisis entre 5, 10 et 20 minutes. Mieux vaut peu chaque jour que beaucoup une fois par semaine.' },
        { q: 'Et si je connais déjà des sourates ?', a: 'Tu peux les cocher dans la bibliothèque : elles passent directement en révision, sans repasser par l’apprentissage.' },
        { q: 'Mes données sont-elles protégées ?', a: 'Sans compte, tout reste sur ton téléphone. Avec un compte, ta progression est synchronisée de façon sécurisée, et tu peux tout supprimer depuis l’app.' },
        { q: 'Quand sort l’app ?', a: "Memoriq arrive bientôt sur l'App Store, puis sur Android." },
      ],
    },
    final: { title: 'Bismillah, commence aujourd’hui', body: 'Quelques minutes par jour suffisent. La régularité fait le reste.' },
    footer: {
      tagline: 'Mémorise le Coran pour de bon.',
      legal: 'Informations',
      privacy: 'Confidentialité',
      terms: "Conditions d'utilisation",
      support: 'Aide et contact',
      rights: 'Tous droits réservés.',
    },
    lang: { label: 'Langue', other: 'English' },
    skip: 'Aller au contenu',
  },
  en: {
    metaTitle: 'Memoriq: memorize the Quran for good',
    metaDescription:
      "Memoriq helps you memorize the Quran for the long run, with the science of memory (spaced repetition, active recall) and the prophetic method. Al-Fatiha and Juz' 'Amma are free.",
    nav: { method: 'The method', how: 'How it works', pricing: 'Pricing', sadaqa: 'Sadaqa', support: 'Help' },
    appStoreSoon: 'Coming soon to the App Store',
    discover: 'Discover the method',
    hero: {
      eyebrow: 'Quran memorization',
      title: 'Memorize the Quran,',
      titleAccent: 'for good.',
      body: 'Memoriq brings together the science of memory and the method of the companions: each verse comes back at the ideal moment, right before you would forget it.',
      free: "Al-Fatiha and Juz' 'Amma free, forever",
    },
    mock: {
      step: 'Recite',
      ref: 'Al-Ikhlas, verse 1',
      hint: 'Tap a hidden word',
      question: 'How did you recite?',
      again: 'Forgot',
      hard: 'Hesitant',
      good: 'Got it',
      easy: 'Perfect',
      againWhen: 'In this session',
      hardWhen: 'Back tomorrow',
      goodWhen: 'In 3 days',
      easyWhen: 'In 9 days',
    },
    strip: ['No ads', 'Works offline', 'French and English', 'Transliteration included'],
    science: {
      eyebrow: 'The science',
      title: 'Three proven effects, brought together in one app',
      cards: [
        {
          title: 'The forgetting curve',
          body: 'As early as 1885, Ebbinghaus measured that we forget most of what we learn within days without review. Memoriq starts from there.',
          tag: 'Ebbinghaus, 1885',
        },
        {
          title: 'Spaced repetition',
          body: 'Each well-timed review lifts memory back up and flattens the curve. The FSRS algorithm picks the right moment for each verse.',
          tag: 'FSRS algorithm',
        },
        {
          title: 'Active recall',
          body: 'Testing yourself leads to about 50% more retention than rereading. The verse is hidden: you recite, then check word by word.',
          tag: 'Roediger and Karpicke, 2006',
        },
      ],
      reread: 'Reread',
      recall: 'Recite',
      days: 'days',
    },
    sunna: {
      eyebrow: 'The tradition',
      title: 'The method of the Prophet ﷺ',
      methodLabel: 'Method',
    },
    how: {
      eyebrow: 'How it works',
      title: 'A few minutes a day, one guided session',
      steps: [
        { title: 'Listen', body: 'The verse is recited by Al-Husary, slowly, on a loop. You read and repeat with him.' },
        { title: 'Recite', body: 'The verse is hidden. You recite it out loud from memory, and reveal a word only when stuck.' },
        { title: 'Rate', body: 'Forgot, hesitant, got it or perfect: your answer decides the day the verse comes back.' },
        { title: 'Chain', body: 'Once a passage is learned, you recite it in one go to bind the verses together.' },
      ],
    },
    features: {
      eyebrow: 'Everything you need',
      title: 'Built to last',
      items: [
        { title: 'Your personal plan', body: 'Your goal, your daily time, your moment: the session adapts to you.' },
        { title: 'Daily reminder', body: 'A discreet notification at the moment you chose, with the number of verses waiting for you.' },
        { title: 'Offline', body: 'Recitations you listened to stay on your phone, at the mosque or on the move.' },
        { title: 'Statistics', body: 'Verses learned, streak, activity over the last 13 weeks and upcoming reviews.' },
        { title: 'Already known', body: 'Learned surahs elsewhere? Tick them: they go straight to review.' },
        { title: 'Synced', body: 'With an account, your progress follows you on every device. Without one, everything stays on your phone.' },
      ],
    },
    pricing: {
      eyebrow: 'Pricing',
      title: 'The essentials are free',
      free: {
        name: 'Free',
        price: '€0',
        period: 'forever',
        items: ["Al-Fatiha and all of Juz' 'Amma (surahs 78 to 114)", 'The whole method: listening, recall, spaced repetition', 'Statistics, reminders, offline mode'],
      },
      premium: {
        name: 'Premium',
        price: '€34.99',
        period: 'a year, that is €2.92 a month',
        badge: '7 days free',
        alt: 'or €4.99 a month',
        items: ['All 114 surahs', 'Every reciter, including Al-Afasy', 'You support the app and access for all'],
      },
    },
    sadaqa: {
      eyebrow: 'Sadaqa',
      title: 'Gift a year of Premium to a student',
      body: 'Around the world, students want to memorize the Quran but cannot pay. From the app, you can gift them a year of Premium: it goes to the one who has waited the longest, anonymously both ways.',
      points: ['A one-time purchase, no subscription', 'Given to the student who has waited the longest', 'Anonymous for the giver and the receiver'],
    },
    faq: {
      eyebrow: 'FAQ',
      title: 'You might be wondering',
      items: [
        { q: 'Do I need to read Arabic?', a: 'No. Every verse comes with its transliteration and translation, recited by a teaching reciter.' },
        { q: 'How much time per day?', a: 'You choose 5, 10 or 20 minutes. A little every day beats a lot once a week.' },
        { q: 'What if I already know some surahs?', a: 'Tick them in the library: they go straight to review, without going through learning again.' },
        { q: 'Is my data safe?', a: 'Without an account, everything stays on your phone. With one, your progress is synced securely, and you can delete everything from the app.' },
        { q: 'When does the app come out?', a: 'Memoriq is coming soon to the App Store, then to Android.' },
      ],
    },
    final: { title: 'Bismillah, start today', body: 'A few minutes a day are enough. Consistency does the rest.' },
    footer: {
      tagline: 'Memorize the Quran for good.',
      legal: 'Information',
      privacy: 'Privacy',
      terms: 'Terms of Use',
      support: 'Help and contact',
      rights: 'All rights reserved.',
    },
    lang: { label: 'Language', other: 'Français' },
    skip: 'Skip to content',
  },
} as const;

export function useTranslations(lang: Lang) {
  return ui[lang];
}

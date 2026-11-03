/*
 * Seeds and seedheads. Seed material is offspring potential: it never receives a Seedling identity. The four source
 * states stay distinct on purpose. "Unidentified dahlia" is one exact physical plant whose name is not known. It is not
 * the same as "unknown or mixed", which means the maternal plant cannot be identified at all. Canonical values are
 * language-neutral; these words only show them. User-authored text is never translated.
 */

export const en = {
  title: "Seeds and seedheads",
  intro:
    "Seeds and seedheads are offspring material, not the same plant. A seed never receives a Seedling identity. Each plant that later grows from it does, when it is recorded.",
  offerNew: "Offer seeds or seedheads",
  offerTitle: "Offer seeds or seedheads",
  offerIntro:
    "Say what you know about the plant that produced this material. Payment and handover happen between you, outside DahliaSeedling.",
  source: {
    legend: "Where the material comes from",
    seedling: "A seedling of mine",
    cultivar: "A named cultivar",
    unidentified: "An unidentified dahlia",
    unidentifiedHint:
      "You know exactly which plant produced it, but not what it is called. This is not a name and not a seedling.",
    unknownMixed: "Unknown or mixed",
    unknownMixedHint:
      "The plant cannot be identified, for example seeds collected from a mixed source.",
  },
  seedlingId: "Seedling",
  cultivarName: "Cultivar name",
  description: "Description (optional)",
  descriptionHint:
    "Your own words about the plant, for example its colour and form. It is shown as written, and it is not a name.",
  sourcePhoto: "Photograph of the source plant",
  sourcePhotoHint:
    "Required. A photograph of the actual plant, not of the seed, the seedhead, the packet or a similar dahlia.",
  parentPhoto: "Photograph of the actual parent plant",
  parentPhotoHint:
    "Required. Your own photograph of the plant that was used, not a picture from the internet.",
  material: {
    legend: "What you are offering",
    seeds: "Seeds",
    seedheads: "Seedheads",
  },
  packetSize: "Seeds per packet",
  seedheadCount: "Number of seedheads",
  mode: {
    legend: "Terms",
    free: "Free",
    forSale: "For sale",
    trade: "Trade",
  },
  price: "Price (optional)",
  priceHint: "For information only. DahliaSeedling does not process any payment.",
  handover: {
    legend: "Handover",
    pickup: "Pickup",
    shipping: "Shipping",
    both: "Pickup or shipping",
  },
  note: "Note (optional)",
  noteHint: "Up to 280 characters.",
  submit: "Publish offer",
  list: {
    title: "Seed and seedhead offers",
    none: "No offers are live.",
    interest: "I'm interested",
    quantity: "How many? (optional)",
    signIn: "Sign in to express interest",
    withdraw: "Withdraw my interest",
    close: "Close this offer",
    closed: "This offer is closed.",
    interested: "Interested growers",
    noneInterested: "No one has expressed interest yet.",
    interestedCount: "{count} interested",
    from: "From {source}",
    you: "Your offer",
  },
  sourceName: {
    seedling: "Seedling",
    cultivar: "Named cultivar",
    unidentified: "Unidentified dahlia",
    unknownMixed: "Unknown or mixed",
  },
  parentage: {
    unidentified: "Unidentified dahlia",
    description: "Unidentified dahlia: {description}",
    source: "Source of the parent",
    newSource: "A new photograph of the plant",
    noDescription: "Photograph only",
  },
  notice: {
    published: "Your offer is live.",
    closed: "The offer is closed. Its source stays on record.",
    interestRecorded: "Your interest is recorded.",
    interestWithdrawn: "Your interest is withdrawn.",
  },
  errors: {
    sourceRequired: "Choose where the material comes from.",
    cultivarName: "Give the cultivar name, 2 to 80 characters.",
    description: "Keep the description to 280 characters or fewer.",
    sourcePhotoRequired:
      "An unidentified dahlia needs a photograph of the actual plant before it can be published.",
    parentPhotoRequired: "A named cultivar needs a photograph of the actual parent plant.",
    photoType: "Use a JPEG, PNG or WebP photograph.",
    photoSize: "That photograph is too large. Use one of 2.5 MB or less.",
    material: "Choose loose seeds or seedheads.",
    packetSize: "Give the number of seeds per packet.",
    seedheadCount: "Give the number of seedheads.",
    mode: "Choose free, for sale or trade.",
    price: "A price belongs only to an offer for sale, and must be 80 characters or fewer.",
    handover: "Choose pickup, shipping or both.",
    note: "Keep the note to 280 characters or fewer.",
    quantity: "Keep the quantity to 80 characters or fewer.",
    notAllowed: "This is not yours to change right now.",
    notFound: "That could not be found.",
    needsPublicImage:
      "The seed parent needs a public photograph on its record before an offer can be published.",
    generic: "The offer could not be saved. Try again.",
  },
};

export const nl: typeof en = {
  title: "Zaden en zaadkoppen",
  intro:
    "Zaden en zaadkoppen zijn nakomelingenmateriaal, niet dezelfde plant. Een zaad krijgt nooit een zaailingidentiteit. Elke plant die er later uit groeit, krijgt er wel een, zodra die is vastgelegd.",
  offerNew: "Zaden of zaadkoppen aanbieden",
  offerTitle: "Zaden of zaadkoppen aanbieden",
  offerIntro:
    "Vertel wat je weet over de plant die dit materiaal heeft voortgebracht. Betaling en overdracht gebeuren tussen jullie, buiten DahliaSeedling.",
  source: {
    legend: "Waar het materiaal vandaan komt",
    seedling: "Een zaailing van mij",
    cultivar: "Een benoemde cultivar",
    unidentified: "Een dahlia met onbekende naam",
    unidentifiedHint:
      "Je weet precies welke plant het heeft voortgebracht, maar niet hoe die heet. Dit is geen naam en geen zaailing.",
    unknownMixed: "Onbekend of gemengd",
    unknownMixedHint:
      "De plant kan niet worden vastgesteld, bijvoorbeeld bij zaad uit een gemengde bron.",
  },
  seedlingId: "Zaailing",
  cultivarName: "Naam van de cultivar",
  description: "Omschrijving (optioneel)",
  descriptionHint:
    "Je eigen woorden over de plant, bijvoorbeeld kleur en vorm. Het wordt getoond zoals je het schrijft, en het is geen naam.",
  sourcePhoto: "Foto van de moederplant",
  sourcePhotoHint:
    "Verplicht. Een foto van de plant zelf, niet van het zaad, de zaadkop, het pakje of een vergelijkbare dahlia.",
  parentPhoto: "Foto van de werkelijke ouderplant",
  parentPhotoHint:
    "Verplicht. Je eigen foto van de plant die is gebruikt, geen afbeelding van internet.",
  material: {
    legend: "Wat je aanbiedt",
    seeds: "Zaden",
    seedheads: "Zaadkoppen",
  },
  packetSize: "Zaden per pakje",
  seedheadCount: "Aantal zaadkoppen",
  mode: {
    legend: "Voorwaarden",
    free: "Gratis",
    forSale: "Te koop",
    trade: "Ruilen",
  },
  price: "Prijs (optioneel)",
  priceHint: "Alleen ter informatie. DahliaSeedling verwerkt geen betalingen.",
  handover: {
    legend: "Overdracht",
    pickup: "Ophalen",
    shipping: "Verzenden",
    both: "Ophalen of verzenden",
  },
  note: "Notitie (optioneel)",
  noteHint: "Maximaal 280 tekens.",
  submit: "Aanbod plaatsen",
  list: {
    title: "Zaad- en zaadkopaanbiedingen",
    none: "Er staan geen aanbiedingen online.",
    interest: "Ik heb interesse",
    quantity: "Hoeveel? (optioneel)",
    signIn: "Log in om interesse te tonen",
    withdraw: "Mijn interesse intrekken",
    close: "Deze aanbieding sluiten",
    closed: "Deze aanbieding is gesloten.",
    interested: "Belangstellende kwekers",
    noneInterested: "Nog niemand heeft interesse getoond.",
    interestedCount: "{count} geïnteresseerd",
    from: "Van {source}",
    you: "Jouw aanbieding",
  },
  sourceName: {
    seedling: "Zaailing",
    cultivar: "Benoemde cultivar",
    unidentified: "Dahlia met onbekende naam",
    unknownMixed: "Onbekend of gemengd",
  },
  parentage: {
    unidentified: "Dahlia met onbekende naam",
    description: "Dahlia met onbekende naam: {description}",
    source: "Bron van de ouder",
    newSource: "Een nieuwe foto van de plant",
    noDescription: "Alleen foto",
  },
  notice: {
    published: "Je aanbieding staat online.",
    closed: "De aanbieding is gesloten. De herkomst blijft vastgelegd.",
    interestRecorded: "Je interesse is vastgelegd.",
    interestWithdrawn: "Je interesse is ingetrokken.",
  },
  errors: {
    sourceRequired: "Kies waar het materiaal vandaan komt.",
    cultivarName: "Geef de naam van de cultivar, 2 tot 80 tekens.",
    description: "Houd de omschrijving op 280 tekens of minder.",
    sourcePhotoRequired:
      "Een dahlia met onbekende naam heeft een foto van de plant zelf nodig voordat hij kan worden geplaatst.",
    parentPhotoRequired: "Een benoemde cultivar heeft een foto van de werkelijke ouderplant nodig.",
    photoType: "Gebruik een JPEG-, PNG- of WebP-foto.",
    photoSize: "Die foto is te groot. Gebruik een van 2,5 MB of kleiner.",
    material: "Kies losse zaden of zaadkoppen.",
    packetSize: "Geef het aantal zaden per pakje.",
    seedheadCount: "Geef het aantal zaadkoppen.",
    mode: "Kies gratis, te koop of ruilen.",
    price: "Een prijs hoort alleen bij een aanbieding te koop, en moet 80 tekens of minder zijn.",
    handover: "Kies ophalen, verzenden of beide.",
    note: "Houd de notitie op 280 tekens of minder.",
    quantity: "Houd de hoeveelheid op 80 tekens of minder.",
    notAllowed: "Dit kun je nu niet wijzigen.",
    notFound: "Dit kon niet worden gevonden.",
    needsPublicImage:
      "De zaadouder heeft een openbare foto nodig in zijn gegevens voordat een aanbieding kan worden geplaatst.",
    generic: "De aanbieding kon niet worden opgeslagen. Probeer het opnieuw.",
  },
};

export const fr: typeof en = {
  title: "Graines et capitules",
  intro:
    "Les graines et les capitules sont du matériel de descendance, pas la même plante. Une graine ne reçoit jamais d'identité de semis. Chaque plante qui en pousse plus tard en reçoit une, une fois enregistrée.",
  offerNew: "Proposer des graines ou des capitules",
  offerTitle: "Proposer des graines ou des capitules",
  offerIntro:
    "Dites ce que vous savez de la plante qui a produit ce matériel. Le paiement et la remise se font entre vous, en dehors de DahliaSeedling.",
  source: {
    legend: "D'où vient le matériel",
    seedling: "Un de mes semis",
    cultivar: "Un cultivar nommé",
    unidentified: "Un dahlia non identifié",
    unidentifiedHint:
      "Vous savez exactement quelle plante l'a produit, mais pas comment elle s'appelle. Ce n'est ni un nom ni un semis.",
    unknownMixed: "Origine inconnue ou mélangée",
    unknownMixedHint:
      "La plante ne peut pas être identifiée, par exemple des graines récoltées dans une source mélangée.",
  },
  seedlingId: "Semis",
  cultivarName: "Nom du cultivar",
  description: "Description (facultatif)",
  descriptionHint:
    "Vos propres mots sur la plante, par exemple sa couleur et sa forme. Elle est affichée telle que vous l'écrivez, et ce n'est pas un nom.",
  sourcePhoto: "Photo de la plante mère",
  sourcePhotoHint:
    "Obligatoire. Une photo de la plante elle-même, pas de la graine, du capitule, du sachet ou d'une dahlia semblable.",
  parentPhoto: "Photo de la plante parent réelle",
  parentPhotoHint:
    "Obligatoire. Votre propre photo de la plante utilisée, pas une image trouvée sur internet.",
  material: {
    legend: "Ce que vous proposez",
    seeds: "Graines",
    seedheads: "Capitules",
  },
  packetSize: "Graines par sachet",
  seedheadCount: "Nombre de capitules",
  mode: {
    legend: "Modalités",
    free: "Gratuit",
    forSale: "À vendre",
    trade: "Échange",
  },
  price: "Prix (facultatif)",
  priceHint: "À titre d'information. DahliaSeedling ne traite aucun paiement.",
  handover: {
    legend: "Remise",
    pickup: "Remise en main propre",
    shipping: "Envoi",
    both: "Remise ou envoi",
  },
  note: "Note (facultatif)",
  noteHint: "280 caractères maximum.",
  submit: "Publier l'offre",
  list: {
    title: "Offres de graines et de capitules",
    none: "Aucune offre n'est en ligne.",
    interest: "Je suis intéressé",
    quantity: "Combien ? (facultatif)",
    signIn: "Connectez-vous pour exprimer votre intérêt",
    withdraw: "Retirer mon intérêt",
    close: "Fermer cette offre",
    closed: "Cette offre est fermée.",
    interested: "Cultivateurs intéressés",
    noneInterested: "Personne n'a encore exprimé d'intérêt.",
    interestedCount: "{count} intéressé(s)",
    from: "De {source}",
    you: "Votre offre",
  },
  sourceName: {
    seedling: "Semis",
    cultivar: "Cultivar nommé",
    unidentified: "Dahlia non identifié",
    unknownMixed: "Origine inconnue ou mélangée",
  },
  parentage: {
    unidentified: "Dahlia non identifié",
    description: "Dahlia non identifié : {description}",
    source: "Source du parent",
    newSource: "Une nouvelle photo de la plante",
    noDescription: "Photo seulement",
  },
  notice: {
    published: "Votre offre est en ligne.",
    closed: "L'offre est fermée. L'origine reste enregistrée.",
    interestRecorded: "Votre intérêt est enregistré.",
    interestWithdrawn: "Votre intérêt est retiré.",
  },
  errors: {
    sourceRequired: "Indiquez d'où vient le matériel.",
    cultivarName: "Donnez le nom du cultivar, de 2 à 80 caractères.",
    description: "Gardez la description à 280 caractères maximum.",
    sourcePhotoRequired:
      "Un dahlia non identifié a besoin d'une photo de la plante elle-même avant d'être publié.",
    parentPhotoRequired: "Un cultivar nommé a besoin d'une photo de la plante parent réelle.",
    photoType: "Utilisez une photo JPEG, PNG ou WebP.",
    photoSize: "Cette photo est trop grande. Utilisez une photo de 2,5 Mo maximum.",
    material: "Choisissez des graines en vrac ou des capitules.",
    packetSize: "Indiquez le nombre de graines par sachet.",
    seedheadCount: "Indiquez le nombre de capitules.",
    mode: "Choisissez gratuit, à vendre ou échange.",
    price: "Un prix ne concerne qu'une offre à vendre, et doit faire 80 caractères maximum.",
    handover: "Choisissez remise en main propre, envoi ou les deux.",
    note: "Gardez la note à 280 caractères maximum.",
    quantity: "Gardez la quantité à 80 caractères maximum.",
    notAllowed: "Vous ne pouvez pas modifier cela pour le moment.",
    notFound: "Introuvable.",
    needsPublicImage:
      "Le semis parent a besoin d'une photo publique dans son dossier avant qu'une offre puisse être publiée.",
    generic: "L'offre n'a pas pu être enregistrée. Réessayez.",
  },
};

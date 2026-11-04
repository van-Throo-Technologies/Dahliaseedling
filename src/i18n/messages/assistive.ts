/*
 * Phase 9 copy: choosing the Seedling for a Capture, the voice-command controls, and merging two Seedlings. The grower's explicit
 * choice is the only authority. No copy here says a Seedling "matches" or is "recognised": the candidates are the grower's own
 * Seedlings, listed for choice, not compared by any model.
 */

export const en = {
  search: {
    retiredIdentifier:
      "This identifier belonged to a Seedling that was merged. It now leads to the Seedling it was merged into.",
    openSeedling: "Open the Seedling",
  },
  capture: {
    question: "Which Seedling is this?",
    questionHint:
      "Choose one of your Seedlings, search your Seedlings, or choose New Seedling. You can change the choice later.",
    searchLabel: "Search your Seedlings",
    searchHint: "Shows only Seedlings you currently hold.",
    noMatches: "None of your Seedlings matches. Choose New Seedling, or search again.",
    newSeedlingApplied: "New Seedling selected.",
  },
  voice: {
    notKeepingHeading: "You said “Not keeping this one”.",
    notKeepingChoose:
      "Choose the Seedling first, then open its continuation. Nothing changes until you confirm there.",
    notKeepingAction: "Open the continuation for this Seedling",
  },
  merge: {
    title: "Merge with another of your Seedlings",
    intro:
      "Use this only when you have confirmed that two DahliaSeedling records represent the same genetically unique Seedling.",
    warning:
      "This merge cannot currently be undone. The duplicate's identifiers stay findable and lead to the Seedling you keep. Its history is kept, but its record is retired.",
    chooseOther: "Which other Seedling is the same plant?",
    noOther: "You have no other active Seedling to merge with.",
    keepThis: "Keep this Seedling",
    keepOther: "Keep the other Seedling",
    confirm:
      "I confirm these records are the same Seedling. I understand the merge cannot currently be undone.",
    submit: "Merge these Seedlings",
    open: "Merge with another Seedling",
    done: "The Seedlings are merged. The duplicate now leads to the Seedling you kept.",
    errors: {
      notAllowed: "You cannot merge these Seedlings.",
      notFound: "One of these Seedlings could not be found.",
      notConfirmed: "Confirm the merge to continue.",
      retired:
        "One of these Seedlings is already merged or inactive, so the merge is not available.",
      differentOriginators:
        "These Seedlings have different originators, so they cannot be merged here.",
      continuation: "Finish or cancel the continuation of these Seedlings first.",
      offer: "Close the seed offers from these Seedlings first.",
      alerts: "Stop the availability alerts for the duplicate first.",
      generic: "The Seedlings could not be merged. Nothing was changed.",
    },
  },
};

export const nl: typeof en = {
  search: {
    retiredIdentifier:
      "Deze identificatie hoorde bij een zaailing die is samengevoegd. Ze leidt nu naar de zaailing waarin die is opgegaan.",
    openSeedling: "Open de zaailing",
  },
  capture: {
    question: "Welke zaailing is dit?",
    questionHint:
      "Kies een van je zaailingen, zoek in je zaailingen of kies Nieuwe zaailing. Je kunt de keuze later wijzigen.",
    searchLabel: "Zoek in je zaailingen",
    searchHint: "Toont alleen zaailingen die je nu kweekt.",
    noMatches: "Geen van je zaailingen komt overeen. Kies Nieuwe zaailing, of zoek opnieuw.",
    newSeedlingApplied: "Nieuwe zaailing gekozen.",
  },
  voice: {
    notKeepingHeading: "Je zei “Deze niet verder kweken”.",
    notKeepingChoose:
      "Kies eerst de zaailing en open daarna de overname. Er verandert niets tot je dat daar bevestigt.",
    notKeepingAction: "Open de overname van deze zaailing",
  },
  merge: {
    title: "Samenvoegen met een andere van je zaailingen",
    intro:
      "Gebruik dit alleen als je hebt bevestigd dat twee DahliaSeedling-dossiers dezelfde genetisch unieke zaailing vertegenwoordigen.",
    warning:
      "Dit samenvoegen kan nu niet ongedaan worden gemaakt. De identificaties van het duplicaat blijven vindbaar en leiden naar de zaailing die je houdt. De geschiedenis blijft bewaard, maar het dossier wordt uitgefaseerd.",
    chooseOther: "Welke andere zaailing is dezelfde plant?",
    noOther: "Je hebt geen andere actieve zaailing om mee samen te voegen.",
    keepThis: "Deze zaailing behouden",
    keepOther: "De andere zaailing behouden",
    confirm:
      "Ik bevestig dat deze dossiers dezelfde zaailing zijn. Ik begrijp dat het samenvoegen nu niet ongedaan kan worden gemaakt.",
    submit: "Deze zaailingen samenvoegen",
    open: "Samenvoegen met een andere zaailing",
    done: "De zaailingen zijn samengevoegd. Het duplicaat leidt nu naar de zaailing die je hebt behouden.",
    errors: {
      notAllowed: "Je kunt deze zaailingen niet samenvoegen.",
      notFound: "Een van deze zaailingen kon niet worden gevonden.",
      notConfirmed: "Bevestig het samenvoegen om door te gaan.",
      retired:
        "Een van deze zaailingen is al samengevoegd of niet actief, dus samenvoegen is niet mogelijk.",
      differentOriginators:
        "Deze zaailingen hebben verschillende oorsprong, dus ze kunnen hier niet worden samengevoegd.",
      continuation: "Rond de overname van deze zaailingen eerst af of annuleer die.",
      offer: "Sluit eerst de zaadaanbiedingen van deze zaailingen.",
      alerts: "Stop eerst de beschikbaarheidsmeldingen voor het duplicaat.",
      generic: "De zaailingen konden niet worden samengevoegd. Er is niets veranderd.",
    },
  },
};

export const fr: typeof en = {
  search: {
    retiredIdentifier:
      "Cet identifiant appartenait à un semis qui a été fusionné. Il mène désormais au semis dans lequel il a été fusionné.",
    openSeedling: "Ouvrir le semis",
  },
  capture: {
    question: "Quel semis est-ce ?",
    questionHint:
      "Choisissez l'un de vos semis, cherchez parmi vos semis, ou choisissez Nouveau semis. Vous pourrez modifier ce choix plus tard.",
    searchLabel: "Chercher parmi vos semis",
    searchHint: "N'affiche que les semis que vous détenez actuellement.",
    noMatches: "Aucun de vos semis ne correspond. Choisissez Nouveau semis, ou cherchez à nouveau.",
    newSeedlingApplied: "Nouveau semis choisi.",
  },
  voice: {
    notKeepingHeading: "Vous avez dit « Je ne garde pas celui-ci ».",
    notKeepingChoose:
      "Choisissez d'abord le semis, puis ouvrez sa transmission. Rien ne change tant que vous ne le confirmez pas là-bas.",
    notKeepingAction: "Ouvrir la transmission de ce semis",
  },
  merge: {
    title: "Fusionner avec un autre de vos semis",
    intro:
      "Utilisez ceci seulement si vous avez confirmé que deux dossiers DahliaSeedling représentent le même semis, génétiquement unique.",
    warning:
      "Cette fusion ne peut pas être annulée pour le moment. Les identifiants du doublon restent consultables et mènent au semis que vous gardez. Son historique est conservé, mais son dossier est retiré.",
    chooseOther: "Quel autre semis est la même plante ?",
    noOther: "Vous n'avez aucun autre semis actif avec lequel fusionner.",
    keepThis: "Garder ce semis",
    keepOther: "Garder l'autre semis",
    confirm:
      "Je confirme que ces dossiers sont le même semis. Je comprends que la fusion ne peut pas être annulée pour le moment.",
    submit: "Fusionner ces semis",
    open: "Fusionner avec un autre semis",
    done: "Les semis sont fusionnés. Le doublon mène désormais au semis que vous avez gardé.",
    errors: {
      notAllowed: "Vous ne pouvez pas fusionner ces semis.",
      notFound: "L'un de ces semis est introuvable.",
      notConfirmed: "Confirmez la fusion pour continuer.",
      retired:
        "L'un de ces semis est déjà fusionné ou inactif, la fusion n'est donc pas disponible.",
      differentOriginators:
        "Ces semis ont des origines différentes, ils ne peuvent donc pas être fusionnés ici.",
      continuation: "Terminez ou annulez d'abord la transmission de ces semis.",
      offer: "Fermez d'abord les offres de graines de ces semis.",
      alerts: "Arrêtez d'abord les alertes de disponibilité du doublon.",
      generic: "Les semis n'ont pas pu être fusionnés. Rien n'a été modifié.",
    },
  },
};

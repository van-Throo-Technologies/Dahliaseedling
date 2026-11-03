/*
 * Continuation (Rehome). The grower's decision is "not keeping this one": another grower may continue the Seedling,
 * and it keeps its identity and origin. Nothing here calls a Seedling defective. Cull is an internal concept only.
 * The canonical states and terms are language-neutral in the database; these words only show them.
 */

export const en = {
  terms: {
    donate: "Donate",
    sell: "Sell",
    trade: "Trade",
  },
  handover: {
    pickup: "Pickup",
    shipping: "Shipping",
    both: "Pickup or shipping",
  },
  panel: {
    title: "Continuation",
    notKeepingLink: "Not keeping this one",
    availableTitle: "Looking for a new grower",
    availableText:
      "Its current grower has decided not to keep growing it, and would like another grower to continue it. It keeps its identity and origin.",
    termLabel: "Terms",
    priceLabel: "Asking price",
    handoverLabel: "Handover",
    noteLabel: "Note from the grower",
    expressInterest: "I'm interested",
    interestRecorded:
      "You have expressed interest. The current grower will choose who continues it.",
    withdrawInterest: "Withdraw my interest",
    signInToInterest: "Sign in to express interest",
    interestedTitle: "Interested growers",
    interestedNone: "No one has expressed interest yet.",
    interestedOnlyHolder: "Only you, as the current grower, can see who is interested.",
    choose: "Choose as new grower",
    chosenTitle: "New grower chosen",
    chosenText:
      "The seedling stays with its current grower until the chosen grower confirms receipt.",
    chosenNotYou: "Another grower has been chosen for this seedling.",
    markSent: "Mark as sent",
    reopen: "Reopen availability",
    withdrawAvailability: "Withdraw availability",
    confirmReceiptLink: "Confirm receipt of this seedling",
    holderFootnote: "You are the current grower of this seedling.",
    declineButton: "Decline",
    declineText:
      "You can decline until the seedling is sent. It then becomes available again, and the current grower chooses again.",
    statusAvailable: "Available",
    statusArranged: "New grower chosen",
    statusSent: "Sent",
  },
  start: {
    title: "Not keeping this one",
    intro:
      "You decide not to keep growing this seedling. Another grower can continue it. Its identity, its origin and its history stay with it.",
    termLegend: "Terms",
    termHint:
      "Choose the arrangement you have in mind. Payment and handover happen between you, outside DahliaSeedling.",
    priceLabel: "Asking price (optional)",
    priceHint: "For information only. DahliaSeedling does not process any payment.",
    handoverLegend: "Handover (optional)",
    noteLabel: "Note (optional)",
    noteHint: "Up to 280 characters. Visible to growers who express interest.",
    makePublicLabel: "Make this seedling public so it can be found",
    makePublicWhy:
      "A seedling looking for a new grower is visible to everyone. Only this seedling's public page is shown. Its private observations, notes and photos stay private.",
    understand: "I understand that the seedling becomes public as described.",
    submit: "Make available",
    cancel: "Back to the seedling",
  },
  receive: {
    title: "Confirm receipt",
    intro:
      "Confirm only when the seedling has reached you. Confirming makes you its current grower in DahliaSeedling. Its origin stays with {originator}, and its history stays with it.",
    submit: "Confirm receipt",
    back: "Back to the seedling",
  },
  provenance: {
    continued: "Continued on {date} by {name}",
    someone: "another grower",
  },
  notice: {
    started: "The seedling is now looking for a new grower.",
    interestRecorded: "Your interest is recorded.",
    interestWithdrawn: "Your interest is withdrawn.",
    chosen: "A new grower is chosen. The seedling stays with you until they confirm receipt.",
    sent: "Marked as sent. The seedling stays with you until receipt is confirmed.",
    reopened: "The seedling is available again.",
    withdrawn: "Availability is withdrawn. The seedling stays with you.",
    declined: "You declined. The seedling is available again.",
    received: "Receipt confirmed. You are now the current grower of this seedling.",
    alreadyReceived: "Receipt was already confirmed.",
    stale: "The current grower has changed, so this continuation has closed without a transfer.",
  },
  errors: {
    notAllowed: "This is not yours to change right now.",
    notAvailable: "This seedling's continuation has changed. Reload the page and try again.",
    makePublicFirst: "Make the seedling public first, so growers can find it.",
    note: "Keep the note to 280 characters or fewer.",
    generic: "The change could not be saved. Try again.",
  },
};

export const nl: typeof en = {
  terms: {
    donate: "Schenken",
    sell: "Verkopen",
    trade: "Ruilen",
  },
  handover: {
    pickup: "Ophalen",
    shipping: "Verzenden",
    both: "Ophalen of verzenden",
  },
  panel: {
    title: "Voortzetting",
    notKeepingLink: "Ik kweek deze niet verder",
    availableTitle: "Zoekt een nieuwe kweker",
    availableText:
      "De huidige kweker kweekt deze zaailing niet verder en zoekt een andere kweker om haar voort te zetten. Ze behoudt haar identiteit en haar oorsprong.",
    termLabel: "Afspraak",
    priceLabel: "Gevraagde prijs",
    handoverLabel: "Overdracht",
    noteLabel: "Notitie van de kweker",
    expressInterest: "Ik heb interesse",
    interestRecorded:
      "Je interesse is vastgelegd. De huidige kweker kiest wie de zaailing voortzet.",
    withdrawInterest: "Mijn interesse intrekken",
    signInToInterest: "Log in om interesse te tonen",
    interestedTitle: "Belangstellenden",
    interestedNone: "Nog niemand heeft interesse getoond.",
    interestedOnlyHolder: "Alleen jij, als huidige kweker, ziet wie belangstelling heeft.",
    choose: "Kies als nieuwe kweker",
    chosenTitle: "Nieuwe kweker gekozen",
    chosenText:
      "De zaailing blijft bij de huidige kweker tot de gekozen kweker de ontvangst bevestigt.",
    chosenNotYou: "Voor deze zaailing is een andere kweker gekozen.",
    markSent: "Markeren als verstuurd",
    reopen: "Beschikbaarheid opnieuw openen",
    withdrawAvailability: "Beschikbaarheid intrekken",
    confirmReceiptLink: "Ontvangst van deze zaailing bevestigen",
    holderFootnote: "Je bent de huidige kweker van deze zaailing.",
    declineButton: "Afwijzen",
    declineText:
      "Je kunt tot het verzenden afwijzen. De zaailing wordt dan weer beschikbaar, en de huidige kweker kiest opnieuw.",
    statusAvailable: "Beschikbaar",
    statusArranged: "Nieuwe kweker gekozen",
    statusSent: "Verstuurd",
  },
  start: {
    title: "Ik kweek deze niet verder",
    intro:
      "Je besluit deze zaailing niet verder te kweken. Een andere kweker kan haar voortzetten. Haar identiteit, haar oorsprong en haar geschiedenis blijven bij haar.",
    termLegend: "Afspraak",
    termHint:
      "Kies de afspraak die je voor ogen hebt. Betaling en overdracht gebeuren tussen jullie, buiten DahliaSeedling.",
    priceLabel: "Gevraagde prijs (optioneel)",
    priceHint: "Alleen ter informatie. DahliaSeedling verwerkt geen betalingen.",
    handoverLegend: "Overdracht (optioneel)",
    noteLabel: "Notitie (optioneel)",
    noteHint: "Maximaal 280 tekens. Zichtbaar voor kwekers die interesse tonen.",
    makePublicLabel: "Maak deze zaailing openbaar, zodat ze gevonden kan worden",
    makePublicWhy:
      "Een zaailing die een nieuwe kweker zoekt, is voor iedereen zichtbaar. Alleen de openbare pagina van deze zaailing wordt getoond. Haar privéwaarnemingen, notities en foto's blijven privé.",
    understand: "Ik begrijp dat de zaailing openbaar wordt zoals hierboven beschreven.",
    submit: "Beschikbaar maken",
    cancel: "Terug naar de zaailing",
  },
  receive: {
    title: "Ontvangst bevestigen",
    intro:
      "Bevestig alleen wanneer de zaailing bij je is aangekomen. Bevestigen maakt jou de huidige kweker in DahliaSeedling. De oorsprong blijft bij {originator}, en de geschiedenis blijft bij de zaailing.",
    submit: "Ontvangst bevestigen",
    back: "Terug naar de zaailing",
  },
  provenance: {
    continued: "Voortgezet op {date} door {name}",
    someone: "een andere kweker",
  },
  notice: {
    started: "De zaailing zoekt nu een nieuwe kweker.",
    interestRecorded: "Je interesse is vastgelegd.",
    interestWithdrawn: "Je interesse is ingetrokken.",
    chosen:
      "Er is een nieuwe kweker gekozen. De zaailing blijft bij jou tot die de ontvangst bevestigt.",
    sent: "Gemarkeerd als verstuurd. De zaailing blijft bij jou tot de ontvangst is bevestigd.",
    reopened: "De zaailing is weer beschikbaar.",
    withdrawn: "De beschikbaarheid is ingetrokken. De zaailing blijft bij jou.",
    declined: "Je hebt afgewezen. De zaailing is weer beschikbaar.",
    received: "Ontvangst bevestigd. Je bent nu de huidige kweker van deze zaailing.",
    alreadyReceived: "De ontvangst was al bevestigd.",
    stale: "De huidige kweker is veranderd, dus deze voortzetting is gesloten zonder overdracht.",
  },
  errors: {
    notAllowed: "Dit kun je nu niet wijzigen.",
    notAvailable:
      "De voortzetting van deze zaailing is veranderd. Laad de pagina opnieuw en probeer het nog eens.",
    makePublicFirst: "Maak de zaailing eerst openbaar, zodat kwekers haar kunnen vinden.",
    note: "Houd de notitie op 280 tekens of minder.",
    generic: "De wijziging kon niet worden opgeslagen. Probeer het opnieuw.",
  },
};

export const fr: typeof en = {
  terms: {
    donate: "Donner",
    sell: "Vendre",
    trade: "Échanger",
  },
  handover: {
    pickup: "Remise en main propre",
    shipping: "Envoi",
    both: "Remise ou envoi",
  },
  panel: {
    title: "Poursuite",
    notKeepingLink: "Je ne poursuis pas ce semis",
    availableTitle: "Recherche un nouveau cultivateur",
    availableText:
      "Son cultivateur actuel ne souhaite plus le poursuivre et voudrait qu'un autre cultivateur le reprenne. Il garde son identité et son origine.",
    termLabel: "Modalités",
    priceLabel: "Prix demandé",
    handoverLabel: "Remise",
    noteLabel: "Note du cultivateur",
    expressInterest: "Je suis intéressé",
    interestRecorded:
      "Votre intérêt est enregistré. Le cultivateur actuel choisit qui poursuit ce semis.",
    withdrawInterest: "Retirer mon intérêt",
    signInToInterest: "Connectez-vous pour exprimer votre intérêt",
    interestedTitle: "Personnes intéressées",
    interestedNone: "Personne n'a encore exprimé d'intérêt.",
    interestedOnlyHolder: "Vous seul, en tant que cultivateur actuel, voyez qui est intéressé.",
    choose: "Choisir comme nouveau cultivateur",
    chosenTitle: "Nouveau cultivateur choisi",
    chosenText:
      "Le semis reste chez son cultivateur actuel jusqu'à ce que le cultivateur choisi confirme la réception.",
    chosenNotYou: "Un autre cultivateur a été choisi pour ce semis.",
    markSent: "Marquer comme envoyé",
    reopen: "Rouvrir la disponibilité",
    withdrawAvailability: "Retirer la disponibilité",
    confirmReceiptLink: "Confirmer la réception de ce semis",
    holderFootnote: "Vous êtes le cultivateur actuel de ce semis.",
    declineButton: "Décliner",
    declineText:
      "Vous pouvez décliner jusqu'à l'envoi du semis. Il redevient alors disponible, et le cultivateur actuel choisit à nouveau.",
    statusAvailable: "Disponible",
    statusArranged: "Nouveau cultivateur choisi",
    statusSent: "Envoyé",
  },
  start: {
    title: "Je ne poursuis pas ce semis",
    intro:
      "Vous décidez de ne plus poursuivre ce semis. Un autre cultivateur peut le reprendre. Son identité, son origine et son historique restent attachés à lui.",
    termLegend: "Modalités",
    termHint:
      "Choisissez les modalités envisagées. Le paiement et la remise se font entre vous, en dehors de DahliaSeedling.",
    priceLabel: "Prix demandé (facultatif)",
    priceHint: "Uniquement à titre d'information. DahliaSeedling ne traite aucun paiement.",
    handoverLegend: "Remise (facultatif)",
    noteLabel: "Note (facultatif)",
    noteHint: "280 caractères maximum. Visible par les cultivateurs qui expriment leur intérêt.",
    makePublicLabel: "Rendre ce semis public pour qu'il puisse être trouvé",
    makePublicWhy:
      "Un semis qui recherche un nouveau cultivateur est visible de tous. Seule la page publique de ce semis est montrée. Ses observations privées, notes et photos restent privées.",
    understand: "Je comprends que le semis devient public comme indiqué ci-dessus.",
    submit: "Rendre disponible",
    cancel: "Retour au semis",
  },
  receive: {
    title: "Confirmer la réception",
    intro:
      "Confirmez seulement lorsque le semis est arrivé chez vous. Confirmer vous en fait le cultivateur actuel dans DahliaSeedling. L'origine reste attachée à {originator}, et l'historique reste attaché au semis.",
    submit: "Confirmer la réception",
    back: "Retour au semis",
  },
  provenance: {
    continued: "Poursuivi le {date} par {name}",
    someone: "un autre cultivateur",
  },
  notice: {
    started: "Le semis recherche maintenant un nouveau cultivateur.",
    interestRecorded: "Votre intérêt est enregistré.",
    interestWithdrawn: "Votre intérêt est retiré.",
    chosen:
      "Un nouveau cultivateur est choisi. Le semis reste chez vous jusqu'à sa confirmation de réception.",
    sent: "Marqué comme envoyé. Le semis reste chez vous jusqu'à la confirmation de réception.",
    reopened: "Le semis est de nouveau disponible.",
    withdrawn: "La disponibilité est retirée. Le semis reste chez vous.",
    declined: "Vous avez décliné. Le semis est de nouveau disponible.",
    received: "Réception confirmée. Vous êtes maintenant le cultivateur actuel de ce semis.",
    alreadyReceived: "La réception était déjà confirmée.",
    stale: "Le cultivateur actuel a changé, donc cette poursuite est close sans transfert.",
  },
  errors: {
    notAllowed: "Vous ne pouvez pas modifier cela pour le moment.",
    notAvailable: "La poursuite de ce semis a changé. Rechargez la page et réessayez.",
    makePublicFirst:
      "Rendez d'abord le semis public, pour que les cultivateurs puissent le trouver.",
    note: "Gardez la note à 280 caractères maximum.",
    generic: "La modification n'a pas pu être enregistrée. Réessayez.",
  },
};

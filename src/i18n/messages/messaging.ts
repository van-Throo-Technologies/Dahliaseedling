/*
 * Messaging: private one-to-one conversations. A conversation is about a specific context (a Seedling, a continuation, a seed
 * offer) or about the grower directly. Messages are never notifications, and they never appear on public pages.
 */

export const en = {
  inbox: {
    title: "Inbox",
    intro:
      "Private conversations with other growers. Each one is about something specific: a seedling, a continuation, a seed offer, or the grower directly.",
    empty: "No conversations yet.",
    emptyText:
      "A conversation starts when you message a grower, or when someone shows interest in one of your continuations or seed offers.",
    withGrower: "With {name}",
    unavailableGrower: "A grower who is not available",
    unread: "New",
    contextDirect: "Private message",
    contextSeedling: "About {name}",
    contextRehome: "About a continuation of {name}",
    contextSeedOffer: "About a seed offer from {name}",
    contextUnavailable: "About something no longer available",
  },
  thread: {
    back: "Back to inbox",
    title: "Conversation with {name}",
    empty: "No messages yet. Say hello, or ask what you need to know.",
    you: "You",
    bodyLabel: "Message",
    photoLabel: "Photograph (optional)",
    photoHint:
      "A JPEG, PNG or WebP image. It is shared only with the two growers in this conversation.",
    send: "Send",
    report: "Report this message",
    blockedHistory:
      "You have blocked this grower. You can still read this history, but neither of you can send new messages.",
    unavailable: "This grower is not available, so new messages cannot be sent.",
    photoAlt: "Photograph sent in this conversation",
  },
  start: {
    direct: "Message this grower",
    seedling: "Message the grower",
    rehome: "Message",
    seedOffer: "Message",
    signIn: "Sign in to message",
  },
  availability: {
    notify: "Notify me if available",
    stop: "Stop notifying me",
    on: "You will be told if this seedling becomes available to continue.",
    off: "You will no longer be told about this seedling.",
    holder: "You hold this seedling, so there is nothing to follow here.",
    signIn: "Sign in to be notified",
  },
  notice: {
    sent: "Message sent.",
    subscribed: "You will be told if this seedling becomes available.",
    unsubscribed: "You will no longer be told about this seedling.",
  },
  errors: {
    notAllowed: "You cannot do that.",
    notFound: "That could not be found.",
    blocked: "Messaging is not available between these growers.",
    empty: "Write a message, or add a photograph.",
    tooLong: "Messages are 2000 characters or fewer.",
    photoType: "Use a JPEG, PNG or WebP image.",
    photoSize: "Photographs must be 2.5 MB or smaller.",
    generic: "That could not be sent. Try again.",
    unavailable: "This cannot be done right now. Try again later.",
  },
};

export const nl: typeof en = {
  inbox: {
    title: "Postvak",
    intro:
      "Privégesprekken met andere kwekers. Elk gesprek gaat over iets concreets: een zaailing, een overname, een zaadaanbod of de kweker zelf.",
    empty: "Nog geen gesprekken.",
    emptyText:
      "Een gesprek begint wanneer je een kweker een bericht stuurt, of wanneer iemand interesse toont in een van je overnames of zaadaanbiedingen.",
    withGrower: "Met {name}",
    unavailableGrower: "Een kweker die niet beschikbaar is",
    unread: "Nieuw",
    contextDirect: "Privébericht",
    contextSeedling: "Over {name}",
    contextRehome: "Over een overname van {name}",
    contextSeedOffer: "Over een zaadaanbod van {name}",
    contextUnavailable: "Over iets dat niet meer beschikbaar is",
  },
  thread: {
    back: "Terug naar het postvak",
    title: "Gesprek met {name}",
    empty: "Nog geen berichten. Zeg hallo, of vraag wat je wilt weten.",
    you: "Jij",
    bodyLabel: "Bericht",
    photoLabel: "Foto (optioneel)",
    photoHint:
      "Een JPEG-, PNG- of WebP-afbeelding. Ze wordt alleen gedeeld met de twee kwekers in dit gesprek.",
    send: "Versturen",
    report: "Dit bericht melden",
    blockedHistory:
      "Je hebt deze kweker geblokkeerd. Je kunt deze geschiedenis nog lezen, maar geen van jullie kan nieuwe berichten sturen.",
    unavailable:
      "Deze kweker is niet beschikbaar, dus er kunnen geen nieuwe berichten worden verstuurd.",
    photoAlt: "Foto die in dit gesprek is verstuurd",
  },
  start: {
    direct: "Stuur deze kweker een bericht",
    seedling: "Stuur de kweker een bericht",
    rehome: "Bericht",
    seedOffer: "Bericht",
    signIn: "Log in om een bericht te sturen",
  },
  availability: {
    notify: "Meld het me als deze beschikbaar is",
    stop: "Niet meer melden",
    on: "Je krijgt bericht als deze zaailing beschikbaar komt om verder te kweken.",
    off: "Je krijgt niet langer bericht over deze zaailing.",
    holder: "Jij kweekt deze zaailing, dus hier is niets om te volgen.",
    signIn: "Log in om op de hoogte te blijven",
  },
  notice: {
    sent: "Bericht verstuurd.",
    subscribed: "Je krijgt bericht als deze zaailing beschikbaar komt.",
    unsubscribed: "Je krijgt niet langer bericht over deze zaailing.",
  },
  errors: {
    notAllowed: "Dat kun je niet doen.",
    notFound: "Dat kon niet worden gevonden.",
    blocked: "Berichten zijn niet mogelijk tussen deze kwekers.",
    empty: "Schrijf een bericht, of voeg een foto toe.",
    tooLong: "Berichten zijn maximaal 2000 tekens.",
    photoType: "Gebruik een JPEG-, PNG- of WebP-afbeelding.",
    photoSize: "Foto's mogen maximaal 2,5 MB zijn.",
    generic: "Dat kon niet worden verstuurd. Probeer het opnieuw.",
    unavailable: "Dit kan nu niet. Probeer het later opnieuw.",
  },
};

export const fr: typeof en = {
  inbox: {
    title: "Messagerie",
    intro:
      "Conversations privées avec d'autres cultivateurs. Chacune porte sur un sujet précis : un semis, une transmission, une offre de graines, ou le cultivateur lui-même.",
    empty: "Aucune conversation pour l'instant.",
    emptyText:
      "Une conversation commence lorsque vous écrivez à un cultivateur, ou lorsque quelqu'un s'intéresse à une de vos transmissions ou offres de graines.",
    withGrower: "Avec {name}",
    unavailableGrower: "Un cultivateur qui n'est pas disponible",
    unread: "Nouveau",
    contextDirect: "Message privé",
    contextSeedling: "À propos de {name}",
    contextRehome: "À propos d'une transmission de {name}",
    contextSeedOffer: "À propos d'une offre de graines de {name}",
    contextUnavailable: "À propos d'un élément qui n'est plus disponible",
  },
  thread: {
    back: "Retour à la messagerie",
    title: "Conversation avec {name}",
    empty: "Aucun message pour l'instant. Dites bonjour, ou demandez ce que vous voulez savoir.",
    you: "Vous",
    bodyLabel: "Message",
    photoLabel: "Photographie (facultatif)",
    photoHint:
      "Une image JPEG, PNG ou WebP. Elle n'est partagée qu'avec les deux cultivateurs de cette conversation.",
    send: "Envoyer",
    report: "Signaler ce message",
    blockedHistory:
      "Vous avez bloqué ce cultivateur. Vous pouvez encore lire cet historique, mais aucun de vous ne peut envoyer de nouveau message.",
    unavailable:
      "Ce cultivateur n'est pas disponible, donc aucun nouveau message ne peut être envoyé.",
    photoAlt: "Photographie envoyée dans cette conversation",
  },
  start: {
    direct: "Écrire à ce cultivateur",
    seedling: "Écrire au cultivateur",
    rehome: "Message",
    seedOffer: "Message",
    signIn: "Connectez-vous pour écrire",
  },
  availability: {
    notify: "Me prévenir si disponible",
    stop: "Ne plus être prévenu",
    on: "Vous serez prévenu si ce semis devient disponible pour être poursuivi.",
    off: "Vous ne serez plus prévenu au sujet de ce semis.",
    holder: "Vous détenez ce semis, il n'y a donc rien à suivre ici.",
    signIn: "Connectez-vous pour être prévenu",
  },
  notice: {
    sent: "Message envoyé.",
    subscribed: "Vous serez prévenu si ce semis devient disponible.",
    unsubscribed: "Vous ne serez plus prévenu au sujet de ce semis.",
  },
  errors: {
    notAllowed: "Vous ne pouvez pas faire cela.",
    notFound: "Introuvable.",
    blocked: "La messagerie n'est pas possible entre ces cultivateurs.",
    empty: "Écrivez un message, ou ajoutez une photographie.",
    tooLong: "Les messages comptent 2000 caractères au maximum.",
    photoType: "Utilisez une image JPEG, PNG ou WebP.",
    photoSize: "Les photographies doivent faire 2,5 Mo au maximum.",
    generic: "Le message n'a pas pu être envoyé. Réessayez.",
    unavailable: "Ceci n'est pas possible pour l'instant. Réessayez plus tard.",
  },
};

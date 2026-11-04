/*
 * Notifications: attention signals, one typed sentence per kind. A notification points at what happened; it is not a message and
 * it never carries message text. Each sentence names the actor when there is one, and falls back to "A grower".
 */

export const en = {
  title: "Notifications",
  intro: "Activity that needs your attention. Your private messages are in the inbox, not here.",
  empty: "Nothing needs your attention right now.",
  emptyText:
    "When someone comments, shows interest, or your seedlings change hands, it will appear here.",
  unread: "New",
  markRead: "Mark as read",
  markAll: "Mark all as read",
  someone: "A grower",
  types: {
    comment: "{name} commented on your Update.",
    reply: "{name} replied to your comment.",
    message: "{name} sent you a private message.",
    rehome_interest: "{name} is interested in continuing a seedling you are offering.",
    rehome_selected: "You have been chosen to continue a seedling.",
    rehome_sent: "The seedling you are continuing is on its way. Confirm once it arrives.",
    rehome_received:
      "A seedling you offered has been continued by another grower. Its identity and origin are kept.",
    seed_offer_interest: "{name} is interested in your seed offer.",
    followed_seedling_update: "{name} shared a new Update on a seedling you follow.",
    availability_trigger: "A seedling you asked about may now be available to continue.",
  },
};

export const nl: typeof en = {
  title: "Meldingen",
  intro:
    "Activiteit die je aandacht nodig heeft. Je privéberichten staan in het postvak, niet hier.",
  empty: "Er is nu niets dat je aandacht nodig heeft.",
  emptyText:
    "Wanneer iemand reageert, interesse toont, of je zaailingen van eigenaar wisselen, verschijnt het hier.",
  unread: "Nieuw",
  markRead: "Markeer als gelezen",
  markAll: "Markeer alles als gelezen",
  someone: "Een kweker",
  types: {
    comment: "{name} heeft gereageerd op je update.",
    reply: "{name} heeft op je reactie geantwoord.",
    message: "{name} heeft je een privébericht gestuurd.",
    rehome_interest: "{name} is geïnteresseerd om een zaailing die je aanbiedt verder te kweken.",
    rehome_selected: "Je bent gekozen om een zaailing verder te kweken.",
    rehome_sent: "De zaailing die je verder kweekt is onderweg. Bevestig zodra hij is aangekomen.",
    rehome_received:
      "Een zaailing die je aanbood wordt door een andere kweker verder gekweekt. Identiteit en herkomst blijven bewaard.",
    seed_offer_interest: "{name} is geïnteresseerd in je zaadaanbod.",
    followed_seedling_update:
      "{name} heeft een nieuwe update gedeeld over een zaailing die je volgt.",
    availability_trigger:
      "Een zaailing waar je naar vroeg, kan nu misschien worden verder gekweekt.",
  },
};

export const fr: typeof en = {
  title: "Notifications",
  intro:
    "Activité qui demande votre attention. Vos messages privés sont dans la messagerie, pas ici.",
  empty: "Rien ne demande votre attention pour l'instant.",
  emptyText:
    "Lorsqu'un cultivateur commente, manifeste son intérêt, ou que vos semis changent de main, cela apparaîtra ici.",
  unread: "Nouveau",
  markRead: "Marquer comme lu",
  markAll: "Tout marquer comme lu",
  someone: "Un cultivateur",
  types: {
    comment: "{name} a commenté votre mise à jour.",
    reply: "{name} a répondu à votre commentaire.",
    message: "{name} vous a envoyé un message privé.",
    rehome_interest: "{name} souhaite poursuivre un semis que vous proposez.",
    rehome_selected: "Vous avez été choisi pour poursuivre un semis.",
    rehome_sent: "Le semis que vous poursuivez est en route. Confirmez son arrivée.",
    rehome_received:
      "Un semis que vous aviez proposé est poursuivi par un autre cultivateur. Son identité et son origine sont conservées.",
    seed_offer_interest: "{name} s'intéresse à votre offre de graines.",
    followed_seedling_update:
      "{name} a partagé une nouvelle mise à jour sur un semis que vous suivez.",
    availability_trigger: "Un semis qui vous intéressait pourrait maintenant être poursuivi.",
  },
};

/*
 * Transactional email copy. Only the availability alert is sent by email in the MVP. Each message names what the grower asked
 * for and where to change it; it makes no offer, recommendation or promise. Seedling names are shown exactly as stored.
 */

export const en = {
  availability: {
    subject: "A Seedling you asked about is now available",
    body: "The Seedling “{name}” is now available to continue. Availability is not a reservation: another grower may act before you.",
    bodyUnnamed:
      "A Seedling you asked about is now available to continue. Availability is not a reservation: another grower may act before you.",
    open: "Open the Seedling page",
    stopHint:
      "You receive this because you asked to be told when this Seedling becomes available. To stop these emails, open the Seedling page and choose “Stop notifying me”.",
  },
};

export const nl: typeof en = {
  availability: {
    subject: "Een zaailing waar je om vroeg is, is nu beschikbaar",
    body: "De zaailing “{name}” is nu beschikbaar om verder te kweken. Beschikbaarheid is geen reservering: een andere kweker kan eerder handelen.",
    bodyUnnamed:
      "Een zaailing waar je om vroeg is, is nu beschikbaar om verder te kweken. Beschikbaarheid is geen reservering: een andere kweker kan eerder handelen.",
    open: "Open de zaailingpagina",
    stopHint:
      "Je ontvangt dit omdat je hebt gevraagd om bericht te krijgen wanneer deze zaailing beschikbaar komt. Om deze e-mails te stoppen, open je de zaailingpagina en kies je “Niet meer melden”.",
  },
};

export const fr: typeof en = {
  availability: {
    subject: "Un semis que vous avez demandé est maintenant disponible",
    body: "Le semis « {name} » est maintenant disponible pour être poursuivi. La disponibilité n'est pas une réservation : un autre cultivateur peut agir avant vous.",
    bodyUnnamed:
      "Un semis que vous avez demandé est maintenant disponible pour être poursuivi. La disponibilité n'est pas une réservation : un autre cultivateur peut agir avant vous.",
    open: "Ouvrir la page du semis",
    stopHint:
      "Vous recevez ce message parce que vous avez demandé à être prévenu lorsque ce semis devient disponible. Pour arrêter ces messages, ouvrez la page du semis et choisissez « Ne plus être prévenu ».",
  },
};

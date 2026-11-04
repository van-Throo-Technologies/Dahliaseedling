/*
 * Safety: blocking and reporting. A report goes to review and is never shown to the grower it concerns. A block stops new
 * private contact in both directions and keeps the history on each side.
 */

export const en = {
  block: {
    block: "Block this grower",
    unblock: "Unblock this grower",
    blocked: "You have blocked this grower.",
    unblocked: "You have unblocked this grower.",
    explain:
      "A blocked grower cannot message you, express interest in your continuations or seed offers, or start a conversation with you. Existing history stays on your side.",
    confirm: "Block",
  },
  report: {
    link: "Report",
    linkUpdate: "Report this Update",
    linkComment: "Report this comment",
    title: "Report",
    reason: "Reason",
    details: "Details (optional)",
    detailsHint: "Only the reviewer sees this. Describe what happened.",
    submit: "Send report",
    reasons: {
      harassment: "Harassment",
      spam: "Spam",
      inappropriate: "Inappropriate content",
      other: "Something else",
    },
    sent: "Thank you. Your report has been sent for review. The grower is not told.",
  },
  errors: {
    rateLimited: "You have reached the limit for this kind of action for now. Try again later.",
    reason: "Choose a reason for the report.",
    details: "Details are 1000 characters or fewer.",
    self: "You cannot report your own content or yourself.",
    notFound: "That could not be found.",
    notAllowed: "You cannot do that.",
    generic: "That could not be sent. Try again.",
  },
};

export const nl: typeof en = {
  block: {
    block: "Blokkeer deze kweker",
    unblock: "Deblokkeer deze kweker",
    blocked: "Je hebt deze kweker geblokkeerd.",
    unblocked: "Je hebt deze kweker gedeblokkeerd.",
    explain:
      "Een geblokkeerde kweker kan je geen berichten sturen, geen interesse tonen in je overnames of zaadaanbiedingen, en geen gesprek met je beginnen. De bestaande geschiedenis blijft aan jouw kant bewaard.",
    confirm: "Blokkeren",
  },
  report: {
    link: "Melden",
    linkUpdate: "Deze update melden",
    linkComment: "Deze reactie melden",
    title: "Melden",
    reason: "Reden",
    details: "Toelichting (optioneel)",
    detailsHint: "Alleen de beoordelaar ziet dit. Beschrijf wat er is gebeurd.",
    submit: "Melding versturen",
    reasons: {
      harassment: "Intimidatie",
      spam: "Spam",
      inappropriate: "Ongepaste inhoud",
      other: "Iets anders",
    },
    sent: "Dank je. Je melding is naar de beoordelaar gestuurd. De kweker wordt niet op de hoogte gesteld.",
  },
  errors: {
    rateLimited:
      "Je hebt voor nu de limiet voor dit soort actie bereikt. Probeer het later opnieuw.",
    reason: "Kies een reden voor de melding.",
    details: "De toelichting is maximaal 1000 tekens.",
    self: "Je kunt je eigen inhoud of jezelf niet melden.",
    notFound: "Dat kon niet worden gevonden.",
    notAllowed: "Dat kun je niet doen.",
    generic: "Dat kon niet worden verstuurd. Probeer het opnieuw.",
  },
};

export const fr: typeof en = {
  block: {
    block: "Bloquer ce cultivateur",
    unblock: "Débloquer ce cultivateur",
    blocked: "Vous avez bloqué ce cultivateur.",
    unblocked: "Vous avez débloqué ce cultivateur.",
    explain:
      "Un cultivateur bloqué ne peut plus vous écrire, manifester son intérêt pour vos transmissions ou offres de graines, ni démarrer une conversation avec vous. L'historique existant reste de votre côté.",
    confirm: "Bloquer",
  },
  report: {
    link: "Signaler",
    linkUpdate: "Signaler cette mise à jour",
    linkComment: "Signaler ce commentaire",
    title: "Signaler",
    reason: "Motif",
    details: "Précisions (facultatif)",
    detailsHint: "Seul l'examinateur voit ceci. Décrivez ce qui s'est passé.",
    submit: "Envoyer le signalement",
    reasons: {
      harassment: "Harcèlement",
      spam: "Spam",
      inappropriate: "Contenu inapproprié",
      other: "Autre chose",
    },
    sent: "Merci. Votre signalement a été envoyé pour examen. Le cultivateur n'en est pas informé.",
  },
  errors: {
    rateLimited:
      "Vous avez atteint la limite pour ce type d'action pour le moment. Réessayez plus tard.",
    reason: "Choisissez un motif pour le signalement.",
    details: "Les précisions comptent 1000 caractères au maximum.",
    self: "Vous ne pouvez pas signaler votre propre contenu ni vous-même.",
    notFound: "Introuvable.",
    notAllowed: "Vous ne pouvez pas faire cela.",
    generic: "Le signalement n'a pas pu être envoyé. Réessayez.",
  },
};

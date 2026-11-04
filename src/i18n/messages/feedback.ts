/*
 * In-app feedback for growers, and its review in the administrator area. Feedback is private: it is not a public Update, comment, report
 * or message. The text a grower writes stays in the language they wrote it in; only the labels here are translated.
 */

export const en = {
  title: "Send feedback",
  intro:
    "Tell us an idea, a problem or how an experience went. Only the people who review feedback can read it. You do not need to attach anything, and you do not need an account outside DahliaSeedling.",
  category: {
    legend: "What is this about?",
    idea: "Idea",
    problem: "Problem",
    experience: "Experience",
  },
  message: {
    label: "Your feedback",
    hint: "Up to 2000 characters. Do not include private notes, messages or passwords.",
    counter: "{count} of 2000 characters",
  },
  submit: "Send feedback",
  submitting: "Sending…",
  sent: "Thank you. Your feedback has been sent.",
  errors: {
    category: "Choose idea, problem or experience.",
    message: "Write a message of 1 to 2000 characters.",
    rateLimited: "You have sent several pieces of feedback today. Please try again tomorrow.",
    notAllowed: "You cannot send feedback from this account.",
    generic: "Your feedback could not be sent. Try again.",
  },
  admin: {
    title: "Feedback",
    intro: "Feedback from growers. Read it, then move it to reviewing or resolved.",
    filterCategory: "Category",
    filterStatus: "Status",
    all: "All",
    status: {
      new: "New",
      reviewing: "Reviewing",
      resolved: "Resolved",
    },
    setStatus: "Set status",
    empty: "No feedback matches these filters.",
    context: "Page",
    version: "Version",
    received: "Received",
    notices: {
      updated: "The status has been updated.",
    },
    errors: {
      notAllowed: "You cannot do that.",
      notFound: "That feedback could not be found.",
      generic: "That could not be done. Try again.",
    },
    link: "Feedback",
  },
};

export const nl: typeof en = {
  title: "Feedback sturen",
  intro:
    "Vertel ons een idee, een probleem of hoe een ervaring verliep. Alleen de mensen die feedback beoordelen, kunnen die lezen. Je hoeft niets bij te voegen en hebt geen account nodig buiten DahliaSeedling.",
  category: {
    legend: "Waar gaat het over?",
    idea: "Idee",
    problem: "Probleem",
    experience: "Ervaring",
  },
  message: {
    label: "Je feedback",
    hint: "Maximaal 2000 tekens. Neem geen privénotities, berichten of wachtwoorden op.",
    counter: "{count} van 2000 tekens",
  },
  submit: "Feedback versturen",
  submitting: "Bezig met versturen…",
  sent: "Dank je. Je feedback is verstuurd.",
  errors: {
    category: "Kies idee, probleem of ervaring.",
    message: "Schrijf een bericht van 1 tot 2000 tekens.",
    rateLimited:
      "Je hebt vandaag al meerdere keren feedback verstuurd. Probeer het morgen opnieuw.",
    notAllowed: "Je kunt vanaf dit account geen feedback versturen.",
    generic: "Je feedback kon niet worden verstuurd. Probeer het opnieuw.",
  },
  admin: {
    title: "Feedback",
    intro: "Feedback van kwekers. Lees hem en zet hem daarna op in behandeling of afgerond.",
    filterCategory: "Categorie",
    filterStatus: "Status",
    all: "Alles",
    status: {
      new: "Nieuw",
      reviewing: "In behandeling",
      resolved: "Afgerond",
    },
    setStatus: "Status instellen",
    empty: "Geen feedback die bij deze filters past.",
    context: "Pagina",
    version: "Versie",
    received: "Ontvangen",
    notices: {
      updated: "De status is bijgewerkt.",
    },
    errors: {
      notAllowed: "Dat kun je niet doen.",
      notFound: "Die feedback kon niet worden gevonden.",
      generic: "Dat kon niet worden uitgevoerd. Probeer het opnieuw.",
    },
    link: "Feedback",
  },
};

export const fr: typeof en = {
  title: "Envoyer un retour",
  intro:
    "Dites-nous une idée, un problème ou comment s'est passée une expérience. Seules les personnes qui examinent les retours peuvent les lire. Vous n'avez rien à joindre et aucun compte extérieur à DahliaSeedling n'est nécessaire.",
  category: {
    legend: "De quoi s'agit-il ?",
    idea: "Idée",
    problem: "Problème",
    experience: "Expérience",
  },
  message: {
    label: "Votre retour",
    hint: "2000 caractères au maximum. N'indiquez ni notes privées, ni messages, ni mots de passe.",
    counter: "{count} sur 2000 caractères",
  },
  submit: "Envoyer le retour",
  submitting: "Envoi en cours…",
  sent: "Merci. Votre retour a été envoyé.",
  errors: {
    category: "Choisissez idée, problème ou expérience.",
    message: "Écrivez un message de 1 à 2000 caractères.",
    rateLimited: "Vous avez envoyé plusieurs retours aujourd'hui. Réessayez demain.",
    notAllowed: "Vous ne pouvez pas envoyer de retour depuis ce compte.",
    generic: "Votre retour n'a pas pu être envoyé. Réessayez.",
  },
  admin: {
    title: "Retours",
    intro:
      "Retours des cultivateurs. Lisez-les, puis passez-les en cours de traitement ou en clôturés.",
    filterCategory: "Catégorie",
    filterStatus: "Statut",
    all: "Tous",
    status: {
      new: "Nouveau",
      reviewing: "En cours de traitement",
      resolved: "Clôturé",
    },
    setStatus: "Définir le statut",
    empty: "Aucun retour ne correspond à ces filtres.",
    context: "Page",
    version: "Version",
    received: "Reçu",
    notices: {
      updated: "Le statut a été mis à jour.",
    },
    errors: {
      notAllowed: "Vous ne pouvez pas faire cela.",
      notFound: "Ce retour est introuvable.",
      generic: "Cette action n'a pas pu aboutir. Réessayez.",
    },
    link: "Retours",
  },
};

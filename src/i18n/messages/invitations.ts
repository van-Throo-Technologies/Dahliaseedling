/* Invitation requests: the public request form and the administrator review. Dutch and French are drafts pending native review. */

export const en = {
  join: {
    title: "Request an invitation",
    intro:
      "DahliaSeedling is a new, invitation-only place for growers who record and share real seedlings. Every Seedling on it is a real, grower-contributed plant.",
    privacyNote:
      "Your email address is used only to send you an invitation if your request is approved. You will not be added to any mailing list. Declined and finished requests are deleted after 90 days.",
    name: "Name",
    nameHint: "The name other growers will know you by.",
    country: "Country",
    countryHint: "Where you grow.",
    email: "Email",
    reason: "Why would you like to join?",
    reasonHint: "Between 10 and 500 characters. Plain text only.",
    submit: "Send request",
    submitting: "Sending…",
    received:
      "Thank you. Your request has been received. If it is approved, you will get an invitation by email.",
    limited: "Many requests have arrived today. Please try again tomorrow.",
    genericError: "Your request could not be sent. Please try again.",
  },
  errors: {
    name: "Enter a name between 2 and 80 characters.",
    country: "Choose your country.",
    email: "Enter a valid email address.",
    reason: "Tell us in 10 to 500 characters.",
  },
  admin: {
    title: "Invitation requests",
    intro:
      "Approve a request, then send the invitation from Supabase (Authentication, Users, Invite user) using the address below. When it has been sent, mark it sent here. Approval alone does not send anything.",
    pending: "Waiting for a decision",
    approved: "Approved, invitation not yet sent",
    none: "Nothing to show.",
    requested: "Requested",
    approve: "Approve",
    decline: "Decline",
    markSent: "Mark invitation sent",
    notices: {
      approved: "The request is approved. Send the invitation from Supabase, then mark it sent.",
      declined: "The request is declined.",
      sent: "The invitation is recorded as sent.",
    },
    errors: {
      alreadyDecided: "This request has already been decided.",
      notApproved: "Only an approved request can be marked as sent.",
      notFound: "That request could not be found.",
      notAllowed: "You do not have permission to do that.",
      generic: "The change could not be saved. Try again.",
    },
  },
};

export const nl: typeof en = {
  join: {
    title: "Vraag een uitnodiging aan",
    intro:
      "DahliaSeedling is een nieuwe plek op uitnodiging voor kwekers die echte zaailingen vastleggen en delen. Elke zaailing erop is een echte plant, ingebracht door een kweker.",
    privacyNote:
      "Je e-mailadres wordt alleen gebruikt om je een uitnodiging te sturen als je aanvraag wordt goedgekeurd. Je wordt aan geen enkele mailinglijst toegevoegd. Afgewezen en afgehandelde aanvragen worden na 90 dagen verwijderd.",
    name: "Naam",
    nameHint: "De naam waarmee andere kwekers je kennen.",
    country: "Land",
    countryHint: "Waar je kweekt.",
    email: "E-mail",
    reason: "Waarom wil je meedoen?",
    reasonHint: "Tussen 10 en 500 tekens. Alleen platte tekst.",
    submit: "Aanvraag versturen",
    submitting: "Bezig met versturen…",
    received:
      "Bedankt. Je aanvraag is ontvangen. Als die wordt goedgekeurd, krijg je een uitnodiging per e-mail.",
    limited: "Er zijn vandaag veel aanvragen binnengekomen. Probeer het morgen opnieuw.",
    genericError: "Je aanvraag kon niet worden verstuurd. Probeer het opnieuw.",
  },
  errors: {
    name: "Vul een naam in van 2 tot 80 tekens.",
    country: "Kies je land.",
    email: "Vul een geldig e-mailadres in.",
    reason: "Vertel het in 10 tot 500 tekens.",
  },
  admin: {
    title: "Uitnodigingsaanvragen",
    intro:
      "Keur een aanvraag goed en verstuur daarna de uitnodiging vanuit Supabase (Authentication, Users, Invite user) met het onderstaande adres. Markeer de uitnodiging hier als verstuurd. Goedkeuren verstuurt zelf niets.",
    pending: "Wacht op een beslissing",
    approved: "Goedgekeurd, uitnodiging nog niet verstuurd",
    none: "Niets om te tonen.",
    requested: "Aangevraagd",
    approve: "Goedkeuren",
    decline: "Afwijzen",
    markSent: "Markeer uitnodiging als verstuurd",
    notices: {
      approved:
        "De aanvraag is goedgekeurd. Verstuur de uitnodiging vanuit Supabase en markeer hem daarna als verstuurd.",
      declined: "De aanvraag is afgewezen.",
      sent: "De uitnodiging is als verstuurd vastgelegd.",
    },
    errors: {
      alreadyDecided: "Over deze aanvraag is al beslist.",
      notApproved: "Alleen een goedgekeurde aanvraag kan als verstuurd worden gemarkeerd.",
      notFound: "Die aanvraag kon niet worden gevonden.",
      notAllowed: "Je hebt geen toestemming om dat te doen.",
      generic: "De wijziging kon niet worden opgeslagen. Probeer het opnieuw.",
    },
  },
};

export const fr: typeof en = {
  join: {
    title: "Demander une invitation",
    intro:
      "DahliaSeedling est un nouvel espace sur invitation, pour les cultivateurs qui enregistrent et partagent de vrais semis. Chaque semis qui s'y trouve est une vraie plante, apportée par un cultivateur.",
    privacyNote:
      "Votre adresse e-mail sert uniquement à vous envoyer une invitation si votre demande est acceptée. Vous ne serez inscrit à aucune liste de diffusion. Les demandes refusées ou closes sont supprimées après 90 jours.",
    name: "Nom",
    nameHint: "Le nom sous lequel les autres cultivateurs vous connaîtront.",
    country: "Pays",
    countryHint: "Où vous cultivez.",
    email: "E-mail",
    reason: "Pourquoi souhaitez-vous rejoindre le site ?",
    reasonHint: "Entre 10 et 500 caractères. Texte brut uniquement.",
    submit: "Envoyer la demande",
    submitting: "Envoi…",
    received:
      "Merci. Votre demande a bien été reçue. Si elle est acceptée, vous recevrez une invitation par e-mail.",
    limited: "De nombreuses demandes sont arrivées aujourd'hui. Réessayez demain.",
    genericError: "Votre demande n'a pas pu être envoyée. Réessayez.",
  },
  errors: {
    name: "Saisissez un nom de 2 à 80 caractères.",
    country: "Choisissez votre pays.",
    email: "Saisissez une adresse e-mail valide.",
    reason: "Dites-nous-le en 10 à 500 caractères.",
  },
  admin: {
    title: "Demandes d'invitation",
    intro:
      "Acceptez une demande, puis envoyez l'invitation depuis Supabase (Authentication, Users, Invite user) à l'adresse ci-dessous. Une fois envoyée, marquez-la comme envoyée ici. L'acceptation n'envoie rien par elle-même.",
    pending: "En attente d'une décision",
    approved: "Acceptée, invitation pas encore envoyée",
    none: "Rien à afficher.",
    requested: "Demandée le",
    approve: "Accepter",
    decline: "Refuser",
    markSent: "Marquer l'invitation comme envoyée",
    notices: {
      approved:
        "La demande est acceptée. Envoyez l'invitation depuis Supabase, puis marquez-la comme envoyée.",
      declined: "La demande est refusée.",
      sent: "L'invitation est enregistrée comme envoyée.",
    },
    errors: {
      alreadyDecided: "Une décision a déjà été prise pour cette demande.",
      notApproved: "Seule une demande acceptée peut être marquée comme envoyée.",
      notFound: "Cette demande est introuvable.",
      notAllowed: "Vous n'avez pas l'autorisation de faire cela.",
      generic: "La modification n'a pas pu être enregistrée. Réessayez.",
    },
  },
};

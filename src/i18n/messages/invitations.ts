/* Invitation requests: the public request form and the administrator review. Dutch and French are drafts pending native review. */

export const en = {
  join: {
    title: "Request an invitation",
    intro:
      "DahliaSeedling is a new, invitation-only place for growers who record and share real seedlings. Every Seedling on it is a real, grower-contributed plant.",
    privacyNote:
      "Your email address is used only to send you an invitation if your request is approved. You will not be added to any mailing list. Declined and finished requests are deleted after 90 days.",
    heroHeading: "Every seedling deserves a chance to be seen.",
    heroAlt:
      "A pink and yellow dahlia in full bloom, with a closed green bud beside it and leaves behind it.",
    requestCta: "Request an invitation",
    storyHeading: "A little story behind DahliaSeedling",
    story1:
      "For years, I've been watching dahlia growers share the beautiful, unique flowers they've grown from seed. Every seedling is different, and that's part of what makes growing dahlias so fascinating.",
    story2:
      "But I've also watched growers make the difficult decision to cull seedlings that don't fit their breeding goals. And quite often, I've found myself thinking, \"I would have loved to grow that one!\"",
    story3: "That's where the idea for DahliaSeedling began.",
    story4:
      "I wanted to create a place where growers could document and showcase their seedlings, share their progress, and give some of those seedlings the opportunity to continue growing in someone else's garden.",
    story5:
      "DahliaSeedling is brand new, and we're building its collection together. You might not see many seedlings when you first join. That's because the photographs, videos and stories come from real growers sharing their own plants.",
    story6:
      "Whether you're breeding dahlias, growing your very first seedlings, or simply fascinated by what can emerge from a single seed, I'd love to welcome you.",
    story7: "Not selected doesn't mean not worth growing.",
    signOffLead: "Personally,",
    signOffName: "Janine",
    signOffRole: "Founder, DahliaSeedling",
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
    visitorLimited: "You have sent several requests in the last hour. Please try again later.",
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
    activity: {
      title: "Activity in the last 24 hours",
      note: "Counts only. No names, addresses or reasons are shown here.",
      requests: "Requests received",
      pending: "Waiting for a decision",
      approved: "Approved",
      declined: "Declined",
      invited: "Invitation sent",
      refusals: "Refused for sending too often",
      visitors: "Different visitors who sent requests",
    },
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
    heroHeading: "Elke zaailing verdient het om gezien te worden.",
    heroAlt:
      "Een roze en gele dahlia in volle bloei, met een gesloten groene knop ernaast en bladeren erachter.",
    requestCta: "Vraag een uitnodiging aan",
    storyHeading: "Een klein verhaal achter DahliaSeedling",
    story1:
      "Al jaren zie ik dahliakwekers hun mooie, unieke bloemen laten zien die ze uit zaad hebben gekweekt. Elke zaailing is anders, en dat maakt het kweken van dahlia's zo fascinerend.",
    story2:
      'Maar ik heb ook gezien hoe kwekers het moeilijke besluit nemen om zaailingen te verwijderen die niet bij hun kweekdoelen passen. En vaak denk ik dan: "Die had ik graag zelf willen kweken!"',
    story3: "Daar begon het idee voor DahliaSeedling.",
    story4:
      "Ik wilde een plek maken waar kwekers hun zaailingen kunnen vastleggen en laten zien, hun voortgang kunnen delen, en sommige van die zaailingen de kans kunnen geven om verder te groeien in de tuin van iemand anders.",
    story5:
      "DahliaSeedling is nieuw, en we bouwen de verzameling samen op. Bij je eerste bezoek zie je misschien nog niet veel zaailingen. Dat komt doordat de foto's, video's en verhalen komen van echte kwekers die hun eigen planten delen.",
    story6:
      "Of je nu dahlia's veredelt, je eerste zaailingen kweekt, of gewoon gefascineerd bent door wat er uit één zaadje kan ontstaan: ik heet je graag welkom.",
    story7: "Niet gekozen betekent niet dat het niet de moeite waard is om te kweken.",
    signOffLead: "Hartelijke groet,",
    signOffName: "Janine",
    signOffRole: "Oprichter, DahliaSeedling",
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
    visitorLimited:
      "Je hebt de laatste uur al meerdere aanvragen verstuurd. Probeer het later opnieuw.",
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
    activity: {
      title: "Activiteit van de afgelopen 24 uur",
      note: "Alleen aantallen. Er worden hier geen namen, adressen of redenen getoond.",
      requests: "Ontvangen aanvragen",
      pending: "Wacht op een beslissing",
      approved: "Goedgekeurd",
      declined: "Afgewezen",
      invited: "Uitnodiging verstuurd",
      refusals: "Geweigerd omdat er te vaak is verstuurd",
      visitors: "Verschillende bezoekers die aanvragen stuurden",
    },
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
    heroHeading: "Chaque semis mérite d'être vu.",
    heroAlt:
      "Un dahlia rose et jaune en pleine floraison, avec un bouton vert fermé à côté et des feuilles derrière.",
    requestCta: "Demander une invitation",
    storyHeading: "Une petite histoire derrière DahliaSeedling",
    story1:
      "Depuis des années, je regarde les cultivateurs de dahlias partager les fleurs magnifiques et uniques qu'ils ont obtenues de semis. Chaque semis est différent, et c'est ce qui rend la culture du dahlia si fascinante.",
    story2:
      "Mais j'ai aussi vu des cultivateurs prendre la décision difficile d'éliminer des semis qui ne correspondent pas à leurs objectifs de sélection. Et bien souvent, je me suis dit : « J'aurais tant aimé cultiver celui-là ! »",
    story3: "C'est de là qu'est née l'idée de DahliaSeedling.",
    story4:
      "Je voulais créer un espace où les cultivateurs pourraient documenter et présenter leurs semis, partager leur progression, et donner à certains de ces semis la chance de continuer à pousser dans le jardin de quelqu'un d'autre.",
    story5:
      "DahliaSeedling est tout récent, et nous construisons sa collection ensemble. Vous ne verrez peut-être pas beaucoup de semis lors de votre première visite. C'est parce que les photos, vidéos et récits proviennent de vrais cultivateurs qui partagent leurs propres plantes.",
    story6:
      "Que vous soyez sélectionneur de dahlias, que vous cultiviez vos tout premiers semis ou que vous soyez simplement fasciné par ce qui peut naître d'une seule graine, j'ai hâte de vous accueillir.",
    story7: "Ne pas être retenu ne veut pas dire que cela ne vaut pas la peine d'être cultivé.",
    signOffLead: "Bien à vous,",
    signOffName: "Janine",
    signOffRole: "Fondatrice, DahliaSeedling",
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
    visitorLimited:
      "Vous avez envoyé plusieurs demandes au cours de la dernière heure. Réessayez plus tard.",
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
    activity: {
      title: "Activité des dernières 24 heures",
      note: "Chiffres uniquement. Aucun nom, adresse ou motif n'est affiché ici.",
      requests: "Demandes reçues",
      pending: "En attente d'une décision",
      approved: "Acceptées",
      declined: "Refusées",
      invited: "Invitation envoyée",
      refusals: "Refusées pour envoi trop fréquent",
      visitors: "Visiteurs différents ayant envoyé une demande",
    },
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

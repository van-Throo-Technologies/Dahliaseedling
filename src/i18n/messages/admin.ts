/*
 * Administrator report review. Every word here is for the moderator, not the grower who reported. Report reasons and the
 * target and status names are canonical in the database; these words only show them. User-authored report details are never
 * translated, and nothing here displays them as if they were copy.
 */

export const en = {
  nav: {
    label: "Administration",
    administration: "Administration",
  },
  accounts: {
    title: "Accounts",
    link: "Accounts",
    intro:
      "Suspend or reinstate an account directly, with a reason. Every change is recorded in the administrator audit log. You cannot suspend your own account.",
    profileId: "Profile identifier",
    profileIdHint: "The identifier of the profile to change.",
    reason: "Reason",
    reasonHint: "Between 10 and 500 characters. Written for the audit record.",
    suspend: "Suspend account",
    restore: "Reinstate account",
    notices: {
      suspended: "The account is suspended.",
      restored: "The account is reinstated.",
    },
    errors: {
      notAllowed: "You cannot do that.",
      notFound: "That profile could not be found.",
      ownAccount: "You cannot suspend your own account.",
      reason: "Give a reason of 10 to 500 characters.",
      generic: "That could not be done. Try again.",
    },
  },
  reports: {
    title: "Reports",
    intro:
      "Reports from growers about public Updates, comments, profiles and private messages. Review starts here, and nothing else is shown.",
    empty: "No reports are waiting for review.",
    filterOpen: "Waiting for review",
    filterAll: "All reports",
    statusLabel: {
      open: "Waiting",
      reviewed: "Reviewed",
      actioned: "Actioned",
      dismissed: "Dismissed",
    },
    targetLabel: {
      update: "Public Update",
      comment: "Comment",
      profile: "Profile",
      message: "Private message",
    },
    reporter: "Reported by {name}",
    unnamed: "Name not shown",
    reported: "Grower: {name}",
    reportedAt: "Reported {date}",
    snapshotTitle: "Content when it was reported",
    snapshotEmpty: "No text was saved with this report.",
    messageNote:
      "Private message: only the text saved when it was reported is shown here. The conversation is not opened from this page.",
    notLive: "Removed, hidden or no longer public. The saved text above is the record.",
    openTarget: "Open the public page",
    suspended: "Suspended",
    active: "Active",
    actions: {
      review: "Mark as reviewed",
      actioned: "Mark as actioned",
      dismiss: "Dismiss",
      remove: "Remove from public view",
      suspend: "Suspend account",
      restore: "Lift suspension",
    },
    helpers: {
      remove: "Hides this Update or comment from the public. Its record is kept.",
      suspend:
        "The grower cannot take part until the suspension is lifted. Their content is not deleted.",
      restore: "The grower can take part again.",
    },
    notices: {
      resolved: "Report updated.",
      removed: "Content removed from public view.",
      suspended: "Account suspended.",
      restored: "Suspension lifted.",
    },
    errors: {
      notAllowed: "You cannot do that.",
      notFound: "That report could not be found.",
      generic: "That could not be done. Try again.",
      alreadyResolved: "This report has already been resolved.",
      notRemovable: "Only a public Update or comment can be removed.",
      ownAccount: "You cannot suspend your own account from a report.",
    },
  },
};

export const nl: typeof en = {
  nav: {
    label: "Beheer",
    administration: "Beheer",
  },
  accounts: {
    title: "Accounts",
    link: "Accounts",
    intro:
      "Schort een account direct op of heft die op, met een reden. Elke wijziging wordt vastgelegd in het auditlogboek van beheerders. Je kunt je eigen account niet opschorten.",
    profileId: "Profielidentificatie",
    profileIdHint: "De identificatie van het profiel dat je wilt wijzigen.",
    reason: "Reden",
    reasonHint: "Tussen 10 en 500 tekens. Bedoeld voor het auditlogboek.",
    suspend: "Account opschorten",
    restore: "Account herstellen",
    notices: {
      suspended: "Het account is opgeschort.",
      restored: "Het account is hersteld.",
    },
    errors: {
      notAllowed: "Dat kun je niet doen.",
      notFound: "Dat profiel kon niet worden gevonden.",
      ownAccount: "Je kunt je eigen account niet opschorten.",
      reason: "Geef een reden van 10 tot 500 tekens.",
      generic: "Dat kon niet worden uitgevoerd. Probeer het opnieuw.",
    },
  },
  reports: {
    title: "Meldingen",
    intro:
      "Meldingen van kwekers over openbare updates, reacties, profielen en privéberichten. De beoordeling begint hier, en er wordt niets anders getoond.",
    empty: "Er wachten geen meldingen op beoordeling.",
    filterOpen: "Wacht op beoordeling",
    filterAll: "Alle meldingen",
    statusLabel: {
      open: "Wachtend",
      reviewed: "Beoordeeld",
      actioned: "Afgehandeld",
      dismissed: "Afgewezen",
    },
    targetLabel: {
      update: "Openbare update",
      comment: "Reactie",
      profile: "Profiel",
      message: "Privébericht",
    },
    reporter: "Gemeld door {name}",
    unnamed: "Naam niet getoond",
    reported: "Kweker: {name}",
    reportedAt: "Gemeld op {date}",
    snapshotTitle: "Inhoud op het moment van melden",
    snapshotEmpty: "Bij deze melding is geen tekst opgeslagen.",
    messageNote:
      "Privébericht: alleen de tekst die bij het melden is opgeslagen, wordt hier getoond. Het gesprek wordt vanaf deze pagina niet geopend.",
    notLive:
      "Verwijderd, verborgen of niet meer openbaar. De opgeslagen tekst hierboven is het bewijs.",
    openTarget: "De openbare pagina openen",
    suspended: "Geschorst",
    active: "Actief",
    actions: {
      review: "Markeren als beoordeeld",
      actioned: "Markeren als afgehandeld",
      dismiss: "Afwijzen",
      remove: "Uit de openbaarheid halen",
      suspend: "Account schorsen",
      restore: "Schorsing opheffen",
    },
    helpers: {
      remove: "Verbergt deze update of reactie voor het publiek. Het dossier blijft bewaard.",
      suspend:
        "De kweker kan niet meedoen zolang de schorsing duurt. Hun inhoud wordt niet verwijderd.",
      restore: "De kweker kan weer meedoen.",
    },
    notices: {
      resolved: "Melding bijgewerkt.",
      removed: "Inhoud uit de openbaarheid gehaald.",
      suspended: "Account geschorst.",
      restored: "Schorsing opgeheven.",
    },
    errors: {
      notAllowed: "Dat kun je niet doen.",
      notFound: "Die melding kon niet worden gevonden.",
      generic: "Dat kon niet worden uitgevoerd. Probeer het opnieuw.",
      alreadyResolved: "Deze melding is al afgehandeld.",
      notRemovable: "Alleen een openbare update of reactie kan worden verwijderd.",
      ownAccount: "Je kunt je eigen account niet via een melding schorsen.",
    },
  },
};

export const fr: typeof en = {
  nav: {
    label: "Administration",
    administration: "Administration",
  },
  accounts: {
    title: "Comptes",
    link: "Comptes",
    intro:
      "Suspendez ou rétablissez un compte directement, avec un motif. Chaque modification est consignée dans le journal d'audit des administrateurs. Vous ne pouvez pas suspendre votre propre compte.",
    profileId: "Identifiant du profil",
    profileIdHint: "L'identifiant du profil à modifier.",
    reason: "Motif",
    reasonHint: "Entre 10 et 500 caractères. Rédigé pour le journal d'audit.",
    suspend: "Suspendre le compte",
    restore: "Rétablir le compte",
    notices: {
      suspended: "Le compte est suspendu.",
      restored: "Le compte est rétabli.",
    },
    errors: {
      notAllowed: "Vous ne pouvez pas faire cela.",
      notFound: "Ce profil est introuvable.",
      ownAccount: "Vous ne pouvez pas suspendre votre propre compte.",
      reason: "Indiquez un motif de 10 à 500 caractères.",
      generic: "Cette action n'a pas pu aboutir. Réessayez.",
    },
  },
  reports: {
    title: "Signalements",
    intro:
      "Signalements de cultivateurs concernant les mises à jour publiques, les commentaires, les profils et les messages privés. L'examen commence ici, et rien d'autre n'est affiché.",
    empty: "Aucun signalement n'attend d'examen.",
    filterOpen: "En attente d'examen",
    filterAll: "Tous les signalements",
    statusLabel: {
      open: "En attente",
      reviewed: "Examiné",
      actioned: "Traité",
      dismissed: "Rejeté",
    },
    targetLabel: {
      update: "Mise à jour publique",
      comment: "Commentaire",
      profile: "Profil",
      message: "Message privé",
    },
    reporter: "Signalé par {name}",
    unnamed: "Nom non affiché",
    reported: "Cultivateur : {name}",
    reportedAt: "Signalé le {date}",
    snapshotTitle: "Contenu au moment du signalement",
    snapshotEmpty: "Aucun texte n'a été enregistré avec ce signalement.",
    messageNote:
      "Message privé : seul le texte enregistré au moment du signalement est affiché ici. La conversation n'est pas ouverte depuis cette page.",
    notLive: "Retiré, masqué ou plus public. Le texte enregistré ci-dessus fait foi.",
    openTarget: "Ouvrir la page publique",
    suspended: "Suspendu",
    active: "Actif",
    actions: {
      review: "Marquer comme examiné",
      actioned: "Marquer comme traité",
      dismiss: "Rejeter",
      remove: "Retirer de l'affichage public",
      suspend: "Suspendre le compte",
      restore: "Lever la suspension",
    },
    helpers: {
      remove: "Masque cette mise à jour ou ce commentaire au public. Le dossier est conservé.",
      suspend:
        "Le cultivateur ne peut pas participer tant que la suspension dure. Son contenu n'est pas supprimé.",
      restore: "Le cultivateur peut à nouveau participer.",
    },
    notices: {
      resolved: "Signalement mis à jour.",
      removed: "Contenu retiré de l'affichage public.",
      suspended: "Compte suspendu.",
      restored: "Suspension levée.",
    },
    errors: {
      notAllowed: "Vous ne pouvez pas faire cela.",
      notFound: "Ce signalement est introuvable.",
      generic: "Cette action n'a pas pu aboutir. Réessayez.",
      alreadyResolved: "Ce signalement a déjà été traité.",
      notRemovable: "Seule une mise à jour ou un commentaire public peut être retiré.",
      ownAccount: "Vous ne pouvez pas suspendre votre propre compte depuis un signalement.",
    },
  },
};

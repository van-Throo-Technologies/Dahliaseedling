/*
 * Privacy settings: deactivation, erasure, and the data export. These texts describe what the product does today. They are not legal
 * terms. The privacy notice and the Terms of Use are not published by this phase, and must be reviewed by a qualified legal adviser first.
 */

export const en = {
  formerGrower: "Former grower",
  link: "Privacy and your data",
  title: "Privacy and your data",
  intro:
    "You can download a copy of your data, deactivate your account, and request erasure of your personal content. Deactivation takes effect at once. Erasure clears what you control, and it shows each step that is still outstanding.",
  state: {
    label: "Account status",
    active: "Active",
    deactivated: "Deactivated. You cannot post, comment, message or express interest.",
    pendingErasure:
      "Erasure in progress. Your personal content has been cleared, and the steps below are still outstanding.",
    erased: "Erased.",
  },
  export: {
    heading: "Download your data",
    body: "The download is a ZIP file with your records as JSON, and your original photos and videos. It includes what is yours. It does not include other people's profiles, private notes, identities or reports about you. The file is created when you ask for it and is not stored on our servers.",
    action: "Download my data",
  },
  deactivate: {
    heading: "Deactivate your account",
    body: "Deactivation takes effect immediately. You cannot take new actions afterwards. Active Rehome cases you have not yet sent are cancelled, and active Seed Offers are closed. Cases you have already sent stay as they are. Your Seedlings stay recorded with you as their last holder.",
    confirm: "I understand that deactivation takes effect immediately.",
    action: "Deactivate my account",
    done: "Your account is deactivated.",
  },
  erasure: {
    heading: "Erase your personal content",
    body: "Erasure clears your name, bio, region, avatar, and the text of your comments, observations and Update captions. Your Updates leave public view. Seedling records, identifiers, parentage and transfer history stay, so that botanical history is kept. Messages you sent stay in the other person's conversation, with you shown as a former grower. Erasure cannot be undone.",
    confirm: "I understand that erasure cannot be undone.",
    action: "Request erasure",
    requested: "Erasure has been requested. The steps below show what is still outstanding.",
    pendingHeading: "Erasure steps",
    steps: {
      recordsCleared: "Personal content cleared",
      avatarRemoved: "Profile photo removed",
      mediaPurge: "Original media removal",
      authIdentity: "Sign-in identity removal",
    },
    done: "Done",
    outstanding: "Outstanding",
    outstandingNote:
      "Original media removal and sign-in identity removal are not available yet. Erasure is not complete until both are done.",
  },
  errors: {
    notConfirmed: "Tick the box to confirm before continuing.",
    notAllowed: "You cannot do that.",
    notDeactivated: "Deactivate your account before requesting erasure.",
    generic: "That could not be done. Try again.",
  },
};

export const nl: typeof en = {
  formerGrower: "Voormalige kweker",
  link: "Privacy en je gegevens",
  title: "Privacy en je gegevens",
  intro:
    "Je kunt een kopie van je gegevens downloaden, je account deactiveren en vragen om wissing van je persoonlijke inhoud. Deactivering gaat meteen in. Bij wissing worden de gegevens die jij beheert gewist, en zie je welke stappen nog openstaan.",
  state: {
    label: "Accountstatus",
    active: "Actief",
    deactivated:
      "Gedeactiveerd. Je kunt niet meer plaatsen, reageren, berichten sturen of interesse tonen.",
    pendingErasure:
      "Wissing loopt. Je persoonlijke inhoud is gewist. De onderstaande stappen staan nog open.",
    erased: "Gewist.",
  },
  export: {
    heading: "Je gegevens downloaden",
    body: "De download is een ZIP-bestand met je gegevens als JSON, en je originele foto's en video's. Het bevat wat van jou is. Het bevat geen profielen van anderen, privé-notities, identiteiten of meldingen over jou. Het bestand wordt gemaakt wanneer je erom vraagt en wordt niet op onze servers bewaard.",
    action: "Mijn gegevens downloaden",
  },
  deactivate: {
    heading: "Je account deactiveren",
    body: "Deactivering gaat meteen in. Daarna kun je geen nieuwe acties meer ondernemen. Actieve Rehome-verzoeken die je nog niet hebt verstuurd, worden geannuleerd, en actieve Zaadaanbiedingen worden gesloten. Verzoeken die je al hebt verstuurd, blijven zoals ze zijn. Je zaailingen blijven geregistreerd met jou als laatste houder.",
    confirm: "Ik begrijp dat deactivering meteen ingaat.",
    action: "Mijn account deactiveren",
    done: "Je account is gedeactiveerd.",
  },
  erasure: {
    heading: "Je persoonlijke inhoud wissen",
    body: "Bij wissing worden je naam, bio, regio, avatar en de tekst van je reacties, waarnemingen en updatebijschriften gewist. Je updates verdwijnen uit het openbare overzicht. Zaailinggegevens, identificaties, verwantschap en overdrachtsgeschiedenis blijven bewaard, zodat de botanische geschiedenis behouden blijft. Berichten die je hebt verstuurd, blijven in het gesprek van de ander, met jou als voormalige kweker. Wissen kan niet ongedaan worden gemaakt.",
    confirm: "Ik begrijp dat wissen niet ongedaan kan worden gemaakt.",
    action: "Wissing aanvragen",
    requested: "Wissing is aangevraagd. De stappen hieronder laten zien wat nog openstaat.",
    pendingHeading: "Stappen bij wissing",
    steps: {
      recordsCleared: "Persoonlijke inhoud gewist",
      avatarRemoved: "Profielfoto verwijderd",
      mediaPurge: "Verwijderen van originele media",
      authIdentity: "Verwijderen van de inlogidentiteit",
    },
    done: "Klaar",
    outstanding: "Openstaand",
    outstandingNote:
      "Het verwijderen van originele media en van de inlogidentiteit is nog niet beschikbaar. De wissing is pas compleet als beide zijn gedaan.",
  },
  errors: {
    notConfirmed: "Vink het vakje aan om te bevestigen voordat je doorgaat.",
    notAllowed: "Dat kun je niet doen.",
    notDeactivated: "Deactiveer je account voordat je wissing aanvraagt.",
    generic: "Dat kon niet worden uitgevoerd. Probeer het opnieuw.",
  },
};

export const fr: typeof en = {
  formerGrower: "Ancien cultivateur",
  link: "Confidentialité et vos données",
  title: "Confidentialité et vos données",
  intro:
    "Vous pouvez télécharger une copie de vos données, désactiver votre compte et demander l'effacement de votre contenu personnel. La désactivation prend effet immédiatement. L'effacement supprime ce que vous contrôlez, et indique chaque étape encore en attente.",
  state: {
    label: "État du compte",
    active: "Actif",
    deactivated:
      "Désactivé. Vous ne pouvez plus publier, commenter, écrire de messages ni exprimer d'intérêt.",
    pendingErasure:
      "Effacement en cours. Votre contenu personnel a été supprimé. Les étapes ci-dessous sont encore en attente.",
    erased: "Effacé.",
  },
  export: {
    heading: "Télécharger vos données",
    body: "Le téléchargement est une archive ZIP contenant vos données au format JSON, ainsi que vos photos et vidéos originales. Il comprend ce qui vous appartient. Il ne comprend ni les profils d'autres personnes, ni leurs notes privées, ni leurs identités, ni les signalements vous concernant. L'archive est créée à votre demande et n'est pas conservée sur nos serveurs.",
    action: "Télécharger mes données",
  },
  deactivate: {
    heading: "Désactiver votre compte",
    body: "La désactivation prend effet immédiatement. Vous ne pourrez plus entreprendre de nouvelles actions. Les demandes de cession actives que vous n'avez pas encore envoyées sont annulées, et les offres de graines actives sont fermées. Les demandes déjà envoyées restent telles quelles. Vos semis restent enregistrés avec vous comme dernier détenteur.",
    confirm: "Je comprends que la désactivation prend effet immédiatement.",
    action: "Désactiver mon compte",
    done: "Votre compte est désactivé.",
  },
  erasure: {
    heading: "Effacer votre contenu personnel",
    body: "L'effacement supprime votre nom, votre bio, votre région, votre avatar, ainsi que le texte de vos commentaires, de vos observations et des légendes de vos mises à jour. Vos mises à jour disparaissent de l'affichage public. Les fiches de semis, identifiants, liens de parenté et historique de cession sont conservés, afin de préserver l'histoire botanique. Les messages que vous avez envoyés restent dans la conversation de l'autre personne, où vous apparaissez comme ancien cultivateur. L'effacement est irréversible.",
    confirm: "Je comprends que l'effacement est irréversible.",
    action: "Demander l'effacement",
    requested:
      "L'effacement a été demandé. Les étapes ci-dessous indiquent ce qui reste en attente.",
    pendingHeading: "Étapes de l'effacement",
    steps: {
      recordsCleared: "Contenu personnel supprimé",
      avatarRemoved: "Photo de profil supprimée",
      mediaPurge: "Suppression des médias originaux",
      authIdentity: "Suppression de l'identité de connexion",
    },
    done: "Terminé",
    outstanding: "En attente",
    outstandingNote:
      "La suppression des médias originaux et de l'identité de connexion n'est pas encore disponible. L'effacement n'est complet que lorsque les deux sont faites.",
  },
  errors: {
    notConfirmed: "Cochez la case pour confirmer avant de continuer.",
    notAllowed: "Vous ne pouvez pas faire cela.",
    notDeactivated: "Désactivez votre compte avant de demander l'effacement.",
    generic: "Cette action n'a pas pu aboutir. Réessayez.",
  },
};

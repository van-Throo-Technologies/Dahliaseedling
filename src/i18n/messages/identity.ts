/* Sign-in, sign-up, profile setup and editing, and the public and own profile pages. */

export const en = {
  chooseCountry: "Choose a country",
  signIn: {
    title: "Sign in",
    intro: "An account lets you document Seedlings, share Updates and take part in the community.",
    submit: "Sign in",
    submitting: "Signing in…",
    newHere: "New to DahliaSeedling?",
    createAccount: "Create an account",
    badCredentials: "That email and password do not match an account.",
    passwordRequired: "Enter your password.",
  },
  signUp: {
    title: "Create an account",
    intro: "You will set up your profile next. Only your display name and country are required.",
    passwordHint: "At least 8 characters.",
    submit: "Create account",
    submitting: "Creating account…",
    goSignIn: "Go to sign in",
    haveAccount: "Already have an account?",
    signIn: "Sign in",
    saved: "Check your email to confirm your account, then sign in.",
    genericError:
      "We could not create an account with those details. Try signing in, or use a different email.",
    invitationOnly:
      "New accounts are by invitation only for now. If you have been invited, open the link in your invitation email.",
  },
  confirm: {
    expired:
      "This link has expired or has already been used. Sign in, or contact us for a new invitation.",
    invalid:
      "This link is not valid. Check that you opened the whole link from your email, or contact us for a new one.",
    signedUp: "Your email is confirmed. Set up your profile to continue.",
  },
  setPassword: {
    title: "Choose a password",
    intro: "Your invitation is confirmed. Choose a password to finish setting up your account.",
    submit: "Save password",
    submitting: "Saving…",
    error:
      "We could not save your password. Try again. If the link has expired, contact us for a new invitation.",
    closedTitle: "Invitation only",
    notInvited:
      "This page is only for finishing an invitation. Your password is already set, so nothing changes here. If you have forgotten your password, contact us.",
  },
  recovery: {
    forgotLink: "Forgot password?",
    forgotTitle: "Reset your password",
    forgotIntro:
      "Enter the email address of your account. If it belongs to an account, we will send a link to choose a new password.",
    forgotSubmit: "Send reset link",
    forgotSubmitting: "Sending…",
    forgotSent:
      "If an account exists for that address, a reset link is on its way. Check your inbox and spam folder.",
    forgotRateLimited: "Too many reset requests. Wait a few minutes, then try again.",
    expired: "That reset link has expired or has already been used. Request a new one below.",
    invalid: "That reset link is not valid. Request a new one below.",
    resetTitle: "Choose a new password",
    resetIntro: "Choose a new password for your account.",
    resetSubmit: "Save new password",
    resetSubmitting: "Saving…",
    resetError: "We could not save your password. Request a new reset link and try again.",
    resetDone: "Your password is updated. Sign in with it to continue.",
    resetClosed:
      "This page is only for choosing a new password from a reset link. Request a new link to continue.",
  },
  fields: {
    email: "Email",
    password: "Password",
    displayName: "Display name",
    displayNameHint:
      "This is how other growers see you. It can be a person's name or a breeder or farm name.",
    country: "Country",
    countryHint: "Shown on your public profile.",
    regionCity: "Region or city (optional)",
    bio: "Bio (optional)",
    bioHint: "Up to {max} characters. Plain text only.",
    accountType: "How you describe yourself (optional)",
    accountTypeNotSpecified: "Not specified",
    accountTypeIndividual: "Individual grower",
    accountTypeBreeder: "Breeder",
    accountTypeFarm: "Farm",
    accountTypeHint: "A label for your profile only. It does not change what you can do.",
    avatar: "Profile photo (optional)",
    avatarHint: "JPEG, PNG or WebP, up to 2 MB. Leave empty to keep your current photo.",
  },
  setup: {
    title: "Set up your profile",
    intro:
      "Two things to start: a display name and your country. A profile is needed before you can share, capture or message, and you can add a photo, region and bio later. Browsing stays open.",
    submit: "Continue",
    submitting: "Saving…",
  },
  edit: {
    title: "Edit your profile",
    submit: "Save profile",
    saved: "Your profile is saved.",
    saveError: "Your changes could not be saved. Try again.",
  },
  profile: {
    title: "Your profile",
    suspended:
      "Your account is suspended. You can still see your profile, but you cannot edit it or take part until it is reinstated.",
    editProfile: "Edit profile",
    viewPublic: "View public profile",
    signOut: "Sign out",
    yourSeedlings: "Your seedlings",
    newSeedling: "New seedling",
    series: "Series",
    noSeedlings: "No seedlings yet. A new seedling stays private until you choose otherwise.",
    memberSince: "Member since {month}",
  },
  publicProfile: {
    sections: "Profile sections",
    tabSeedlings: "Seedlings",
    tabOriginated: "Originated",
    tabUpdates: "Updates",
    noUpdates: "No public Updates yet.",
    noHeld: "No public seedlings are held here yet.",
    noOriginated: "No public seedlings are recorded as originated here yet.",
    noPhoto: "No photo yet",
    unnamedSeedling: "Unnamed seedling",
    notFound: "Profile not found",
  },
  placeholder: {
    inboxTitle: "Inbox",
    inboxMessage: "Messages are not available yet. Private conversations will appear here.",
    notificationsTitle: "Notifications",
    notificationsMessage:
      "Notifications are not available yet. Activity that needs your attention will appear here.",
  },
};

export const nl: typeof en = {
  chooseCountry: "Kies een land",
  signIn: {
    title: "Inloggen",
    intro:
      "Met een account documenteer je zaailingen, deel je updates en doe je mee met de community.",
    submit: "Inloggen",
    submitting: "Bezig met inloggen…",
    newHere: "Nieuw bij DahliaSeedling?",
    createAccount: "Maak een account aan",
    badCredentials: "Die combinatie van e-mailadres en wachtwoord hoort bij geen account.",
    passwordRequired: "Vul je wachtwoord in.",
  },
  signUp: {
    title: "Account aanmaken",
    intro: "Daarna stel je je profiel in. Alleen je weergavenaam en je land zijn verplicht.",
    passwordHint: "Minstens 8 tekens.",
    submit: "Account aanmaken",
    submitting: "Account wordt aangemaakt…",
    goSignIn: "Naar inloggen",
    haveAccount: "Heb je al een account?",
    signIn: "Inloggen",
    saved: "Controleer je e-mail om je account te bevestigen, en log daarna in.",
    genericError:
      "We konden met deze gegevens geen account aanmaken. Probeer in te loggen, of gebruik een ander e-mailadres.",
    invitationOnly:
      "Nieuwe accounts zijn voorlopig alleen op uitnodiging. Heb je een uitnodiging ontvangen, open dan de link in die e-mail.",
  },
  confirm: {
    expired:
      "Deze link is verlopen of al gebruikt. Log in, of vraag ons om een nieuwe uitnodiging.",
    invalid:
      "Deze link is niet geldig. Controleer of je de volledige link uit je e-mail hebt geopend, of vraag ons om een nieuwe.",
    signedUp: "Je e-mailadres is bevestigd. Stel je profiel in om verder te gaan.",
  },
  setPassword: {
    title: "Kies een wachtwoord",
    intro: "Je uitnodiging is bevestigd. Kies een wachtwoord om je account af te ronden.",
    submit: "Wachtwoord opslaan",
    submitting: "Bezig met opslaan…",
    error:
      "We konden je wachtwoord niet opslaan. Probeer het opnieuw. Is de link verlopen, vraag ons dan om een nieuwe uitnodiging.",
    closedTitle: "Alleen op uitnodiging",
    notInvited:
      "Deze pagina is alleen om een uitnodiging af te ronden. Je wachtwoord is al ingesteld, dus hier verandert niets. Ben je je wachtwoord vergeten, neem dan contact met ons op.",
  },
  recovery: {
    forgotLink: "Wachtwoord vergeten?",
    forgotTitle: "Stel je wachtwoord opnieuw in",
    forgotIntro:
      "Vul het e-mailadres van je account in. Hoort het bij een account, dan sturen we een link om een nieuw wachtwoord te kiezen.",
    forgotSubmit: "Stuur resetlink",
    forgotSubmitting: "Bezig met versturen…",
    forgotSent:
      "Als er een account bij dat adres hoort, is er een resetlink onderweg. Kijk in je inbox en in je spammap.",
    forgotRateLimited: "Er zijn te veel resetverzoeken. Wacht even en probeer het opnieuw.",
    expired: "Die resetlink is verlopen of al gebruikt. Vraag hieronder een nieuwe aan.",
    invalid: "Die resetlink is niet geldig. Vraag hieronder een nieuwe aan.",
    resetTitle: "Kies een nieuw wachtwoord",
    resetIntro: "Kies een nieuw wachtwoord voor je account.",
    resetSubmit: "Sla nieuw wachtwoord op",
    resetSubmitting: "Bezig met opslaan…",
    resetError:
      "We konden je wachtwoord niet opslaan. Vraag een nieuwe resetlink aan en probeer het opnieuw.",
    resetDone: "Je wachtwoord is bijgewerkt. Log in met het nieuwe wachtwoord om verder te gaan.",
    resetClosed:
      "Deze pagina is alleen bedoeld om een nieuw wachtwoord te kiezen via een resetlink. Vraag een nieuwe link aan om verder te gaan.",
  },
  fields: {
    email: "E-mailadres",
    password: "Wachtwoord",
    displayName: "Weergavenaam",
    displayNameHint:
      "Zo zien andere kwekers je. Dit kan een persoonsnaam zijn, of de naam van een kwekerij of boerderij.",
    country: "Land",
    countryHint: "Wordt getoond op je openbare profiel.",
    regionCity: "Regio of stad (optioneel)",
    bio: "Bio (optioneel)",
    bioHint: "Maximaal {max} tekens. Alleen platte tekst.",
    accountType: "Hoe omschrijf je jezelf? (optioneel)",
    accountTypeNotSpecified: "Niet opgegeven",
    accountTypeIndividual: "Particuliere kweker",
    accountTypeBreeder: "Veredelaar",
    accountTypeFarm: "Boerderij",
    accountTypeHint: "Alleen een label voor je profiel. Het verandert niets aan wat je kunt doen.",
    avatar: "Profielfoto (optioneel)",
    avatarHint: "JPEG, PNG of WebP, tot 2 MB. Laat leeg om je huidige foto te behouden.",
  },
  setup: {
    title: "Stel je profiel in",
    intro:
      "Twee dingen om mee te beginnen: een weergavenaam en je land. Een profiel is nodig voordat je iets kunt delen, vastleggen of berichten sturen. Een foto, regio en bio kun je later toevoegen. Bladeren blijft open.",
    submit: "Doorgaan",
    submitting: "Opslaan…",
  },
  edit: {
    title: "Bewerk je profiel",
    submit: "Profiel opslaan",
    saved: "Je profiel is opgeslagen.",
    saveError: "Je wijzigingen konden niet worden opgeslagen. Probeer het opnieuw.",
  },
  profile: {
    title: "Je profiel",
    suspended:
      "Je account is opgeschort. Je kunt je profiel nog zien, maar je kunt het niet bewerken of meedoen tot de opschorting is opgeheven.",
    editProfile: "Profiel bewerken",
    viewPublic: "Openbaar profiel bekijken",
    signOut: "Uitloggen",
    yourSeedlings: "Je zaailingen",
    newSeedling: "Nieuwe zaailing",
    series: "Series",
    noSeedlings: "Nog geen zaailingen. Een nieuwe zaailing blijft privé totdat je anders kiest.",
    memberSince: "Lid sinds {month}",
  },
  publicProfile: {
    sections: "Profielonderdelen",
    tabSeedlings: "Zaailingen",
    tabOriginated: "Opgekweekt",
    tabUpdates: "Updates",
    noUpdates: "Nog geen openbare updates.",
    noHeld: "Hier worden nog geen openbare zaailingen gehouden.",
    noOriginated:
      "Hier zijn nog geen openbare zaailingen met deze kweker als oorsprong vastgelegd.",
    noPhoto: "Nog geen foto",
    unnamedSeedling: "Naamloze zaailing",
    notFound: "Profiel niet gevonden",
  },
  placeholder: {
    inboxTitle: "Postvak",
    inboxMessage: "Berichten zijn nog niet beschikbaar. Privégesprekken verschijnen hier.",
    notificationsTitle: "Meldingen",
    notificationsMessage:
      "Meldingen zijn nog niet beschikbaar. Activiteit die je aandacht nodig heeft, verschijnt hier.",
  },
};

export const fr: typeof en = {
  chooseCountry: "Choisissez un pays",
  signIn: {
    title: "Se connecter",
    intro:
      "Un compte vous permet de documenter vos semis, de partager vos mises à jour et de participer à la communauté.",
    submit: "Se connecter",
    submitting: "Connexion…",
    newHere: "Nouveau sur DahliaSeedling ?",
    createAccount: "Créer un compte",
    badCredentials: "Cette adresse e-mail et ce mot de passe ne correspondent à aucun compte.",
    passwordRequired: "Saisissez votre mot de passe.",
  },
  signUp: {
    title: "Créer un compte",
    intro:
      "Vous configurerez ensuite votre profil. Seuls votre nom affiché et votre pays sont obligatoires.",
    passwordHint: "Au moins 8 caractères.",
    submit: "Créer le compte",
    submitting: "Création du compte…",
    goSignIn: "Aller à la connexion",
    haveAccount: "Vous avez déjà un compte ?",
    signIn: "Se connecter",
    saved: "Confirmez votre compte depuis votre e-mail, puis connectez-vous.",
    genericError:
      "Nous n'avons pas pu créer de compte avec ces informations. Essayez de vous connecter, ou utilisez une autre adresse e-mail.",
    invitationOnly:
      "Les nouveaux comptes sont pour l'instant sur invitation uniquement. Si vous avez reçu une invitation, ouvrez le lien de l'e-mail d'invitation.",
  },
  confirm: {
    expired:
      "Ce lien a expiré ou a déjà été utilisé. Connectez-vous, ou demandez-nous une nouvelle invitation.",
    invalid:
      "Ce lien n'est pas valide. Vérifiez que vous avez ouvert le lien complet depuis votre e-mail, ou demandez-nous un nouveau lien.",
    signedUp: "Votre adresse e-mail est confirmée. Configurez votre profil pour continuer.",
  },
  setPassword: {
    title: "Choisissez un mot de passe",
    intro:
      "Votre invitation est confirmée. Choisissez un mot de passe pour finaliser votre compte.",
    submit: "Enregistrer le mot de passe",
    submitting: "Enregistrement…",
    error:
      "Nous n'avons pas pu enregistrer votre mot de passe. Réessayez. Si le lien a expiré, demandez-nous une nouvelle invitation.",
    closedTitle: "Sur invitation uniquement",
    notInvited:
      "Cette page sert uniquement à finaliser une invitation. Votre mot de passe est déjà défini, rien ne change ici. Si vous l'avez oublié, contactez-nous.",
  },
  recovery: {
    forgotLink: "Mot de passe oublié ?",
    forgotTitle: "Réinitialiser votre mot de passe",
    forgotIntro:
      "Saisissez l'adresse e-mail de votre compte. Si elle correspond à un compte, nous enverrons un lien pour choisir un nouveau mot de passe.",
    forgotSubmit: "Envoyer le lien",
    forgotSubmitting: "Envoi…",
    forgotSent:
      "Si un compte existe pour cette adresse, un lien de réinitialisation est en route. Vérifiez votre boîte de réception et vos indésirables.",
    forgotRateLimited:
      "Trop de demandes de réinitialisation. Attendez quelques minutes, puis réessayez.",
    expired:
      "Ce lien de réinitialisation a expiré ou a déjà été utilisé. Demandez-en un nouveau ci-dessous.",
    invalid: "Ce lien de réinitialisation n'est pas valide. Demandez-en un nouveau ci-dessous.",
    resetTitle: "Choisissez un nouveau mot de passe",
    resetIntro: "Choisissez un nouveau mot de passe pour votre compte.",
    resetSubmit: "Enregistrer le nouveau mot de passe",
    resetSubmitting: "Enregistrement…",
    resetError:
      "Nous n'avons pas pu enregistrer votre mot de passe. Demandez un nouveau lien et réessayez.",
    resetDone: "Votre mot de passe est mis à jour. Connectez-vous avec celui-ci pour continuer.",
    resetClosed:
      "Cette page sert uniquement à choisir un nouveau mot de passe depuis un lien de réinitialisation. Demandez un nouveau lien pour continuer.",
  },
  fields: {
    email: "Adresse e-mail",
    password: "Mot de passe",
    displayName: "Nom affiché",
    displayNameHint:
      "C'est ainsi que les autres cultivateurs vous voient. Il peut s'agir d'un nom de personne ou du nom d'un sélectionneur ou d'une exploitation.",
    country: "Pays",
    countryHint: "Affiché sur votre profil public.",
    regionCity: "Région ou ville (facultatif)",
    bio: "Biographie (facultatif)",
    bioHint: "{max} caractères maximum. Texte brut uniquement.",
    accountType: "Comment vous décrivez-vous ? (facultatif)",
    accountTypeNotSpecified: "Non précisé",
    accountTypeIndividual: "Cultivateur particulier",
    accountTypeBreeder: "Sélectionneur",
    accountTypeFarm: "Exploitation",
    accountTypeHint:
      "Un libellé pour votre profil uniquement. Il ne change rien à ce que vous pouvez faire.",
    avatar: "Photo de profil (facultatif)",
    avatarHint: "JPEG, PNG ou WebP, 2 Mo maximum. Laissez vide pour garder votre photo actuelle.",
  },
  setup: {
    title: "Configurez votre profil",
    intro:
      "Deux éléments pour commencer : un nom affiché et votre pays. Un profil est nécessaire avant de partager, de capturer ou d'écrire, et vous pourrez ajouter plus tard une photo, une région et une biographie. La navigation reste libre.",
    submit: "Continuer",
    submitting: "Enregistrement…",
  },
  edit: {
    title: "Modifier votre profil",
    submit: "Enregistrer le profil",
    saved: "Votre profil est enregistré.",
    saveError: "Vos modifications n'ont pas pu être enregistrées. Réessayez.",
  },
  profile: {
    title: "Votre profil",
    suspended:
      "Votre compte est suspendu. Vous pouvez toujours voir votre profil, mais vous ne pouvez ni le modifier ni participer tant que la suspension n'est pas levée.",
    editProfile: "Modifier le profil",
    viewPublic: "Voir le profil public",
    signOut: "Se déconnecter",
    yourSeedlings: "Vos semis",
    newSeedling: "Nouveau semis",
    series: "Séries",
    noSeedlings:
      "Pas encore de semis. Un nouveau semis reste privé tant que vous ne décidez pas autrement.",
    memberSince: "Membre depuis {month}",
  },
  publicProfile: {
    sections: "Sections du profil",
    tabSeedlings: "Semis",
    tabOriginated: "Créés",
    tabUpdates: "Mises à jour",
    noUpdates: "Aucune mise à jour publique pour l'instant.",
    noHeld: "Aucun semis public n'est détenu ici pour l'instant.",
    noOriginated:
      "Aucun semis public n'est enregistré ici comme ayant cette origine pour l'instant.",
    noPhoto: "Pas encore de photo",
    unnamedSeedling: "Semis sans nom",
    notFound: "Profil introuvable",
  },
  placeholder: {
    inboxTitle: "Messagerie",
    inboxMessage:
      "Les messages ne sont pas encore disponibles. Les conversations privées apparaîtront ici.",
    notificationsTitle: "Notifications",
    notificationsMessage:
      "Les notifications ne sont pas encore disponibles. Les activités qui demandent votre attention apparaîtront ici.",
  },
};

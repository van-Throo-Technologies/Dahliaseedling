/*
 * Input messages. The rules themselves (lengths, formats, limits) stay in code and in the database; these
 * sentences only describe them. Numbers are inserted as parameters, so a rule change is made once.
 */

export const en = {
  email: {
    required: "Enter your email address.",
    format: "Enter an email address in the form name@example.com.",
  },
  password: {
    min: "Use at least {min} characters.",
    tooLong: "Use a shorter password.",
    required: "Enter your password.",
  },
  displayName: {
    range: "Use {min} to {max} characters.",
    reserved: "Choose another name. This one is reserved.",
  },
  country: { choose: "Choose your country from the list." },
  regionCity: { max: "Use {max} characters or fewer." },
  bio: { max: "Use {max} characters or fewer." },
  accountType: { choose: "Choose one of the listed options." },
  avatar: {
    type: "Choose a JPEG, PNG or WebP image.",
    size: "Choose an image of 2 MB or smaller.",
  },
  series: {
    required: "Enter a series name, such as JV.",
    format: "Use 1 to 8 letters or numbers, with no spaces or symbols.",
    choose: "Choose one of your series.",
  },
  seedling: {
    workingName: "Use {max} characters or fewer.",
    year: "Enter a year between {min} and {max}, or leave it empty.",
    visibility: "Choose private or public.",
    role: "Choose seed parent or pollen parent.",
    kind: "Choose how this parent is known.",
    parentChoose: "Choose one of the seedlings you can see.",
    cultivar: "Enter a cultivar name of {min} to {max} characters.",
    notes: "Use {max} characters or fewer.",
  },
  capture: {
    fileType:
      "That file type is not supported. Use a photo (JPEG, PNG, WebP, HEIC) or a short video (MP4, MOV, WebM).",
    fileSize: "Choose a file of {megabytes} MB or smaller.",
    fileEmpty: "That file is empty.",
    chooseFirst: "Choose a photo or a short video first.",
    tooMany: "Choose up to {max} files for one capture.",
    incomplete: "The upload is incomplete. Try again.",
    notYours: "One of the uploads does not belong to you. Start again.",
    duplicate: "The same file was listed twice.",
    note: "Use {max} characters or fewer.",
    timeInvalid: "Enter a valid date and time.",
    timeFuture: "The observed time cannot be in the future.",
    chooseSeedling: "Choose one of your seedlings.",
    identifier: "Enter the seedling's identifier, such as JV-26-001 or #12.",
    destination: "Choose where this capture goes.",
  },
  publication: {
    captionRead: "The caption could not be read.",
    captionMax: "A caption can be at most {max} characters.",
    commentEmpty: "Write something before you post.",
    commentMax: "A comment can be at most {max} characters.",
    chooseImage: "Choose at least one image to share.",
    chooseMax: "Choose up to {max} images.",
    selection: "The selection could not be read. Choose the images again.",
    cursor: "That page link is out of date. Start again from the Feed.",
  },
};

export const nl: typeof en = {
  email: {
    required: "Vul je e-mailadres in.",
    format: "Vul een e-mailadres in van de vorm naam@voorbeeld.nl.",
  },
  password: {
    min: "Gebruik minstens {min} tekens.",
    tooLong: "Gebruik een korter wachtwoord.",
    required: "Vul je wachtwoord in.",
  },
  displayName: {
    range: "Gebruik {min} tot {max} tekens.",
    reserved: "Kies een andere naam. Deze is gereserveerd.",
  },
  country: { choose: "Kies je land uit de lijst." },
  regionCity: { max: "Gebruik {max} tekens of minder." },
  bio: { max: "Gebruik {max} tekens of minder." },
  accountType: { choose: "Kies een van de opties in de lijst." },
  avatar: {
    type: "Kies een JPEG-, PNG- of WebP-afbeelding.",
    size: "Kies een afbeelding van 2 MB of kleiner.",
  },
  series: {
    required: "Vul een serienaam in, zoals JV.",
    format: "Gebruik 1 tot 8 letters of cijfers, zonder spaties of tekens.",
    choose: "Kies een van je series.",
  },
  seedling: {
    workingName: "Gebruik {max} tekens of minder.",
    year: "Vul een jaar in tussen {min} en {max}, of laat het leeg.",
    visibility: "Kies privé of openbaar.",
    role: "Kies zaadouder of stuifmeelouder.",
    kind: "Kies hoe deze ouder bekend is.",
    parentChoose: "Kies een van de zaailingen die je kunt zien.",
    cultivar: "Vul een cultivarnaam in van {min} tot {max} tekens.",
    notes: "Gebruik {max} tekens of minder.",
  },
  capture: {
    fileType:
      "Dit bestandstype wordt niet ondersteund. Gebruik een foto (JPEG, PNG, WebP, HEIC) of een korte video (MP4, MOV, WebM).",
    fileSize: "Kies een bestand van {megabytes} MB of kleiner.",
    fileEmpty: "Dit bestand is leeg.",
    chooseFirst: "Kies eerst een foto of een korte video.",
    tooMany: "Kies maximaal {max} bestanden voor één vastlegging.",
    incomplete: "De upload is niet compleet. Probeer het opnieuw.",
    notYours: "Een van de uploads is niet van jou. Begin opnieuw.",
    duplicate: "Hetzelfde bestand is twee keer gekozen.",
    note: "Gebruik {max} tekens of minder.",
    timeInvalid: "Vul een geldige datum en tijd in.",
    timeFuture: "Het waargenomen moment kan niet in de toekomst liggen.",
    chooseSeedling: "Kies een van je zaailingen.",
    identifier: "Vul de identificatie van de zaailing in, zoals JV-26-001 of #12.",
    destination: "Kies waar deze vastlegging heen moet.",
  },
  publication: {
    captionRead: "Het bijschrift kon niet worden gelezen.",
    captionMax: "Een bijschrift mag maximaal {max} tekens bevatten.",
    commentEmpty: "Schrijf iets voordat je plaatst.",
    commentMax: "Een reactie mag maximaal {max} tekens bevatten.",
    chooseImage: "Kies minstens één afbeelding om te delen.",
    chooseMax: "Kies maximaal {max} afbeeldingen.",
    selection: "De selectie kon niet worden gelezen. Kies de afbeeldingen opnieuw.",
    cursor: "Deze paginalink is verlopen. Begin opnieuw bij de Start-feed.",
  },
};

export const fr: typeof en = {
  email: {
    required: "Saisissez votre adresse e-mail.",
    format: "Saisissez une adresse e-mail au format nom@exemple.fr.",
  },
  password: {
    min: "Utilisez au moins {min} caractères.",
    tooLong: "Utilisez un mot de passe plus court.",
    required: "Saisissez votre mot de passe.",
  },
  displayName: {
    range: "Utilisez entre {min} et {max} caractères.",
    reserved: "Choisissez un autre nom. Celui-ci est réservé.",
  },
  country: { choose: "Choisissez votre pays dans la liste." },
  regionCity: { max: "Utilisez {max} caractères ou moins." },
  bio: { max: "Utilisez {max} caractères ou moins." },
  accountType: { choose: "Choisissez l'une des options proposées." },
  avatar: {
    type: "Choisissez une image JPEG, PNG ou WebP.",
    size: "Choisissez une image de 2 Mo maximum.",
  },
  series: {
    required: "Saisissez un nom de série, par exemple JV.",
    format: "Utilisez de 1 à 8 lettres ou chiffres, sans espace ni symbole.",
    choose: "Choisissez l'une de vos séries.",
  },
  seedling: {
    workingName: "Utilisez {max} caractères ou moins.",
    year: "Saisissez une année entre {min} et {max}, ou laissez vide.",
    visibility: "Choisissez privé ou public.",
    role: "Choisissez parent porte-graines ou parent pollinisateur.",
    kind: "Choisissez comment ce parent est connu.",
    parentChoose: "Choisissez l'un des semis que vous pouvez voir.",
    cultivar: "Saisissez un nom de cultivar de {min} à {max} caractères.",
    notes: "Utilisez {max} caractères ou moins.",
  },
  capture: {
    fileType:
      "Ce type de fichier n'est pas pris en charge. Utilisez une photo (JPEG, PNG, WebP, HEIC) ou une courte vidéo (MP4, MOV, WebM).",
    fileSize: "Choisissez un fichier de {megabytes} Mo maximum.",
    fileEmpty: "Ce fichier est vide.",
    chooseFirst: "Choisissez d'abord une photo ou une courte vidéo.",
    tooMany: "Choisissez {max} fichiers maximum pour une seule capture.",
    incomplete: "L'envoi est incomplet. Réessayez.",
    notYours: "L'un des envois ne vous appartient pas. Recommencez.",
    duplicate: "Le même fichier a été sélectionné deux fois.",
    note: "Utilisez {max} caractères ou moins.",
    timeInvalid: "Saisissez une date et une heure valides.",
    timeFuture: "Le moment d'observation ne peut pas être dans le futur.",
    chooseSeedling: "Choisissez l'un de vos semis.",
    identifier: "Saisissez l'identifiant du semis, par exemple JV-26-001 ou #12.",
    destination: "Choisissez où ira cette capture.",
  },
  publication: {
    captionRead: "La légende n'a pas pu être lue.",
    captionMax: "Une légende peut comporter {max} caractères au maximum.",
    commentEmpty: "Écrivez quelque chose avant de publier.",
    commentMax: "Un commentaire peut comporter {max} caractères au maximum.",
    chooseImage: "Choisissez au moins une image à partager.",
    chooseMax: "Choisissez {max} images maximum.",
    selection: "La sélection n'a pas pu être lue. Choisissez à nouveau les images.",
    cursor: "Ce lien de page n'est plus valide. Recommencez depuis le fil d'actualité.",
  },
};

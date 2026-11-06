import * as app from "./app";
import * as common from "./common";
import * as glossary from "./glossary";
import * as identity from "./identity";
import * as seedlings from "./seedlings";
import * as capture from "./capture";
import * as publication from "./publication";
import * as validation from "./validation";
import * as errors from "./errors";
import * as search from "./search";
import * as rehome from "./rehome";
import * as seeds from "./seeds";
import * as messaging from "./messaging";
import * as notifications from "./notifications";
import * as safety from "./safety";
import * as admin from "./admin";
import * as email from "./email";
import * as assistive from "./assistive";
import * as privacy from "./privacy";
import * as feedback from "./feedback";
import * as launch from "./launch";
import * as invitations from "./invitations";

/*
 * One dictionary per area and language. Each area's nl and fr are typed against its English, so a missing or
 * extra key is a type error. Keys are stable identifiers; the wording is the only thing that changes per language.
 */
export const MESSAGES = {
  en: {
    app: app.en,
    common: common.en,
    glossary: glossary.en,
    identity: identity.en,
    seedlings: seedlings.en,
    capture: capture.en,
    publication: publication.en,
    validation: validation.en,
    errors: errors.en,
    search: search.en,
    rehome: rehome.en,
    seeds: seeds.en,
    messaging: messaging.en,
    notifications: notifications.en,
    safety: safety.en,
    admin: admin.en,
    email: email.en,
    assistive: assistive.en,
    privacy: privacy.en,
    feedback: feedback.en,
    launch: launch.en,
    invitations: invitations.en,
  },
  nl: {
    app: app.nl,
    common: common.nl,
    glossary: glossary.nl,
    identity: identity.nl,
    seedlings: seedlings.nl,
    capture: capture.nl,
    publication: publication.nl,
    validation: validation.nl,
    errors: errors.nl,
    search: search.nl,
    rehome: rehome.nl,
    seeds: seeds.nl,
    messaging: messaging.nl,
    notifications: notifications.nl,
    safety: safety.nl,
    admin: admin.nl,
    email: email.nl,
    assistive: assistive.nl,
    privacy: privacy.nl,
    feedback: feedback.nl,
    launch: launch.nl,
    invitations: invitations.nl,
  },
  fr: {
    app: app.fr,
    common: common.fr,
    glossary: glossary.fr,
    identity: identity.fr,
    seedlings: seedlings.fr,
    capture: capture.fr,
    publication: publication.fr,
    validation: validation.fr,
    errors: errors.fr,
    search: search.fr,
    rehome: rehome.fr,
    seeds: seeds.fr,
    messaging: messaging.fr,
    notifications: notifications.fr,
    safety: safety.fr,
    admin: admin.fr,
    email: email.fr,
    assistive: assistive.fr,
    privacy: privacy.fr,
    feedback: feedback.fr,
    launch: launch.fr,
    invitations: invitations.fr,
  },
};

export type Messages = (typeof MESSAGES)["en"];

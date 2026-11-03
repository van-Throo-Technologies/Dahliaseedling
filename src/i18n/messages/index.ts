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
  },
};

export type Messages = (typeof MESSAGES)["en"];

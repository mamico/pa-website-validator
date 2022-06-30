"use strict";

import {CheerioAPI, load} from "cheerio";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import lighthouse from "lighthouse";
import { primaryMenuItems } from "../../storage/municipality/menuItems";
import {
  buildUrl,
  checkOrder, getHREFValuesDataAttribute,
  getPageElementDataAttribute,
  loadPageData,
} from "../../utils/utils";

const Audit = lighthouse.Audit;

const greenResult = "Il componente è presente.";
const redResult = "Il componente non è presente.";
const notExecuted = "Non è stato possibile condurre il test. Controlla le \"Modalità di verifica\" per scoprire di più."

class LoadAudit extends lighthouse.Audit {
  static get meta() {
    return {
      id: "municipality-feedback-element",
      title:
        "C.SI.2.5 - VALUTAZIONE DELL'ESPERIENZA D'USO, CHIAREZZA DELLE PAGINE INFORMATIVE - Il sito comunale deve consentire al cittadino di fornire una valutazione della chiarezza di ogni pagina di primo e secondo livello.",
      failureTitle:
        "C.SI.2.5 - VALUTAZIONE DELL'ESPERIENZA D'USO, CHIAREZZA DELLE PAGINE INFORMATIVE - Il sito comunale deve consentire al cittadino di fornire una valutazione della chiarezza di ogni pagina di primo e secondo livello.",
      scoreDisplayMode: Audit.SCORING_MODES.NUMERIC,
      description:
        "CONDIZIONI DI SUCCESSO: la funzionalità per valutare la chiarezza informativa è presente su tutte le pagine di primo e secondo livello; MODALITÀ DI VERIFICA: viene verificata la presenza del componente, tramite il suo attributo, su una pagina di primo o secondo livello selezionata casualmente; RIFERIMENTI TECNICI E NORMATIVI: [Docs Italia, documentazione Modello Comuni, EGovernment benchmark method paper 2020-2023](https://docs.italia.it/italia/designers-italia/design-comuni-docs/it/v2022.1/index.html)",
      requiredArtifacts: ["origin"],
    };
  }

  static async audit(
    artifacts: LH.Artifacts & { origin: string }
  ): Promise<{ score: number; details: LH.Audit.Details.Table }> {
    const url = artifacts.origin;

    let score = 0;
    const headings = [
      { key: "result", itemType: "text", text: "Risultato" },
      { key: "inspected_first_level_page", itemType: "text", text: "Pagina di primo livello ispezionata" },
      { key: "inspected_second_level_page", itemType: "text", text: "Pagina di primo livello ispezionata" },
    ];

    const items = [{
      result: redResult,
      inspected_first_level_page: "",
      inspected_second_level_page: ""
    }];

    let $ = await loadPageData(url)

    const administrationPage = await getHREFValuesDataAttribute($, '[data-element="management"]')
    const servicesPage = await getHREFValuesDataAttribute($, '[data-element="service"]')
    const newsPage = await getHREFValuesDataAttribute($, '[data-element="news"]')
    const lifePage = await getHREFValuesDataAttribute($, '[data-element="live"]')

    const firstLevelPages = [...administrationPage, ...servicesPage, ...newsPage, ...lifePage]

    if (firstLevelPages.length <= 0) {
      items[0].result = notExecuted + ' nessuna pagina di primo livello trovata'
      return {
        score: 0,
        details: Audit.makeTableDetails(headings, items),
      };
    }

    let randomFirstLevelPage = firstLevelPages[Math.floor(Math.random() * firstLevelPages.length)];
    if (!randomFirstLevelPage.includes(url)) {
      randomFirstLevelPage = await buildUrl(url, randomFirstLevelPage);
    }

    $ = await loadPageData(randomFirstLevelPage)
    let feedbackElement = $('[data-element="feedback"]')
    console.log('FEEDBACK ELEMENT', feedbackElement)
    console.log('FEEDBACK ELEMENT TEXT', feedbackElement.text())

    //TODO: booleano per verificare presenza componente su pagina di primo livello

    if (servicesPage.length <= 0) {
      items[0].result = notExecuted + ' pagina servizi non trovata'
      return {
        score: 0,
        details: Audit.makeTableDetails(headings, items),
      };
    }

    let secondLevelPageUrl = servicesPage[0];
    if (!secondLevelPageUrl.includes(url)) {
      secondLevelPageUrl = await buildUrl(url, servicesPage[0]);
    }

    $ = await loadPageData(secondLevelPageUrl);
    const servicesSecondLevelPages = await getHREFValuesDataAttribute(
      $,
      '[data-element="service-page"]'
    );

    if (servicesSecondLevelPages.length <= 0) {
      items[0].result = notExecuted + " - pagina servizio di secondo livello non trovata";
      return {
        score: 0,
        details: Audit.makeTableDetails(headings, items),
      };
    }

    let randomSecondLevelServicePage = servicesSecondLevelPages[Math.floor(Math.random() * servicesSecondLevelPages.length)]
    if (!randomSecondLevelServicePage.includes(url)) {
      randomSecondLevelServicePage = await buildUrl(url, servicesPage[0]);
    }

    $ = await loadPageData(randomSecondLevelServicePage)
    feedbackElement = $('[data-element="feedback"]')

    //TODO: booleano per verificare presenza componente su pagina di secondo livello


    return {
      score: score,
      details: Audit.makeTableDetails(headings, items),
    };
  }
}

module.exports = LoadAudit;
"use strict";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import lighthouse from "lighthouse";
import https from "https";
import { TLSSocket } from "tls";
import { allowedCiphers } from "../../storage/common/allowedCiphers";
const allowedTlsVersions = ["TLSv1.2", "TLSv1.3"];
import * as sslCertificate from "get-ssl-certificate";
import crawlerTypes from "../../types/crawler-types";
import cipher = crawlerTypes.cipher;
import cipherInfo = crawlerTypes.cipherInfo;

const Audit = lighthouse.Audit;

let greenResult = "Il certificato del sito [url] è attivo e valido.";
let redResult = "Il certificato del sito [url] non è attivo o valido: ";

const redResultHttps = " -Il sito non utilizza il protocollo HTTPS- ";
const redResultCertificateValidation = " -Il certificato è scaduto- ";
const redResultTLSVersion =
  " -La versione del TLS richiesta è TLSv1.2 o TLSv1.3- ";
const redResultCipherSuiteTLS12 =
  " -La versione della suite di cifratura (per la versione TLS in uso) richiesta è una tra: " +
  allowedCiphers.tls12.join(", ") +
  "- ";
const redResultCipherSuiteTLS13 =
  " -La versione della suite di cifratura (per la versione TLS in uso) richiesta è una tra: " +
  allowedCiphers.tls13.join(", ") +
  "- ";

class LoadAudit extends Audit {
  static get meta() {
    return {
      id: "common-security",
      title:
        "CERTIFICATO HTTPS - Il sito scuola deve avere un certificato https valido e attivo.",
      failureTitle:
        "CERTIFICATO HTTPS - Il sito scuola deve avere un certificato https valido e attivo.",
      scoreDisplayMode: Audit.SCORING_MODES.BINARY,
      description:
        "CONDIZIONI DI SUCCESSO: il sito utilizza un certificato https valido e non obsoleto secondo le raccomandazioni AgID; MODALITÀ DI VERIFICA: viene verificato che il certificato https del sito sia valido e attivo; RIFERIMENTI TECNICI E NORMATIVI: [Agid Raccomandazioni in merito allo standard Transport Layer Security (TLS)](https://cert-agid.gov.it/wp-content/uploads/2020/11/AgID-RACCSECTLS-01.pdf).",
      requiredArtifacts: ["origin"],
    };
  }

  static async audit(
    artifacts: LH.Artifacts & { origin: string }
  ): Promise<{ score: number; details: LH.Audit.Details.Table }> {
    const origin = artifacts.origin;
    greenResult = greenResult.replace("[url]", origin);
    redResult = redResult.replace("[url]", origin);

    const headings = [
      { key: "result", itemType: "text", text: "Risultato" },
      {
        key: "protocol",
        itemType: "text",
        text: "Protocollo usato dal dominio",
      },
      {
        key: "certificate_validation_from",
        itemType: "text",
        text: "Certificato valido da",
      },
      {
        key: "certificate_validation_to",
        itemType: "text",
        text: "Certificato valido a",
      },
      { key: "tls_version", itemType: "text", text: "Versione TLS" },
      { key: "cipher_suite", itemType: "text", text: "Suite di cifratura" },
    ];
    const item = [
      {
        result: redResult,
        protocol: "",
        certificate_validation_from: "",
        certificate_validation_to: "",
        tls_version: "",
        cipher_suite: "",
      },
    ];
    let score = 0;

    const protocol = await getProtocol(origin);
    if (protocol !== "https") {
      item[0].protocol = protocol;
      item[0].result = redResult + redResultHttps;
      return {
        score: 0,
        details: Audit.makeTableDetails(headings, item),
      };
    }

    const certificate = await checkCertificateValidation(origin);
    const tls = await checkTLSVersion(origin);
    const cipherSuite = await checkCipherSuite(origin);

    item[0].protocol = protocol;
    item[0].certificate_validation_from = certificate.valid_from;
    item[0].certificate_validation_to = certificate.valid_to;
    item[0].tls_version = tls.tls_version;
    item[0].cipher_suite = cipherSuite.version;

    if (certificate.valid && tls.valid && cipherSuite.valid) {
      score = 1;
      item[0].result = greenResult;
    } else {
      if (!certificate.valid) {
        item[0].result += redResultCertificateValidation;
      }

      if (!tls.valid) {
        item[0].result += redResultTLSVersion;
      }

      if (tls.tls_version === allowedTlsVersions[0] && !cipherSuite.valid) {
        item[0].result += redResultCipherSuiteTLS12;
      }

      if (tls.tls_version === allowedTlsVersions[1] && !cipherSuite.valid) {
        item[0].result += redResultCipherSuiteTLS13;
      }
    }

    return {
      score: score,
      details: Audit.makeTableDetails(headings, item),
    };
  }
}

async function getProtocol(url: string): Promise<string> {
  const urlElements = url.split("://");

  if (urlElements.length <= 0) {
    return "";
  }

  return urlElements[0];
}

async function checkCertificateValidation(
  url: string
): Promise<{ valid: boolean; valid_from: string; valid_to: string }> {
  const returnObj = {
    valid: false,
    valid_from: "",
    valid_to: "",
  };

  const hostname = url.split("://");
  if (hostname.length <= 1) {
    return returnObj;
  }

  const parsedHost = hostname[1].split("www.");
  if (parsedHost.length <= 1) {
    return returnObj;
  }

  const certificate = await sslCertificate.get(parsedHost[1]);
  if (certificate) {
    const validFromTimestamp = Date.parse(certificate.valid_from ?? null);
    const validToTimestamp = Date.parse(certificate.valid_to ?? null);

    if (!isNaN(validFromTimestamp) && !isNaN(validToTimestamp)) {
      const todayTimestamp = Date.now();
      if (
        todayTimestamp > validFromTimestamp &&
        todayTimestamp < validToTimestamp
      ) {
        returnObj.valid = true;
      }
    }
  }

  returnObj.valid_from = certificate.valid_from;
  returnObj.valid_to = certificate.valid_to;

  return returnObj;
}

async function checkTLSVersion(
  url: string
): Promise<{ valid: boolean; tls_version: string }> {
  const returnObj = {
    valid: false,
    tls_version: "",
  };

  const cipherInfo: cipher = {
    version: await getCipherVersion(url),
  };

  if (!cipherInfo || !cipherInfo.version) {
    return returnObj;
  }

  if (allowedTlsVersions.includes(cipherInfo.version)) {
    returnObj.valid = true;
  }
  returnObj.tls_version = cipherInfo.version ?? "";

  return returnObj;
}

async function checkCipherSuite(
  url: string
): Promise<{ valid: boolean; version: string }> {
  const returnObj = {
    valid: false,
    version: "",
  };

  const cipherInfo: cipherInfo = {
    version: await getCipherVersion(url),
    standardName: await getCipherStandardName(url),
  };

  if (!cipherInfo || !cipherInfo.version || !cipherInfo.standardName) {
    return returnObj;
  }

  switch (cipherInfo.version) {
    case "TLSv1.2":
      if (allowedCiphers.tls12.includes(cipherInfo.standardName)) {
        returnObj.valid = true;
      }
      break;
    case "TLSv1.3":
      if (allowedCiphers.tls13.includes(cipherInfo.standardName)) {
        returnObj.valid = true;
      }
      break;
    default:
      returnObj.valid = false;
  }

  returnObj.version = cipherInfo.standardName ?? "";

  return returnObj;
}

async function getCipherVersion(hostname: string): Promise<string> {
  return new Promise(function (resolve) {
    https
      .request(hostname, function (res) {
        resolve((res.socket as TLSSocket).getCipher().version);
      })
      .end();
  });
}

async function getCipherStandardName(hostname: string): Promise<string> {
  return new Promise(function (resolve) {
    https
      .request(hostname, function (res) {
        resolve((res.socket as TLSSocket).getCipher().standardName);
      })
      .end();
  });
}

module.exports = LoadAudit;

"use strict";

import crawlerTypes from "../../../types/crawler-types";
import cipher = crawlerTypes.cipher;
import https from "https";
import { TLSSocket } from "tls";
// @ts-ignore
import lighthouse from "lighthouse";

const Audit = lighthouse.Audit;
const allowedTlsVersions = ["TLSv1.2", "TLSv1.3"];

class LoadAudit extends Audit {
  static get meta() {
    return {
      id: "common-security-tls-check",
      title: "Versione del TLS",
      failureTitle:
        "La versione del TLS non è valida, sono valide: TLSv1.2 e TLSv1.3",
      scoreDisplayMode: Audit.SCORING_MODES.BINARY,
      description: "Test per controllare se la versione del TLS è corretta",
      requiredArtifacts: ["securityTlsCheck"],
    };
  }

  static async audit(
    artifacts: any
  ): Promise<{ score: number; details: LH.Audit.Details.Table }> {
    const hostname = artifacts.securityTlsCheck;

    let score = 0;
    const headings = [
      {
        key: "tls_version",
        itemType: "text",
        text: "Versione del certificato corrente",
      },
    ];
    const items = [{ tls_version: "" }];

    const cipherInfo: cipher = {
      version: await getCipherVersion(hostname),
    };
    if (Boolean(cipherInfo) && Boolean(cipherInfo.version)) {
      if (allowedTlsVersions.includes(cipherInfo.version)) {
        score = 1;
      }

      items[0].tls_version = cipherInfo.version ?? "";
    }

    return {
      score: score,
      details: Audit.makeTableDetails(headings, items),
    };
  }
}

module.exports = LoadAudit;

// @ts-ignore
async function getCipherVersion(hostname: string): Promise<string> {
  return new Promise(function (resolve, reject) {
    https
      .request(hostname, function (res) {
        resolve((res.socket as TLSSocket).getCipher().version);
      })
      .end();
  });
}

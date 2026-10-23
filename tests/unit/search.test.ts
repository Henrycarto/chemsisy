import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { createSearch } from "../../src/search/search.ts";
import type { Index } from "../../src/data/types.ts";

const index: Index = JSON.parse(fs.readFileSync("public/data/index.json", "utf8"));
const search = createSearch(index.drugs);
const top = (q: string) => search(q)[0]?.slug;

describe("brand to substance: the ten Austrian test brands", () => {
  // Amoxilan from the original list is not authorised in Austria; Ospamox replaces it.
  const BRANDS: [string, string][] = [
    ["Thrombo ASS", "acetylsalicylic-acid"],
    ["Parkemed", "mefenamic-acid"],
    ["Mexalen", "paracetamol"],
    ["Voltaren", "diclofenac"],
    ["Seractil", "dexibuprofen"],
    ["Novalgin", "metamizole"],
    ["Aspirin", "acetylsalicylic-acid"],
    ["Sortis", "atorvastatin"],
    ["Pantoloc", "pantoprazole"],
    ["Ospamox", "amoxicillin"],
  ];
  for (const [brand, slug] of BRANDS) {
    it(`${brand} finds ${slug}`, () => {
      const hit = search(brand)[0];
      expect(hit?.slug).toBe(slug);
      expect(hit?.matched).toBe("brand");
    });
  }

  it("lower case and extra spaces do not matter", () => {
    expect(top("  thrombo ass ")).toBe("acetylsalicylic-acid");
    expect(top("PANTOLOC")).toBe("pantoprazole");
  });
});

describe("typo tolerance", () => {
  const TYPOS: [string, string][] = [
    ["Voltarn", "diclofenac"],
    ["Pantolok", "pantoprazole"],
    ["atorvastatn", "atorvastatin"],
    ["amoxicilin", "amoxicillin"],
    ["omeprazol", "omeprazole"],
    ["paracetamole", "paracetamol"],
  ];
  for (const [q, slug] of TYPOS) it(`"${q}" finds ${slug}`, () => expect(top(q)).toBe(slug));
});

describe("substance names, German forms and synonyms", () => {
  it("finds the substance by its English name", () => expect(top("pantoprazole")).toBe("pantoprazole"));
  it("finds German INN spellings", () => {
    expect(top("Acetylsalicylsäure")).toBe("acetylsalicylic-acid");
    expect(top("Metamizol")).toBe("metamizole");
    expect(top("Mefenaminsäure")).toBe("mefenamic-acid");
  });
  it("finds common synonyms", () => {
    expect(top("acetaminophen")).toBe("paracetamol");
    expect(top("penicillin V")).toBe("phenoxymethylpenicillin");
    expect(top("ASS")).toBe("acetylsalicylic-acid");
  });
  it("prefixes work while typing", () => expect(top("simva")).toBe("simvastatin"));
});

describe("ATC codes", () => {
  it("a full code finds its substance", () => {
    expect(top("C10AA05")).toBe("atorvastatin");
    expect(search("c10aa05")[0]?.matched).toBe("atc");
  });
  it("a code prefix lists the whole group", () => {
    const statins = search("C10AA", 10).map((h) => h.slug).sort();
    expect(statins).toEqual(["atorvastatin", "rosuvastatin", "simvastatin"]);
  });
  it("a drug with two codes is found by either", () => {
    expect(top("B01AC06")).toBe("acetylsalicylic-acid");
    expect(top("N02BA01")).toBe("acetylsalicylic-acid");
  });
});

describe("no false friends", () => {
  it("an unknown word returns nothing", () => expect(search("xylophone")).toHaveLength(0));
  it("an empty query returns nothing", () => expect(search("   ")).toHaveLength(0));
});

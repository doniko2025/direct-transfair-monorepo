// apps/direct-transfair-mobile/components/dashboards/companyDocs.ts
// =========================================================
// PIÈCES JUSTIFICATIVES D'UNE SOCIÉTÉ — logique partagée (création de société, fiche société)
// • Types de pièces : mêmes que le back-office web et le serveur (RCCM, identité du gérant, NIF, statuts, agrément, autre).
// • Sources : appareil photo, galerie, ou fichier (PDF ou image) via le sélecteur système d'expo-file-system.
// • Contrôles sur le téléphone : format réel (JPEG, PNG, WebP, PDF) d'après les premiers octets, taille 8 Ko → 5,5 Mo.
//   Le serveur refait les mêmes contrôles (décodage + signature + 6 Mo) : ceux-ci évitent seulement un envoi voué à l'échec.
// • Aucun JSX ici : les écrans gardent leur propre thème.
// =========================================================

import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";

export type DocKind = "RCCM" | "IDENTITY" | "TAX" | "STATUTES" | "LICENSE" | "OTHER";
export type DocSource = "camera" | "gallery" | "file";

export interface DocSlot { kind: DocKind; label: string; hint: string; icon: string }

export const DOC_SLOTS: DocSlot[] = [
  { kind: "RCCM",     label: "Extrait RCCM",               hint: "Registre du commerce", icon: "document-text-outline" },
  { kind: "IDENTITY", label: "Pièce d'identité du gérant", hint: "Recto lisible",        icon: "id-card-outline" },
  { kind: "TAX",      label: "Attestation fiscale (NIF)",  hint: "Facultatif",           icon: "receipt-outline" },
  { kind: "STATUTES", label: "Statuts de la société",      hint: "Facultatif",           icon: "reader-outline" },
  { kind: "LICENSE",  label: "Agrément / licence",         hint: "Facultatif",           icon: "ribbon-outline" },
  { kind: "OTHER",    label: "Autre document",             hint: "Nom à préciser",       icon: "attach-outline" },
];

export const DOC_KIND_LABEL: Record<DocKind, string> = Object.fromEntries(
  DOC_SLOTS.map((d) => [d.kind, d.label]),
) as Record<DocKind, string>;

/** Nombre maximal de pièces par société (même limite que le serveur). */
export const MAX_COMPANY_DOCS = 20;

/** Une pièce choisie, prête à être envoyée. */
export interface DocPick {
  uri: string;          // aperçu local (image) ou fichier (PDF)
  dataUrl: string;      // data:<mime>;base64,… envoyé au serveur
  mime: string;
  isPdf: boolean;
  sizeBytes: number;
  name?: string;        // nom du fichier choisi (PDF)
  label?: string;       // nom saisi — obligatoire pour le type « Autre document »
}
export type DocPicks = Partial<Record<DocKind, DocPick>>;

export type PickOutcome =
  | { status: "ok"; pick: DocPick }
  | { status: "canceled" }
  | { status: "error"; message: string };

const MIN_BYTES = 8 * 1024;     // le serveur refuse en dessous (fichier vide ou corrompu)
const MAX_BYTES = 5_500_000;    // le serveur refuse au-delà de 6 Mo (le base64 grossit d'un tiers : marge prise ici)
const IMAGE_OPTIONS = { mediaTypes: ["images"] as any, quality: 0.7, base64: true, allowsEditing: false, exif: false };

/** Type réel d'après les premiers octets du base64. */
export function sniffMime(b64: string): "image/jpeg" | "image/png" | "image/webp" | "application/pdf" | null {
  if (b64.startsWith("/9j/")) return "image/jpeg";
  if (b64.startsWith("iVBOR")) return "image/png";
  if (b64.startsWith("UklGR")) return "image/webp";
  if (b64.startsWith("JVBER")) return "application/pdf";   // « %PDF- »
  return null;
}

/** « 1,2 Mo », « 340 Ko ». */
export function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} Mo`;
  return `${Math.max(1, Math.round(n / 1000))} Ko`;
}

function build(b64: string, uri: string, sizeBytes: number, name?: string): PickOutcome {
  const mime = sniffMime(b64);
  if (!mime) return { status: "error", message: "Format non pris en charge : choisissez une photo (JPEG, PNG, WebP) ou un PDF." };
  if (sizeBytes > MAX_BYTES) return { status: "error", message: "Fichier trop lourd (5 Mo maximum). Reprenez la photo de plus loin ou compressez le PDF." };
  if (sizeBytes < MIN_BYTES) return { status: "error", message: "Fichier trop petit ou vide : reprenez la photo ou choisissez un autre fichier." };
  return {
    status: "ok",
    pick: { uri, dataUrl: `data:${mime};base64,${b64}`, mime, isPdf: mime === "application/pdf", sizeBytes, name },
  };
}

function fromImageResult(res: ImagePicker.ImagePickerResult): PickOutcome {
  if (res.canceled || !res.assets?.[0]) return { status: "canceled" };
  const a = res.assets[0];
  if (!a.base64) return { status: "error", message: "Image illisible, réessayez." };
  return build(a.base64, a.uri, Math.floor((a.base64.length * 3) / 4), (a as any).fileName ?? undefined);
}

/** Ouvre la source demandée et renvoie la pièce contrôlée (ou la raison du refus). Ne lève jamais d'exception. */
export async function pickCompanyDoc(source: DocSource): Promise<PickOutcome> {
  try {
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return { status: "error", message: "Autorisez l'appareil photo dans les réglages du téléphone." };
      return fromImageResult(await ImagePicker.launchCameraAsync(IMAGE_OPTIONS));
    }
    if (source === "gallery") {
      return fromImageResult(await ImagePicker.launchImageLibraryAsync(IMAGE_OPTIONS));
    }
    // Fichier : PDF ou image. Contrôle de la taille AVANT de lire le contenu en mémoire.
    const res = await File.pickFileAsync({ mimeTypes: ["application/pdf", "image/*"] });
    if (res.canceled || !res.result) return { status: "canceled" };
    const file = res.result as File;
    const size = Number(file.size ?? 0);
    if (size > MAX_BYTES) return { status: "error", message: "Fichier trop lourd (5 Mo maximum). Reprenez la photo de plus loin ou compressez le PDF." };
    return build(await file.base64(), file.uri, size, file.name);
  } catch {
    return {
      status: "error",
      message: source === "camera" ? "Appareil photo indisponible."
        : source === "gallery" ? "Galerie indisponible."
        : "Impossible de lire ce fichier. Choisissez un PDF ou une image.",
    };
  }
}

// apps/backend/src/contracts/contract-templates.ts
// =========================================================
// MODÈLES DE CONTRAT — deux contrats complets, rendus à partir des conditions de chaque société :
//   RENTAL   → contrat de LOCATION de l'application (licence d'utilisation en mode SaaS, avec redevance périodique)
//   PURCHASE → contrat d'ACHAT de l'application (licence d'utilisation perpétuelle d'une instance dédiée, prix forfaitaire)
//
// Le texte rendu est figé en base au moment de l'émission (Contract.content) : modifier ce fichier ne change jamais un
// contrat déjà émis. Incrémenter CONTRACT_TEMPLATE_VERSION (contract-config.ts) à chaque évolution du texte.
//
// ⚠️ Modèle rédigé pour une relation entre professionnels, sous droit français. Il doit être relu par un juriste avant usage
//   commercial (clauses de responsabilité, de réglementation financière et de données personnelles notamment).
// =========================================================

import { platform } from '../common/platform.config';
import { contractConfig } from './contract-config';
import { countryName, formatDateFr, formatMoney } from './contract-format';

export type ContractKind = 'RENTAL' | 'PURCHASE';
export type BillingPeriod = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export interface ContractTerms {
  /** Location : redevance par période. Achat : prix forfaitaire. */
  amount: number;
  currency: string;
  /** Location uniquement. */
  billingPeriod?: BillingPeriod;
  /** Location uniquement : durée de l'engagement initial, en mois. */
  commitmentMonths?: number;
  /** Achat uniquement : redevance annuelle de maintenance et d'hébergement (0 / absente = non incluse). */
  maintenanceFeeYearly?: number;
  /** Délai de paiement des factures, en jours (défaut 15). */
  paymentDays?: number;
  /** Date d'effet (AAAA-MM-JJ). */
  effectiveDate: string;
}

export interface PartyBlock {
  role: string;
  name: string;
  lines: string[];
  representative: string;
}

export interface ContractArticle {
  number: number;
  title: string;
  paragraphs: string[];
}

export interface ContractContent {
  kind: ContractKind;
  title: string;
  subtitle: string;
  reference: string;
  issuedAt: string;
  provider: PartyBlock;
  customer: PartyBlock;
  summary: { label: string; value: string }[];
  preamble: string[];
  articles: ContractArticle[];
  closing: string[];
}

export interface CustomerInfo {
  name: string;
  legalName?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  email: string;
  representativeName: string;
}

const PERIOD_LABEL: Record<BillingPeriod, { adj: string; per: string; noun: string }> = {
  MONTHLY: { adj: 'mensuelle', per: 'par mois', noun: 'mois' },
  QUARTERLY: { adj: 'trimestrielle', per: 'par trimestre', noun: 'trimestre' },
  YEARLY: { adj: 'annuelle', per: 'par an', noun: 'an' },
};

export function normalizeTerms(kind: ContractKind, raw: Partial<ContractTerms>): ContractTerms {
  const amount = Number(raw.amount);
  const base: ContractTerms = {
    amount,
    currency: String(raw.currency ?? 'EUR').toUpperCase(),
    paymentDays: Number.isInteger(raw.paymentDays) && raw.paymentDays! >= 0 && raw.paymentDays! <= 90 ? raw.paymentDays : 15,
    effectiveDate: String(raw.effectiveDate ?? '').slice(0, 10),
  };
  if (kind === 'RENTAL') {
    base.billingPeriod = raw.billingPeriod && raw.billingPeriod in PERIOD_LABEL ? raw.billingPeriod : 'MONTHLY';
    const months = Number(raw.commitmentMonths);
    base.commitmentMonths = Number.isInteger(months) && months >= 1 && months <= 120 ? months : 12;
  } else {
    const fee = Number(raw.maintenanceFeeYearly);
    if (Number.isFinite(fee) && fee > 0) base.maintenanceFeeYearly = fee;
  }
  return base;
}

function providerBlock(): PartyBlock {
  const c = contractConfig;
  const lines = [
    c.issuerLegalForm ? `Forme juridique : ${c.issuerLegalForm}` : '',
    c.issuerRegistration ?? '',
    c.issuerAddress ? `Siège : ${c.issuerAddress}` : '',
    c.issuerEmail ? `E-mail : ${c.issuerEmail}` : '',
  ].filter(Boolean);
  return {
    role: 'Le Prestataire',
    name: c.issuerName,
    lines,
    representative: `Représenté par ${c.issuerRepresentative}, ${c.issuerTitle}`,
  };
}

function customerBlock(c: CustomerInfo): PartyBlock {
  const place = [c.city, countryName(c.country)].filter(Boolean).join(', ');
  const lines = [
    c.legalName && c.legalName !== c.name ? `Nom commercial : ${c.name}` : '',
    c.address ? `Adresse : ${c.address}` : '',
    place ? `Localisation : ${place}` : '',
    `E-mail : ${c.email}`,
  ].filter(Boolean);
  return {
    role: 'Le Client',
    name: c.legalName?.trim() || c.name,
    lines,
    representative: `Représenté par ${c.representativeName}, en qualité de représentant légal`,
  };
}

/** Clauses communes aux deux contrats (réglementation, données personnelles, confidentialité, force majeure…). */
function commonClauses(app: string) {
  return {
    clientObligations: [
      `Le Client utilise l'Application conformément à sa destination et aux lois applicables. Il est seul responsable de l'usage qu'il en fait, de la saisie et de l'exactitude des données, ainsi que des actions réalisées avec les comptes de ses administrateurs, agents et utilisateurs.`,
      `Le Client déclare détenir, et s'engage à conserver pendant toute la durée du contrat, les agréments, licences, enregistrements ou autorisations exigés par la réglementation des pays où il exerce son activité de transfert ou de service de paiement (notamment auprès de l'autorité de contrôle compétente), ainsi qu'à respecter ses obligations de connaissance client (KYC), de lutte contre le blanchiment de capitaux et le financement du terrorisme, et de gel des avoirs.`,
      `Le Prestataire est un éditeur de logiciel. Il n'est ni établissement de paiement, ni établissement de crédit, ne détient aucun fonds du Client ni de ses clients, n'exécute aucune opération de paiement et n'est partie à aucune transaction réalisée au moyen de l'Application. Les fonds, taux de change, frais, commissions et plafonds sont fixés et assumés par le Client.`,
      `Le Client s'interdit de copier, décompiler, modifier, contourner les mesures de sécurité de l'Application, de la sous-licencier, de la mettre à disposition de tiers autres que ses propres agences, agents et clients, ou de s'en servir pour développer un produit concurrent.`,
      `Le Client protège la confidentialité de ses identifiants, impose à ses utilisateurs un mot de passe robuste, et informe sans délai le Prestataire de toute utilisation non autorisée ou de toute suspicion de compromission.`,
    ],
    data: [
      `Pour les données à caractère personnel de ses clients, agents et utilisateurs traitées au moyen de l'Application, le Client agit en qualité de responsable de traitement et le Prestataire en qualité de sous-traitant, au sens du règlement (UE) 2016/679 (RGPD) et de la loi Informatique et Libertés.`,
      `Le Prestataire s'engage à : (i) ne traiter les données que sur instruction documentée du Client et pour les seules finalités du présent contrat ; (ii) garantir la confidentialité des données et l'engagement de ses personnels à la confidentialité ; (iii) mettre en œuvre des mesures techniques et organisationnelles appropriées (chiffrement des mots de passe, contrôle d'accès par rôle, journalisation, sauvegardes) ; (iv) n'avoir recours à des sous-traitants ultérieurs (hébergement, envoi d'e-mails et de SMS) que dans le respect du RGPD et en leur imposant des obligations équivalentes ; (v) assister le Client dans l'exercice des droits des personnes concernées ; (vi) notifier au Client toute violation de données dans les meilleurs délais après en avoir eu connaissance ; (vii) supprimer ou restituer les données à l'issue du contrat dans les conditions de l'article « Réversibilité ».`,
      `Le Client fait son affaire de l'information des personnes concernées, de la base légale des traitements, de la tenue de son registre et, le cas échéant, des formalités auprès de l'autorité de protection des données de son pays. Tout transfert de données hors de l'Union européenne s'effectue avec des garanties appropriées.`,
    ],
    confidentiality: [
      `Chaque partie s'engage à garder strictement confidentielles les informations non publiques de l'autre partie dont elle a connaissance à l'occasion du contrat (conditions financières, documentation technique, données de clients, procédés), à ne les utiliser que pour l'exécution du contrat et à ne les divulguer qu'aux personnes qui ont besoin d'en connaître et qui sont tenues à une obligation équivalente.`,
      `Cette obligation s'applique pendant toute la durée du contrat et pendant cinq (5) ans après son terme. Elle ne s'applique pas aux informations tombées dans le domaine public sans faute de la partie qui les détenait, ni à celles dont la divulgation est exigée par la loi ou par une autorité compétente.`,
    ],
    forceMajeure: [
      `Aucune des parties n'est responsable d'un manquement à ses obligations (hors obligations de paiement) causé par un événement de force majeure au sens de l'article 1218 du Code civil, notamment une panne généralisée des réseaux ou des fournisseurs d'hébergement, un acte de piratage malgré des mesures de sécurité conformes aux règles de l'art, une décision d'une autorité publique ou une catastrophe naturelle.`,
      `Si l'événement dure plus de soixante (60) jours, l'une ou l'autre partie peut résilier le contrat par notification écrite, sans indemnité.`,
    ],
    general: [
      `Le contrat, avec ses éventuelles annexes, exprime l'intégralité de l'accord des parties sur son objet et remplace tout accord ou proposition antérieur. Toute modification doit faire l'objet d'un avenant écrit et signé des deux parties.`,
      `Le Client ne peut céder ni transférer le contrat, en tout ou partie, sans l'accord écrit préalable du Prestataire. Le Prestataire peut le céder à une entité reprenant son activité, sous réserve d'en informer le Client.`,
      `Si l'une des stipulations du contrat est déclarée nulle ou inapplicable, les autres demeurent en vigueur. Le fait pour une partie de ne pas exercer un droit ne vaut pas renonciation à ce droit.`,
      `Les notifications prévues au contrat sont valablement faites par courrier électronique aux adresses indiquées en tête du contrat (avec accusé de réception ou preuve d'envoi), ou par lettre recommandée. Chaque partie informe l'autre de tout changement d'adresse.`,
      `Les parties conviennent que le Prestataire peut citer le nom du Client comme utilisateur de la plateforme ${app} dans ses références commerciales, sauf opposition écrite du Client.`,
    ],
    law: (): string[] => [
      `Le contrat est soumis au droit français. En cas de difficulté d'interprétation ou d'exécution, les parties s'efforcent de la résoudre à l'amiable dans un délai de trente (30) jours à compter de la notification du différend par la partie la plus diligente.`,
      `À défaut d'accord amiable, tout litige relève de la compétence exclusive des tribunaux de ${contractConfig.jurisdictionCity}, y compris en cas de référé, d'appel en garantie ou de pluralité de défendeurs, sauf disposition légale impérative contraire.`,
    ],
    signature: [
      `Le Client reconnaît que la signature électronique apposée sur le présent contrat au moyen du lien sécurisé qui lui a été adressé par e-mail a, entre les parties, la même valeur que sa signature manuscrite, conformément aux articles 1366 et 1367 du Code civil et au règlement (UE) n° 910/2014 (eIDAS).`,
      `Les parties acceptent que les éléments d'identification et d'horodatage conservés par le Prestataire (nom du signataire, date et heure, adresse IP, empreinte numérique du document) constituent la preuve de la signature et de l'intégrité du contrat. Un exemplaire signé au format PDF est adressé au Client par e-mail dès la signature et reste consultable par le Prestataire.`,
    ],
  };
}

function summaryRental(t: ContractTerms): { label: string; value: string }[] {
  const p = PERIOD_LABEL[t.billingPeriod ?? 'MONTHLY'];
  return [
    { label: 'Nature du contrat', value: "Location de l'application (licence d'utilisation en mode SaaS)" },
    { label: 'Date d\'effet', value: formatDateFr(t.effectiveDate) },
    { label: 'Redevance', value: `${formatMoney(t.amount, t.currency)} ${p.per}, hors taxes` },
    { label: 'Engagement initial', value: `${t.commitmentMonths} mois, renouvelable tacitement` },
    { label: 'Délai de paiement', value: `${t.paymentDays} jours à compter de la facture` },
    { label: 'Préavis de non-renouvellement', value: '1 mois avant l\'échéance' },
  ];
}

function summaryPurchase(t: ContractTerms): { label: string; value: string }[] {
  const rows = [
    { label: 'Nature du contrat', value: "Achat de l'application (licence d'utilisation perpétuelle d'une instance dédiée)" },
    { label: 'Date d\'effet', value: formatDateFr(t.effectiveDate) },
    { label: 'Prix', value: `${formatMoney(t.amount, t.currency)}, forfaitaire et hors taxes` },
    { label: 'Paiement', value: `${t.paymentDays} jours à compter de la facture` },
    { label: 'Garantie', value: '12 mois (correction des anomalies)' },
  ];
  rows.push({
    label: 'Maintenance et hébergement',
    value: t.maintenanceFeeYearly ? `${formatMoney(t.maintenanceFeeYearly, t.currency)} par an, hors taxes` : 'Non inclus (sur devis)',
  });
  return rows;
}

function rentalArticles(t: ContractTerms, app: string): ContractArticle[] {
  const cc = commonClauses(app);
  const p = PERIOD_LABEL[t.billingPeriod ?? 'MONTHLY'];
  const amount = formatMoney(t.amount, t.currency);
  const list: Omit<ContractArticle, 'number'>[] = [
    {
      title: 'Objet et définitions',
      paragraphs: [
        `Le présent contrat a pour objet la location, par le Prestataire au Client, de la plateforme ${app}, solution logicielle de gestion de transferts d'argent, mise à disposition en ligne (mode SaaS), et la fourniture des services associés décrits ci-après.`,
        `« Application » : la plateforme ${app}, comprenant le back-office web, les applications mobiles, l'interface de programmation (API) et la documentation. « Instance » : l'environnement de l'Application paramétré pour le Client (code société, identité visuelle, domaine, règles de frais et de commissions). « Utilisateurs » : les administrateurs, agents et clients finaux auxquels le Client donne accès à l'Instance. « Données du Client » : l'ensemble des données saisies ou générées par le Client et ses Utilisateurs dans l'Instance.`,
      ],
    },
    {
      title: 'Services fournis',
      paragraphs: [
        `Pendant la durée du contrat, le Prestataire fournit au Client : (i) l'accès à l'Instance depuis un navigateur et depuis les applications mobiles ; (ii) l'hébergement de l'Instance et des Données du Client ; (iii) les mises à jour correctives et évolutives de l'Application, selon la feuille de route du Prestataire ; (iv) un support par e-mail les jours ouvrés, pour les incidents et questions d'utilisation ; (v) des sauvegardes régulières des Données du Client.`,
        `Les personnalisations spécifiques non prévues ci-dessus (développements sur mesure, intégrations particulières, formation sur site) font l'objet d'un devis distinct accepté par écrit.`,
      ],
    },
    {
      title: 'Mise en service et accès',
      paragraphs: [
        `À la création de l'Instance, le Prestataire communique au représentant du Client, par e-mail, les identifiants du compte administrateur de la société. Le Client doit modifier le mot de passe temporaire lors de sa première connexion.`,
        `Le Client est responsable de la création et de la gestion des comptes de ses agences, agents et Utilisateurs, ainsi que de la confidentialité des identifiants. Toute opération réalisée avec des identifiants valides est réputée effectuée par le Client.`,
      ],
    },
    {
      title: 'Durée, renouvellement et préavis',
      paragraphs: [
        `Le contrat prend effet le ${formatDateFr(t.effectiveDate)} pour un engagement initial de ${t.commitmentMonths} mois.`,
        `À son terme, il se renouvelle tacitement par périodes successives d'une durée égale à ${(t.commitmentMonths ?? 12) > 12 ? 'douze (12) mois' : 'la période d\'engagement initial'}, sauf notification de non-renouvellement adressée par l'une des parties à l'autre au moins un (1) mois avant l'échéance de la période en cours.`,
      ],
    },
    {
      title: 'Redevance et paiement',
      paragraphs: [
        `En contrepartie des services, le Client verse au Prestataire une redevance ${p.adj} de ${amount}, hors taxes, payable d'avance. Les taxes applicables (TVA ou équivalent) s'ajoutent le cas échéant au taux en vigueur.`,
        `Les factures sont payables dans un délai de ${t.paymentDays} jours à compter de leur émission, par virement ou par tout autre moyen convenu. Tout retard de paiement entraîne de plein droit, sans mise en demeure préalable, des pénalités égales à trois (3) fois le taux d'intérêt légal, ainsi qu'une indemnité forfaitaire de recouvrement de quarante (40) euros, conformément aux articles L. 441-10 et D. 441-5 du Code de commerce, sans préjudice de toute autre action.`,
        `Le Prestataire peut réviser la redevance une fois par période de douze (12) mois, moyennant un préavis écrit de soixante (60) jours ; à défaut d'acceptation, le Client peut notifier sa non-reconduction avant l'entrée en vigueur du nouveau tarif.`,
        `En cas de non-paiement d'une somme exigible quinze (15) jours après une mise en demeure restée sans effet, le Prestataire peut suspendre l'accès à l'Instance jusqu'au règlement intégral, sans que cette suspension ouvre droit à indemnité ni ne suspende l'obligation de payer la redevance.`,
      ],
    },
    {
      title: 'Obligations du Prestataire',
      paragraphs: [
        `Le Prestataire fournit les services avec le soin et la compétence d'un professionnel, et s'engage à une obligation de moyens. Il vise une disponibilité de l'Application de 99 % par mois, hors maintenances planifiées annoncées à l'avance et hors causes extérieures à sa maîtrise (fournisseurs d'accès, d'hébergement, force majeure).`,
        `Il met en œuvre les mesures de sécurité décrites à l'article relatif aux données personnelles, corrige dans des délais raisonnables les anomalies reproductibles qui lui sont signalées, et informe le Client de toute interruption significative des services.`,
      ],
    },
    { title: 'Obligations du Client', paragraphs: cc.clientObligations },
    {
      title: 'Propriété intellectuelle',
      paragraphs: [
        `L'Application, ses évolutions, son code source, sa documentation, ses bases, ainsi que les marques, logos et noms du Prestataire, demeurent la propriété exclusive du Prestataire ou de ses concédants. Le contrat ne confère au Client aucun droit de propriété sur eux.`,
        `Pendant sa durée, le Prestataire concède au Client un droit personnel, non exclusif, non cessible et non sous-licenciable d'accéder à l'Application et de l'utiliser pour les besoins de sa propre activité et de celle de ses agences et agents.`,
        `Le Client demeure propriétaire de ses marques, logos et contenus, et des Données du Client. Il concède au Prestataire le droit de les utiliser pour la seule fourniture des services (personnalisation de l'Instance, affichage dans les interfaces et les messages).`,
      ],
    },
    { title: 'Données personnelles', paragraphs: cc.data },
    { title: 'Confidentialité', paragraphs: cc.confidentiality },
    {
      title: 'Responsabilité',
      paragraphs: [
        `La responsabilité du Prestataire ne peut être engagée qu'en cas de faute prouvée de sa part. Elle est limitée aux dommages directs et prévisibles et, tous préjudices confondus, ne peut excéder le montant des redevances hors taxes effectivement payées par le Client au cours des douze (12) mois précédant le fait générateur.`,
        `Le Prestataire n'est pas responsable des dommages indirects (perte d'exploitation, de clientèle, de chiffre d'affaires, atteinte à l'image), des erreurs de saisie ou de paramétrage du Client, des opérations financières, des fraudes résultant d'une compromission des identifiants du Client, ni des décisions du Client à l'égard de ses propres clients et autorités.`,
        `Ces limitations ne s'appliquent pas en cas de dol, de faute lourde, ni pour les dommages corporels, et ne limitent pas les obligations de paiement du Client.`,
      ],
    },
    {
      title: 'Résiliation',
      paragraphs: [
        `Chaque partie peut résilier le contrat de plein droit, par lettre recommandée ou courrier électronique avec preuve d'envoi, en cas de manquement grave de l'autre partie à ses obligations non réparé dans un délai de trente (30) jours après mise en demeure.`,
        `Le Prestataire peut résilier immédiatement et sans préavis en cas d'usage de l'Application à des fins illicites ou frauduleuses, de perte par le Client d'un agrément nécessaire à son activité, ou de non-paiement persistant.`,
        `La résiliation n'ouvre droit à aucun remboursement des redevances déjà payées pour la période en cours, sauf manquement grave du Prestataire. Les redevances échues restent dues.`,
      ],
    },
    {
      title: 'Réversibilité',
      paragraphs: [
        `À la fin du contrat, pour quelque cause que ce soit, l'accès à l'Instance est désactivé. Pendant un délai de trente (30) jours suivant cette date, le Client peut demander au Prestataire la restitution de ses Données dans un format structuré et couramment utilisé (CSV ou équivalent).`,
        `Passé ce délai, le Prestataire supprime les Données du Client de ses systèmes actifs, sous réserve des données qu'il est tenu de conserver en application de la loi ou nécessaires à la preuve de ses droits. Le Client demeure responsable de la conservation de ses propres obligations légales d'archivage (notamment en matière de lutte contre le blanchiment, pendant cinq ans).`,
      ],
    },
    { title: 'Force majeure', paragraphs: cc.forceMajeure },
    { title: 'Dispositions générales', paragraphs: cc.general },
    { title: 'Droit applicable et règlement des litiges', paragraphs: cc.law() },
    { title: 'Signature électronique et preuve', paragraphs: cc.signature },
  ];
  return list.map((a, i) => ({ number: i + 1, ...a }));
}

function purchaseArticles(t: ContractTerms, app: string): ContractArticle[] {
  const cc = commonClauses(app);
  const price = formatMoney(t.amount, t.currency);
  const maint = t.maintenanceFeeYearly ? formatMoney(t.maintenanceFeeYearly, t.currency) : null;
  const list: Omit<ContractArticle, 'number'>[] = [
    {
      title: 'Objet et définitions',
      paragraphs: [
        `Le présent contrat a pour objet la vente au Client d'une licence d'utilisation perpétuelle, non exclusive, d'une instance dédiée de la plateforme ${app}, solution logicielle de gestion de transferts d'argent, moyennant le paiement d'un prix forfaitaire.`,
        `« Application » : la plateforme ${app}, comprenant le back-office web, les applications mobiles, l'interface de programmation (API) et la documentation. « Instance » : l'environnement de l'Application paramétré pour le Client (code société, identité visuelle, domaine, règles de frais et de commissions). « Utilisateurs » : les administrateurs, agents et clients finaux auxquels le Client donne accès à l'Instance. « Données du Client » : l'ensemble des données saisies ou générées par le Client et ses Utilisateurs dans l'Instance.`,
      ],
    },
    {
      title: 'Périmètre de la livraison',
      paragraphs: [
        `Le Prestataire livre au Client : (i) une Instance dédiée, paramétrée à son identité (nom, logo, couleurs, informations légales) ; (ii) l'accès au back-office web et aux applications mobiles de l'Application ; (iii) le compte administrateur de la société ; (iv) la documentation d'utilisation en vigueur.`,
        `Le code source de l'Application n'est pas cédé : il demeure la propriété exclusive du Prestataire. Sa remise éventuelle (« dépôt de code ») ou tout développement spécifique ne peut résulter que d'un accord écrit distinct.`,
      ],
    },
    {
      title: 'Livraison et recette',
      paragraphs: [
        `L'Instance est mise à disposition du Client à la date d'effet du contrat, soit le ${formatDateFr(t.effectiveDate)}. Les identifiants du compte administrateur sont adressés au représentant du Client par e-mail ; le Client doit modifier le mot de passe temporaire lors de sa première connexion.`,
        `Le Client dispose de quinze (15) jours à compter de la mise à disposition pour vérifier la conformité de l'Instance et notifier par écrit toute anomalie reproductible. Le Prestataire corrige les anomalies signalées dans des délais raisonnables. À défaut de notification dans ce délai, la livraison est réputée acceptée sans réserve.`,
      ],
    },
    {
      title: 'Prix et paiement',
      paragraphs: [
        `Le prix de la licence est fixé à ${price}, forfaitaire et hors taxes. Les taxes applicables (TVA ou équivalent) s'ajoutent le cas échéant au taux en vigueur.`,
        `Le prix est facturé à la signature du contrat et payable dans un délai de ${t.paymentDays} jours à compter de la facture, par virement ou par tout autre moyen convenu. Tout retard de paiement entraîne de plein droit, sans mise en demeure préalable, des pénalités égales à trois (3) fois le taux d'intérêt légal, ainsi qu'une indemnité forfaitaire de recouvrement de quarante (40) euros, conformément aux articles L. 441-10 et D. 441-5 du Code de commerce.`,
        `Le transfert au Client des droits d'utilisation est subordonné au paiement intégral du prix. À défaut de paiement quinze (15) jours après une mise en demeure restée sans effet, le Prestataire peut suspendre l'accès à l'Instance jusqu'au règlement.`,
      ],
    },
    {
      title: "Licence d'utilisation",
      paragraphs: [
        `Sous réserve du paiement du prix, le Prestataire concède au Client une licence personnelle, non exclusive et incessible d'utiliser l'Application, pour une durée illimitée, pour les besoins de sa propre activité et de celle de ses agences et agents, dans les pays où le Client est légalement autorisé à exercer.`,
        `La licence ne peut être sous-licenciée, louée, prêtée ni transférée à un tiers, sauf accord écrit du Prestataire. Elle ne confère au Client aucun droit de propriété sur l'Application, son code source ou ses évolutions.`,
      ],
    },
    {
      title: 'Garantie de conformité et correctifs',
      paragraphs: [
        `Pendant douze (12) mois à compter de la mise à disposition, le Prestataire corrige gratuitement les anomalies reproductibles de l'Application qui lui sont signalées par écrit, par une correction, un contournement ou une mise à jour. Cette garantie ne s'applique pas aux anomalies causées par une utilisation non conforme, par une modification faite par le Client ou un tiers, ou par un défaut de l'environnement du Client.`,
        `Le Prestataire ne garantit pas que l'Application sera exempte de toute erreur ni qu'elle répondra à des besoins non décrits au contrat ; il garantit qu'elle fonctionne conformément à sa documentation.`,
      ],
    },
    {
      title: 'Hébergement, maintenance et support',
      paragraphs: maint
        ? [
            `Le Client souscrit, en complément, un service de maintenance et d'hébergement moyennant une redevance annuelle de ${maint}, hors taxes, payable d'avance, qui comprend : l'hébergement de l'Instance et des Données du Client, les sauvegardes régulières, les mises à jour correctives et évolutives de l'Application, ainsi qu'un support par e-mail les jours ouvrés.`,
            `Ce service est conclu pour une durée d'un (1) an à compter de la date d'effet et se renouvelle tacitement par périodes d'un an, sauf notification de non-renouvellement adressée au moins un (1) mois avant l'échéance. Le Prestataire peut réviser la redevance moyennant un préavis écrit de soixante (60) jours. En l'absence de renouvellement, la licence perpétuelle subsiste, mais l'hébergement, les mises à jour et le support cessent, sous réserve de l'article « Réversibilité ».`,
          ]
        : [
            `L'hébergement de l'Instance, les mises à jour évolutives et le support au-delà de la période de garantie ne sont pas inclus dans le prix de la licence. Ils peuvent être fournis par le Prestataire sur devis distinct, accepté par écrit.`,
          ],
    },
    { title: 'Obligations du Client', paragraphs: cc.clientObligations },
    {
      title: 'Propriété intellectuelle',
      paragraphs: [
        `L'Application, ses évolutions, son code source, sa documentation, ainsi que les marques, logos et noms du Prestataire, demeurent la propriété exclusive du Prestataire ou de ses concédants.`,
        `Le Client demeure propriétaire de ses marques, logos et contenus, et des Données du Client. Il concède au Prestataire le droit de les utiliser pour la seule fourniture des services (personnalisation de l'Instance, affichage dans les interfaces et les messages).`,
      ],
    },
    { title: 'Données personnelles', paragraphs: cc.data },
    { title: 'Confidentialité', paragraphs: cc.confidentiality },
    {
      title: 'Responsabilité',
      paragraphs: [
        `La responsabilité du Prestataire ne peut être engagée qu'en cas de faute prouvée de sa part. Elle est limitée aux dommages directs et prévisibles et, tous préjudices confondus, ne peut excéder le prix hors taxes effectivement payé par le Client au titre du présent contrat.`,
        `Le Prestataire n'est pas responsable des dommages indirects (perte d'exploitation, de clientèle, de chiffre d'affaires, atteinte à l'image), des erreurs de saisie ou de paramétrage du Client, des opérations financières, des fraudes résultant d'une compromission des identifiants du Client, ni des décisions du Client à l'égard de ses propres clients et autorités.`,
        `Ces limitations ne s'appliquent pas en cas de dol, de faute lourde, ni pour les dommages corporels, et ne limitent pas les obligations de paiement du Client.`,
      ],
    },
    {
      title: 'Résiliation',
      paragraphs: [
        `Le prix de la licence étant forfaitaire, le Client ne peut pas résilier le contrat pour convenance. Chaque partie peut le résilier de plein droit, par lettre recommandée ou courrier électronique avec preuve d'envoi, en cas de manquement grave de l'autre partie non réparé dans un délai de trente (30) jours après mise en demeure.`,
        `Le Prestataire peut résilier immédiatement et sans préavis en cas d'usage de l'Application à des fins illicites ou frauduleuses, de violation des limites de la licence, ou de perte par le Client d'un agrément nécessaire à son activité. Le prix payé reste acquis au Prestataire, sauf manquement grave de ce dernier.`,
      ],
    },
    {
      title: 'Réversibilité',
      paragraphs: [
        `À la fin du contrat, ou si l'hébergement par le Prestataire prend fin, le Client peut demander la restitution de ses Données dans un format structuré et couramment utilisé (CSV ou équivalent), dans un délai de trente (30) jours. Passé ce délai, le Prestataire supprime les Données du Client de ses systèmes actifs, sous réserve des données qu'il est tenu de conserver en application de la loi.`,
        `Le Client demeure responsable de la conservation de ses propres obligations légales d'archivage (notamment en matière de lutte contre le blanchiment, pendant cinq ans).`,
      ],
    },
    { title: 'Force majeure', paragraphs: cc.forceMajeure },
    { title: 'Dispositions générales', paragraphs: cc.general },
    { title: 'Droit applicable et règlement des litiges', paragraphs: cc.law() },
    { title: 'Signature électronique et preuve', paragraphs: cc.signature },
  ];
  return list.map((a, i) => ({ number: i + 1, ...a }));
}

/** Rend le contrat complet (texte figé) pour un type, des conditions et un client donnés. */
export function buildContract(args: {
  kind: ContractKind;
  reference: string;
  issuedAt: Date;
  terms: ContractTerms;
  customer: CustomerInfo;
}): ContractContent {
  const { kind, reference, issuedAt, terms, customer } = args;
  const app = platform.name;
  const provider = providerBlock();
  const rental = kind === 'RENTAL';

  const preamble = [
    `Le Prestataire édite et exploite la plateforme ${app}, solution logicielle destinée aux sociétés de transfert d'argent, qu'il met à la disposition de ses clients professionnels.`,
    rental
      ? `Le Client, société de transfert d'argent ou de services financiers, souhaite louer l'Application pour exercer son activité auprès de ses agences, agents et clients. Les parties se sont rapprochées et ont convenu ce qui suit.`
      : `Le Client, société de transfert d'argent ou de services financiers, souhaite acquérir une licence d'utilisation perpétuelle de l'Application pour exercer son activité auprès de ses agences, agents et clients. Les parties se sont rapprochées et ont convenu ce qui suit.`,
  ];

  return {
    kind,
    title: rental ? "CONTRAT DE LOCATION DE L'APPLICATION" : "CONTRAT D'ACHAT DE L'APPLICATION",
    subtitle: rental
      ? `Licence d'utilisation en mode SaaS — ${app}`
      : `Licence d'utilisation perpétuelle d'une instance dédiée — ${app}`,
    reference,
    issuedAt: issuedAt.toISOString(),
    provider,
    customer: customerBlock(customer),
    summary: rental ? summaryRental(terms) : summaryPurchase(terms),
    preamble,
    articles: rental ? rentalArticles(terms, app) : purchaseArticles(terms, app),
    closing: [
      `Fait en un exemplaire électronique, signé par voie électronique, le jour de la signature du Client indiqué dans le certificat de signature joint au présent contrat.`,
    ],
  };
}

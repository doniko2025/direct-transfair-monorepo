# Paiement de factures — mon avis sur les partenariats, et ce qu'il faut obtenir

> Les noms de partenaires ci-dessous sont des **pistes à vérifier** (annonces publiques, pas de contrat connu). Aucun accord n'est supposé. Rien ici n'est un avis juridique.

## 1. Mon avis en une page

**Tu as raison : le logiciel est la partie facile.** Sans accord avec le facturier, tu peux encaisser le client, mais rien ne garantit que la facture soit réellement créditée au bon abonné, ni que tu puisses prouver le paiement en cas de litige. Un client qui paie « EDG » depuis l'application et dont le compteur n'est pas crédité, c'est un litige que **toi** tu portes.

**Ce que j'ai donc construit : un système qui marche avant tout accord.**
- Mode **manuel** (par défaut) : le client paie depuis son portefeuille, l'argent arrive sur le portefeuille de ta société, ton équipe règle le facturier **elle-même** (agence, mobile money, virement…), puis saisit le numéro de reçu. Le client reçoit son reçu (et son jeton d'électricité prépayée) dans l'application. Un délai est annoncé au client ; au-delà, la facture passe « en retard » chez toi.
- Mode **automatique** (plus tard) : le jour où un partenaire te donne une API, on branche un « connecteur » (un fichier à écrire, sans toucher au reste) et la facture est réglée en quelques secondes.
- Mode **simulation** : pour montrer l'écran, tester et former l'équipe, sans aucun argent réel (bloqué en production).

**Ordre que je te conseille**
1. **Commencer en manuel, avec 2 ou 3 facturiers seulement**, ceux que tes clients paient le plus (électricité et eau en Guinée, scolarité d'une ou deux écoles que tu connais). Tu mesures le volume réel et les litiges avant de signer quoi que ce soit de lourd.
2. **Un agrégateur ou un opérateur de mobile money** pour l'électricité, l'eau, la télé et les recharges : un seul contrat pour beaucoup de facturiers, une seule API, un seul rapprochement. C'est presque toujours plus rapide que de négocier société par société.
3. **Les gros facturiers en direct** (EDG, SEG, l'assureur principal) quand ton volume leur donne une raison de te répondre : commissions meilleures, reçus officiels.
4. **Écoles, propriétaires, petits assureurs** : pas de contrat de masse. Chaque école a son propre facturier dans le catalogue (matricule, trimestre…), réglé en manuel, avec une convention d'une page. Le loyer est un cas à part (voir §4).

**Les 3 risques à garder en tête avant d'ouvrir au public**
- **L'argent des clients dort sur le portefeuille de ta société** entre le paiement et le règlement du facturier. C'est une dette envers tes clients : le portefeuille doit rester approvisionné (il sert aussi aux remboursements).
- **Statut réglementaire** : encaisser des factures pour le compte de tiers peut relever d'un statut d'établissement de paiement ou d'un agrément, selon le pays (France/UE, Guinée — BCRG, zone UEMOA — BCEAO). **À faire valider par un juriste ou le régulateur avant de passer à l'échelle.** Un partenaire déjà agréé (opérateur, banque, agrégateur) peut porter ce risque à ta place — c'est un argument de plus pour le point 2.
- **Fraude et blanchiment** : les plafonds par facture et par jour, le KYC et le code secret sont déjà dans le système (réglables dans « Factures — facturiers »). Un loyer ou des frais de scolarité de montant élevé justifient des plafonds plus prudents.

## 2. Ce qu'il faut obtenir de chaque partenaire (liste à cocher)

À demander **par écrit**, quel que soit le facturier :

| # | À obtenir | Pourquoi |
|---|---|---|
| 1 | **Accord signé** et identité complète du facturier (raison sociale, numéro d'enregistrement, représentant) | Prouver que tu agis avec son accord |
| 2 | **Mandat d'encaissement** : tu es autorisé à encaisser pour lui, et un paiement chez toi **libère** l'abonné | Sans cela, le client peut être poursuivi comme « impayé » |
| 3 | **Commission** : qui paie quoi (frais payés par le client, commission reversée par le facturier, aucune ?) | Tes frais dans l'écran de chaque facturier |
| 4 | **Règlement** : délai (J+0, J+1…), compte ou portefeuille à créditer, périodicité, devise | Le « délai annoncé » au client et le montant à verser |
| 5 | **Format de la référence** : numéro d'abonné, de compteur, matricule… et ses règles (longueur, chiffres) | Le « format attendu » qui évite les fautes de frappe |
| 6 | **Vérification avant paiement** : peut-on interroger la facture (nom du titulaire, montant dû, échéance) ? | Évite de payer la mauvaise personne ; montant exact |
| 7 | **Reçu officiel** et, pour le prépayé, le **jeton / code** de recharge | Ce que le client reçoit dans l'application |
| 8 | **Fichier de rapprochement** quotidien (qui a payé quoi) | Contrôler que tout ce que tu as encaissé est crédité |
| 9 | **Litiges et remboursements** : délai de réponse, qui rembourse, preuve acceptée | Procédure quand un paiement est contesté |
| 10 | **Accès technique** (si API) : clés de test, documentation, webhooks de confirmation, idempotence (rejouer sans payer deux fois) | Écrire le connecteur |
| 11 | **Disponibilité** : engagement de service, horaires, contact d'urgence | Savoir quoi dire au client quand ça ne répond pas |
| 12 | **Conformité** : pièces KYC demandées à ta société, exigences de licence, protection des données | Éviter une mauvaise surprise à la signature |

## 3. Pistes par type de facturier (à vérifier)

| Type | Pistes publiques à explorer | Remarque |
|---|---|---|
| **Électricité / eau (Guinée)** | EDG (« EDG Express », points de vente annoncés fin 2024), SEG (eau) ; paiement possible via Orange Money et des plateformes de paiement locales (ex. PayCard) | Demander s'ils ont une API ou seulement un portail agent |
| **Électricité / eau (UEMOA)** | Accords Orange Money annoncés avec des distributeurs (ex. Senelec, SDE au Sénégal) | Souvent réservés aux opérateurs mobile money |
| **Agrégateurs** | Reloadly (API de factures et recharges), Onafriq, Fincra, LAfricaMobile (modèle à commission) | Un contrat, plusieurs facturiers ; vérifier la couverture pays par pays (Flutterwave Bills ne couvre que le Nigéria) |
| **Télé, internet, recharges** | Canal+, Startimes, opérateurs télécom | Faciles à obtenir par agrégateur |
| **Assurance auto / moto** | Les assureurs et courtiers locaux | Demander : attestation numérique et délai de mise en vigueur après paiement — c'est ce que le client attend vraiment |
| **Scolarité** | Chaque école / université directement | Un facturier par école ; champs « matricule », « trimestre » ; reçu signé par l'école |
| **Loyer** | Propriétaires, agences immobilières | Pas de partenariat de masse : un facturier par agence, ou transfert vers un bénéficiaire connu ; plafonds prudents |

## 4. Le loyer, cas particulier

Contrairement aux autres, le propriétaire n'a souvent ni système ni mandat. Deux options :
1. **Agences immobilières partenaires** : un facturier par agence (ou par bailleur régulier), avec le numéro de contrat comme référence.
2. **Pas de facturier du tout** : c'est alors un transfert d'argent classique vers le bénéficiaire (fonction qui existe déjà dans l'application).
Dans les deux cas, garde des plafonds bas au début et demande une preuve de paiement signée par le bénéficiaire.

## 5. Comment ça se passe dans le système (pour ton équipe)

1. **Factures — facturiers** : régler le plafond, ajouter un facturier (brouillon), renseigner frais, champs demandés, délai, **statut du partenariat** (aucun accord / en négociation / signé) et coordonnées de règlement — **jamais visibles des clients**.
2. Passer le facturier en **« Ouvert aux clients »**, puis ouvrir la fonction pour la société (interrupteur « Paiement de factures »). Fermée par défaut.
3. Un client paie ; sur **Factures à régler**, ton équipe voit le montant dû, la référence, les coordonnées de règlement. Elle règle le facturier, puis **« Réglée »** avec le numéro de reçu (et le jeton). Ou **« Refuser »** : le client est remboursé automatiquement.
4. **Exporter** (CSV) pour le rapprochement avec le fichier du facturier.

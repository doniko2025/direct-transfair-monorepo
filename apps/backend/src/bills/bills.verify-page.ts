// apps/backend/src/bills/bills.verify-page.ts
// Petite page publique « Reçu authentique / non reconnu » (ouverte depuis le code ou le lien imprimé sur un reçu PDF).
// Même présentation que la page de vérification des reçus marchands ; ne montre que les données déjà renvoyées par verifyReceipt
// (référence du compte masquée, jamais de nom complet ni de coordonnées).

type Check =
  | { valid: false }
  | { valid: true; biller: string; amount: number; currency: string; accountRef: string; providerRef: string | null; completedAt: Date };

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

function money(amount: number, currency: string): string {
  const n = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(amount);
  return `${n} ${currency === 'XOF' || currency === 'XAF' ? 'F CFA' : currency}`;
}

export function renderBillVerifyPage(r: Check): string {
  const row = (k: string, v: string) => `<div class="row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`;
  const body = r.valid
    ? `<div class="badge ok">Reçu de facture authentique</div>
       <div class="amount">${esc(money(r.amount, r.currency))}</div>
       ${row('Facturier', r.biller)}${row('Compte', r.accountRef)}${r.providerRef ? row('N° d\'opération', r.providerRef) : ''}
       ${row('Réglé le', `${new Date(r.completedAt).toLocaleString('fr-FR', { timeZone: 'UTC' })} UTC`)}
       <p class="hint">Comparez le <b>montant</b>, le <b>facturier</b> et la fin du <b>numéro de compte</b> avec le document reçu. S'ils diffèrent, le document a été modifié : ne l'acceptez pas.</p>`
    : `<div class="badge bad">Reçu non reconnu</div>
       <p class="hint">Ce code ne correspond à aucune facture réglée. Le document est falsifié, incomplet, ou la facture n'a pas encore été réglée au facturier. Ne l'acceptez pas.</p>`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Vérification de reçu de facture</title><style>
body{font-family:-apple-system,Helvetica,Arial,sans-serif;background:#f4f4f2;margin:0;padding:24px;color:#111}
.card{max-width:460px;margin:0 auto;background:#fff;border-radius:20px;padding:24px;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.badge{display:inline-block;padding:8px 14px;border-radius:99px;font-weight:700;font-size:14px;margin-bottom:12px}
.ok{background:#e8f6ee;color:#17803d}.bad{background:#fdeaea;color:#b42318}
.amount{font-size:34px;font-weight:800;margin:6px 0 14px}.row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #eee;font-size:14px}
.row span{color:#666}.row b{text-align:right;word-break:break-word}.hint{font-size:13px;color:#555;line-height:1.5;margin-top:16px}</style></head><body><div class="card">${body}</div></body></html>`;
}

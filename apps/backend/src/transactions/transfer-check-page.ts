// apps/backend/src/transactions/transfer-check-page.ts
// Petite page publique ouverte par le QR d'un reçu d'envoi (caméra du téléphone). Pure : testée sans serveur.
import type { PublicTransferCheck } from './transfer-receipt';

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

function money(amount: number, currency: string): string {
  const n = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(amount);
  return `${n} ${currency === 'XOF' || currency === 'XAF' ? 'F CFA' : currency}`;
}
const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { timeZone: 'UTC' }) + ' UTC';

export const APP_SCHEME = 'directtransfair';

export function renderTransferCheckPage(r: PublicTransferCheck | { valid: false }, code: string): string {
  const row = (k: string, v: string) => `<div class="row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`;
  const body = r.valid
    ? `<div class="badge ${r.statusTone}">${esc(r.statusLabel)}</div>
       <div class="co">${esc(r.companyName)}</div>
       <div class="amount">${esc(money(r.amount, r.currency))}</div>
       ${row('Opération', r.title)}
       ${row('Référence', r.reference)}
       ${r.currency !== r.sentCurrency ? row('Montant envoyé', money(r.sentAmount, r.sentCurrency)) : ''}
       ${row('Expéditeur', r.sender)}${row('Bénéficiaire', r.recipient)}
       ${row('Émis le', when(r.createdAt))}
       ${r.paidAt ? row('Payé le', when(r.paidAt)) : ''}
       ${r.payable
         ? `<a class="btn" href="${APP_SCHEME}://agent/withdraw?code=${encodeURIComponent(code)}">Payer dans l'application agent</a>
            <p class="hint">Agent : ouvrez ce reçu dans l'application pour verser le montant. Le paiement est contrôlé et ne peut se faire qu'une seule fois.</p>`
         : ''}
       <p class="hint">Comparez le <b>montant</b>, le <b>bénéficiaire</b> et la <b>référence</b> avec ceux du reçu. S'ils diffèrent, le document a été modifié : ne l'acceptez pas.${r.status === 'PAID' ? ' Ce reçu est déjà <b>payé</b> : il ne peut plus servir à retirer de l\'argent.' : ''}</p>`
    : `<div class="badge bad">Reçu non reconnu</div>
       <p class="hint">Ce code ne correspond à aucun envoi. Le document est falsifié, incomplet ou le QR code est abîmé. Ne l'acceptez pas et ne versez rien.</p>`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Vérification de reçu</title><style>
body{font-family:-apple-system,Helvetica,Arial,sans-serif;background:#f4f4f2;margin:0;padding:24px;color:#111}
.card{max-width:460px;margin:0 auto;background:#fff;border-radius:20px;padding:24px;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.badge{display:inline-block;padding:8px 14px;border-radius:99px;font-weight:700;font-size:14px;margin-bottom:12px}
.ok{background:#e8f6ee;color:#17803d}.info{background:#e8f0fe;color:#1a56c4}.warn{background:#fff4e0;color:#a15c00}.bad{background:#fdeaea;color:#b42318}
.co{font-size:13px;color:#666;font-weight:600}.amount{font-size:34px;font-weight:800;margin:4px 0 14px;word-break:break-word}
.row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #eee;font-size:14px}
.row span{color:#666}.row b{text-align:right}.hint{font-size:13px;color:#555;line-height:1.5;margin-top:16px}
.btn{display:block;text-align:center;margin-top:18px;background:#111;color:#fff;text-decoration:none;font-weight:700;padding:14px;border-radius:14px}
</style></head><body><div class="card">${body}</div></body></html>`;
}

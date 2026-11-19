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

const stepTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' UTC' : '');

/** Frise de suivi : une pastille par étape, reliées par un trait ; l'étape en cours pulse. */
function renderTimeline(steps: PublicTransferCheck['steps']): string {
  if (!steps || steps.length === 0) return '';
  const items = steps
    .map(
      (s, i) => `<li class="st ${esc(s.state)}" style="--i:${i}"><span class="dot" aria-hidden="true">${s.state === 'done' ? '✓' : s.state === 'failed' ? '!' : ''}</span>
        <div class="stx"><b>${esc(s.label)}</b>${s.at ? `<small>${esc(stepTime(s.at))}</small>` : ''}</div></li>`,
    )
    .join('');
  return `<h2 class="tl">Suivi de l'envoi</h2><ol class="timeline" aria-label="Étapes de l'envoi">${items}</ol>`;
}

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
       ${renderTimeline(r.steps)}
       ${r.payable
         ? `<a class="btn" href="${APP_SCHEME}://agent/withdraw?code=${encodeURIComponent(code)}">Payer dans l'application agent</a>
            <p class="hint">Agent : ouvrez ce reçu dans l'application pour verser le montant. Le paiement est contrôlé et ne peut se faire qu'une seule fois.</p>`
         : ''}
       <p class="hint">Comparez le <b>montant</b>, le <b>bénéficiaire</b> et la <b>référence</b> avec ceux du reçu. S'ils diffèrent, le document a été modifié : ne l'acceptez pas.${r.status === 'PAID' ? ' Ce reçu est déjà <b>payé</b> : il ne peut plus servir à retirer de l\'argent.' : ''}</p>`
    : `<div class="badge bad">Reçu non reconnu</div>
       <p class="hint">Ce code ne correspond à aucun envoi. Le document est falsifié, incomplet ou le QR code est abîmé. Ne l'acceptez pas et ne versez rien.</p>`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">${r.valid && r.final === false ? '<meta http-equiv="refresh" content="60">' : ''}<title>Suivi et vérification de reçu</title><style>
body{font-family:-apple-system,Helvetica,Arial,sans-serif;background:#f4f4f2;margin:0;padding:24px;color:#111}
.card{max-width:460px;margin:0 auto;background:#fff;border-radius:20px;padding:24px;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.badge{display:inline-block;padding:8px 14px;border-radius:99px;font-weight:700;font-size:14px;margin-bottom:12px}
.ok{background:#e8f6ee;color:#17803d}.info{background:#e8f0fe;color:#1a56c4}.warn{background:#fff4e0;color:#a15c00}.bad{background:#fdeaea;color:#b42318}
.co{font-size:13px;color:#666;font-weight:600}.amount{font-size:34px;font-weight:800;margin:4px 0 14px;word-break:break-word}
.row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #eee;font-size:14px}
.row span{color:#666}.row b{text-align:right}.hint{font-size:13px;color:#555;line-height:1.5;margin-top:16px}
.tl{font-size:15px;margin:20px 0 8px}.timeline{list-style:none;margin:0;padding:0}
.st{position:relative;display:flex;gap:12px;padding:0 0 18px;animation:rise .45s both;animation-delay:calc(var(--i)*90ms)}
.st:last-child{padding-bottom:0}.st::before{content:'';position:absolute;left:13px;top:28px;bottom:-2px;width:2px;background:#e3e3df}.st:last-child::before{display:none}
.dot{flex:0 0 28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:14px;font-weight:800;background:#e8e8e4;color:#999;z-index:1}
.stx{display:grid;gap:1px;padding-top:3px}.stx b{font-size:14px}.stx small{color:#777;font-size:12px}
.st.done .dot{background:#17803d;color:#fff}.st.done::before{background:#17803d}
.st.current .dot{background:#1a56c4;box-shadow:0 0 0 0 rgba(26,86,196,.5);animation:pulse 1.6s infinite}
.st.failed .dot{background:#b42318;color:#fff}.st.todo b{color:#999;font-weight:600}
@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes pulse{70%{box-shadow:0 0 0 10px rgba(26,86,196,0)}100%{box-shadow:0 0 0 0 rgba(26,86,196,0)}}
@media(prefers-reduced-motion:reduce){.st,.st.current .dot{animation:none}}
.btn{display:block;text-align:center;margin-top:18px;background:#111;color:#fff;text-decoration:none;font-weight:700;padding:14px;border-radius:14px}
</style></head><body><div class="card">${body}</div></body></html>`;
}

/* functions/index.js — إشعارات الزبون (Blaze). النشر: firebase deploy --only functions */
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

/* إرسال إشعار لكل أجهزة زبون عبر customerId */
async function sendToCustomer(customerId, title, body, extra) {
  const db = getFirestore();
  const tokensSnap = await db.collection('customer_tokens')
    .where('customerId', '==', customerId).get();
  const tokens = tokensSnap.docs.map((d) => d.id);
  console.log(`tokens for ${customerId}:`, tokens.length);
  if (tokens.length === 0) { console.log('SKIP: no tokens'); return; }

  const message = {
    tokens,
    notification: { title, body },
    data: Object.assign({ title, body }, extra || {}),
    webpush: {
      headers: { Urgency: 'high', TTL: '86400' },
      notification: { title, body, icon: '/icon-192.png', badge: '/icon-192.png', dir: 'rtl', lang: 'ar', requireInteraction: true },
      fcmOptions: { link: '/' },
    },
  };
  const res = await getMessaging().sendEachForMulticast(message);
  console.log(`sent: ${res.successCount} failed: ${res.failureCount}`);
  const dels = [];
  res.responses.forEach((r, i) => {
    if (!r.success) {
      const code = (r.error && r.error.code) || '';
      console.log('error token', i, code);
      if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
        dels.push(db.collection('customer_tokens').doc(tokens[i]).delete());
      }
    }
  });
  await Promise.all(dels);
}

/* تنسيق رقم مختصر */
function num(n) { return Math.round((Number(n) || 0) * 100) / 100; }

/* ① فاتورة جديدة */
exports.notifyCustomerOnInvoice = onDocumentCreated(
  { document: 'invoices/{id}', region: 'europe-west1' },
  async (event) => {
    const inv = (event.data && event.data.data()) || {};
    const customerId = inv.customerId ? String(inv.customerId) : null;
    console.log('invoice', { id: inv.id, customer: inv.customer, customerId });
    if (!customerId) { console.log('SKIP: no customerId'); return; }
    await sendToCustomer(customerId, 'فاتورة جديدة',
      `تم تسجيل فاتورة #${inv.id || ''} في حسابك`, { invId: String(inv.id || '') });
  }
);

/* ② معاملة أخذ/دفع جديدة (من السجل) */
exports.notifyCustomerOnLedger = onDocumentCreated(
  { document: 'ledger/{id}', region: 'europe-west1' },
  async (event) => {
    const e = (event.data && event.data.data()) || {};
    const customerId = e.customerId ? String(e.customerId) : null;
    const t = e.type;
    console.log('ledger', { type: t, customer: e.customer, customerId, amount: e.amount });
    if (!customerId) { console.log('SKIP: no customerId'); return; }

    const TYPES = ['take', 'take-gold', 'give', 'give-gold'];
    if (!TYPES.includes(t)) { console.log('SKIP: type not notifiable:', t); return; }

    const amt = num(e.amount != null ? e.amount : Math.abs(e.dinar || e.gold || 0));
    let body;
    if (t === 'take')           body = `أخذ: ${amt} دج`;
    else if (t === 'take-gold') body = `أخذ ذهب: ${amt} غ`;
    else if (t === 'give')      body = `دفع: ${amt} دج`;
    else                        body = `دفع ذهب: ${amt} غ`;

    await sendToCustomer(customerId, 'معاملة جديدة', body, { kind: t });
  }
);

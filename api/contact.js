const https = require('https');

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ body: data, headers: res.headers }));
    }).on('error', reject);
  });
}

function postForm(url, formData, cookies) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(formData).toString();
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'Mozilla/5.0',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://softart.io',
        'Referer': 'https://softart.io/trumpet-contact',
        ...(cookies ? { 'Cookie': cookies } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

    // 1. Fetch fresh nonce from softart.io/trumpet-contact
    const page = await fetchPage('https://softart.io/trumpet-contact');
    const nonceMatch = page.body.match(/name="forminator_nonce"\s+value="([^"]+)"/);
    const nonce = nonceMatch ? nonceMatch[1] : '';
    const rawCookies = page.headers['set-cookie'] || [];
    const cookies = rawCookies.map((c) => c.split(';')[0]).join('; ');

    // 2. Build Forminator payload matching form_id 5044
    const formFields = {
      'name-1': payload.name || '',
      'email-1': payload.email || '',
      'select-4': payload.subject || 'Trumpet-Performance',
      'date-1': payload.eventDate || '',
      'time-1-hours': payload.eventHour || '6',
      'time-1-minutes': payload.eventMinute || '0',
      'time-1-ampm': payload.eventAmPm || 'pm',
      'address-1-street_address': payload.venue || '',
      'address-1-city': payload.city || 'Chapel Hill',
      'address-1-state': payload.state || 'NC',
      'address-1-zip': payload.zip || '27516',
      'checkbox-2[]': payload.blackTie || 'two',
      'select-5': payload.tuxedo || 'two',
      'select-8': payload.indoorOutdoor || 'one',
      'select-9': payload.rainPlan || 'one',
      'select-7': payload.attendees || 'two',
      'select-6': payload.paSystem || 'two',
      'currency-1': payload.budget || '300',
      'textarea-1': payload.message || '',
      'select-3': 'I-hope-to-be-contacted-via-email',
      'phone-1': payload.phone || '',
      'checkbox-1[]': 'You-will-get-an-email-reply,-so-please-add-to-your-safe-senders-list,-and-check-your-inbox---spam-folder.',
      'hidden-1': '',
      'hidden-2': '',
      'hidden-3': '',
      'hidden-4': '',
      'hidden-5': 'https://trumpetmonk.org',
      'referer_url': 'https://trumpetmonk.org',
      'forminator_nonce': nonce,
      '_wp_http_referer': '/trumpet-contact',
      'form_id': '5044',
      'page_id': '3659',
      'form_type': 'default',
      'current_url': 'https://softart.io/trumpet-contact',
      'render_id': '0',
      'action': 'forminator_submit_form_custom-forms'
    };

    if (payload.recaptchaToken) {
      formFields['g-recaptcha-response'] = payload.recaptchaToken;
    }

    const result = await postForm('https://softart.io/wp-admin/admin-ajax.php', formFields, cookies);
    let parsed = null;
    try {
      parsed = JSON.parse(result.body);
    } catch (_) {
      parsed = { raw: result.body };
    }

    return res.status(200).json({
      success: Boolean(parsed && parsed.success),
      upstream: parsed
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Submission error'
    });
  }
};

// Pre-deploy sanity check for the alltrails cloud function. Reads the three
// prod Firestore docs the handler needs (auth/scub3d, auth/alltrails, auth/mapbox)
// and optionally fires a single AllTrails request through the prod proxy to
// prove the pipe works end-to-end.
//
// Non-destructive — read-only Firestore, one outbound GET. Delete after use.
//
// Run: cd functions && node _check_prod_deps.js [--probe]

const admin = require('firebase-admin');
const serviceAccount = require('./credentials.json');
const request = require('request');

admin.initializeApp({
	projectId: serviceAccount.project_id,
	credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

function redact(s) {
	if (!s) return '(unset)';
	if (s.length <= 8) return '*'.repeat(s.length);
	return s.slice(0, 4) + '…' + s.slice(-4);
}

async function main() {
	console.log('=== Firestore auth docs ===\n');

	const scub3d = await db.collection('auth').doc('scub3d').get();
	console.log('auth/scub3d exists:', scub3d.exists);
	if (scub3d.exists) {
		const data = scub3d.data();
		if (data.proxyIP) {
			try {
				const u = new URL(data.proxyIP);
				// Host visible (not secret — just need to know if it's localhost
				// vs a cloud-reachable service). Any userinfo is redacted.
				console.log('  proxyIP host:', u.hostname + ':' + u.port + ' (protocol ' + u.protocol + ')');
				const isLocal = ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(u.hostname) || u.hostname.startsWith('192.168.') || u.hostname.startsWith('10.') || u.hostname.startsWith('172.');
				if (isLocal) {
					console.log('  ⚠  proxyIP is a LOCAL/private address — Cloud Functions cannot reach this from prod.');
				}
			} catch (_) {
				console.log('  proxyIP (unparseable):', redact(data.proxyIP));
			}
		} else {
			console.log('  proxyIP: (missing)');
		}
		console.log('  (full field set:', Object.keys(data).join(', '), ')');
		if (data.proxyIP_old) {
			try {
				const u = new URL(data.proxyIP_old);
				console.log('  proxyIP_old host:', u.hostname + ':' + u.port + ' (protocol ' + u.protocol + ')');
			} catch (_) {
				console.log('  proxyIP_old (unparseable):', redact(data.proxyIP_old));
			}
		}
	}

	const atAuth = await db.collection('auth').doc('alltrails').get();
	console.log('\nauth/alltrails exists:', atAuth.exists);
	if (atAuth.exists) {
		const data = atAuth.data();
		console.log('  userId:', data.userId || '(missing)');
		console.log('  cookies: ' + (data.cookies ? Object.keys(data.cookies).length + ' keys' : '(missing)'));
		if (data.cookies) {
			const importantCookies = ['_at_session', '_at_userid', '_at_token', 'datadome'];
			for (const k of importantCookies) {
				if (data.cookies[k]) console.log('    ' + k + ':', redact(data.cookies[k]));
			}
		}
	}

	const mapbox = await db.collection('auth').doc('mapbox').get();
	console.log('\nauth/mapbox exists:', mapbox.exists);
	if (mapbox.exists) {
		console.log('  token:', redact(mapbox.data().token));
	}

	// Optional: probe AllTrails through the prod proxy.
	if (process.argv.includes('--probe')) {
		if (!scub3d.exists || !scub3d.data().proxyIP) {
			console.log('\n✗ Cannot probe — no proxyIP in auth/scub3d');
			process.exit(1);
		}
		if (!atAuth.exists || !atAuth.data().cookies || !atAuth.data().userId) {
			console.log('\n✗ Cannot probe — missing cookies/userId');
			process.exit(1);
		}

		const auth = atAuth.data();
		const proxy = scub3d.data().proxyIP;
		console.log('\n=== Probe: one AllTrails maps request via prod proxy ===');

		const cookieHeader = Object.entries(auth.cookies).map(([k, v]) => k + '=' + v).join('; ');
		const url = 'https://www.alltrails.com/api/alltrails/users/' + auth.userId + '/maps?limit=1&presentation_type=track';

		await new Promise((resolve) => {
			request({
				method: 'GET',
				url,
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
					'Accept': 'application/json',
					'Cookie': cookieHeader,
				},
				proxy,
				gzip: true,
				timeout: 15000,
			}, (err, resp, body) => {
				if (err) {
					console.log('  ✗ Request failed:', err.code || err.message);
					resolve();
					return;
				}
				console.log('  status:', resp.statusCode);
				console.log('  body length:', body ? body.length : 0);
				const bodyText = Buffer.isBuffer(body) ? body.toString() : body;
				if (resp.statusCode === 200) {
					try {
						const json = JSON.parse(bodyText);
						const mapCount = (json.maps || []).length;
						console.log('  ✓ Got', mapCount, 'map(s). Proxy + cookies are live.');
					} catch (_) {
						console.log('  ✗ 200 but body not JSON. Preview:', bodyText.slice(0, 200));
					}
				} else {
					console.log('  ✗ Preview:', bodyText.slice(0, 300));
					if (resp.statusCode === 403) {
						console.log('  Hint: cookies likely expired OR DataDome challenge — refresh browser cookies into auth/alltrails.cookies');
					}
				}
				resolve();
			});
		});
	} else {
		console.log('\n(pass --probe to fire one real AllTrails request through the prod proxy)');
	}

	process.exit(0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });

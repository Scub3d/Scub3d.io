// Seeds the local Firebase Storage emulator with current contents of the
// prod dynamic.scub3d.io bucket so widgets have real media to load during
// dev without repeatedly hitting prod GCS bandwidth.
//
// Prerequisites:
//   1. The storage emulator must be running at localhost:9199
//      (npm run serve)
//   2. credentials.json must be present in functions/
//
// Run:
//   npm run seed-emulator

const { Storage } = require('@google-cloud/storage');
const serviceAccount = require('./credentials.json');

const EMULATOR_ENDPOINT = 'http://127.0.0.1:9199';

// Seed the ar/* subset of each bucket — everything the AR card needs to
// render widgets locally. Add additional prefixes (e.g. www/, minesweeper/)
// if you start testing those pages against the emulator too.
const BUCKETS_TO_SEED = [
	{ name: 'dynamic.scub3d.io', prefixes: ['ar/images/', 'ar/videos/', 'ar/models/'] },
	{ name: 'static.scub3d.io', prefixes: ['ar/'] },
];

async function copyBucket(prodStorage, emulatorStorage, { name, prefixes }) {
	const prodBucket = prodStorage.bucket(name);
	const emuBucket = emulatorStorage.bucket(name);

	let copied = 0;
	let failed = 0;
	let bytes = 0;

	for (const prefix of prefixes) {
		const [files] = await prodBucket.getFiles({ prefix });
		console.log(`[${name}] ${prefix}: ${files.length} files in prod`);

		for (const file of files) {
			try {
				const [data] = await file.download();
				await emuBucket.file(file.name).save(data, {
					contentType: file.metadata.contentType,
					resumable: false,
				});
				copied++;
				bytes += data.length;
				console.log(`  ✓ ${file.name} (${(data.length / 1024).toFixed(1)} KB)`);
			} catch (err) {
				failed++;
				console.error(`  ✗ ${file.name}: ${err.message}`);
				if (err.errors) console.error('    errors:', JSON.stringify(err.errors));
				if (err.code) console.error('    code:', err.code);
			}
		}
	}

	return { copied, failed, bytes };
}

async function main() {
	const prodStorage = new Storage({
		projectId: serviceAccount.project_id,
		credentials: serviceAccount,
	});

	const emulatorStorage = new Storage({
		projectId: serviceAccount.project_id,
		apiEndpoint: EMULATOR_ENDPOINT,
	});

	let totalCopied = 0;
	let totalFailed = 0;
	let totalBytes = 0;

	for (const bucket of BUCKETS_TO_SEED) {
		const { copied, failed, bytes } = await copyBucket(prodStorage, emulatorStorage, bucket);
		totalCopied += copied;
		totalFailed += failed;
		totalBytes += bytes;
	}

	console.log('\nDone.');
	console.log(`  copied: ${totalCopied}`);
	console.log(`  failed: ${totalFailed}`);
	console.log(`  bytes:  ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
}

main().catch(err => {
	console.error('Seed failed:', err);
	process.exit(1);
});

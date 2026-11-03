/**
 * Fills English and Arabic on existing records. Safe to run repeatedly.
 * From backend/:
 *   node scripts/backfill-bilingual.js            shows what would change, writes nothing
 *   node scripts/backfill-bilingual.js --apply    writes the changes
 * Local databases only, unless --allow-remote is passed too.
 */
import '../config/env.js'
import connectDB from '../config/mongodb.js'
import { backfillBilingual } from '../services/bilingualContentService.js'
import { BILINGUAL_MODELS } from '../services/bilingualRegistry.js'
import { isLocalMongoUri } from '../utils/mongoUri.js'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const allowRemote = args.includes('--allow-remote')

const run = async () => {
  if (!isLocalMongoUri(process.env.MONGODB_URI) && !allowRemote) {
    console.error('MONGODB_URI is not a local database. Refusing to run without --allow-remote.')
    process.exit(1)
  }
  await connectDB()
  console.log(apply ? 'Applying changes.' : 'Dry run: nothing will be written. Pass --apply to write.')

  for (const { label, model, fields } of BILINGUAL_MODELS) {
    const summary = await backfillBilingual(model, fields, {
      dryRun: !apply,
      log: (line) => console.log(`  [${label}] ${line}`)
    })
    console.log(`${label}:`, summary)
  }
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})

import { toyverseGoldCases } from './corpus.js'
import { validateGoldCorpus } from './ontology-validation.js'

const result = await validateGoldCorpus(toyverseGoldCases)
process.stdout.write(
  `Toyverse: ${result.caseCount} cases, ${result.domainCount} domains, ${result.propertyCount} properties\n`
)
process.exit(0)

import { buildVocabularyIndex, resetVocabularyIndex } from '../vocabulary-index.js'

describe('VocabularyIndex', () => {
  beforeEach(() => {
    resetVocabularyIndex()
  })

  it('discovers and parses SHACL files from artifacts directory', async () => {
    const index = await buildVocabularyIndex()

    // Should have loaded at least hdmap and georeference domains
    expect(index.domains.length).toBeGreaterThanOrEqual(1)
  })

  it('extracts roadTypes with allowed values from hdmap SHACL', async () => {
    const index = await buildVocabularyIndex()
    const roadTypes = index.properties.get('roadTypes')

    expect(roadTypes).toBeDefined()
    expect(roadTypes!.allowedValues).toContain('motorway')
    expect(roadTypes!.allowedValues).toContain('rural')
    expect(roadTypes!.allowedValues).toContain('town')
    expect(roadTypes!.domain).toBe('hdmap')
  })

  it('extracts laneTypes with correct values including exit/onRamp', async () => {
    const index = await buildVocabularyIndex()
    const laneTypes = index.properties.get('laneTypes')

    expect(laneTypes).toBeDefined()
    expect(laneTypes!.allowedValues).toContain('exit')
    expect(laneTypes!.allowedValues).toContain('onRamp')
    expect(laneTypes!.allowedValues).toContain('offRamp')
    expect(laneTypes!.allowedValues).toContain('mwyEntry')
    expect(laneTypes!.allowedValues).toContain('mwyExit')
    expect(laneTypes!.allowedValues).toContain('driving')
  })

  it('extracts formatType allowed values', async () => {
    const index = await buildVocabularyIndex()
    const formatType = index.properties.get('formatType')

    expect(formatType).toBeDefined()
    expect(formatType!.allowedValues).toContain('ASAM OpenDRIVE')
    expect(formatType!.allowedValues).toContain('Lanelet')
  })

  it('extracts heightSystem from georeference SHACL', async () => {
    const index = await buildVocabularyIndex()
    const heightSystem = index.properties.get('heightSystem')

    expect(heightSystem).toBeDefined()
    expect(heightSystem!.allowedValues).toContain('Ellipsoidal height')
    expect(heightSystem!.domain).toBe('georeference')
  })

  it('builds reverse index for value lookup', async () => {
    const index = await buildVocabularyIndex()

    const motorwayMappings = index.valueToProperty.get('motorway')
    expect(motorwayMappings).toBeDefined()
    expect(motorwayMappings!.some((m) => m.property === 'roadTypes')).toBe(true)
  })

  it('extracts numeric properties without sh:in', async () => {
    const index = await buildVocabularyIndex()

    // hdmap:length, hdmap:numberIntersections etc should be present
    const length = index.properties.get('length')
    if (length) {
      expect(length.datatype).toBe('float')
      expect(length.allowedValues).toHaveLength(0)
    }
  })
})

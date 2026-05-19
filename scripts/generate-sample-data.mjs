import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const dataDirectory = join(__dirname, '..', 'packages', 'search', 'data')

const inputFiles = [
  'sample-assets.ttl',
  'sample-scenarios.ttl',
  'sample-ositrace.ttl',
  'sample-environment-models.ttl',
  'sample-surface-models.ttl',
]

const hdmapFormats = [
  'ASAM OpenDRIVE',
  'Lanelet2',
  'HERE HD Live Map',
  'TomTom HD Map',
  'Mapbox Vector Tiles',
]
const hdmapVersions = ['1.6', '1.7', '1.8', '1.0', '2.0']
const roadTypes = ['motorway', 'town', 'rural', 'custom', 'highway']
const laneTypes = [
  'driving',
  'parking',
  'sidewalk',
  'biking',
  'median',
  'entry',
  'exit',
  'shoulder',
  'border',
]
const levelOfDetail = ['lane', 'crosswalk', 'car', 'truck', 'bike']
const trafficDirections = ['right-hand', 'left-hand']
const usedDataSources = ['lidar', 'camera', 'radar', 'satellite imagery', 'scanner']
const measurementSystems = ['photogrammetry', '3DMS system', 'MMS', 'drone survey', 'GNSS/INS']

const scenarioFormats = ['ASAM OpenSCENARIO', 'IPG CarMaker Scenario', 'CARLA Scenario Runner']
const abstractionLevels = ['Abstract', 'Concrete', 'Logical']
const scenarioCategories = [
  'cut-in',
  'cut-out',
  'lane-change',
  'overtake',
  'emergency-brake',
  'pedestrian-crossing',
  'intersection-crossing',
  'highway-merge',
  'follow-vehicle',
  'obstacle-avoidance',
]
const entityTypesList = [
  ['car', 'pedestrian'],
  ['car', 'truck'],
  ['car', 'bicycle'],
  ['truck', 'pedestrian'],
  ['car'],
  ['motorcycle', 'car'],
  ['bus', 'pedestrian'],
]
const criticalityFactors = [
  'occlusion',
  'limited visibility',
  'weather',
  'distraction',
  'aggressive driving',
  'sensor failure',
]
const scenarioSourceTypes = [
  'Accident Database',
  'Naturalistic Driving Study',
  'Real World Data',
  'Synthetic',
  'Expert Knowledge',
]
const weatherSummaries = ['clear', 'rainy', 'foggy', 'snowy', 'overcast', 'stormy']

const osiFormats = ['ASAM OSI SensorData', 'ASAM OSI SensorView', 'ASAM OSI GroundTruth']
const osiVersions = ['3.5.0', '3.6.0', '3.7.0']
const fileFormats = ['MCAP', 'ProtoBuf', 'FlatBuffers']
const compressions = ['uncompressed', 'lz4', 'zstd']
const granularities = ['object list', 'detection list', 'raw data']

const envFormats = ['glTF', 'FBX', 'Unreal Datasmith', 'OpenSceneGraph', 'USD']
const envVersions = ['2.0', '3.0', 'SDK 4.25', '1.0', '22.11']
const envElements = [
  'buildings, roads, vegetation',
  'urban environment, street furniture',
  'terrain, tunnels',
  'highways, bridges, guardrails',
  'pedestrians, vehicles, signals',
]
const envUseCases = ['driving', 'sensor simulation', 'digital twin', 'test ground', 'training data']
const detailLevels = ['Low', 'Medium', 'High', 'Ultra']
const creationTools = [
  { name: 'CARLA Scene Builder', vendor: 'CARLA', version: '0.9.15' },
  { name: 'RoadRunner', vendor: 'MathWorks', version: 'R2024a' },
  { name: 'Triangle3DBuilder', vendor: 'TriangleGraphics GmbH', version: '7.7' },
  { name: 'CityEngine', vendor: 'Esri', version: '2024.0' },
  { name: 'Twinmotion', vendor: 'Epic Games', version: '2024.1' },
]

const surfaceFormats = ['ASAM OpenCRG', 'Custom Binary', 'HDF5']
const surfaceVersions = ['1.1', '1.2', '2.0']
const contentTypes = ['roughness profile', 'Height', 'friction map', 'texture map']

const locations = [
  {
    country: 'DE',
    state: 'DE-BW',
    region: 'Baden-Wuerttemberg',
    city: 'Karlsruhe',
    lat: 49.0069,
    lon: 8.4037,
  },
  { country: 'DE', state: 'DE-BY', region: 'Bavaria', city: 'Munich', lat: 48.1351, lon: 11.582 },
  { country: 'DE', state: 'DE-BE', region: 'Berlin', city: 'Berlin', lat: 52.52, lon: 13.405 },
  { country: 'DE', state: 'DE-HH', region: 'Hamburg', city: 'Hamburg', lat: 53.5511, lon: 9.9937 },
  { country: 'DE', state: 'DE-HE', region: 'Hesse', city: 'Frankfurt', lat: 50.1109, lon: 8.6821 },
  {
    country: 'DE',
    state: 'DE-NW',
    region: 'North Rhine-Westphalia',
    city: 'Cologne',
    lat: 50.9375,
    lon: 6.9603,
  },
  { country: 'DE', state: 'DE-SN', region: 'Saxony', city: 'Dresden', lat: 51.0504, lon: 13.7373 },
  {
    country: 'DE',
    state: 'DE-NI',
    region: 'Lower Saxony',
    city: 'Hanover',
    lat: 52.3759,
    lon: 9.732,
  },
  {
    country: 'US',
    state: 'US-CA',
    region: 'California',
    city: 'San Francisco',
    lat: 37.7749,
    lon: -122.4194,
  },
  {
    country: 'US',
    state: 'US-MI',
    region: 'Michigan',
    city: 'Detroit',
    lat: 42.3314,
    lon: -83.0458,
  },
  { country: 'US', state: 'US-TX', region: 'Texas', city: 'Austin', lat: 30.2672, lon: -97.7431 },
  { country: 'JP', state: 'JP-13', region: 'Kanto', city: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  {
    country: 'CN',
    state: 'CN-31',
    region: 'Shanghai',
    city: 'Shanghai',
    lat: 31.2304,
    lon: 121.4737,
  },
  { country: 'AT', state: 'AT-9', region: 'Vienna', city: 'Vienna', lat: 48.2082, lon: 16.3738 },
  {
    country: 'SE',
    state: 'SE-AB',
    region: 'Stockholm',
    city: 'Stockholm',
    lat: 59.3293,
    lon: 18.0686,
  },
  {
    country: 'FR',
    state: 'FR-75',
    region: 'Ile-de-France',
    city: 'Paris',
    lat: 48.8566,
    lon: 2.3522,
  },
  {
    country: 'GB',
    state: 'GB-LND',
    region: 'Greater London',
    city: 'London',
    lat: 51.5074,
    lon: -0.1278,
  },
  { country: 'IT', state: 'IT-MI', region: 'Lombardy', city: 'Milan', lat: 45.4642, lon: 9.19 },
  { country: 'KR', state: 'KR-11', region: 'Seoul', city: 'Seoul', lat: 37.5665, lon: 126.978 },
  {
    country: 'DE',
    state: 'DE-BW',
    region: 'Baden-Wuerttemberg',
    city: 'Stuttgart',
    lat: 48.7758,
    lon: 9.1829,
  },
]
const licenses = ['CC-BY-4.0', 'CC-BY-NC-4.0', 'CC0-1.0', 'proprietary', 'MIT', 'EPL-2.0']
const providers = [
  'provider35.net',
  'simcorp.io',
  'osidata.io',
  'envmodels.io',
  'surfacepro.io',
  'mapcorp.de',
  'simtrace.io',
  'roadtech.com',
  'lidardata.de',
  'pointcloud.eu',
]

const ROAD_TYPES_OL = [
  'RoadTypeMotorway',
  'MotorwayManaged',
  'MotorwayUnmanaged',
  'RoadTypeDistributor',
  'RoadTypeMinor',
  'RoadTypeParking',
  'RoadTypeRadial',
  'RoadTypeShared',
  'RoadTypeSlip',
]
const LANE_TYPES_OL = [
  'LaneTypeTraffic',
  'LaneTypeBus',
  'LaneTypeCycle',
  'LaneTypeEmergency',
  'LaneTypeSpecial',
  'LaneTypeTram',
]
const TRAVEL_DIRECTIONS_OL = ['TravelDirectionLeft', 'TravelDirectionRight']
const SURFACE_TYPES_OL = ['SurfaceTypeLoose', 'SurfaceTypeSegmented', 'SurfaceTypeUniform']
const SURFACE_CONDITIONS_OL = [
  'SurfaceConditionContamination',
  'SurfaceConditionFlooded',
  'SurfaceConditionIcy',
  'SurfaceConditionMirage',
  'SurfaceConditionSnow',
  'SurfaceConditionStandingWater',
  'SurfaceConditionWet',
]
const EDGE_TYPES_OL = [
  'EdgeLineMarkers',
  'EdgeNone',
  'EdgeShoulderGrass',
  'EdgeShoulderPavedOrGravel',
  'EdgeSolidBarriers',
  'EdgeTemporaryLineMarkers',
]
const SCENERY_ZONES_OL = [
  'ZoneGeoFenced',
  'ZoneInterference',
  'ZoneRegion',
  'ZoneSchool',
  'ZoneTrafficManagement',
]
const SCENERY_FIXED_OL = [
  'FixedStructureBuilding',
  'FixedStructureStreetFurniture',
  'FixedStructureStreetlight',
  'FixedStructureVegetation',
]
const SCENERY_TEMP_OL = [
  'TemporaryStructureConstructionDetour',
  'TemporaryStructureRefuseCollection',
  'TemporaryStructureRoadSignage',
  'TemporaryStructureRoadWorks',
]
const SCENERY_SPECIAL_OL = [
  'SpecialStructureAutoAccess',
  'SpecialStructureBridge',
  'SpecialStructurePedestrianCrossing',
  'SpecialStructureRailCrossing',
  'SpecialStructureTollPlaza',
  'SpecialStructureTunnel',
]
const RAIN_TYPES_OL = ['RainTypeConvective', 'RainTypeDynamic', 'RainTypeOrographic']
const SUN_POSITIONS_OL = [
  'SunPositionBehind',
  'SunPositionFront',
  'SunPositionLeft',
  'SunPositionRight',
]
const LOW_LIGHT_OL = ['LowLightAmbient', 'LowLightNight']
const ARTIFICIAL_LIGHT_OL = ['ArtificialStreetLighting', 'ArtificialVehicleLighting']
const CONNECTIVITY_COMM_OL = [
  'CommunicationV2i',
  'V2iCellular',
  'V2iSatellite',
  'V2iWifi',
  'CommunicationV2v',
  'V2vCellular',
  'V2vSatellite',
  'V2vWifi',
]
const CONNECTIVITY_POS_OL = ['PositioningGalileo', 'PositioningGlonass', 'PositioningGps']
const PARTICULATES_OL = [
  'ParticulatesDust',
  'ParticulatesMarine',
  'ParticulatesPollution',
  'ParticulatesVolcanic',
  'ParticulatesWater',
]
const INTERSECTIONS_OL = [
  'IntersectionCrossroad',
  'IntersectionGradeSeperated',
  'IntersectionStaggered',
  'IntersectionTJunction',
  'IntersectionYJunction',
]
const ROUNDABOUTS_OL = [
  'RoundaboutCompactNosignal',
  'RoundaboutCompactSignal',
  'RoundaboutNormalNosignal',
  'RoundaboutNormalSignal',
  'RoundaboutLargeNosignal',
  'RoundaboutLargeSignal',
  'RoundaboutMiniNosignal',
  'RoundaboutMiniSignal',
]
const GEOMETRY_TRANSVERSE_OL = ['TransverseDivided', 'TransverseUndivided']
const BEHAVIOUR_COMM_OL = [
  'CommunicationHeadlightFlash',
  'CommunicationHorn',
  'CommunicationSignalEmergency',
  'CommunicationSignalHazard',
  'CommunicationSignalLeft',
  'CommunicationSignalRight',
  'CommunicationSignalSlowing',
  'CommunicationWave',
]
const VEHICLES_OL = [
  'VehicleAgricultural',
  'VehicleBus',
  'VehicleCar',
  'VehicleConstruction',
  'VehicleCycle',
  'VehicleEmergency',
  'VehicleMotorcycle',
  'VehicleTrailer',
  'VehicleTruck',
  'VehicleVan',
  'VehicleWheelchair',
]
const HUMANS_OL = [
  'HumanAnimalRider',
  'HumanCyclist',
  'HumanDriver',
  'HumanMotorcyclist',
  'HumanPassenger',
  'HumanPedestrian',
  'HumanWheelchairUser',
]

const behaviourMotionDefinitions = [
  { flag: 'MotionAccelerate', valueProperty: 'motionAccelerateValue', mode: 'decimal' },
  { flag: 'MotionDecelerate', valueProperty: 'motionDecelerateValue', mode: 'decimal' },
  { flag: 'MotionDrive', valueProperty: 'motionDriveValue', mode: 'integer' },
  { flag: 'MotionCutIn' },
  { flag: 'MotionCutOut' },
  { flag: 'MotionOvertake' },
  { flag: 'MotionLaneChangeLeft' },
  { flag: 'MotionLaneChangeRight' },
  { flag: 'MotionTurnLeft' },
  { flag: 'MotionTurnRight' },
]

const hdmapSceneNames = {
  motorway: 'Motorway',
  town: 'Urban Corridor',
  rural: 'Rural Route',
  custom: 'Parking Garage',
  highway: 'Highway Interchange',
}

const scenarioVersions = {
  'ASAM OpenSCENARIO': '1.3',
  'IPG CarMaker Scenario': '12.0',
  'CARLA Scenario Runner': '0.9.15',
}

const contexts = {
  hdmap: {
    hdmap: 'https://w3id.org/ascs-ev/envited-x/hdmap/v6/',
    'envited-x': 'https://w3id.org/ascs-ev/envited-x/envited-x/v3/',
    georeference: 'https://w3id.org/ascs-ev/envited-x/georeference/v5/',
    manifest: 'https://w3id.org/ascs-ev/envited-x/manifest/v5/',
    gx: 'https://w3id.org/gaia-x/development#',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    xsd: 'http://www.w3.org/2001/XMLSchema#',
    openlabel_v2: 'https://w3id.org/ascs-ev/envited-x/openlabel/v2/',
  },
  scenario: {
    scenario: 'https://w3id.org/ascs-ev/envited-x/scenario/v6/',
    hdmap: 'https://w3id.org/ascs-ev/envited-x/hdmap/v6/',
    'environment-model': 'https://w3id.org/ascs-ev/envited-x/environment-model/v5/',
    'envited-x': 'https://w3id.org/ascs-ev/envited-x/envited-x/v3/',
    georeference: 'https://w3id.org/ascs-ev/envited-x/georeference/v5/',
    manifest: 'https://w3id.org/ascs-ev/envited-x/manifest/v5/',
    gx: 'https://w3id.org/gaia-x/development#',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    xsd: 'http://www.w3.org/2001/XMLSchema#',
    openlabel_v2: 'https://w3id.org/ascs-ev/envited-x/openlabel/v2/',
  },
  ositrace: {
    ositrace: 'https://w3id.org/ascs-ev/envited-x/ositrace/v6/',
    'envited-x': 'https://w3id.org/ascs-ev/envited-x/envited-x/v3/',
    georeference: 'https://w3id.org/ascs-ev/envited-x/georeference/v5/',
    manifest: 'https://w3id.org/ascs-ev/envited-x/manifest/v5/',
    gx: 'https://w3id.org/gaia-x/development#',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    xsd: 'http://www.w3.org/2001/XMLSchema#',
    openlabel_v2: 'https://w3id.org/ascs-ev/envited-x/openlabel/v2/',
  },
  environmentModel: {
    'environment-model': 'https://w3id.org/ascs-ev/envited-x/environment-model/v5/',
    'envited-x': 'https://w3id.org/ascs-ev/envited-x/envited-x/v3/',
    georeference: 'https://w3id.org/ascs-ev/envited-x/georeference/v5/',
    manifest: 'https://w3id.org/ascs-ev/envited-x/manifest/v5/',
    gx: 'https://w3id.org/gaia-x/development#',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    xsd: 'http://www.w3.org/2001/XMLSchema#',
    openlabel_v2: 'https://w3id.org/ascs-ev/envited-x/openlabel/v2/',
  },
  surfaceModel: {
    'surface-model': 'https://w3id.org/ascs-ev/envited-x/surface-model/v6/',
    'envited-x': 'https://w3id.org/ascs-ev/envited-x/envited-x/v3/',
    georeference: 'https://w3id.org/ascs-ev/envited-x/georeference/v5/',
    manifest: 'https://w3id.org/ascs-ev/envited-x/manifest/v5/',
    gx: 'https://w3id.org/gaia-x/development#',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    xsd: 'http://www.w3.org/2001/XMLSchema#',
    openlabel_v2: 'https://w3id.org/ascs-ev/envited-x/openlabel/v2/',
  },
}

const typeValue = (value, type) => ({ '@value': String(value), '@type': type })
const floatValue = (value, digits = 1) => typeValue(Number(value).toFixed(digits), 'xsd:float')
const decimalValue = (value, digits = 1) => typeValue(Number(value).toFixed(digits), 'xsd:decimal')
const integerValue = (value) => typeValue(Math.trunc(value), 'xsd:integer')
const languageValue = (value) => ({ '@value': value, '@language': 'en' })
const enumRef = (value) => ({ '@id': `openlabel_v2:${value}` })
const cycle = (items, index, multiplier = 1, offset = 0) =>
  items[(index * multiplier + offset) % items.length]
const toTitleCase = (value) =>
  value
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const getLocation = (index, offset = 0) => cycle(locations, index, 3, offset)
const getProvider = (index, offset = 0) => cycle(providers, index, 5, offset)
const getTrafficDirection = (country, index) => {
  if (country === 'GB' || country === 'JP') {
    return 'left-hand'
  }

  return cycle(trafficDirections, index, 1, 0)
}

function createBoundingBox(location, index) {
  const width = 0.012 + (index % 5) * 0.004
  const height = 0.01 + (index % 4) * 0.003
  const xMin = location.lon - width / 2
  const yMin = location.lat - height / 2
  const xMax = location.lon + width / 2
  const yMax = location.lat + height / 2

  return {
    '@type': 'georeference:BoundingBox',
    'georeference:xMin': floatValue(xMin, 4),
    'georeference:yMin': floatValue(yMin, 4),
    'georeference:xMax': floatValue(xMax, 4),
    'georeference:yMax': floatValue(yMax, 4),
  }
}

function createProjectLocation(location, index, includeBoundingBox = true) {
  const projectLocation = {
    '@type': 'georeference:ProjectLocation',
    'georeference:country': location.country,
    'georeference:state': location.state,
    'georeference:region': location.region,
    'georeference:city': location.city,
  }

  if (includeBoundingBox) {
    projectLocation['georeference:hasBoundingBox'] = createBoundingBox(location, index)
  }

  return projectLocation
}

function createGeoreference(location, index, includeBoundingBox = true) {
  return {
    '@type': 'georeference:Georeference',
    'georeference:hasProjectLocation': createProjectLocation(location, index, includeBoundingBox),
  }
}

function createResourceDescription(name, description, index, offset = 0) {
  return {
    '@type': 'envited-x:ResourceDescription',
    'gx:name': name,
    'gx:description': description,
    'gx:version': `${1 + ((index + offset) % 5)}.${(index * 3 + offset) % 10}.${(index * 7 + offset) % 10}`,
    'gx:license': cycle(licenses, index, 3, offset),
    'gx:containsPII': false,
  }
}

function createManifest(referencedArtifacts = []) {
  const manifest = { '@type': 'manifest:Manifest' }

  if (referencedArtifacts.length > 0) {
    manifest['manifest:hasReferencedArtifacts'] = referencedArtifacts.map((artifactId) => ({
      '@id': artifactId,
    }))
  }

  return manifest
}

function generateOdd(assetIdx, options = {}) {
  const { profile = 'general', roadType } = options
  const odd = {
    '@type': 'openlabel_v2:Odd',
    'openlabel_v2:DrivableAreaType': enumRef(cycle(ROAD_TYPES_OL, assetIdx, 7, 3)),
    'openlabel_v2:LaneSpecificationTravelDirection': enumRef(
      cycle(TRAVEL_DIRECTIONS_OL, assetIdx, 1, 0)
    ),
  }

  // Lane count correlated with road type for realistic data
  if (assetIdx % 10 < 6) {
    odd['openlabel_v2:LaneSpecificationLaneCount'] = true
    let laneCount
    if (roadType === 'motorway' || roadType === 'highway') {
      laneCount = 2 + (assetIdx % 5) // 2-6 lanes for motorways/highways
    } else if (roadType === 'town') {
      laneCount = 1 + (assetIdx % 4) // 1-4 lanes for urban roads
    } else {
      laneCount = 1 + (assetIdx % 3) // 1-3 lanes for rural/custom
    }
    odd['openlabel_v2:laneSpecificationLaneCountValue'] = integerValue(laneCount)
  }

  if (assetIdx % 10 < 7) {
    odd['openlabel_v2:LaneSpecificationType'] = enumRef(cycle(LANE_TYPES_OL, assetIdx, 3, 1))
  }

  if (profile === 'surface' || assetIdx % 2 === 0) {
    odd['openlabel_v2:DrivableAreaSurfaceType'] = enumRef(cycle(SURFACE_TYPES_OL, assetIdx, 2, 1))
  }

  if (profile === 'surface' ? assetIdx % 2 === 1 : assetIdx % 10 < 3) {
    odd['openlabel_v2:DrivableAreaSurfaceCondition'] = enumRef(
      cycle(SURFACE_CONDITIONS_OL, assetIdx, 5, 2)
    )
  }

  if (assetIdx % 5 < 2) {
    odd['openlabel_v2:DrivableAreaEdge'] = enumRef(cycle(EDGE_TYPES_OL, assetIdx, 4, 3))
  }

  if (assetIdx % 4 === 0) {
    odd['openlabel_v2:WeatherRain'] = true
    odd['openlabel_v2:RainType'] = enumRef(cycle(RAIN_TYPES_OL, assetIdx, 3, 0))
  }

  if (assetIdx % 5 === 1) {
    odd['openlabel_v2:WeatherWind'] = true
  }

  if (assetIdx % 10 === 6) {
    odd['openlabel_v2:WeatherSnow'] = true
  }

  if (assetIdx % 20 < 7) {
    if (assetIdx % 2 === 0) {
      odd['openlabel_v2:DaySunPosition'] = enumRef(cycle(SUN_POSITIONS_OL, assetIdx, 2, 0))
    } else {
      odd['openlabel_v2:IlluminationLowLight'] = enumRef(cycle(LOW_LIGHT_OL, assetIdx, 1, 0))
      odd['openlabel_v2:IlluminationArtificial'] = enumRef(
        cycle(ARTIFICIAL_LIGHT_OL, assetIdx, 1, 0)
      )
    }
  }

  if (profile === 'scenery' || assetIdx % 5 < 2) {
    odd['openlabel_v2:SceneryFixedStructure'] = enumRef(cycle(SCENERY_FIXED_OL, assetIdx, 2, 1))
  }

  if (assetIdx % 20 < 3) {
    odd['openlabel_v2:SceneryZone'] = enumRef(cycle(SCENERY_ZONES_OL, assetIdx, 3, 2))
  }

  if (profile === 'scenery' || assetIdx % 5 === 2) {
    odd['openlabel_v2:ScenerySpecialStructure'] = enumRef(cycle(SCENERY_SPECIAL_OL, assetIdx, 4, 0))
  }

  if (assetIdx % 10 === 4) {
    odd['openlabel_v2:SceneryTemporaryStructure'] = enumRef(cycle(SCENERY_TEMP_OL, assetIdx, 2, 0))
  }

  if (assetIdx % 20 < 3) {
    odd['openlabel_v2:JunctionIntersection'] = enumRef(cycle(INTERSECTIONS_OL, assetIdx, 3, 0))
  }

  if (assetIdx % 10 === 7) {
    odd['openlabel_v2:JunctionRoundabout'] = enumRef(cycle(ROUNDABOUTS_OL, assetIdx, 2, 0))
  }

  if (assetIdx % 20 < 3) {
    odd['openlabel_v2:ConnectivityCommunication'] = enumRef(
      cycle(CONNECTIVITY_COMM_OL, assetIdx, 3, 0)
    )
    odd['openlabel_v2:ConnectivityPositioning'] = enumRef(
      cycle(CONNECTIVITY_POS_OL, assetIdx, 2, 1)
    )
  }

  if (assetIdx % 4 === 0) {
    odd['openlabel_v2:GeometryTransverse'] = enumRef(cycle(GEOMETRY_TRANSVERSE_OL, assetIdx, 1, 0))
  } else if (assetIdx % 4 === 1) {
    odd['openlabel_v2:HorizontalStraights'] = true
  } else if (assetIdx % 4 === 2) {
    odd['openlabel_v2:HorizontalCurves'] = true
  }

  if (assetIdx % 5 === 3) {
    odd['openlabel_v2:TrafficAgentDensity'] = true
    odd['openlabel_v2:trafficAgentDensityValue'] = integerValue(10 + ((assetIdx * 7) % 90))
  }

  if (assetIdx % 20 < 3) {
    odd['openlabel_v2:SubjectVehicleSpeed'] = true
    odd['openlabel_v2:subjectVehicleSpeedValue'] = integerValue(30 + ((assetIdx * 11) % 100))
  }

  if (assetIdx % 10 === 8) {
    odd['openlabel_v2:EnvironmentParticulates'] = enumRef(cycle(PARTICULATES_OL, assetIdx, 3, 0))
  }

  return odd
}

function generateBehaviour(assetIdx) {
  const behaviour = { '@type': 'openlabel_v2:Behaviour' }
  const selectedFlags = new Set()
  const motionCount = 1 + (assetIdx % 3)
  let offset = 0

  while (selectedFlags.size < motionCount) {
    const motionDefinition = cycle(behaviourMotionDefinitions, assetIdx, 7, offset * 3)

    if (!selectedFlags.has(motionDefinition.flag)) {
      selectedFlags.add(motionDefinition.flag)
      behaviour[`openlabel_v2:${motionDefinition.flag}`] = true

      if (motionDefinition.valueProperty) {
        const value =
          motionDefinition.mode === 'decimal'
            ? decimalValue(1.5 + ((assetIdx + offset) % 8) * 0.6, 1)
            : integerValue(25 + ((assetIdx + offset) % 8) * 10)
        behaviour[`openlabel_v2:${motionDefinition.valueProperty}`] = value
      }
    }

    offset += 1
  }

  if (assetIdx % 5 === 0) {
    behaviour['openlabel_v2:BehaviourCommunication'] = enumRef(
      cycle(BEHAVIOUR_COMM_OL, assetIdx, 3, 0)
    )
  }

  return behaviour
}

function generateRoadUser(assetIdx) {
  const roadUser = {
    '@type': 'openlabel_v2:RoadUser',
    'openlabel_v2:RoadUserVehicle': enumRef(cycle(VEHICLES_OL, assetIdx, 5, 2)),
  }

  if (assetIdx % 5 < 3) {
    roadUser['openlabel_v2:RoadUserHuman'] = enumRef(cycle(HUMANS_OL, assetIdx, 3, 1))
  }

  if (assetIdx % 20 === 7) {
    roadUser['openlabel_v2:RoadUserAnimal'] = true
  }

  return roadUser
}

function generateTag(assetIdx) {
  return {
    '@type': 'openlabel_v2:Tag',
    'openlabel_v2:Odd': generateOdd(assetIdx),
    'openlabel_v2:Behaviour': generateBehaviour(assetIdx),
    'openlabel_v2:RoadUser': generateRoadUser(assetIdx),
  }
}

function buildHdMapAsset(index, options = {}) {
  const {
    id,
    locationOffset = 0,
    profile = 'general',
    referenced = false,
    labelPrefix = '',
  } = options
  const assetNumber = index + 1
  const provider = getProvider(index, referenced ? 2 : 0)
  const location = getLocation(index, locationOffset)
  const roadType = cycle(roadTypes, index, 3, referenced ? 1 : 0)
  const laneType = cycle(laneTypes, index, 5, 2)
  const lod = cycle(levelOfDetail, index, 2, 1)
  const direction = getTrafficDirection(location.country, index)
  const formatType = cycle(hdmapFormats, index, 2, referenced ? 1 : 0)
  const formatVersion = cycle(hdmapVersions, index, 3, referenced ? 2 : 0)
  const sceneName = hdmapSceneNames[roadType]
  const name = labelPrefix || `${location.city} ${sceneName} HD Map`
  const slug = `${slugify(location.city)}-${slugify(sceneName)}-${String(assetNumber).padStart(3, '0')}`
  const assetId = id ?? `did:web:${provider}:HdMap:${slug}`
  const description = `${sceneName} HD map for ${location.city}, ${location.region} with ${laneType} lane semantics.`
  const speedMin = 20 + ((index * 11) % 60)
  const speedMax = speedMin + 25 + ((index * 7) % 60)
  const content = {
    '@type': 'hdmap:Content',
    'hdmap:roadTypes': roadType,
    'hdmap:laneTypes': laneType,
    'hdmap:levelOfDetail': lod,
    'hdmap:trafficDirection': direction,
  }

  const asset = {
    '@id': assetId,
    '@type': 'hdmap:HdMap',
    'rdfs:label': languageValue(name),
    'hdmap:hasDomainSpecification': {
      '@type': 'hdmap:DomainSpecification',
      'hdmap:hasFormat': {
        '@type': 'hdmap:Format',
        'hdmap:formatType': formatType,
        'hdmap:version': formatVersion,
      },
      'hdmap:hasContent': referenced
        ? [content]
        : [content, generateOdd(index, { profile, roadType })],
      'hdmap:hasQuantity': {
        '@type': 'hdmap:Quantity',
        'hdmap:length': floatValue(12 + index * 0.8, 1),
        'hdmap:elevationRange': floatValue(35 + (index % 12) * 18, 1),
        'hdmap:numberIntersections': integerValue((index * 3 + 1) % 21),
        'hdmap:numberTrafficLights': integerValue((index * 2 + 5) % 16),
        'hdmap:numberTrafficSigns': integerValue(20 + ((index * 13 + 7) % 500)),
        'hdmap:numberObjects': integerValue(120 + ((index * 37 + 11) % 3000)),
        'hdmap:numberOutlines': integerValue(90 + ((index * 19 + 17) % 700)),
        'hdmap:rangeOfModeling': floatValue(20 + (index % 8) * 2.5, 1),
        'hdmap:speedLimit': {
          '@type': 'hdmap:Range2D',
          'hdmap:min': floatValue(speedMin, 1),
          'hdmap:max': floatValue(speedMax, 1),
        },
      },
      'hdmap:hasQuality': {
        '@type': 'hdmap:Quality',
        'hdmap:precision': floatValue(cycle([0.005, 0.01, 0.02, 0.05], index, 1, 0), 3),
      },
      'hdmap:hasDataSource': {
        '@type': 'hdmap:DataSource',
        'hdmap:usedDataSources': cycle(usedDataSources, index, 2, 0),
        'hdmap:measurementSystem': cycle(measurementSystems, index, 3, 0),
      },
      'hdmap:hasGeoreference': createGeoreference(location, index, true),
    },
  }

  if (!referenced) {
    asset['hdmap:hasResourceDescription'] = createResourceDescription(name, description, index)
  }

  return asset
}

function buildScenarioReferenceHdMap(index, scenarioLabel) {
  const location = getLocation(index, 1)
  const assetId = `did:web:${getProvider(index, 6)}:HdMap:ref-${slugify(location.city)}-${String(index + 1).padStart(3, '0')}`

  return buildHdMapAsset(index, {
    id: assetId,
    locationOffset: 1,
    referenced: true,
    profile: 'general',
    labelPrefix: `Referenced HD Map for ${scenarioLabel}`,
  })
}

function buildEnvironmentModelAsset(index, options = {}) {
  const {
    id,
    locationOffset = 0,
    profile = 'scenery',
    referenced = false,
    labelPrefix = '',
  } = options
  const assetNumber = index + 1
  const provider = getProvider(index, referenced ? 4 : 3)
  const location = getLocation(index, locationOffset)
  const detailLevel = cycle(detailLevels, index, 2, 1)
  const formatType = cycle(envFormats, index, 2, referenced ? 1 : 0)
  const formatVersion = cycle(envVersions, index, 3, referenced ? 2 : 0)
  const useCase = cycle(envUseCases, index, 2, 1)
  const creationTool = cycle(creationTools, index, 3, 0)
  const name = labelPrefix || `${location.city} ${detailLevel} Detail Environment Model`
  const slug = `${slugify(location.city)}-envmodel-${String(assetNumber).padStart(3, '0')}`
  const assetId = id ?? `did:web:${provider}:EnvironmentModel:${slug}`
  const description = `${detailLevel} detail environment model of ${location.city} for ${useCase}.`
  const content = {
    '@type': 'environment-model:Content',
    'environment-model:elements': cycle(envElements, index, 3, 0),
    'environment-model:useCase': useCase,
  }

  const asset = {
    '@id': assetId,
    '@type': 'environment-model:EnvironmentModel',
    'rdfs:label': languageValue(name),
    'environment-model:hasDomainSpecification': {
      '@type': 'environment-model:DomainSpecification',
      'environment-model:hasFormat': {
        '@type': 'environment-model:Format',
        'environment-model:formatType': formatType,
        'environment-model:version': formatVersion,
      },
      'environment-model:hasContent': referenced
        ? [content]
        : [content, generateOdd(index, { profile })],
      'environment-model:hasProject': {
        '@type': 'environment-model:Project',
        'environment-model:creationToolName': creationTool.name,
        'environment-model:creationToolVendor': creationTool.vendor,
        'environment-model:creationToolVersion': creationTool.version,
      },
      'environment-model:hasQuantity': {
        '@type': 'environment-model:Quantity',
        'environment-model:triangleCount': integerValue(250000 + index * 41000),
        'environment-model:geometryCount': integerValue(90 + ((index * 29) % 1800)),
        'environment-model:textureMaterialCount': integerValue(20 + ((index * 11) % 380)),
      },
      'environment-model:hasQuality': {
        '@type': 'environment-model:Quality',
        'environment-model:detailLevel': detailLevel,
        'environment-model:textureResolution': floatValue(
          cycle([512, 1024, 2048, 4096], index, 1, 0),
          0
        ),
      },
      'environment-model:hasGeoreference': createGeoreference(location, index, true),
    },
    'environment-model:hasManifest': createManifest(),
  }

  if (!referenced) {
    asset['environment-model:hasResourceDescription'] = createResourceDescription(
      name,
      description,
      index,
      1
    )
  }

  return asset
}

function buildScenarioReferenceEnvironmentModel(index, scenarioLabel) {
  const location = getLocation(index, 2)
  const assetId = `did:web:${getProvider(index, 8)}:EnvironmentModel:ref-${slugify(location.city)}-${String(index + 1).padStart(3, '0')}`

  return buildEnvironmentModelAsset(index, {
    id: assetId,
    locationOffset: 2,
    referenced: true,
    profile: 'scenery',
    labelPrefix: `Referenced Environment Model for ${scenarioLabel}`,
  })
}

function buildScenarioAsset(index) {
  const location = getLocation(index, 4)
  const provider = getProvider(index, 1)
  const category = cycle(scenarioCategories, index, 3, 0)
  const scenarioLabel = `${toTitleCase(category)} in ${location.city}`
  const scenarioId = `did:web:${provider}:Scenario:${slugify(category)}-${slugify(location.city)}-${String(index + 1).padStart(3, '0')}`
  const formatType = cycle(scenarioFormats, index, 2, 0)
  const referencedHdMap = buildScenarioReferenceHdMap(index, scenarioLabel)
  const referencedAssets = [referencedHdMap['@id']]
  const referencedEntries = [referencedHdMap]

  if (index % 5 < 2) {
    const referencedEnvironmentModel = buildScenarioReferenceEnvironmentModel(index, scenarioLabel)
    referencedAssets.push(referencedEnvironmentModel['@id'])
    referencedEntries.push(referencedEnvironmentModel)
  }

  return {
    scenario: {
      '@id': scenarioId,
      '@type': 'scenario:Scenario',
      'rdfs:label': languageValue(scenarioLabel),
      'scenario:hasDomainSpecification': {
        '@type': 'scenario:DomainSpecification',
        'scenario:hasFormat': {
          '@type': 'scenario:Format',
          'scenario:formatType': formatType,
          'scenario:version': scenarioVersions[formatType],
        },
        'scenario:hasContent': [
          {
            '@type': 'scenario:Content',
            'scenario:abstractionLevel': cycle(abstractionLevels, index, 2, 0),
            'scenario:scenarioCategory': category,
            'scenario:weatherSummary': cycle(weatherSummaries, index, 2, 0),
            'scenario:entityTypes': cycle(entityTypesList, index, 2, 0),
            'scenario:country': location.country.toLowerCase(),
            'scenario:criticalityFactors': cycle(criticalityFactors, index, 2, 0),
          },
          generateTag(index),
        ],
        'scenario:hasQuantity': {
          '@type': 'scenario:Quantity',
          'scenario:numberTrafficObjects': integerValue(2 + (index % 8)),
          'scenario:permanentTrafficObjects': integerValue(1 + (index % 5)),
          'scenario:temporaryTrafficObjects': integerValue(index % 4),
        },
        'scenario:hasDataSource': {
          '@type': 'scenario:DataSource',
          'scenario:sourceType': cycle(scenarioSourceTypes, index, 2, 0),
        },
        'scenario:hasGeoreference': createGeoreference(location, index, true),
      },
      'scenario:hasManifest': createManifest(referencedAssets),
    },
    referencedEntries,
  }
}

function buildOsiTraceAsset(index) {
  const assetNumber = index + 1
  const provider = getProvider(index, 2)
  const location = getLocation(index, 6)
  const roadType = cycle(roadTypes, index, 4, 1)
  const laneA = cycle(laneTypes, index, 3, 0)
  const laneB = cycle(
    laneTypes.filter((laneType) => laneType !== laneA),
    index,
    2,
    1
  )
  const name = `${location.city} ${toTitleCase(roadType)} OSI Trace`
  const assetId = `did:web:${provider}:OSITrace:${slugify(location.city)}-${slugify(roadType)}-${String(assetNumber).padStart(3, '0')}`

  return {
    '@id': assetId,
    '@type': 'ositrace:OSITrace',
    'rdfs:label': languageValue(name),
    'ositrace:hasResourceDescription': createResourceDescription(
      name,
      `${cycle(osiFormats, index, 2, 0)} capture for ${location.city}, ${location.region}.`,
      index,
      2
    ),
    'ositrace:hasDomainSpecification': {
      '@type': 'ositrace:DomainSpecification',
      'ositrace:hasFormat': {
        '@type': 'ositrace:Format',
        'ositrace:formatType': cycle(osiFormats, index, 2, 0),
        'ositrace:version': cycle(osiVersions, index, 3, 0),
        'ositrace:fileFormat': cycle(fileFormats, index, 2, 0),
        'ositrace:compression': cycle(compressions, index, 2, 1),
        'ositrace:osiTraceFormatVersion': `1.${index % 3}.0`,
      },
      'ositrace:hasContent': [
        {
          '@type': 'ositrace:Content',
          'ositrace:roadTypes': roadType,
          'ositrace:laneTypes': [laneA, laneB],
          'ositrace:levelOfDetail': cycle(levelOfDetail, index, 2, 0),
          'ositrace:trafficDirection': getTrafficDirection(location.country, index),
          'ositrace:granularity': cycle(granularities, index, 2, 0),
        },
        generateOdd(index, { profile: 'general' }),
      ],
      'ositrace:hasQuantity': {
        '@type': 'ositrace:Quantity',
        'ositrace:numberFrames': integerValue(1000 + index * 975),
        'ositrace:numberOfChannels': integerValue(1 + (index % 8)),
      },
      'ositrace:hasQuality': {
        '@type': 'ositrace:Quality',
        'ositrace:precision': floatValue(cycle([0.01, 0.02, 0.05, 0.1], index, 1, 0), 2),
      },
      'ositrace:hasDataSource': {
        '@type': 'ositrace:DataSource',
        'ositrace:usedDataSources': cycle(usedDataSources, index, 2, 1),
        'ositrace:measurementSystem': cycle(measurementSystems, index, 2, 1),
      },
      'ositrace:hasGeoreference': createGeoreference(location, index, true),
    },
    'ositrace:hasManifest': createManifest(),
  }
}

function buildSurfaceModelAsset(index) {
  const assetNumber = index + 1
  const provider = getProvider(index, 4)
  const location = getLocation(index, 8)
  const formatType = cycle(surfaceFormats, index, 2, 0)
  const contentType = cycle(contentTypes, index, 3, 0)
  const name = `${location.city} ${formatType} Surface Model`
  const assetId = `did:web:${provider}:SurfaceModel:${slugify(location.city)}-surface-${String(assetNumber).padStart(3, '0')}`

  return {
    '@id': assetId,
    '@type': 'surface-model:SurfaceModel',
    'rdfs:label': languageValue(name),
    'surface-model:hasResourceDescription': createResourceDescription(
      name,
      `${contentType} surface model for ${location.city}, ${location.region}.`,
      index,
      3
    ),
    'surface-model:hasDomainSpecification': {
      '@type': 'surface-model:DomainSpecification',
      'surface-model:hasFormat': {
        '@type': 'surface-model:Format',
        'surface-model:formatType': formatType,
        'surface-model:version': cycle(surfaceVersions, index, 2, 0),
      },
      'surface-model:hasContent': [
        {
          '@type': 'surface-model:Content',
          'surface-model:contentType': contentType,
        },
        generateOdd(index, { profile: 'surface' }),
      ],
      'surface-model:hasQuantity': {
        '@type': 'surface-model:Quantity',
        'surface-model:length': floatValue(2 + index * 1.7, 2),
        'surface-model:elevationRange': floatValue(5 + index * 3.4, 2),
        'surface-model:mapDataField': index % 2 === 0,
      },
      'surface-model:hasQuality': {
        '@type': 'surface-model:Quality',
        'surface-model:resolutionLongitudinal': floatValue(
          cycle([0.001, 0.005, 0.01, 0.05], index, 1, 0),
          3
        ),
        'surface-model:resolutionLateral': floatValue(
          cycle([0.001, 0.005, 0.01, 0.05], index, 1, 1),
          3
        ),
        'surface-model:orientation': floatValue((index * 18.5) % 360, 1),
        'surface-model:platformExists': index % 3 !== 0,
        'surface-model:rampExists': index % 4 === 0,
      },
      'surface-model:hasGeoreference': createGeoreference(location, index, true),
    },
    'surface-model:hasManifest': createManifest(),
  }
}

function buildDocuments() {
  const hdmapDocument = {
    '@context': contexts.hdmap,
    '@graph': Array.from({ length: 100 }, (_, index) => buildHdMapAsset(index)),
  }

  const scenarioGraph = []
  for (let index = 0; index < 50; index += 1) {
    const { scenario, referencedEntries } = buildScenarioAsset(index)
    scenarioGraph.push(scenario, ...referencedEntries)
  }

  const scenarioDocument = {
    '@context': contexts.scenario,
    '@graph': scenarioGraph,
  }

  const osiTraceDocument = {
    '@context': contexts.ositrace,
    '@graph': Array.from({ length: 50 }, (_, index) => buildOsiTraceAsset(index)),
  }

  const environmentModelDocument = {
    '@context': contexts.environmentModel,
    '@graph': Array.from({ length: 50 }, (_, index) => buildEnvironmentModelAsset(index)),
  }

  const surfaceModelDocument = {
    '@context': contexts.surfaceModel,
    '@graph': Array.from({ length: 20 }, (_, index) => buildSurfaceModelAsset(index)),
  }

  return [
    { fileName: 'sample-hdmap.jsonld', document: hdmapDocument },
    { fileName: 'sample-scenarios.jsonld', document: scenarioDocument },
    { fileName: 'sample-ositrace.jsonld', document: osiTraceDocument },
    { fileName: 'sample-environment-models.jsonld', document: environmentModelDocument },
    { fileName: 'sample-surface-models.jsonld', document: surfaceModelDocument },
  ]
}

function validateInputs() {
  for (const inputFile of inputFiles) {
    const filePath = join(dataDirectory, inputFile)
    const fileContents = readFileSync(filePath, 'utf8')

    if (!fileContents.trim()) {
      throw new Error(`Input file is empty: ${filePath}`)
    }
  }
}

function writeDocuments(documents) {
  mkdirSync(dataDirectory, { recursive: true })

  return documents.map(({ fileName, document }) => {
    const outputPath = join(dataDirectory, fileName)
    writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8')
    return { fileName, outputPath, count: document['@graph'].length }
  })
}

async function main() {
  validateInputs()
  const results = writeDocuments(buildDocuments())
  const summary = results.map(({ fileName, count }) => `${fileName}: ${count}`).join('\n')
  process.stdout.write(`Generated JSON-LD sample data files:\n${summary}\n`)
  return results
}

const isMainModule =
  process.argv[1] && resolve(process.argv[1]).toLowerCase() === __filename.toLowerCase()

if (isMainModule) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
    )
    process.exitCode = 1
  })
}

export {
  buildDocuments,
  contexts,
  generateBehaviour,
  generateOdd,
  generateRoadUser,
  generateTag,
  main,
  writeDocuments,
}

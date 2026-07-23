// Copyright the ontology-based-nl-search authors.
// SPDX-License-Identifier: Apache-2.0
//
// Thin embind entrypoint over the RA Consulting `openscenario.api.test` C++ API
// (Apache-2.0, pinned submodule submodules/openscenario-api @ 292d0be). Exposes
// the in-process OpenSCENARIO 1.3 engine to TypeScript as strings-in / data-out,
// mirroring how packages/sparql loads Oxigraph WASM.
//
// [OSC-XSD] OpenSCENARIO 1.3 — the engine's class model + range/cardinality
// checker rules are generated from the ASAM UML model; see docs/specs/references.
#include <emscripten/bind.h>

#include <cstdint>
#include <cstdio>
#include <exception>
#include <map>
#include <memory>
#include <sstream>
#include <string>
#include <vector>

#include "ApiClassWriterInterfacesV1_3.h"
#include "DateTime.h"
#include "ErrorLevel.h"
#include "FileContentMessage.h"
#include "FileResourceLocator.h"
#include "IScenarioLoader.h"
#include "NamedReferenceProxy.h"
#include "OpenScenarioWriterFactoryImplV1_3.h"
#include "OpenScenarioXmlExporterV1_3.h"
#include "SimpleMessageLogger.h"
#include "XmlScenarioLoaderFactoryV1_3.h"
#include "json.hpp"
#include "osc_versions_generated.h"
#include "tinyxml2.h"

using namespace NET_ASAM_OPENSCENARIO;
namespace v = NET_ASAM_OPENSCENARIO::v1_3;

static std::string jsonEscape(const std::string& s) {
  std::ostringstream o;
  for (char c : s) {
    switch (c) {
      case '"': o << "\\\""; break;
      case '\\': o << "\\\\"; break;
      case '\n': o << "\\n"; break;
      case '\r': o << "\\r"; break;
      case '\t': o << "\\t"; break;
      default: o << c;
    }
  }
  return o.str();
}

// Validate a .xosc already present in the MEMFS at `mainPath`. Callers (the TS
// loader) write the scenario + any referenced catalog/import files to MEMFS at
// their referenced paths, then call this — mirroring how OpenSCENARIO resolves
// catalog imports by file path. Returns JSON diagnostics.
std::string validate(std::string mainPath) {
  auto messageLogger = std::make_shared<SimpleMessageLogger>(INFO);
  std::map<std::string, std::string> params;
  std::ostringstream out;
  try {
    v::XmlScenarioLoaderFactory factory(mainPath);
    auto locator = std::make_shared<FileResourceLocator>();
    auto loader = factory.CreateLoader(locator);
    auto model = loader->Load(messageLogger, params);
    (void)model;
  } catch (std::exception& e) {
    out << "{\"fatal\":\"" << jsonEscape(e.what()) << "\"}";
    return out.str();
  } catch (...) {
    return "{\"fatal\":\"unknown exception\"}";
  }

  auto msgs = messageLogger->GetMessages();
  int errors = 0;
  for (auto& m : msgs) {
    if (m.GetErrorLevel() >= ERROR) errors++;
  }
  out << "{\"messageCount\":" << msgs.size() << ",\"errorCount\":" << errors
      << ",\"ok\":" << (errors == 0 ? "true" : "false") << ",\"messages\":[";
  bool first = true;
  for (auto& m : msgs) {
    if (!first) out << ",";
    first = false;
    auto tm = m.GetTextmarker();
    out << "{\"level\":" << (int)m.GetErrorLevel() << ",\"line\":" << tm.GetLine()
        << ",\"col\":" << tm.GetColumn() << ",\"msg\":\"" << jsonEscape(m.ToString())
        << "\"}";
  }
  out << "]}";
  return out.str();
}

// The reported versions are generated from versions.json at build time
// (native/build.mjs → OSC_DESCRIBE_JSON), so this can never drift from the pin
// the ontology derivation and the TS capability probe share (task 10).
std::string describe() {
  return OSC_DESCRIBE_JSON;
}

static std::string xmlToString(std::shared_ptr<tinyxml2::XMLDocument> doc) {
  tinyxml2::XMLPrinter printer;
  doc->Print(&printer);
  return std::string(printer.CStr());
}

// AUTHOR PATH (a): re-serialize a parsed scenario tree back to .xosc.
// Exercises the FULL exporter (295 Fill*Node methods) + XmlExportHelper number
// formatting on a real scenario — the writer-determinism surface. Same input
// must yield byte-identical output across runs.
std::string roundtripExport(std::string filename) {
  auto messageLogger = std::make_shared<SimpleMessageLogger>(INFO);
  std::map<std::string, std::string> params;
  try {
    v::XmlScenarioLoaderFactory factory(filename);
    auto loader = factory.CreateLoader(std::make_shared<FileResourceLocator>());
    auto model = loader->Load(messageLogger, params);
    auto oscWriter = std::dynamic_pointer_cast<v::IOpenScenarioWriter>(model);
    if (!oscWriter) return "{\"error\":\"cast to IOpenScenarioWriter failed\"}";
    v::OpenScenarioXmlExporter exporter;
    return xmlToString(exporter.CreateXmlDocument(oscWriter));
  } catch (std::exception& e) {
    return std::string("{\"fatal\":\"") + jsonEscape(e.what()) + "\"}";
  } catch (...) {
    return "{\"fatal\":\"unknown exception\"}";
  }
}

// AUTHOR PATH (b): build a scenario tree FROM SCRATCH via the typed writer
// factory (no parse), then serialize. Proves the Create*Writer()/Set*() surface
// is callable under WASM and emits XML — the seed of the model-generated facade.
std::string authorMinimal() {
  try {
    auto factory = std::make_shared<v::OpenScenarioWriterFactoryImpl>();
    auto osc = factory->CreateOpenScenarioWriter();
    auto fh = factory->CreateFileHeaderWriter();
    fh->SetRevMajor(static_cast<uint16_t>(1));
    fh->SetRevMinor(static_cast<uint16_t>(3));
    fh->SetAuthor(std::string("authoring-wasm"));
    fh->SetDescription(std::string("from-scratch writer smoke"));
    DateTime dt{};
    dt.year = 2026 - 1900;
    dt.mon = 0;  // 0-based -> January
    dt.mday = 1;
    dt.hour = 0;
    dt.min = 0;
    dt.sec = 0.0;
    dt.gmtHours = 0;
    dt.gmtMin = 0;
    fh->SetDate(dt);
    osc->SetFileHeader(fh);
    v::OpenScenarioXmlExporter exporter;
    return xmlToString(exporter.CreateXmlDocument(osc));
  } catch (std::exception& e) {
    return std::string("{\"fatal\":\"") + jsonEscape(e.what()) + "\"}";
  } catch (...) {
    return "{\"fatal\":\"unknown exception\"}";
  }
}

// ---------------------------------------------------------------------------
// AUTHOR PATH (c): build a complete scenario tree from a resolved "engine tree"
// JSON (produced by packages/authoring's ir-to-engine mapping) via the typed
// writer factory, then serialize with the model-generated exporter. The engine
// owns element order, xsd:choice selection and attribute-vs-element placement
// because the writers are generated from the ASAM UML model — the TS layer only
// supplies values, never XML. This is the lowering half of task 04.
//
// [OSC-XSD] OpenSCENARIO 1.3 — the writer/exporter surface is generated from the
// standard's model, so emitted documents are structurally standard by
// construction; the runtime checker (validate) is the confirming gate.
namespace {

using nlohmann::json;
using namespace NET_ASAM_OPENSCENARIO::v1_3;

std::string jstr(const json& o, const char* k, const std::string& d = "") {
  return o.contains(k) && !o[k].is_null() ? o[k].get<std::string>() : d;
}
double jnum(const json& o, const char* k, double d = 0.0) {
  return o.contains(k) && !o[k].is_null() ? o[k].get<double>() : d;
}
int jint(const json& o, const char* k, int d = 0) {
  return o.contains(k) && !o[k].is_null() ? o[k].get<int>() : d;
}
bool jbool(const json& o, const char* k, bool d = false) {
  return o.contains(k) && !o[k].is_null() ? o[k].get<bool>() : d;
}

// Every generated enum wrapper has a `E(std::string& literal)` constructor that
// maps the OpenSCENARIO literal (e.g. "car", "cubic", "rising") to the enum — so
// the IR's literal values drive enum-typed setters directly, no per-enum switch.
template <class E>
E enumOf(const std::string& s) {
  std::string t = s;
  return E(t);
}

// A model reference is a NamedReferenceProxy over the referenced interface,
// carrying just the referenced name — exactly how the XML parser builds them.
template <class T>
std::shared_ptr<INamedReference<T>> nref(const std::string& name) {
  return std::make_shared<NamedReferenceProxy<T>>(name);
}

DateTime parseDate(const std::string& iso) {
  DateTime dt{};
  int Y = 2020, Mo = 1, Da = 1, h = 0, mi = 0;
  double se = 0.0;
  std::sscanf(iso.c_str(), "%d-%d-%dT%d:%d:%lf", &Y, &Mo, &Da, &h, &mi, &se);
  dt.year = Y - 1900;
  dt.mon = Mo - 1;  // struct tm months are 0-based
  dt.mday = Da;
  dt.hour = h;
  dt.min = mi;
  dt.sec = se;
  dt.gmtHours = 0;
  dt.gmtMin = 0;
  return dt;
}

using Factory = v::IOpenScenarioWriterFactory;

std::shared_ptr<v::IFileWriter> buildFile(Factory& f, const std::string& path) {
  auto w = f.CreateFileWriter();
  w->SetFilepath(path);
  return w;
}

std::shared_ptr<v::IAxleWriter> buildAxle(Factory& f, const json& a) {
  auto w = f.CreateAxleWriter();
  w->SetMaxSteering(jnum(a, "maxSteering"));
  w->SetWheelDiameter(jnum(a, "wheelDiameter"));
  w->SetTrackWidth(jnum(a, "trackWidth"));
  w->SetPositionX(jnum(a, "positionX"));
  w->SetPositionZ(jnum(a, "positionZ"));
  return w;
}

std::shared_ptr<v::IVehicleWriter> buildVehicle(Factory& f, const json& veh) {
  auto w = f.CreateVehicleWriter();
  w->SetName(jstr(veh, "name"));
  w->SetVehicleCategory(enumOf<VehicleCategory>(jstr(veh, "vehicleCategory", "car")));

  if (veh.contains("performance")) {
    const json& p = veh["performance"];
    auto perf = f.CreatePerformanceWriter();
    perf->SetMaxSpeed(jnum(p, "maxSpeed"));
    perf->SetMaxAcceleration(jnum(p, "maxAcceleration"));
    perf->SetMaxDeceleration(jnum(p, "maxDeceleration"));
    w->SetPerformance(perf);
  }
  if (veh.contains("boundingBox")) {
    const json& b = veh["boundingBox"];
    auto bb = f.CreateBoundingBoxWriter();
    const json& c = b.value("center", json::object());
    auto center = f.CreateCenterWriter();
    center->SetX(jnum(c, "x"));
    center->SetY(jnum(c, "y"));
    center->SetZ(jnum(c, "z"));
    bb->SetCenter(center);
    const json& d = b.value("dimensions", json::object());
    auto dims = f.CreateDimensionsWriter();
    dims->SetWidth(jnum(d, "width"));
    dims->SetLength(jnum(d, "length"));
    dims->SetHeight(jnum(d, "height"));
    bb->SetDimensions(dims);
    w->SetBoundingBox(bb);
  }
  if (veh.contains("axles")) {
    const json& ax = veh["axles"];
    auto axles = f.CreateAxlesWriter();
    if (ax.contains("front")) axles->SetFrontAxle(buildAxle(f, ax["front"]));
    if (ax.contains("rear")) axles->SetRearAxle(buildAxle(f, ax["rear"]));
    w->SetAxles(axles);
  }
  return w;
}

std::shared_ptr<v::IScenarioObjectWriter> buildScenarioObject(Factory& f, const json& e) {
  auto so = f.CreateScenarioObjectWriter();
  so->SetName(jstr(e, "name"));
  auto obj = f.CreateEntityObjectWriter();
  obj->SetVehicle(buildVehicle(f, e.value("vehicle", json::object())));
  so->SetEntityObject(obj);
  return so;
}

std::shared_ptr<v::ITransitionDynamicsWriter> buildDynamics(Factory& f, const json& d) {
  auto td = f.CreateTransitionDynamicsWriter();
  td->SetDynamicsShape(enumOf<DynamicsShape>(jstr(d, "dynamicsShape", "step")));
  td->SetDynamicsDimension(enumOf<DynamicsDimension>(jstr(d, "dynamicsDimension", "time")));
  td->SetValue(jnum(d, "value"));
  return td;
}

std::shared_ptr<v::IPositionWriter> buildPosition(Factory& f, const json& tp) {
  auto pos = f.CreatePositionWriter();
  if (tp.contains("lane")) {
    const json& l = tp["lane"];
    auto lp = f.CreateLanePositionWriter();
    lp->SetRoadId(jstr(l, "roadId", "0"));
    lp->SetLaneId(jstr(l, "laneId", "-1"));
    lp->SetS(jnum(l, "s"));
    lp->SetOffset(jnum(l, "offset"));
    pos->SetLanePosition(lp);
  } else if (tp.contains("relativeLane")) {
    const json& r = tp["relativeLane"];
    auto rlp = f.CreateRelativeLanePositionWriter();
    rlp->SetEntityRef(nref<v::IEntity>(jstr(r, "entityRef")));
    rlp->SetDLane(jint(r, "dLane"));
    rlp->SetDs(jnum(r, "ds"));
    if (r.contains("offset")) rlp->SetOffset(jnum(r, "offset"));
    pos->SetRelativeLanePosition(rlp);
  }
  return pos;
}

std::shared_ptr<v::IPrivateWriter> buildInitPrivate(Factory& f, const json& p) {
  auto priv = f.CreatePrivateWriter();
  priv->SetEntityRef(nref<v::IEntity>(jstr(p, "entityRef")));

  std::vector<std::shared_ptr<v::IPrivateActionWriter>> actions;
  if (p.contains("speed")) {
    auto speed = f.CreateSpeedActionWriter();
    json stepDyn = {{"dynamicsShape", "step"}, {"dynamicsDimension", "time"}, {"value", 0}};
    speed->SetSpeedActionDynamics(buildDynamics(f, stepDyn));
    auto target = f.CreateSpeedActionTargetWriter();
    auto abs = f.CreateAbsoluteTargetSpeedWriter();
    abs->SetValue(jnum(p, "speed"));
    target->SetAbsoluteTargetSpeed(abs);
    speed->SetSpeedActionTarget(target);
    auto lon = f.CreateLongitudinalActionWriter();
    lon->SetSpeedAction(speed);
    auto pa = f.CreatePrivateActionWriter();
    pa->SetLongitudinalAction(lon);
    actions.push_back(pa);
  }
  if (p.contains("teleport")) {
    auto teleport = f.CreateTeleportActionWriter();
    teleport->SetPosition(buildPosition(f, p["teleport"]));
    auto pa = f.CreatePrivateActionWriter();
    pa->SetTeleportAction(teleport);
    actions.push_back(pa);
  }
  priv->SetPrivateActions(actions);
  return priv;
}

// A start/stop trigger with a single simulation-time condition.
std::shared_ptr<v::ITriggerWriter> buildSimTimeTrigger(
    Factory& f, const std::string& name, double value, const std::string& rule,
    const std::string& edge, double delay) {
  auto cond = f.CreateConditionWriter();
  cond->SetName(name);
  cond->SetDelay(delay);
  cond->SetConditionEdge(enumOf<ConditionEdge>(edge));
  auto byValue = f.CreateByValueConditionWriter();
  auto simTime = f.CreateSimulationTimeConditionWriter();
  simTime->SetValue(value);
  simTime->SetRule(enumOf<Rule>(rule));
  byValue->SetSimulationTimeCondition(simTime);
  cond->SetByValueCondition(byValue);

  std::vector<std::shared_ptr<v::IConditionWriter>> conditions{cond};
  auto group = f.CreateConditionGroupWriter();
  group->SetConditions(conditions);
  std::vector<std::shared_ptr<v::IConditionGroupWriter>> groups{group};
  auto trigger = f.CreateTriggerWriter();
  trigger->SetConditionGroups(groups);
  return trigger;
}

std::shared_ptr<v::IStoryWriter> buildStory(Factory& f, const json& m) {
  // The lane-change event.
  const json& lc = m.value("laneChange", json::object());
  auto lcAction = f.CreateLaneChangeActionWriter();
  lcAction->SetTargetLaneOffset(jnum(lc, "targetLaneOffset"));
  lcAction->SetLaneChangeActionDynamics(buildDynamics(f, lc.value("dynamics", json::object())));
  auto lcTarget = f.CreateLaneChangeTargetWriter();
  auto rtl = f.CreateRelativeTargetLaneWriter();
  const json& rt = lc.value("relativeTarget", json::object());
  rtl->SetEntityRef(nref<v::IEntity>(jstr(rt, "entityRef")));
  rtl->SetValue(jint(rt, "value"));
  lcTarget->SetRelativeTargetLane(rtl);
  lcAction->SetLaneChangeTarget(lcTarget);
  auto lateral = f.CreateLateralActionWriter();
  lateral->SetLaneChangeAction(lcAction);
  auto privAction = f.CreatePrivateActionWriter();
  privAction->SetLateralAction(lateral);
  auto action = f.CreateActionWriter();
  action->SetName(jstr(m, "actionName", "Action1"));
  action->SetPrivateAction(privAction);
  std::vector<std::shared_ptr<v::IActionWriter>> eventActions{action};

  auto event = f.CreateEventWriter();
  event->SetName(jstr(m, "eventName", "Event1"));
  event->SetPriority(enumOf<Priority>(jstr(m, "priority", "override")));
  event->SetActions(eventActions);
  event->SetStartTrigger(buildSimTimeTrigger(f, "EventStart", jnum(m, "startTime", 0.0),
                                             "greaterThan", "rising", 0.0));
  std::vector<std::shared_ptr<v::IEventWriter>> events{event};

  auto maneuver = f.CreateManeuverWriter();
  maneuver->SetName(jstr(m, "maneuverName", "Maneuver1"));
  maneuver->SetEvents(events);
  std::vector<std::shared_ptr<v::IManeuverWriter>> maneuvers{maneuver};

  auto entityRef = f.CreateEntityRefWriter();
  entityRef->SetEntityRef(nref<v::IEntity>(jstr(m, "actorRef")));
  std::vector<std::shared_ptr<v::IEntityRefWriter>> entityRefs{entityRef};
  auto actors = f.CreateActorsWriter();
  actors->SetSelectTriggeringEntities(false);
  actors->SetEntityRefs(entityRefs);

  auto group = f.CreateManeuverGroupWriter();
  group->SetMaximumExecutionCount(static_cast<uint32_t>(1));
  group->SetName(jstr(m, "groupName", "ManeuverGroup1"));
  group->SetActors(actors);
  group->SetManeuvers(maneuvers);
  std::vector<std::shared_ptr<v::IManeuverGroupWriter>> groups{group};

  auto act = f.CreateActWriter();
  act->SetName(jstr(m, "actName", "Act1"));
  act->SetManeuverGroups(groups);
  act->SetStartTrigger(
      buildSimTimeTrigger(f, "ActStart", 0.0, "greaterThan", "rising", 0.0));
  std::vector<std::shared_ptr<v::IActWriter>> acts{act};

  auto story = f.CreateStoryWriter();
  story->SetName(jstr(m, "storyName", "Story1"));
  story->SetActs(acts);
  return story;
}

std::string authorImpl(const std::string& treeJson) {
  json ir = json::parse(treeJson);
  auto factory = std::make_shared<v::OpenScenarioWriterFactoryImpl>();
  Factory& f = *factory;

  auto osc = f.CreateOpenScenarioWriter();

  const json& fh = ir.value("fileHeader", json::object());
  auto header = f.CreateFileHeaderWriter();
  header->SetRevMajor(static_cast<uint16_t>(jint(fh, "revMajor", 1)));
  header->SetRevMinor(static_cast<uint16_t>(jint(fh, "revMinor", 3)));
  header->SetAuthor(jstr(fh, "author", "authoring-wasm"));
  header->SetDescription(jstr(fh, "description", ""));
  header->SetDate(parseDate(jstr(fh, "date", "2020-01-01T00:00:00")));
  osc->SetFileHeader(header);

  auto scenarioDef = f.CreateScenarioDefinitionWriter();

  if (ir.contains("parameters") && ir["parameters"].is_array()) {
    std::vector<std::shared_ptr<v::IParameterDeclarationWriter>> params;
    for (const json& p : ir["parameters"]) {
      auto pd = f.CreateParameterDeclarationWriter();
      pd->SetName(jstr(p, "name"));
      pd->SetParameterType(enumOf<ParameterType>(jstr(p, "parameterType", "string")));
      pd->SetValue(jstr(p, "value"));
      params.push_back(pd);
    }
    scenarioDef->SetParameterDeclarations(params);
  }

  // CatalogLocations is required by the writer/exporter contract; an empty one
  // mirrors the normative `<CatalogLocations />`.
  scenarioDef->SetCatalogLocations(f.CreateCatalogLocationsWriter());

  if (ir.contains("roadNetwork")) {
    const json& rn = ir["roadNetwork"];
    auto roadNetwork = f.CreateRoadNetworkWriter();
    if (rn.contains("logicFile")) roadNetwork->SetLogicFile(buildFile(f, jstr(rn, "logicFile")));
    if (rn.contains("sceneGraphFile"))
      roadNetwork->SetSceneGraphFile(buildFile(f, jstr(rn, "sceneGraphFile")));
    scenarioDef->SetRoadNetwork(roadNetwork);
  }

  auto entities = f.CreateEntitiesWriter();
  std::vector<std::shared_ptr<v::IScenarioObjectWriter>> scenarioObjects;
  if (ir.contains("entities") && ir["entities"].is_array()) {
    for (const json& e : ir["entities"]) scenarioObjects.push_back(buildScenarioObject(f, e));
  }
  entities->SetScenarioObjects(scenarioObjects);
  scenarioDef->SetEntities(entities);

  auto storyboard = f.CreateStoryboardWriter();
  auto init = f.CreateInitWriter();
  auto initActions = f.CreateInitActionsWriter();
  std::vector<std::shared_ptr<v::IPrivateWriter>> privates;
  if (ir.contains("init") && ir["init"].is_array()) {
    for (const json& p : ir["init"]) privates.push_back(buildInitPrivate(f, p));
  }
  initActions->SetPrivates(privates);
  init->SetActions(initActions);
  storyboard->SetInit(init);

  if (ir.contains("maneuver")) {
    std::vector<std::shared_ptr<v::IStoryWriter>> stories{buildStory(f, ir["maneuver"])};
    storyboard->SetStories(stories);
  }

  double stopTime = jnum(ir, "stopTime", 30.0);
  storyboard->SetStopTrigger(
      buildSimTimeTrigger(f, "SimulationEnd", stopTime, "greaterThan", "rising", 0.0));
  scenarioDef->SetStoryboard(storyboard);

  auto category = f.CreateOpenScenarioCategoryWriter();
  category->SetScenarioDefinition(scenarioDef);
  osc->SetOpenScenarioCategory(category);

  v::OpenScenarioXmlExporter exporter;
  return xmlToString(exporter.CreateXmlDocument(osc));
}

}  // namespace

// AUTHOR PATH (c): deterministic IR → .xosc lowering. Input is the resolved
// engine-tree JSON; output is the emitted .xosc XML, or a JSON `{"fatal":...}`
// object if authoring throws. Same input yields byte-identical output.
std::string author(std::string treeJson) {
  try {
    return authorImpl(treeJson);
  } catch (std::exception& e) {
    return std::string("{\"fatal\":\"") + jsonEscape(e.what()) + "\"}";
  } catch (...) {
    return "{\"fatal\":\"unknown exception\"}";
  }
}

EMSCRIPTEN_BINDINGS(osc_engine) {
  emscripten::function("validate", &validate);
  emscripten::function("describe", &describe);
  emscripten::function("roundtripExport", &roundtripExport);
  emscripten::function("authorMinimal", &authorMinimal);
  emscripten::function("author", &author);
}

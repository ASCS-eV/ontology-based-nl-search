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
#include "OpenScenarioWriterFactoryImplV1_3.h"
#include "OpenScenarioXmlExporterV1_3.h"
#include "SimpleMessageLogger.h"
#include "XmlScenarioLoaderFactoryV1_3.h"
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

EMSCRIPTEN_BINDINGS(osc_engine) {
  emscripten::function("validate", &validate);
  emscripten::function("describe", &describe);
  emscripten::function("roundtripExport", &roundtripExport);
  emscripten::function("authorMinimal", &authorMinimal);
}

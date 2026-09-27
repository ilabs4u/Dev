/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* Dev Browser - LuaJIT Engine Implementation */

#include "lua-engine.h"

#include <iostream>
#include <fstream>
#include <sstream>
#include <cstdlib>

#if defined(_WIN32) || defined(_WIN64)
#include <windows.h>
#else
#include <unistd.h>
#include <sys/stat.h>
#endif

namespace dev {

LuaEngine& LuaEngine::GetInstance() {
  static LuaEngine instance;
  return instance;
}

LuaEngine::LuaEngine()
  : mL(nullptr)
  , mInitialized(false)
  , mLogCallback(nullptr)
{
}

LuaEngine::~LuaEngine() {
  Shutdown();
}

void LuaEngine::Log(const std::string& msg) {
  if (mLogCallback) {
    mLogCallback(msg);
  } else {
    std::cout << "[DevBrowser:Lua] " << msg << std::endl;
  }
}

int LuaEngine::LuaPrint(lua_State* L) {
  int nargs = lua_gettop(L);
  std::ostringstream ss;
  for (int i = 1; i <= nargs; ++i) {
    if (i > 1) ss << "\t";
    if (lua_isstring(L, i)) {
      ss << lua_tostring(L, i);
    } else if (lua_isboolean(L, i)) {
      ss << (lua_toboolean(L, i) ? "true" : "false");
    } else if (lua_isnil(L, i)) {
      ss << "nil";
    } else {
      ss << lua_typename(L, lua_type(L, i));
    }
  }
  LuaEngine::GetInstance().Log(ss.str());
  return 0;
}

int LuaEngine::LuaKeymapSet(lua_State* L) {
  // keymap.set(mode, key, action)
  if (lua_gettop(L) >= 3 && lua_isstring(L, 1) && lua_isstring(L, 2)) {
    const char* mode = lua_tostring(L, 1);
    const char* key = lua_tostring(L, 2);
    const char* action = lua_isstring(L, 3) ? lua_tostring(L, 3) : "[function]";
    std::ostringstream ss;
    ss << "Keymap registered: [" << mode << "] " << key << " -> " << action;
    LuaEngine::GetInstance().Log(ss.str());
  }
  return 0;
}

int LuaEngine::LuaKeymapDel(lua_State* L) {
  if (lua_gettop(L) >= 2 && lua_isstring(L, 1) && lua_isstring(L, 2)) {
    const char* mode = lua_tostring(L, 1);
    const char* key = lua_tostring(L, 2);
    std::ostringstream ss;
    ss << "Keymap removed: [" << mode << "] " << key;
    LuaEngine::GetInstance().Log(ss.str());
  }
  return 0;
}

int LuaEngine::LuaCommandCreate(lua_State* L) {
  if (lua_gettop(L) >= 2 && lua_isstring(L, 1)) {
    const char* name = lua_tostring(L, 1);
    std::ostringstream ss;
    ss << "Command registered: " << name;
    LuaEngine::GetInstance().Log(ss.str());
  }
  return 0;
}

int LuaEngine::LuaCommandRun(lua_State* L) {
  if (lua_gettop(L) >= 1 && lua_isstring(L, 1)) {
    const char* name = lua_tostring(L, 1);
    std::ostringstream ss;
    ss << "Running command: " << name;
    LuaEngine::GetInstance().Log(ss.str());
  }
  return 0;
}

int LuaEngine::LuaPluginLoad(lua_State* L) {
  if (lua_gettop(L) >= 1 && lua_isstring(L, 1)) {
    const char* name = lua_tostring(L, 1);
    std::ostringstream ss;
    ss << "Loading plugin: " << name;
    LuaEngine::GetInstance().Log(ss.str());
  }
  return 0;
}

bool LuaEngine::Init() {
  if (mInitialized) return true;

  mL = luaL_newstate();
  if (!mL) {
    Log("Failed to create LuaJIT state");
    return false;
  }

  // Open standard libraries
  luaL_openlibs(mL);

  // Override print function to route to browser console
  lua_register(mL, "print", LuaEngine::LuaPrint);

  // Register Dev Browser core API tables
  RegisterCoreAPIs();

  mInitialized = true;
  Log("LuaJIT 2.1 engine initialized successfully");
  return true;
}

void LuaEngine::RegisterCoreAPIs() {
  RegisterKeymapAPI();
  RegisterWorkspaceAPI();
  RegisterCommandAPI();
  RegisterNetworkAPI();
  RegisterAgentAPI();
  RegisterAIAPI();
  RegisterPluginAPI();
  RegisterDevAPI();
}

void LuaEngine::RegisterKeymapAPI() {
  lua_newtable(mL);
  lua_pushcfunction(mL, LuaEngine::LuaKeymapSet);
  lua_setfield(mL, -2, "set");
  lua_pushcfunction(mL, LuaEngine::LuaKeymapDel);
  lua_setfield(mL, -2, "del");
  lua_setglobal(mL, "keymap");
}

void LuaEngine::RegisterWorkspaceAPI() {
  lua_newtable(mL);
  lua_setglobal(mL, "workspace");
}

void LuaEngine::RegisterCommandAPI() {
  lua_newtable(mL);
  lua_pushcfunction(mL, LuaEngine::LuaCommandCreate);
  lua_setfield(mL, -2, "create");
  lua_pushcfunction(mL, LuaEngine::LuaCommandRun);
  lua_setfield(mL, -2, "run");
  lua_setglobal(mL, "command");
}

void LuaEngine::RegisterNetworkAPI() {
  lua_newtable(mL);

  // network.proxy
  lua_newtable(mL);
  lua_pushstring(mL, "direct");
  lua_setfield(mL, -2, "default");
  lua_setfield(mL, -2, "proxy");

  // network.dns
  lua_newtable(mL);
  lua_pushstring(mL, "cloudflare-doh");
  lua_setfield(mL, -2, "resolver");
  lua_setfield(mL, -2, "dns");

  lua_setglobal(mL, "network");
}

void LuaEngine::RegisterAgentAPI() {
  lua_newtable(mL);

  // agent.mcp
  lua_newtable(mL);
  lua_pushboolean(mL, 1);
  lua_setfield(mL, -2, "enabled");
  lua_pushinteger(mL, 9222);
  lua_setfield(mL, -2, "port");
  lua_setfield(mL, -2, "mcp");

  // agent.permissions
  lua_newtable(mL);
  lua_pushboolean(mL, 1);
  lua_setfield(mL, -2, "allow_navigation");
  lua_pushboolean(mL, 1);
  lua_setfield(mL, -2, "allow_form_fill");
  lua_pushboolean(mL, 1);
  lua_setfield(mL, -2, "allow_click");
  lua_setfield(mL, -2, "permissions");

  lua_setglobal(mL, "agent");
}

void LuaEngine::RegisterAIAPI() {
  lua_newtable(mL);
  lua_pushstring(mL, "ollama");
  lua_setfield(mL, -2, "default_backend");

  lua_newtable(mL);
  lua_pushstring(mL, "llama3.2");
  lua_setfield(mL, -2, "model");
  lua_pushstring(mL, "http://localhost:11434");
  lua_setfield(mL, -2, "url");
  lua_setfield(mL, -2, "ollama");

  lua_setglobal(mL, "ai");
}

void LuaEngine::RegisterPluginAPI() {
  lua_newtable(mL);
  lua_pushcfunction(mL, LuaEngine::LuaPluginLoad);
  lua_setfield(mL, -2, "load");
  lua_setglobal(mL, "plugin");
}

void LuaEngine::RegisterDevAPI() {
  lua_newtable(mL);
  lua_setglobal(mL, "dev");

  lua_newtable(mL);
  lua_setglobal(mL, "boost");
}

std::string LuaEngine::ResolveConfigPath() const {
  const char* envPath = std::getenv("DEV_BROWSER_CONFIG");
  if (envPath && *envPath) {
    return std::string(envPath);
  }

#if defined(_WIN32) || defined(_WIN64)
  const char* userProfile = std::getenv("USERPROFILE");
  if (userProfile && *userProfile) {
    std::string configPath = std::string(userProfile) + "\\.config\\dev\\init.lua";
    std::ifstream f(configPath.c_str());
    if (f.good()) return configPath;
  }
  const char* appData = std::getenv("APPDATA");
  if (appData && *appData) {
    std::string configPath = std::string(appData) + "\\dev\\init.lua";
    std::ifstream f(configPath.c_str());
    if (f.good()) return configPath;
  }
#else
  const char* home = std::getenv("HOME");
  if (home && *home) {
    std::string configPath = std::string(home) + "/.config/dev/init.lua";
    std::ifstream f(configPath.c_str());
    if (f.good()) return configPath;
  }
#endif

  // Fallback to local default-init.lua
  return "config/default-init.lua";
}

bool LuaEngine::LoadInitFile(const std::string& customPath) {
  if (!mInitialized && !Init()) {
    return false;
  }

  std::string filePath = customPath.empty() ? ResolveConfigPath() : customPath;
  Log("Loading configuration from: " + filePath);

  std::ifstream file(filePath.c_str());
  if (!file.good()) {
    Log("Config file not found: " + filePath + " (using defaults)");
    return true;
  }

  int result = luaL_dofile(mL, filePath.c_str());
  if (result != 0) {
    const char* err = lua_tostring(mL, -1);
    Log(std::string("Error executing init.lua: ") + (err ? err : "unknown error"));
    lua_pop(mL, 1);
    return false;
  }

  Log("Loaded configuration successfully");
  return true;
}

bool LuaEngine::ExecuteString(const char* code, std::string* outError) {
  if (!mInitialized && !Init()) {
    if (outError) *outError = "Engine not initialized";
    return false;
  }

  int result = luaL_dostring(mL, code);
  if (result != 0) {
    const char* err = lua_tostring(mL, -1);
    if (outError) *outError = err ? err : "Unknown error";
    Log(std::string("Lua error: ") + (err ? err : "unknown"));
    lua_pop(mL, 1);
    return false;
  }
  return true;
}

bool LuaEngine::CallFunction(const char* name, const std::vector<std::string>& args, std::string* outError) {
  if (!mInitialized && !Init()) {
    if (outError) *outError = "Engine not initialized";
    return false;
  }

  lua_getglobal(mL, name);
  if (!lua_isfunction(mL, -1)) {
    lua_pop(mL, 1);
    if (outError) *outError = std::string("Function not found: ") + name;
    return false;
  }

  for (const auto& arg : args) {
    lua_pushstring(mL, arg.c_str());
  }

  int result = lua_pcall(mL, static_cast<int>(args.size()), 0, 0);
  if (result != 0) {
    const char* err = lua_tostring(mL, -1);
    if (outError) *outError = err ? err : "Unknown error";
    Log(std::string("Lua call error: ") + (err ? err : "unknown"));
    lua_pop(mL, 1);
    return false;
  }
  return true;
}

void LuaEngine::Shutdown() {
  if (mL) {
    lua_close(mL);
    mL = nullptr;
  }
  mInitialized = false;
}

} // namespace dev

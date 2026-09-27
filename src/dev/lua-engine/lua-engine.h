/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* Dev Browser - LuaJIT Engine Integration */

#ifndef DevLuaEngine_h
#define DevLuaEngine_h

#include <string>
#include <vector>
#include <functional>
#include <memory>

extern "C" {
#include "vendor/lua.h"
#include "vendor/lualib.h"
#include "vendor/lauxlib.h"
#include "vendor/luajit.h"
}

namespace dev {

class LuaEngine {
public:
  static LuaEngine& GetInstance();

  bool Init();
  void Shutdown();
  bool IsInitialized() const { return mInitialized; }

  bool LoadInitFile(const std::string& customPath = "");
  bool ExecuteString(const char* code, std::string* outError = nullptr);
  bool CallFunction(const char* name, const std::vector<std::string>& args = {}, std::string* outError = nullptr);

  std::string ResolveConfigPath() const;
  lua_State* GetState() const { return mL; }

  // Custom print redirect sink for browser console
  typedef std::function<void(const std::string&)> LogCallback;
  void SetLogCallback(LogCallback cb) { mLogCallback = cb; }
  void Log(const std::string& msg);

private:
  LuaEngine();
  ~LuaEngine();
  LuaEngine(const LuaEngine&) = delete;
  LuaEngine& operator=(const LuaEngine&) = delete;

  void RegisterCoreAPIs();
  void RegisterKeymapAPI();
  void RegisterWorkspaceAPI();
  void RegisterCommandAPI();
  void RegisterNetworkAPI();
  void RegisterAgentAPI();
  void RegisterAIAPI();
  void RegisterPluginAPI();
  void RegisterDevAPI();

  static int LuaPrint(lua_State* L);
  static int LuaKeymapSet(lua_State* L);
  static int LuaKeymapDel(lua_State* L);
  static int LuaCommandCreate(lua_State* L);
  static int LuaCommandRun(lua_State* L);
  static int LuaPluginLoad(lua_State* L);

  lua_State* mL;
  bool mInitialized;
  LogCallback mLogCallback;
};

} // namespace dev

#endif // DevLuaEngine_h

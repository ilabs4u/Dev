/*
** Auxiliary functions for building Lua libraries
*/

#ifndef lauxlib_h
#define lauxlib_h

#include <stddef.h>
#include <stdio.h>

#include "lua.h"

typedef struct luaL_Reg {
  const char *name;
  lua_CFunction func;
} luaL_Reg;

LUALIB_API void (luaI_openlib) (lua_State *L, const char *libname,
                                const luaL_Reg *l, int nup);
LUALIB_API void (luaL_register) (lua_State *L, const char *libname,
                                 const luaL_Reg *l);
LUALIB_API int (luaL_getmetafield) (lua_State *L, int obj, const char *e);
LUALIB_API int (luaL_callmeta) (lua_State *L, int obj, const char *e);
LUALIB_API int (luaL_typerror) (lua_State *L, int narg, const char *tname);
LUALIB_API int (luaL_argerror) (lua_State *L, int numarg, const char *extramsg);
LUALIB_API const char *(luaL_checklstring) (lua_State *L, int numarg,
                                            size_t *l);
LUALIB_API const char *(luaL_optlstring) (lua_State *L, int numarg,
                                          const char *def, size_t *l);
LUALIB_API lua_Number (luaL_checknumber) (lua_State *L, int numarg);
LUALIB_API lua_Number (luaL_optnumber) (lua_State *L, int nArg, lua_Number def);
LUALIB_API lua_Integer (luaL_checkinteger) (lua_State *L, int numarg);
LUALIB_API lua_Integer (luaL_optinteger) (lua_State *L, int nArg,
                                          lua_Integer def);

LUALIB_API void (luaL_checkstack) (lua_State *L, int sz, const char *msg);
LUALIB_API void (luaL_checktype) (lua_State *L, int narg, int t);
LUALIB_API void (luaL_checkany) (lua_State *L, int narg);

LUALIB_API int   (luaL_newmetatable) (lua_State *L, const char *tname);
LUALIB_API void *(luaL_checkudata) (lua_State *L, int ud, const char *tname);

LUALIB_API void (luaL_where) (lua_State *L, int lvl);
LUALIB_API int (luaL_error) (lua_State *L, const char *fmt, ...);

LUALIB_API int (luaL_loadfile) (lua_State *L, const char *filename);
LUALIB_API int (luaL_loadbuffer) (lua_State *L, const char *buff, size_t sz,
                                  const char *name);
LUALIB_API int (luaL_loadstring) (lua_State *L, const char *s);

LUALIB_API lua_State *(luaL_newstate) (void);

LUALIB_API const char *(luaL_gsub) (lua_State *L, const char *s, const char *p,
                                                  const char *r);

LUALIB_API const char *(luaL_findtable) (lua_State *L, int idx,
                                         const char *fname, int szhint);

/*
** ===============================================================
** some useful macros
** ===============================================================
*/

#define luaL_argcheck(L, cond,numarg,extramsg) if (!(cond)) \
                                               luaL_argerror(L, (numarg), (extramsg))
#define luaL_checkstring(L,n)	(luaL_checklstring(L, (n), NULL))
#define luaL_optstring(L,n,d)	(luaL_optlstring(L, (n), (d), NULL))
#define luaL_checkint(L,n)	((int)luaL_checkinteger(L, (n)))
#define luaL_optint(L,n,d)	((int)luaL_optinteger(L, (n), (d)))
#define luaL_checklong(L,n)	((long)luaL_checkinteger(L, (n)))
#define luaL_optlong(L,n,d)	((long)luaL_optinteger(L, (n), (d)))

#define luaL_typename(L,i)	lua_typename(L, lua_type(L,(i)))

#define luaL_dofile(L, fn) \
	(luaL_loadfile(L, fn) || lua_pcall(L, 0, LUA_MULTRET, 0))

#define luaL_dostring(L, s) \
	(luaL_loadstring(L, s) || lua_pcall(L, 0, LUA_MULTRET, 0))

#define luaL_getmetatable(L,n)	(lua_getfield(L, LUA_REGISTRYINDEX, (n)))

#endif

/*
** Configuration file for Lua/LuaJIT
*/

#ifndef lualib_conf_h
#define lualib_conf_h

#include <limits.h>
#include <stddef.h>

#define LUA_NUMBER_DOUBLE
typedef double LUA_NUMBER;
typedef ptrdiff_t LUA_INTEGER;

#define LUA_API extern
#define LUALIB_API LUA_API

#define LUAI_MAXSTACK	65500
#define LUAI_MAXCSTACK	8000

#define LUA_IDSIZE	60

#endif

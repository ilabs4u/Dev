/*
** LuaJIT -- a Just-In-Time Compiler for Lua. http://luajit.org/
**
** LuaJIT C API extensions.
*/

#ifndef _LUAJIT_H
#define _LUAJIT_H

#include "lua.h"

#define LUAJIT_VERSION		"LuaJIT 2.1.0-beta3"
#define LUAJIT_VERSION_NUM	20100	/* Version 2.1.0 = 02.01.00. */
#define LUAJIT_VERSION_SYM	luaJIT_version_2_1_0_beta3
#define LUAJIT_COPYRIGHT	"Copyright (C) 2005-2023 Mike Pall"
#define LUAJIT_URL		"http://luajit.org/"

/* Modes for luaJIT_setmode. */
#define LUAJIT_MODE_MASK	0x00ff

enum {
  LUAJIT_MODE_ENGINE,		/* Set mode for whole JIT engine. */
  LUAJIT_MODE_DEBUG,		/* Set debug mode (idx = level). */
  LUAJIT_MODE_FUNC,		/* Change mode for a function. */
  LUAJIT_MODE_ALLFUNC,		/* Recurse into subroutine protos. */
  LUAJIT_MODE_ALLSUBFUNC,	/* Change only the subroutines. */
  LUAJIT_MODE_TRACE,		/* Flush a compiled trace. */
  LUAJIT_MODE_WRAP = 0x10	/* Wrap PCall into pcall. */
};

/* Flags or'ed in to the mode. */
#define LUAJIT_MODE_OFF		0x0000	/* Turn feature off. */
#define LUAJIT_MODE_ON		0x0100	/* Turn feature on. */
#define LUAJIT_MODE_FLUSH	0x0200	/* Flush JIT-compiled code. */

/* Control the JIT engine. */
LUA_API int luaJIT_setmode(lua_State *L, int idx, int mode);

#endif

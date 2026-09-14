--[[
	ServerMain.server.lua
	Punto de entrada único del servidor. Controla el ORDEN de inicialización, que importa:
	los remotos deben existir antes de que los demás servicios los usen, y el catálogo debe
	existir antes de construir el vestíbulo.
]]

local Services = script.Parent.Services

local RemotesService = require(Services.RemotesService)
local PlayerDataService = require(Services.PlayerDataService)
local CatalogService = require(Services.CatalogService)
local ExamService = require(Services.ExamService)
local DiagnosticService = require(Services.DiagnosticService)
local HubBuilderService = require(Services.HubBuilderService)

local remotes = RemotesService.Init()

PlayerDataService.Init()
CatalogService.Init(remotes)
ExamService.Init(remotes)
DiagnosticService.Init(remotes)

HubBuilderService.Init()

print("[ConectaEscuela] Servidor inicializado: materias, exámenes, diagnóstico y vestíbulo listos.")

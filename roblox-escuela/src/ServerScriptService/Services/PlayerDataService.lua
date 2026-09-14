--[[
	PlayerDataService.lua
	Guarda y carga el progreso de cada jugador (por materia: nivel desbloqueado, niveles
	completados, mejor puntaje y si ya hizo el diagnóstico). Usa DataStoreService directo
	con reintentos; si el estudio crece mucho conviene migrar a ProfileService, pero esto
	es robusto para producción pequeña/mediana.
]]

local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")

local STORE_NAME = "ConectaEscuela_Progreso_v1"
local AUTOSAVE_INTERVAL = 120 -- segundos
local MAX_RETRIES = 3

local PlayerDataService = {}
PlayerDataService.Store = DataStoreService:GetDataStore(STORE_NAME)
PlayerDataService.Cache = {} -- [userId] = profileTable
PlayerDataService.Dirty = {} -- [userId] = true si hay cambios sin guardar

local function defaultProfile()
	return {
		Subjects = {}, -- [subjectId] = { UnlockedIndex = 1, Completed = {}, Scores = {}, DiagnosticDone = false }
	}
end

local function withRetries(fn)
	local lastErr
	for attempt = 1, MAX_RETRIES do
		local ok, result = pcall(fn)
		if ok then
			return true, result
		end
		lastErr = result
		task.wait(attempt * 0.75)
	end
	return false, lastErr
end

function PlayerDataService.GetSubjectProgress(player, subjectId)
	local profile = PlayerDataService.Cache[player.UserId]
	if not profile then
		return nil
	end
	if not profile.Subjects[subjectId] then
		profile.Subjects[subjectId] = {
			UnlockedIndex = 1,
			Completed = {},
			Scores = {},
			DiagnosticDone = false,
		}
	end
	return profile.Subjects[subjectId]
end

function PlayerDataService.MarkDirty(player)
	PlayerDataService.Dirty[player.UserId] = true
end

function PlayerDataService.Load(player)
	local key = "user_" .. player.UserId
	local ok, data = withRetries(function()
		return PlayerDataService.Store:GetAsync(key)
	end)

	if ok and data then
		PlayerDataService.Cache[player.UserId] = data
	else
		PlayerDataService.Cache[player.UserId] = defaultProfile()
	end
end

function PlayerDataService.Save(player)
	local profile = PlayerDataService.Cache[player.UserId]
	if not profile then
		return
	end
	local key = "user_" .. player.UserId
	local ok = withRetries(function()
		return PlayerDataService.Store:SetAsync(key, profile)
	end)
	if ok then
		PlayerDataService.Dirty[player.UserId] = nil
	else
		warn(("[PlayerDataService] No se pudo guardar el progreso de %s"):format(player.Name))
	end
end

function PlayerDataService.Init()
	Players.PlayerAdded:Connect(function(player)
		PlayerDataService.Load(player)
	end)

	Players.PlayerRemoving:Connect(function(player)
		PlayerDataService.Save(player)
		PlayerDataService.Cache[player.UserId] = nil
		PlayerDataService.Dirty[player.UserId] = nil
	end)

	-- por si el servicio arranca después de que algún jugador ya entró (raro, pero seguro)
	for _, player in ipairs(Players:GetPlayers()) do
		if not PlayerDataService.Cache[player.UserId] then
			PlayerDataService.Load(player)
		end
	end

	task.spawn(function()
		while true do
			task.wait(AUTOSAVE_INTERVAL)
			for userId, isDirty in pairs(PlayerDataService.Dirty) do
				if isDirty then
					local player = Players:GetPlayerByUserId(userId)
					if player then
						PlayerDataService.Save(player)
					end
				end
			end
		end
	end)

	game:BindToClose(function()
		for _, player in ipairs(Players:GetPlayers()) do
			PlayerDataService.Save(player)
		end
	end)
end

return PlayerDataService

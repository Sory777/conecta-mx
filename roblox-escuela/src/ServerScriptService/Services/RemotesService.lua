--[[
	RemotesService.lua
	Crea la carpeta ReplicatedStorage.Remotes con todos los RemoteFunctions que usa el juego.
	Debe inicializarse ANTES que cualquier otro servicio.
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local RemotesService = {}

local REMOTE_NAMES = {
	"RF_GetCatalog",
	"RF_GetProgress",
	"RF_SubmitExam",
	"RF_StartDiagnostic",
	"RF_SubmitDiagnostic",
}

function RemotesService.Init()
	local folder = ReplicatedStorage:FindFirstChild("Remotes")
	if not folder then
		folder = Instance.new("Folder")
		folder.Name = "Remotes"
		folder.Parent = ReplicatedStorage
	end

	local remotes = {}
	for _, remoteName in ipairs(REMOTE_NAMES) do
		local remote = folder:FindFirstChild(remoteName)
		if not remote then
			remote = Instance.new("RemoteFunction")
			remote.Name = remoteName
			remote.Parent = folder
		end
		remotes[remoteName] = remote
	end

	RemotesService.Remotes = remotes
	return remotes
end

return RemotesService

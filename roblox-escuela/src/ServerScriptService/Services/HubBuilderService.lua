--[[
	HubBuilderService.lua
	Construye un vestíbulo mínimo jugable de inmediato: una plaza + un kiosco por materia,
	cada uno con un ProximityPrompt que el cliente detecta para abrir el menú de esa
	materia. Es un placeholder funcional: puedes borrar estas partes en Studio y poner tu
	propia escuela modelada a mano, siempre y cuando cada kiosco final conserve el
	atributo "SubjectId" y un ProximityPrompt llamado "StudyPrompt".
]]

local CatalogService = require(script.Parent.CatalogService)

local HubBuilderService = {}

local KIOSK_SIZE = Vector3.new(6, 8, 6)
local KIOSK_SPACING = 14

local function createBaseplate()
	if workspace:FindFirstChild("EscuelaPlaza") then
		return
	end
	local plaza = Instance.new("Part")
	plaza.Name = "EscuelaPlaza"
	plaza.Anchored = true
	plaza.Size = Vector3.new(200, 1, 100)
	plaza.Position = Vector3.new(0, 0, 0)
	plaza.Color = Color3.fromRGB(180, 210, 180)
	plaza.Material = Enum.Material.Grass
	plaza.Parent = workspace
end

local function createKiosk(subject, index, total)
	local existing = workspace:FindFirstChild("Kiosco_" .. subject.Id)
	if existing then
		existing:Destroy()
	end

	local totalWidth = (total - 1) * KIOSK_SPACING
	local x = -totalWidth / 2 + (index - 1) * KIOSK_SPACING

	local part = Instance.new("Part")
	part.Name = "Kiosco_" .. subject.Id
	part.Anchored = true
	part.Size = KIOSK_SIZE
	part.Position = Vector3.new(x, KIOSK_SIZE.Y / 2 + 0.5, -20)
	part.Color = Color3.fromRGB(90, 140, 220)
	part.Material = Enum.Material.SmoothPlastic
	part:SetAttribute("SubjectId", subject.Id)
	part.Parent = workspace

	local billboard = Instance.new("BillboardGui")
	billboard.Name = "Etiqueta"
	billboard.Size = UDim2.new(0, 220, 0, 70)
	billboard.StudsOffset = Vector3.new(0, KIOSK_SIZE.Y / 2 + 2, 0)
	billboard.AlwaysOnTop = true
	billboard.Parent = part

	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 0.25
	label.BackgroundColor3 = Color3.fromRGB(20, 20, 30)
	label.TextColor3 = Color3.new(1, 1, 1)
	label.TextScaled = true
	label.Font = Enum.Font.FredokaOne
	label.Text = (subject.Icon or "") .. " " .. subject.Name
	label.Parent = billboard

	local prompt = Instance.new("ProximityPrompt")
	prompt.Name = "StudyPrompt"
	prompt.ActionText = "Estudiar"
	prompt.ObjectText = subject.Name
	prompt.HoldDuration = 0.3
	prompt.MaxActivationDistance = 10
	prompt.Parent = part
end

function HubBuilderService.Init()
	createBaseplate()
	local catalog = CatalogService.GetPublicCatalog()
	for index, subject in ipairs(catalog.Subjects) do
		createKiosk(subject, index, #catalog.Subjects)
	end
end

return HubBuilderService

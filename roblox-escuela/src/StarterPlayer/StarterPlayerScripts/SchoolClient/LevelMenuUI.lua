--[[
	LevelMenuUI.lua
	Lista de temas/niveles de una materia con su estado: 🔒 bloqueado, 🔓 disponible o
	✅ completado (con el mejor puntaje). Si la materia tiene diagnóstico activo (hoy solo
	Matemáticas) y el jugador aún no lo ha hecho, ofrece el botón de examen de colocación
	antes de la lista normal.
]]

local UIUtil = require(script.Parent.UIUtil)

local LevelMenuUI = {}

function LevelMenuUI.Init(root)
	LevelMenuUI.Frame = UIUtil.New("Frame", {
		Name = "LevelMenuFrame",
		Size = UDim2.fromScale(0.5, 0.8),
		Position = UDim2.fromScale(0.5, 0.5),
		AnchorPoint = Vector2.new(0.5, 0.5),
		BackgroundColor3 = Color3.fromRGB(25, 25, 35),
		Visible = false,
		Parent = root,
	})
	UIUtil.Round(LevelMenuUI.Frame, 16)
	UIUtil.Padding(LevelMenuUI.Frame, 16)

	LevelMenuUI.Title = UIUtil.New("TextLabel", {
		Size = UDim2.new(1, 0, 0, 44),
		BackgroundTransparency = 1,
		TextColor3 = Color3.new(1, 1, 1),
		Font = Enum.Font.FredokaOne,
		TextScaled = true,
		Text = "Materia",
		Parent = LevelMenuUI.Frame,
	})

	LevelMenuUI.CloseButton = UIUtil.New("TextButton", {
		Size = UDim2.new(0, 32, 0, 32),
		Position = UDim2.new(1, -32, 0, 0),
		BackgroundColor3 = Color3.fromRGB(180, 60, 60),
		TextColor3 = Color3.new(1, 1, 1),
		Font = Enum.Font.GothamBold,
		TextScaled = true,
		Text = "X",
		Parent = LevelMenuUI.Frame,
	})
	UIUtil.Round(LevelMenuUI.CloseButton, 8)

	LevelMenuUI.DiagnosticBanner = UIUtil.New("TextButton", {
		Name = "DiagnosticBanner",
		Size = UDim2.new(1, 0, 0, 54),
		Position = UDim2.new(0, 0, 0, 50),
		BackgroundColor3 = Color3.fromRGB(230, 160, 40),
		TextColor3 = Color3.new(1, 1, 1),
		Font = Enum.Font.GothamBold,
		TextScaled = true,
		TextWrapped = true,
		Text = "🧠 ¿Ya sabes esto? Toma el examen de colocación",
		Visible = false,
		Parent = LevelMenuUI.Frame,
	})
	UIUtil.Round(LevelMenuUI.DiagnosticBanner, 10)

	LevelMenuUI.ScrollFrame = UIUtil.New("ScrollingFrame", {
		Size = UDim2.new(1, 0, 1, -114),
		Position = UDim2.new(0, 0, 0, 60),
		BackgroundTransparency = 1,
		CanvasSize = UDim2.new(0, 0, 0, 0),
		AutomaticCanvasSize = Enum.AutomaticSize.Y,
		ScrollBarThickness = 8,
		Parent = LevelMenuUI.Frame,
	})
	UIUtil.ListLayout(LevelMenuUI.ScrollFrame, 8)

	LevelMenuUI.CloseButton.MouseButton1Click:Connect(function()
		LevelMenuUI.Frame.Visible = false
	end)
end

local function statusInfo(level, index, progress)
	if progress.Completed[level.Id] then
		local score = progress.Scores[level.Id] or 0
		return "✅", true, ("Completado · %d%%"):format(math.floor(score * 100 + 0.5))
	elseif index <= progress.UnlockedIndex then
		return "🔓", true, "Disponible"
	else
		return "🔒", false, "Bloqueado"
	end
end

--- @param subject table catálogo público de la materia
--- @param progress table respuesta de RF_GetProgress
--- @param callbacks table { OnPickLevel(level, index), OnStartDiagnostic() }
function LevelMenuUI.Open(subject, progress, callbacks)
	LevelMenuUI.Title.Text = (subject.Icon or "") .. " " .. subject.Name
	UIUtil.ClearChildren(LevelMenuUI.ScrollFrame)

	local showDiagnostic = subject.Diagnostic and not progress.DiagnosticDone
	LevelMenuUI.DiagnosticBanner.Visible = showDiagnostic
	if LevelMenuUI.DiagnosticConnection then
		LevelMenuUI.DiagnosticConnection:Disconnect()
		LevelMenuUI.DiagnosticConnection = nil
	end
	if showDiagnostic then
		LevelMenuUI.DiagnosticConnection = LevelMenuUI.DiagnosticBanner.MouseButton1Click:Connect(function()
			LevelMenuUI.Frame.Visible = false
			callbacks.OnStartDiagnostic()
		end)
	end
	LevelMenuUI.ScrollFrame.Position = UDim2.new(0, 0, 0, showDiagnostic and 114 or 60)
	LevelMenuUI.ScrollFrame.Size = UDim2.new(1, 0, 1, showDiagnostic and -168 or -114)

	for index, level in ipairs(subject.Levels) do
		local icon, enabled, statusText = statusInfo(level, index, progress)

		local button = UIUtil.New("TextButton", {
			Name = "Level_" .. level.Id,
			Size = UDim2.new(1, 0, 0, 54),
			BackgroundColor3 = enabled and Color3.fromRGB(45, 45, 60) or Color3.fromRGB(32, 32, 40),
			AutoButtonColor = enabled,
			TextColor3 = enabled and Color3.new(1, 1, 1) or Color3.fromRGB(130, 130, 140),
			Font = Enum.Font.Gotham,
			TextScaled = true,
			TextXAlignment = Enum.TextXAlignment.Left,
			Text = ("  %s  %s (%s) — %s"):format(icon, level.Name, level.Grade, statusText),
			LayoutOrder = index,
			Parent = LevelMenuUI.ScrollFrame,
		})
		UIUtil.Round(button, 8)
		UIUtil.Padding(button, 6)

		if enabled then
			button.MouseButton1Click:Connect(function()
				LevelMenuUI.Frame.Visible = false
				callbacks.OnPickLevel(level, index)
			end)
		end
	end

	LevelMenuUI.Frame.Visible = true
end

return LevelMenuUI

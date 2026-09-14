--[[
	TutorialUI.lua
	Pantalla de video tutorial que se muestra ANTES del examen de cada tema. Roblox no
	permite incrustar YouTube: el video debe subirse como asset propio desde el Creator
	Dashboard y su rbxassetid va en SubjectData.VideoId. Mientras no exista, se avisa y se
	deja pasar directo al examen para no trabar el avance del alumno.
]]

local UIUtil = require(script.Parent.UIUtil)

local TutorialUI = {}

function TutorialUI.Init(root)
	TutorialUI.Frame = UIUtil.New("Frame", {
		Name = "TutorialFrame",
		Size = UDim2.fromScale(0.6, 0.7),
		Position = UDim2.fromScale(0.5, 0.5),
		AnchorPoint = Vector2.new(0.5, 0.5),
		BackgroundColor3 = Color3.fromRGB(25, 25, 35),
		Visible = false,
		Parent = root,
	})
	UIUtil.Round(TutorialUI.Frame, 16)
	UIUtil.Padding(TutorialUI.Frame, 18)

	TutorialUI.Title = UIUtil.New("TextLabel", {
		Size = UDim2.new(1, 0, 0, 40),
		BackgroundTransparency = 1,
		TextColor3 = Color3.new(1, 1, 1),
		TextScaled = true,
		Font = Enum.Font.FredokaOne,
		Text = "Video tutorial",
		Parent = TutorialUI.Frame,
	})

	TutorialUI.VideoHolder = UIUtil.New("Frame", {
		Size = UDim2.new(1, 0, 1, -110),
		Position = UDim2.new(0, 0, 0, 50),
		BackgroundColor3 = Color3.fromRGB(0, 0, 0),
		Parent = TutorialUI.Frame,
	})
	UIUtil.Round(TutorialUI.VideoHolder, 10)

	TutorialUI.Placeholder = UIUtil.New("TextLabel", {
		Size = UDim2.fromScale(1, 1),
		BackgroundTransparency = 1,
		TextColor3 = Color3.fromRGB(200, 200, 210),
		TextWrapped = true,
		TextScaled = true,
		Font = Enum.Font.Gotham,
		Text = "Video próximamente. Puedes continuar al examen.",
		Parent = TutorialUI.VideoHolder,
	})

	TutorialUI.ContinueButton = UIUtil.New("TextButton", {
		Size = UDim2.new(1, 0, 0, 46),
		Position = UDim2.new(0, 0, 1, -46),
		BackgroundColor3 = Color3.fromRGB(70, 170, 90),
		TextColor3 = Color3.new(1, 1, 1),
		Font = Enum.Font.GothamBold,
		TextScaled = true,
		Text = "Continuar al examen ▶",
		Parent = TutorialUI.Frame,
	})
	UIUtil.Round(TutorialUI.ContinueButton, 10)
end

--- @param level table El nivel público (con VideoId, Name)
--- @param onContinue function Se llama cuando el alumno decide pasar al examen
function TutorialUI.Open(level, onContinue)
	TutorialUI.Title.Text = "📺 " .. level.Name

	if TutorialUI.CurrentVideo then
		TutorialUI.CurrentVideo:Destroy()
		TutorialUI.CurrentVideo = nil
	end

	if level.VideoId and level.VideoId ~= "" then
		TutorialUI.Placeholder.Visible = false
		local video = Instance.new("VideoFrame")
		video.Size = UDim2.fromScale(1, 1)
		video.Video = level.VideoId
		video.BackgroundColor3 = Color3.new(0, 0, 0)
		video.Parent = TutorialUI.VideoHolder
		TutorialUI.CurrentVideo = video
		video:Play()
	else
		TutorialUI.Placeholder.Visible = true
	end

	local connection
	connection = TutorialUI.ContinueButton.MouseButton1Click:Connect(function()
		connection:Disconnect()
		TutorialUI.Frame.Visible = false
		if TutorialUI.CurrentVideo then
			TutorialUI.CurrentVideo:Stop()
		end
		onContinue()
	end)

	TutorialUI.Frame.Visible = true
end

return TutorialUI

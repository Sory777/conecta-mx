--[[
	ResultUI.lua
	Pantalla simple de mensaje/resultado (aprobado, reprobado, resumen del diagnóstico)
	con un botón para continuar.
]]

local UIUtil = require(script.Parent.UIUtil)

local ResultUI = {}

function ResultUI.Init(root)
	ResultUI.Frame = UIUtil.New("Frame", {
		Name = "ResultFrame",
		Size = UDim2.fromScale(0.5, 0.45),
		Position = UDim2.fromScale(0.5, 0.5),
		AnchorPoint = Vector2.new(0.5, 0.5),
		BackgroundColor3 = Color3.fromRGB(25, 25, 35),
		Visible = false,
		Parent = root,
	})
	UIUtil.Round(ResultUI.Frame, 16)
	UIUtil.Padding(ResultUI.Frame, 18)
	UIUtil.ListLayout(ResultUI.Frame, 12)

	ResultUI.Title = UIUtil.New("TextLabel", {
		Size = UDim2.new(1, 0, 0, 50),
		BackgroundTransparency = 1,
		TextColor3 = Color3.new(1, 1, 1),
		Font = Enum.Font.FredokaOne,
		TextScaled = true,
		Text = "",
		LayoutOrder = 1,
		Parent = ResultUI.Frame,
	})

	ResultUI.Body = UIUtil.New("TextLabel", {
		Size = UDim2.new(1, 0, 1, -110),
		BackgroundTransparency = 1,
		TextColor3 = Color3.fromRGB(220, 220, 230),
		Font = Enum.Font.Gotham,
		TextScaled = true,
		TextWrapped = true,
		Text = "",
		LayoutOrder = 2,
		Parent = ResultUI.Frame,
	})

	ResultUI.ContinueButton = UIUtil.New("TextButton", {
		Size = UDim2.new(1, 0, 0, 46),
		BackgroundColor3 = Color3.fromRGB(70, 130, 220),
		TextColor3 = Color3.new(1, 1, 1),
		Font = Enum.Font.GothamBold,
		TextScaled = true,
		Text = "Continuar",
		LayoutOrder = 3,
		Parent = ResultUI.Frame,
	})
	UIUtil.Round(ResultUI.ContinueButton, 10)
end

function ResultUI.Open(title, body, buttonText, onContinue)
	ResultUI.Title.Text = title
	ResultUI.Body.Text = body
	ResultUI.ContinueButton.Text = buttonText or "Continuar"

	if ResultUI.Connection then
		ResultUI.Connection:Disconnect()
	end
	ResultUI.Connection = ResultUI.ContinueButton.MouseButton1Click:Connect(function()
		ResultUI.Connection:Disconnect()
		ResultUI.Connection = nil
		ResultUI.Frame.Visible = false
		if onContinue then
			onContinue()
		end
	end)

	ResultUI.Frame.Visible = true
end

return ResultUI

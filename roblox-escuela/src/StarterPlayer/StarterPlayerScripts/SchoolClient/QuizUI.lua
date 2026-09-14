--[[
	QuizUI.lua
	Componente genérico de "examen": pinta una lista de preguntas de opción múltiple con
	scroll y un botón de enviar. Lo usan tanto el examen normal de cada tema (ExamUI) como
	el examen de diagnóstico de Matemáticas (DiagnosticUI), para no duplicar la UI.
]]

local UIUtil = require(script.Parent.UIUtil)

local SELECTED_COLOR = Color3.fromRGB(70, 130, 220)
local DEFAULT_COLOR = Color3.fromRGB(45, 45, 60)

local QuizUI = {}

function QuizUI.Init(root)
	QuizUI.Frame = UIUtil.New("Frame", {
		Name = "QuizFrame",
		Size = UDim2.fromScale(0.7, 0.85),
		Position = UDim2.fromScale(0.5, 0.5),
		AnchorPoint = Vector2.new(0.5, 0.5),
		BackgroundColor3 = Color3.fromRGB(25, 25, 35),
		Visible = false,
		Parent = root,
	})
	UIUtil.Round(QuizUI.Frame, 16)
	UIUtil.Padding(QuizUI.Frame, 16)

	QuizUI.Title = UIUtil.New("TextLabel", {
		Size = UDim2.new(1, 0, 0, 36),
		BackgroundTransparency = 1,
		TextColor3 = Color3.new(1, 1, 1),
		Font = Enum.Font.FredokaOne,
		TextScaled = true,
		Text = "Examen",
		Parent = QuizUI.Frame,
	})

	QuizUI.ScrollFrame = UIUtil.New("ScrollingFrame", {
		Size = UDim2.new(1, 0, 1, -96),
		Position = UDim2.new(0, 0, 0, 44),
		BackgroundTransparency = 1,
		CanvasSize = UDim2.new(0, 0, 0, 0),
		AutomaticCanvasSize = Enum.AutomaticSize.Y,
		ScrollBarThickness = 8,
		Parent = QuizUI.Frame,
	})
	UIUtil.ListLayout(QuizUI.ScrollFrame, 14)

	QuizUI.SubmitButton = UIUtil.New("TextButton", {
		Size = UDim2.new(1, 0, 0, 46),
		Position = UDim2.new(0, 0, 1, -46),
		BackgroundColor3 = Color3.fromRGB(70, 170, 90),
		TextColor3 = Color3.new(1, 1, 1),
		Font = Enum.Font.GothamBold,
		TextScaled = true,
		Text = "Enviar respuestas ✔",
		Parent = QuizUI.Frame,
	})
	UIUtil.Round(QuizUI.SubmitButton, 10)
end

local function buildQuestionCard(index, questionData, answers)
	local card = UIUtil.New("Frame", {
		Name = "Question" .. index,
		Size = UDim2.new(1, -16, 0, 160),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundColor3 = Color3.fromRGB(35, 35, 48),
		LayoutOrder = index,
	})
	UIUtil.Round(card, 10)
	UIUtil.Padding(card, 12)

	local layout = UIUtil.ListLayout(card, 8)
	layout.HorizontalAlignment = Enum.HorizontalAlignment.Left

	UIUtil.New("TextLabel", {
		Size = UDim2.new(1, 0, 0, 30),
		BackgroundTransparency = 1,
		TextColor3 = Color3.new(1, 1, 1),
		Font = Enum.Font.GothamBold,
		TextScaled = true,
		TextXAlignment = Enum.TextXAlignment.Left,
		TextWrapped = true,
		Text = ("%d. %s"):format(index, questionData.Text),
		LayoutOrder = 0,
		Parent = card,
	})

	local optionButtons = {}
	for optIndex, optionText in ipairs(questionData.Options) do
		local button = UIUtil.New("TextButton", {
			Size = UDim2.new(1, 0, 0, 34),
			BackgroundColor3 = DEFAULT_COLOR,
			TextColor3 = Color3.new(1, 1, 1),
			Font = Enum.Font.Gotham,
			TextScaled = true,
			Text = optionText,
			LayoutOrder = optIndex,
			Parent = card,
		})
		UIUtil.Round(button, 8)
		optionButtons[optIndex] = button

		button.MouseButton1Click:Connect(function()
			answers[index] = optIndex
			for i, otherButton in ipairs(optionButtons) do
				otherButton.BackgroundColor3 = (i == optIndex) and SELECTED_COLOR or DEFAULT_COLOR
			end
		end)
	end

	return card
end

--- @param title string
--- @param questions table lista de { Text, Options }
--- @param onSubmit function(answers) -- answers[i] = índice elegido o nil si no contestó
function QuizUI.Open(title, questions, onSubmit)
	QuizUI.Title.Text = title
	UIUtil.ClearChildren(QuizUI.ScrollFrame)

	local answers = {}
	for i, questionData in ipairs(questions) do
		local card = buildQuestionCard(i, questionData, answers)
		card.Parent = QuizUI.ScrollFrame
	end

	if QuizUI.SubmitConnection then
		QuizUI.SubmitConnection:Disconnect()
	end
	QuizUI.SubmitConnection = QuizUI.SubmitButton.MouseButton1Click:Connect(function()
		QuizUI.SubmitConnection:Disconnect()
		QuizUI.SubmitConnection = nil
		QuizUI.Frame.Visible = false
		onSubmit(answers)
	end)

	QuizUI.Frame.Visible = true
end

function QuizUI.Close()
	QuizUI.Frame.Visible = false
end

return QuizUI

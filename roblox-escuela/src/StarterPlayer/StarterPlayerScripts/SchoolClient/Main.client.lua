--[[
	Main.client.lua
	Punto de entrada del cliente: construye la interfaz, escucha los kioscos del vestíbulo
	(ProximityPrompt) y orquesta el flujo completo de cada materia:

	  Kiosco -> Menú de niveles -> [examen de diagnóstico si aplica] -> Video tutorial
	  -> Examen -> Resultado -> vuelve al menú de niveles actualizado.
]]

local Players = game:GetService("Players")
local ProximityPromptService = game:GetService("ProximityPromptService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local remotesFolder = ReplicatedStorage:WaitForChild("Remotes")
local RF_GetCatalog = remotesFolder:WaitForChild("RF_GetCatalog")
local RF_GetProgress = remotesFolder:WaitForChild("RF_GetProgress")
local RF_SubmitExam = remotesFolder:WaitForChild("RF_SubmitExam")
local RF_StartDiagnostic = remotesFolder:WaitForChild("RF_StartDiagnostic")
local RF_SubmitDiagnostic = remotesFolder:WaitForChild("RF_SubmitDiagnostic")

local LevelMenuUI = require(script.Parent.LevelMenuUI)
local TutorialUI = require(script.Parent.TutorialUI)
local QuizUI = require(script.Parent.QuizUI)
local ResultUI = require(script.Parent.ResultUI)

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "EscuelaGui"
screenGui.ResetOnSpawn = false
screenGui.IgnoreGuiInset = true
screenGui.Parent = playerGui

LevelMenuUI.Init(screenGui)
TutorialUI.Init(screenGui)
QuizUI.Init(screenGui)
ResultUI.Init(screenGui)

local catalog = RF_GetCatalog:InvokeServer()

local function findSubject(subjectId)
	for _, subject in ipairs(catalog.Subjects) do
		if subject.Id == subjectId then
			return subject
		end
	end
	return nil
end

local function openLevelMenu(subjectId)
	local subject = findSubject(subjectId)
	if not subject then
		warn("[EscuelaGui] Materia desconocida:", subjectId)
		return
	end

	local progress = RF_GetProgress:InvokeServer(subjectId)
	if not progress then
		warn("[EscuelaGui] No se pudo obtener el progreso de", subjectId)
		return
	end

	LevelMenuUI.Open(subject, progress, {
		OnPickLevel = function(level)
			TutorialUI.Open(level, function()
				QuizUI.Open(level.Name, level.Questions, function(answers)
					local result = RF_SubmitExam:InvokeServer(subjectId, level.Id, answers)
					if not result or not result.Ok then
						ResultUI.Open("Ups", "No se pudo calificar el examen. Intenta de nuevo.", "Volver", function()
							openLevelMenu(subjectId)
						end)
						return
					end

					local pct = math.floor(result.Score * 100 + 0.5)
					if result.Passed then
						ResultUI.Open(
							"✅ ¡Aprobado!",
							("Sacaste %d/%d (%d%%). ¡Buen trabajo! Se desbloqueó el siguiente tema."):format(
								result.Correct,
								result.Total,
								pct
							),
							"Continuar",
							function()
								openLevelMenu(subjectId)
							end
						)
					else
						ResultUI.Open(
							"❌ Casi",
							("Sacaste %d/%d (%d%%). Necesitas repasar un poco más. Puedes ver el video de nuevo e intentarlo otra vez."):format(
								result.Correct,
								result.Total,
								pct
							),
							"Reintentar",
							function()
								openLevelMenu(subjectId)
							end
						)
					end
				end)
			end)
		end,

		OnStartDiagnostic = function()
			local session = RF_StartDiagnostic:InvokeServer(subjectId)
			if not session or not session.Ok then
				ResultUI.Open("Ups", "No se pudo iniciar el examen de diagnóstico.", "Volver", function()
					openLevelMenu(subjectId)
				end)
				return
			end

			QuizUI.Open("🧠 Examen de diagnóstico — " .. session.SubjectName, session.Items, function(answers)
				local placement = RF_SubmitDiagnostic:InvokeServer(subjectId, answers)
				if not placement or not placement.Ok then
					ResultUI.Open("Ups", "No se pudo calificar el diagnóstico.", "Volver", function()
						openLevelMenu(subjectId)
					end)
					return
				end

				local masteredCount = #placement.MasteredLevelIds
				local body
				if placement.PlacedAtLevelId then
					local placedLevelName = placement.PlacedAtLevelId
					for _, lvl in ipairs(subject.Levels) do
						if lvl.Id == placement.PlacedAtLevelId then
							placedLevelName = lvl.Name
							break
						end
					end
					body = ("Ya dominas %d tema(s). Te colocamos justo en: %s."):format(
						masteredCount,
						placedLevelName
					)
				else
					body = ("¡Wow! Ya dominas los %d temas de esta materia."):format(masteredCount)
				end

				ResultUI.Open("🎯 Resultado del diagnóstico", body, "Ver mis temas", function()
					openLevelMenu(subjectId)
				end)
			end)
		end,
	})
end

ProximityPromptService.PromptTriggered:Connect(function(prompt)
	if prompt.Name ~= "StudyPrompt" then
		return
	end
	local subjectId = prompt.Parent and prompt.Parent:GetAttribute("SubjectId")
	if subjectId then
		openLevelMenu(subjectId)
	end
end)

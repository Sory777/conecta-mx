--[[
	ExamService.lua
	Valida y califica exámenes SIEMPRE en el servidor (nunca confiar en el resultado que
	mande el cliente). También expone el progreso del jugador para pintar la UI
	(candados / completado / puntaje) y aplica la regla de desbloqueo secuencial:
	un nivel solo se puede examinar si su índice es <= UnlockedIndex del jugador.
]]

local CatalogService = require(script.Parent.CatalogService)
local PlayerDataService = require(script.Parent.PlayerDataService)

local ExamService = {}

local function gradeAnswers(level, answers)
	local total = #level.Questions
	local correctCount = 0

	for i, question in ipairs(level.Questions) do
		local given = answers[i]
		if type(given) == "number" and given == question.Correct then
			correctCount = correctCount + 1
		end
	end

	local score = total > 0 and (correctCount / total) or 0
	return score, correctCount, total
end

local function buildProgressSnapshot(subjectId)
	local subject = CatalogService.FindSubject(subjectId)
	local levelOrder = {}
	if subject then
		for i, level in ipairs(subject.Levels) do
			levelOrder[i] = level.Id
		end
	end
	return levelOrder
end

--- Devuelve una tabla lista para la UI: { UnlockedIndex, DiagnosticDone, Completed = {...}, Scores = {...}, LevelOrder = {ids en orden} }
function ExamService.GetProgressForClient(player, subjectId)
	local subjectProgress = PlayerDataService.GetSubjectProgress(player, subjectId)
	if not subjectProgress then
		return nil
	end
	return {
		UnlockedIndex = subjectProgress.UnlockedIndex,
		DiagnosticDone = subjectProgress.DiagnosticDone,
		Completed = subjectProgress.Completed,
		Scores = subjectProgress.Scores,
		LevelOrder = buildProgressSnapshot(subjectId),
	}
end

function ExamService.SubmitExam(player, subjectId, levelId, answers)
	local level, levelIndex = CatalogService.FindLevel(subjectId, levelId)
	if not level then
		return { Ok = false, Error = "NIVEL_NO_EXISTE" }
	end

	if type(answers) ~= "table" then
		return { Ok = false, Error = "RESPUESTAS_INVALIDAS" }
	end

	local subjectProgress = PlayerDataService.GetSubjectProgress(player, subjectId)
	if not subjectProgress then
		return { Ok = false, Error = "SIN_PERFIL" }
	end

	-- anti-exploit: no se puede examinar un nivel bloqueado aunque el cliente lo pida
	if levelIndex > subjectProgress.UnlockedIndex then
		return { Ok = false, Error = "NIVEL_BLOQUEADO" }
	end

	local score, correctCount, total = gradeAnswers(level, answers)
	local passed = score >= (level.PassScore or 0.7)

	if passed then
		subjectProgress.Completed[levelId] = true
		local bestScore = subjectProgress.Scores[levelId] or 0
		if score > bestScore then
			subjectProgress.Scores[levelId] = score
		end
		if levelIndex >= subjectProgress.UnlockedIndex then
			subjectProgress.UnlockedIndex = levelIndex + 1
		end
		PlayerDataService.MarkDirty(player)
	else
		local bestScore = subjectProgress.Scores[levelId] or 0
		if score > bestScore then
			subjectProgress.Scores[levelId] = score
			PlayerDataService.MarkDirty(player)
		end
	end

	return {
		Ok = true,
		Score = score,
		Correct = correctCount,
		Total = total,
		Passed = passed,
		Progress = ExamService.GetProgressForClient(player, subjectId),
	}
end

function ExamService.Init(remotes)
	remotes.RF_GetProgress.OnServerInvoke = function(player, subjectId)
		if type(subjectId) ~= "string" then
			return nil
		end
		return ExamService.GetProgressForClient(player, subjectId)
	end

	remotes.RF_SubmitExam.OnServerInvoke = function(player, subjectId, levelId, answers)
		if type(subjectId) ~= "string" or type(levelId) ~= "string" then
			return { Ok = false, Error = "PARAMETROS_INVALIDOS" }
		end
		local ok, result = pcall(ExamService.SubmitExam, player, subjectId, levelId, answers)
		if not ok then
			warn("[ExamService] Error calificando examen:", result)
			return { Ok = false, Error = "ERROR_SERVIDOR" }
		end
		return result
	end
end

return ExamService

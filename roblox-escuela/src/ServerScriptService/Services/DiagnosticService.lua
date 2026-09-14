--[[
	DiagnosticService.lua
	Examen de diagnóstico / colocación. HOY SOLO SE USA PARA MATEMÁTICAS (subject.Diagnostic
	== true en SubjectData), tal como se pidió: un niño puede ir en 2° de primaria pero ya
	dominar tablas y tablas salteadas, así que en vez de obligarlo a repasar desde el nivel 1
	de la materia, primero se le hacen un par de preguntas de cada tema (en orden, del más
	fácil al más difícil) y se le coloca automáticamente justo después del último tema que
	domina. El resto de las materias avanzan siempre de forma secuencial normal (sin esto).

	Regla de colocación:
	  Se recorren los niveles de la materia en orden. Si el jugador contesta bien TODAS las
	  preguntas de muestra de un nivel, ese nivel se marca como completado (dominado) y se
	  sigue al siguiente. En cuanto falla alguna pregunta de un nivel, ahí se detiene: ese
	  nivel queda como su nivel actual (tendrá que ver el video y presentar el examen normal).
	  Si domina todos los niveles, queda con la materia completa.
]]

local CatalogService = require(script.Parent.CatalogService)
local PlayerDataService = require(script.Parent.PlayerDataService)
local ExamService = require(script.Parent.ExamService)

local SAMPLE_SIZE_PER_LEVEL = 2

local DiagnosticService = {}
DiagnosticService.Sessions = {} -- [userId] = { SubjectId = str, Items = { {LevelId, LevelIndex, QuestionIndex}, ... } }

local function buildDiagnosticItems(subject)
	local items = {}
	for levelIndex, level in ipairs(subject.Levels) do
		local sampleCount = math.min(SAMPLE_SIZE_PER_LEVEL, #level.Questions)
		for questionIndex = 1, sampleCount do
			table.insert(items, {
				LevelId = level.Id,
				LevelIndex = levelIndex,
				QuestionIndex = questionIndex,
			})
		end
	end
	return items
end

function DiagnosticService.StartDiagnostic(player, subjectId)
	local subject = CatalogService.FindSubject(subjectId)
	if not subject or not subject.Diagnostic then
		return nil, "MATERIA_SIN_DIAGNOSTICO"
	end

	local subjectProgress = PlayerDataService.GetSubjectProgress(player, subjectId)
	if not subjectProgress then
		return nil, "SIN_PERFIL"
	end
	if subjectProgress.DiagnosticDone then
		return nil, "DIAGNOSTICO_YA_REALIZADO"
	end

	local items = buildDiagnosticItems(subject)
	DiagnosticService.Sessions[player.UserId] = {
		SubjectId = subjectId,
		Items = items,
	}

	local publicItems = {}
	for i, item in ipairs(items) do
		local level = subject.Levels[item.LevelIndex]
		local question = level.Questions[item.QuestionIndex]
		publicItems[i] = {
			LevelId = item.LevelId,
			LevelName = level.Name,
			Text = question.Text,
			Options = question.Options,
		}
	end

	return {
		SubjectId = subjectId,
		SubjectName = subject.Name,
		Items = publicItems,
	}
end

function DiagnosticService.SubmitDiagnostic(player, subjectId, answers)
	local session = DiagnosticService.Sessions[player.UserId]
	if not session or session.SubjectId ~= subjectId then
		return { Ok = false, Error = "SIN_SESION_ACTIVA" }
	end
	if type(answers) ~= "table" or #answers ~= #session.Items then
		return { Ok = false, Error = "RESPUESTAS_INVALIDAS" }
	end

	local subject = CatalogService.FindSubject(subjectId)
	if not subject then
		return { Ok = false, Error = "MATERIA_NO_EXISTE" }
	end

	-- resultado por nivel: ¿contestó bien TODAS las preguntas de muestra de ese nivel?
	local perLevelAllCorrect = {} -- [levelIndex] = true/false
	local perLevelSeen = {}

	for i, item in ipairs(session.Items) do
		local level = subject.Levels[item.LevelIndex]
		local question = level.Questions[item.QuestionIndex]
		local given = answers[i]
		local isCorrect = type(given) == "number" and given == question.Correct

		perLevelSeen[item.LevelIndex] = true
		if perLevelAllCorrect[item.LevelIndex] == nil then
			perLevelAllCorrect[item.LevelIndex] = isCorrect
		else
			perLevelAllCorrect[item.LevelIndex] = perLevelAllCorrect[item.LevelIndex] and isCorrect
		end
	end

	local subjectProgress = PlayerDataService.GetSubjectProgress(player, subjectId)
	local masteredLevelIds = {}
	local placedAtLevelId = nil
	local unlockedIndex = 1

	for levelIndex, level in ipairs(subject.Levels) do
		if perLevelAllCorrect[levelIndex] then
			subjectProgress.Completed[level.Id] = true
			subjectProgress.Scores[level.Id] = 1
			table.insert(masteredLevelIds, level.Id)
			unlockedIndex = levelIndex + 1
		else
			placedAtLevelId = level.Id
			break
		end
	end

	subjectProgress.UnlockedIndex = unlockedIndex
	subjectProgress.DiagnosticDone = true
	PlayerDataService.MarkDirty(player)
	DiagnosticService.Sessions[player.UserId] = nil

	return {
		Ok = true,
		MasteredLevelIds = masteredLevelIds,
		PlacedAtLevelId = placedAtLevelId, -- nil si dominó toda la materia
		Progress = ExamService.GetProgressForClient(player, subjectId),
	}
end

function DiagnosticService.Init(remotes)
	remotes.RF_StartDiagnostic.OnServerInvoke = function(player, subjectId)
		if type(subjectId) ~= "string" then
			return { Ok = false, Error = "PARAMETROS_INVALIDOS" }
		end
		local result, err = DiagnosticService.StartDiagnostic(player, subjectId)
		if not result then
			return { Ok = false, Error = err }
		end
		result.Ok = true
		return result
	end

	remotes.RF_SubmitDiagnostic.OnServerInvoke = function(player, subjectId, answers)
		if type(subjectId) ~= "string" then
			return { Ok = false, Error = "PARAMETROS_INVALIDOS" }
		end
		local ok, result = pcall(DiagnosticService.SubmitDiagnostic, player, subjectId, answers)
		if not ok then
			warn("[DiagnosticService] Error calificando diagnóstico:", result)
			return { Ok = false, Error = "ERROR_SERVIDOR" }
		end
		return result
	end

	game:GetService("Players").PlayerRemoving:Connect(function(player)
		DiagnosticService.Sessions[player.UserId] = nil
	end)
end

return DiagnosticService

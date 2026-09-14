--[[
	CatalogService.lua
	Convierte SubjectData (que incluye respuestas correctas) en una versión "pública"
	segura para enviar al cliente: SIN el campo `Correct`. Así ningún exploit puede leer
	las respuestas inspeccionando lo que llega por el remoto.
]]

local SubjectData = require(script.Parent.Parent.Data.SubjectData)

local CatalogService = {}

local cachedPublicCatalog = nil

local function sanitizeQuestion(question)
	return {
		Text = question.Text,
		Options = question.Options,
	}
end

local function sanitizeLevel(level)
	local questions = {}
	for i, q in ipairs(level.Questions) do
		questions[i] = sanitizeQuestion(q)
	end
	return {
		Id = level.Id,
		Name = level.Name,
		Grade = level.Grade,
		VideoId = level.VideoId,
		PassScore = level.PassScore,
		QuestionCount = #level.Questions,
		Questions = questions,
	}
end

local function buildPublicCatalog()
	local subjects = {}
	for i, subject in ipairs(SubjectData.Subjects) do
		local levels = {}
		for j, level in ipairs(subject.Levels) do
			levels[j] = sanitizeLevel(level)
		end
		subjects[i] = {
			Id = subject.Id,
			Name = subject.Name,
			Icon = subject.Icon,
			Diagnostic = subject.Diagnostic == true,
			Levels = levels,
		}
	end
	return { Subjects = subjects }
end

function CatalogService.GetPublicCatalog()
	if not cachedPublicCatalog then
		cachedPublicCatalog = buildPublicCatalog()
	end
	return cachedPublicCatalog
end

function CatalogService.FindSubject(subjectId)
	for _, subject in ipairs(SubjectData.Subjects) do
		if subject.Id == subjectId then
			return subject
		end
	end
	return nil
end

function CatalogService.FindLevel(subjectId, levelId)
	local subject = CatalogService.FindSubject(subjectId)
	if not subject then
		return nil, nil
	end
	for index, level in ipairs(subject.Levels) do
		if level.Id == levelId then
			return level, index
		end
	end
	return nil, nil
end

function CatalogService.Init(remotes)
	remotes.RF_GetCatalog.OnServerInvoke = function(_player)
		return CatalogService.GetPublicCatalog()
	end
end

return CatalogService

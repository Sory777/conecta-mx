--[[
	SubjectData.lua
	Fuente maestra de contenido educativo. Vive en ServerScriptService: NUNCA se replica
	al cliente, por eso es seguro guardar aquí las respuestas correctas ("Correct").

	Cómo agregar contenido nuevo:
	  - Una MATERIA nueva = un elemento más en la tabla `Subjects`.
	  - Un TEMA/NIVEL nuevo dentro de una materia = un elemento más en `Levels` de esa materia.
	    El orden en la lista ES el orden de desbloqueo (el jugador avanza de arriba hacia abajo).
	  - `Grade` es solo informativo (para mostrarlo en la UI: "2° primaria", "1° secundaria",
	    "3° preparatoria", "Universidad"), no controla el desbloqueo. Lo que controla el avance
	    es la posición en la lista `Levels`.
	  - `VideoId` debe ser un rbxassetid:// de un video SUBIDO por ti al Creator Dashboard de
	    Roblox (Roblox no permite incrustar YouTube ni ningún reproductor externo dentro del
	    juego). Mientras no subas el video, déjalo como cadena vacía: la UI mostrará un aviso
	    de "video próximamente" y dejará pasar al examen igual.
	  - `Diagnostic = true` en una materia activa el examen de diagnóstico de colocación
	    (hoy solo Matemáticas lo usa, tal como se pidió).
]]

local Subjects = {
	{
		Id = "matematicas",
		Name = "Matemáticas",
		Icon = "➗",
		Diagnostic = true,
		Levels = {
			{
				Id = "sumas_basicas",
				Name = "Sumas básicas",
				Grade = "1° Primaria",
				VideoId = "",
				PassScore = 0.7,
				Questions = {
					{ Text = "3 + 4 = ?", Options = { "6", "7", "8", "9" }, Correct = 2 },
					{ Text = "5 + 5 = ?", Options = { "9", "10", "11", "12" }, Correct = 2 },
					{ Text = "8 + 2 = ?", Options = { "9", "10", "11", "12" }, Correct = 2 },
					{ Text = "6 + 6 = ?", Options = { "10", "11", "12", "13" }, Correct = 3 },
				},
			},
			{
				Id = "restas_basicas",
				Name = "Restas básicas",
				Grade = "1° Primaria",
				VideoId = "",
				PassScore = 0.7,
				Questions = {
					{ Text = "9 - 4 = ?", Options = { "4", "5", "6", "7" }, Correct = 2 },
					{ Text = "10 - 3 = ?", Options = { "6", "7", "8", "9" }, Correct = 2 },
					{ Text = "8 - 5 = ?", Options = { "2", "3", "4", "5" }, Correct = 2 },
					{ Text = "12 - 6 = ?", Options = { "4", "5", "6", "7" }, Correct = 3 },
				},
			},
			{
				Id = "sumas_llevando",
				Name = "Sumas con llevada (2 cifras)",
				Grade = "2° Primaria",
				VideoId = "",
				PassScore = 0.7,
				Questions = {
					{ Text = "27 + 15 = ?", Options = { "32", "42", "40", "41" }, Correct = 2 },
					{ Text = "38 + 26 = ?", Options = { "54", "64", "62", "60" }, Correct = 2 },
					{ Text = "49 + 37 = ?", Options = { "76", "86", "84", "80" }, Correct = 2 },
					{ Text = "56 + 28 = ?", Options = { "74", "84", "82", "80" }, Correct = 2 },
				},
			},
			{
				Id = "restas_prestando",
				Name = "Restas con préstamo (2 cifras)",
				Grade = "2° Primaria",
				VideoId = "",
				PassScore = 0.7,
				Questions = {
					{ Text = "52 - 27 = ?", Options = { "15", "25", "35", "24" }, Correct = 2 },
					{ Text = "81 - 47 = ?", Options = { "34", "44", "24", "36" }, Correct = 1 },
					{ Text = "63 - 38 = ?", Options = { "15", "25", "35", "23" }, Correct = 2 },
					{ Text = "90 - 56 = ?", Options = { "34", "44", "24", "36" }, Correct = 1 },
				},
			},
			{
				Id = "tablas_2_5_10",
				Name = "Tablas de multiplicar 2, 5 y 10",
				Grade = "2° Primaria",
				VideoId = "",
				PassScore = 0.75,
				Questions = {
					{ Text = "2 x 6 = ?", Options = { "10", "12", "14", "16" }, Correct = 2 },
					{ Text = "5 x 7 = ?", Options = { "30", "35", "40", "45" }, Correct = 2 },
					{ Text = "10 x 8 = ?", Options = { "70", "80", "90", "100" }, Correct = 2 },
					{ Text = "5 x 9 = ?", Options = { "40", "45", "50", "55" }, Correct = 2 },
				},
			},
			{
				Id = "tablas_completas",
				Name = "Tablas de multiplicar del 1 al 10",
				Grade = "3° Primaria",
				VideoId = "",
				PassScore = 0.75,
				Questions = {
					{ Text = "7 x 8 = ?", Options = { "54", "56", "58", "64" }, Correct = 2 },
					{ Text = "9 x 6 = ?", Options = { "52", "54", "56", "58" }, Correct = 2 },
					{ Text = "8 x 8 = ?", Options = { "56", "60", "64", "72" }, Correct = 3 },
					{ Text = "9 x 9 = ?", Options = { "72", "81", "83", "90" }, Correct = 2 },
				},
			},
			{
				Id = "tablas_salteadas",
				Name = "Tablas salteadas (contar de 3 en 3, de 7 en 7, etc.)",
				Grade = "3° Primaria",
				VideoId = "",
				PassScore = 0.75,
				Questions = {
					{ Text = "Contando de 3 en 3: 3, 6, 9, __, 15", Options = { "10", "11", "12", "13" }, Correct = 3 },
					{ Text = "Contando de 7 en 7: 7, 14, 21, __, 35", Options = { "26", "27", "28", "29" }, Correct = 3 },
					{ Text = "Contando de 9 en 9: 9, 18, 27, __, 45", Options = { "34", "35", "36", "37" }, Correct = 3 },
					{ Text = "Contando de 6 en 6: 6, 12, 18, __, 30", Options = { "22", "23", "24", "25" }, Correct = 3 },
				},
			},
			{
				Id = "multiplicacion_2digitos",
				Name = "Multiplicación de 2 cifras",
				Grade = "3° Primaria",
				VideoId = "",
				PassScore = 0.7,
				Questions = {
					{ Text = "23 x 12 = ?", Options = { "246", "266", "276", "286" }, Correct = 3 },
					{ Text = "34 x 15 = ?", Options = { "480", "500", "510", "520" }, Correct = 3 },
					{ Text = "27 x 14 = ?", Options = { "358", "368", "378", "388" }, Correct = 3 },
					{ Text = "18 x 24 = ?", Options = { "412", "422", "432", "442" }, Correct = 3 },
				},
			},
			{
				Id = "division_basica",
				Name = "División exacta",
				Grade = "3° Primaria",
				VideoId = "",
				PassScore = 0.7,
				Questions = {
					{ Text = "48 ÷ 6 = ?", Options = { "6", "7", "8", "9" }, Correct = 3 },
					{ Text = "72 ÷ 9 = ?", Options = { "6", "7", "8", "9" }, Correct = 3 },
					{ Text = "81 ÷ 9 = ?", Options = { "7", "8", "9", "10" }, Correct = 3 },
					{ Text = "56 ÷ 7 = ?", Options = { "6", "7", "8", "9" }, Correct = 3 },
				},
			},
			{
				Id = "fracciones_basicas",
				Name = "Fracciones básicas",
				Grade = "4° Primaria",
				VideoId = "",
				PassScore = 0.7,
				Questions = {
					{ Text = "¿Cuál fracción representa la mitad?", Options = { "1/3", "1/2", "1/4", "2/3" }, Correct = 2 },
					{ Text = "1/2 + 1/4 = ?", Options = { "2/6", "2/4", "3/4", "1/4" }, Correct = 3 },
					{ Text = "¿Cuál es mayor: 1/3 o 1/4?", Options = { "1/3", "1/4", "Son iguales", "No se puede saber" }, Correct = 1 },
					{ Text = "3/4 - 1/4 = ?", Options = { "1/2", "2/4", "1/4", "1"}, Correct = 1 },
				},
			},
		},
	},
	{
		Id = "espanol",
		Name = "Español",
		Icon = "📖",
		Diagnostic = false,
		Levels = {
			{
				Id = "vocales_silabas",
				Name = "Vocales y sílabas",
				Grade = "1° Primaria",
				VideoId = "",
				PassScore = 0.7,
				Questions = {
					{ Text = "¿Cuántas sílabas tiene 'mesa'?", Options = { "1", "2", "3", "4" }, Correct = 2 },
					{ Text = "¿Cuál palabra empieza con vocal?", Options = { "Casa", "Oso", "Perro", "Mesa" }, Correct = 2 },
					{ Text = "¿Cuántas vocales tiene el abecedario?", Options = { "3", "4", "5", "6" }, Correct = 3 },
				},
			},
			{
				Id = "sustantivos_adjetivos",
				Name = "Sustantivos y adjetivos",
				Grade = "2° Primaria",
				VideoId = "",
				PassScore = 0.7,
				Questions = {
					{ Text = "En 'el perro grande', ¿cuál palabra es el adjetivo?", Options = { "El", "Perro", "Grande", "Ninguna" }, Correct = 3 },
					{ Text = "¿Cuál de estas palabras es un sustantivo?", Options = { "Correr", "Bonito", "Escuela", "Rápido" }, Correct = 3 },
				},
			},
			{
				Id = "comprension_lectora_1",
				Name = "Comprensión lectora I",
				Grade = "3° Primaria",
				VideoId = "",
				PassScore = 0.7,
				Questions = {
					{ Text = "Un texto que cuenta una historia con personajes se llama...", Options = { "Receta", "Cuento", "Anuncio", "Instructivo" }, Correct = 2 },
				},
			},
		},
	},
	{
		Id = "ciencias_naturales",
		Name = "Ciencias Naturales",
		Icon = "🔬",
		Diagnostic = false,
		Levels = {
			{
				Id = "seres_vivos",
				Name = "Los seres vivos",
				Grade = "1° Primaria",
				VideoId = "",
				PassScore = 0.7,
				Questions = {
					{ Text = "¿Cuál de estos es un ser vivo?", Options = { "Piedra", "Árbol", "Silla", "Nube" }, Correct = 2 },
					{ Text = "Los seres vivos nacen, crecen, se reproducen y...", Options = { "Vuelan", "Mueren", "Nadan", "Cantan" }, Correct = 2 },
				},
			},
			{
				Id = "estados_de_la_materia",
				Name = "Estados de la materia",
				Grade = "3° Primaria",
				VideoId = "",
				PassScore = 0.7,
				Questions = {
					{ Text = "El agua en forma de hielo está en estado...", Options = { "Líquido", "Sólido", "Gaseoso", "Plasma" }, Correct = 2 },
					{ Text = "Cuando el agua hierve y se convierte en vapor, cambia a estado...", Options = { "Sólido", "Líquido", "Gaseoso", "Congelado" }, Correct = 3 },
				},
			},
		},
	},
	{
		Id = "ingles",
		Name = "English",
		Icon = "🇬🇧",
		Diagnostic = false,
		Levels = {
			{
				Id = "colors_numbers",
				Name = "Colors & Numbers",
				Grade = "1° Primaria",
				VideoId = "",
				PassScore = 0.7,
				Questions = {
					{ Text = "How do you say 'rojo' in English?", Options = { "Blue", "Red", "Green", "Yellow" }, Correct = 2 },
					{ Text = "What number is 'seven'?", Options = { "5", "6", "7", "8" }, Correct = 3 },
				},
			},
			{
				Id = "greetings",
				Name = "Greetings",
				Grade = "2° Primaria",
				VideoId = "",
				PassScore = 0.7,
				Questions = {
					{ Text = "¿Cómo se dice 'buenos días'?", Options = { "Good night", "Good morning", "Good bye", "Good luck" }, Correct = 2 },
				},
			},
		},
	},
}

--[[
	Plantilla para agregar Secundaria / Preparatoria / Universidad:
	Copia el bloque de una materia, cambia Id, Name, Icon, y agrega sus Levels con el
	Grade correspondiente, por ejemplo Grade = "1° Secundaria", "3° Preparatoria",
	"Universidad - Cálculo I", etc. El motor de niveles, exámenes y (para Matemáticas)
	el diagnóstico funcionan igual sin importar cuántas materias o niveles agregues.
]]

return {
	Subjects = Subjects,
}

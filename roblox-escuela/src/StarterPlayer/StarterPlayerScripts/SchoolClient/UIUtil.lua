--[[
	UIUtil.lua
	Pequeños helpers para no repetir código al construir la interfaz por script.
]]

local UIUtil = {}

function UIUtil.New(className, props)
	local instance = Instance.new(className)
	for key, value in pairs(props or {}) do
		if key ~= "Children" then
			instance[key] = value
		end
	end
	if props and props.Children then
		for _, child in ipairs(props.Children) do
			child.Parent = instance
		end
	end
	return instance
end

function UIUtil.Round(instance, radius)
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, radius or 12)
	corner.Parent = instance
	return corner
end

function UIUtil.Padding(instance, amount)
	local padding = Instance.new("UIPadding")
	amount = amount or 12
	padding.PaddingTop = UDim.new(0, amount)
	padding.PaddingBottom = UDim.new(0, amount)
	padding.PaddingLeft = UDim.new(0, amount)
	padding.PaddingRight = UDim.new(0, amount)
	padding.Parent = instance
	return padding
end

function UIUtil.ListLayout(instance, gap, direction)
	local layout = Instance.new("UIListLayout")
	layout.Padding = UDim.new(0, gap or 8)
	layout.FillDirection = direction or Enum.FillDirection.Vertical
	layout.SortOrder = Enum.SortOrder.LayoutOrder
	layout.HorizontalAlignment = Enum.HorizontalAlignment.Center
	layout.Parent = instance
	return layout
end

function UIUtil.ClearChildren(instance)
	for _, child in ipairs(instance:GetChildren()) do
		if not child:IsA("UILayoutBase") and not child:IsA("UIPadding") then
			child:Destroy()
		end
	end
end

return UIUtil

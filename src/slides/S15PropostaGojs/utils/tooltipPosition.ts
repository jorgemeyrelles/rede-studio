type TooltipCalcInput = {
  iconX: number
  iconY: number
  containerWidth: number
  containerHeight: number
  tooltipWidth?: number
  tooltipHeight?: number
  preferredPlacement?: string
  triggerSize?: number
}

export function calculateTooltipPosition({
  iconX,
  iconY,
  containerWidth,
  containerHeight,
  tooltipWidth = 260,
  tooltipHeight = 140,
  preferredPlacement,
  triggerSize = 16,
}: TooltipCalcInput) {
  let left = iconX
  let top = iconY
  let placement = preferredPlacement || 'right'

  if (preferredPlacement === 'bottom') {
    left = iconX
    top = iconY + triggerSize

    if (iconY + tooltipHeight <= containerHeight) {
      top = iconY
    } else if (iconY - tooltipHeight >= 0) {
      top = iconY - tooltipHeight
    } else {
      top = Math.max(0, Math.min(iconY, containerHeight - tooltipHeight))
    }

    if (left + tooltipWidth > containerWidth) {
      left = Math.max(0, containerWidth - tooltipWidth)
    }

    return { left, top, placement }
  }

  if (iconX + triggerSize + tooltipWidth <= containerWidth) {
    left = iconX + triggerSize
    placement = 'right'
  } else if (iconX - tooltipWidth >= 0) {
    left = iconX - tooltipWidth
    placement = 'left'
  } else {
    left = Math.max(0, Math.min(iconX, containerWidth - tooltipWidth))
  }

  if (iconY + tooltipHeight <= containerHeight) {
    top = iconY
  } else if (iconY + triggerSize + tooltipHeight <= containerHeight) {
    top = iconY + triggerSize
    placement = placement === 'right' ? 'bottom-right' : 'bottom-left'
  } else if (iconY - tooltipHeight >= 0) {
    top = iconY - tooltipHeight
    placement = placement === 'right' ? 'top-right' : 'top-left'
  } else {
    top = Math.max(0, containerHeight - tooltipHeight)
  }

  return { left, top, placement }
}

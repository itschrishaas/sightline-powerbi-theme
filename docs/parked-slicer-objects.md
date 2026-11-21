# Parked: schema 2.159 slicer objects

Report theme schema 2.159 lists `selectionBox`, `dropdownButton`, `dropdownMenu`, `pills`, `search` and `selectedOnly` for `listSlicer` (plus `data.dropdownMode` as a `Dropdown` style), and `search` / `selectedOnly` for `advancedSlicerVisual`.

Power BI Desktop 2.159 renders these when they are set **on the visual**, but ignores them **from a theme** — with or without `"$id": "default"`, and even in a minimal theme that sets nothing else. The visual code takes these parts' defaults from the theme *palette* (`foregroundNeutralSecondary` and so on), not from `visualStyles`. They were therefore taken out of the theme.

To try again on a newer Desktop release: merge each block into the `"*"` style of its visual (and `Dropdown` next to `"*"` in `listSlicer`), rebuild, and first compare one property set on a test visual against the same property coming from the theme. The placeholder text `All` matches the classic dropdown.

```json
{
    "listSlicer": {
        "*": {
            "selectionBox": [
                {
                    "$id": "default",
                    "backgroundShow": true,
                    "backgroundColor": {
                        "solid": {
                            "color": "{{otherColors.white}}"
                        }
                    },
                    "backgroundTransparency": 0,
                    "borderShow": true,
                    "borderColor": {
                        "solid": {
                            "color": "{{borders.color}}"
                        }
                    },
                    "borderWidth": "{{borders.width}}",
                    "borderTransparency": 0,
                    "cornerRadius": "{{borders.corners}}",
                    "paddingUniform": 8,
                    "accentBarShow": false,
                    "fontFamily": "{{font.family}}",
                    "fontSize": "{{font.sizes.s}}",
                    "fontColor": {
                        "solid": {
                            "color": "{{otherColors.text}}"
                        }
                    },
                    "bold": false,
                    "placeholderText": "All"
                }
            ],
            "dropdownButton": [
                {
                    "$id": "default",
                    "position": "right",
                    "backgroundShow": false,
                    "iconShow": true,
                    "iconColor": {
                        "solid": {
                            "color": "{{otherColors.text_muted}}"
                        }
                    },
                    "iconSize": 12,
                    "iconTransparency": 0,
                    "horizontalGap": 8
                }
            ],
            "dropdownMenu": [
                {
                    "$id": "default",
                    "backgroundShow": true,
                    "backgroundColor": {
                        "solid": {
                            "color": "{{otherColors.white}}"
                        }
                    },
                    "backgroundTransparency": 0,
                    "borderShow": true,
                    "borderColor": {
                        "solid": {
                            "color": "{{borders.color}}"
                        }
                    },
                    "borderWidth": "{{borders.width}}",
                    "borderTransparency": 0,
                    "cornerRadius": "{{borders.corners}}",
                    "paddingUniform": 4,
                    "shadowShow": false,
                    "glowShow": false,
                    "maxHeight": 320
                }
            ],
            "pills": [
                {
                    "$id": "default",
                    "backgroundShow": true,
                    "backgroundColor": {
                        "solid": {
                            "color": "{{buttons.selected.background.color}}"
                        }
                    },
                    "backgroundTransparency": "{{buttons.selected.background.transparency}}",
                    "borderShow": false,
                    "cornerRadius": "{{borders.corners}}",
                    "paddingUniform": 4,
                    "fontFamily": "{{buttons.selected.value.fontFamily}}",
                    "fontSize": "{{font.sizes.xs}}",
                    "fontColor": {
                        "solid": {
                            "color": "{{buttons.selected.value.fontColor}}"
                        }
                    },
                    "bold": false,
                    "dismissColor": {
                        "solid": {
                            "color": "{{buttons.selected.value.fontColor}}"
                        }
                    },
                    "dismissSize": 10,
                    "dismissGap": 4,
                    "dismissPosition": "right",
                    "layoutDirection": "left"
                }
            ],
            "search": [
                {
                    "$id": "default",
                    "backgroundShow": true,
                    "backgroundColor": {
                        "solid": {
                            "color": "{{otherColors.white}}"
                        }
                    },
                    "backgroundTransparency": 0,
                    "borderShow": true,
                    "borderColor": {
                        "solid": {
                            "color": "{{borders.color}}"
                        }
                    },
                    "borderTransparency": 0,
                    "cornerRadius": "{{borders.corners}}",
                    "paddingUniform": 8,
                    "verticalGap": 4,
                    "accentBarShow": false,
                    "iconShow": true,
                    "iconColor": {
                        "solid": {
                            "color": "{{otherColors.text_muted}}"
                        }
                    },
                    "iconSize": 12,
                    "fontFamily": "{{font.family}}",
                    "fontSize": "{{font.sizes.s}}",
                    "fontColor": {
                        "solid": {
                            "color": "{{otherColors.text}}"
                        }
                    },
                    "bold": false
                }
            ],
            "selectedOnly": [
                {
                    "$id": "default",
                    "backgroundShow": true,
                    "backgroundColor": {
                        "solid": {
                            "color": "{{buttons.default.background.color}}"
                        }
                    },
                    "backgroundTransparency": "{{buttons.default.background.transparency}}",
                    "borderShow": true,
                    "borderColor": {
                        "solid": {
                            "color": "{{buttons.default.border.color}}"
                        }
                    },
                    "borderWidth": "{{buttons.default.border.width}}",
                    "cornerRadius": "{{borders.corners}}",
                    "paddingUniform": 4,
                    "buttonColor": {
                        "solid": {
                            "color": "{{dataColors.primary}}"
                        }
                    },
                    "fontFamily": "{{buttons.default.value.fontFamily}}",
                    "fontSize": "{{font.sizes.xs}}",
                    "fontColor": {
                        "solid": {
                            "color": "{{buttons.default.value.fontColor}}"
                        }
                    },
                    "bold": false
                }
            ]
        },
        "Dropdown": {
            "data": [
                {
                    "$id": "default",
                    "dropdownMode": true
                }
            ]
        }
    },
    "advancedSlicerVisual": {
        "*": {
            "search": [
                {
                    "$id": "default",
                    "backgroundShow": true,
                    "backgroundColor": {
                        "solid": {
                            "color": "{{otherColors.white}}"
                        }
                    },
                    "backgroundTransparency": 0,
                    "borderShow": true,
                    "borderColor": {
                        "solid": {
                            "color": "{{borders.color}}"
                        }
                    },
                    "borderTransparency": 0,
                    "cornerRadius": "{{borders.corners}}",
                    "paddingUniform": 8,
                    "verticalGap": 8,
                    "accentBarShow": false,
                    "iconShow": true,
                    "iconColor": {
                        "solid": {
                            "color": "{{otherColors.text_muted}}"
                        }
                    },
                    "iconSize": 12,
                    "fontFamily": "{{font.family}}",
                    "fontSize": "{{font.sizes.s}}",
                    "fontColor": {
                        "solid": {
                            "color": "{{otherColors.text}}"
                        }
                    },
                    "bold": false
                }
            ],
            "selectedOnly": [
                {
                    "$id": "default",
                    "backgroundShow": true,
                    "backgroundColor": {
                        "solid": {
                            "color": "{{buttons.default.background.color}}"
                        }
                    },
                    "backgroundTransparency": "{{buttons.default.background.transparency}}",
                    "borderShow": true,
                    "borderColor": {
                        "solid": {
                            "color": "{{buttons.default.border.color}}"
                        }
                    },
                    "borderWidth": "{{buttons.default.border.width}}",
                    "cornerRadius": "{{borders.corners}}",
                    "paddingUniform": 4,
                    "buttonColor": {
                        "solid": {
                            "color": "{{dataColors.primary}}"
                        }
                    },
                    "fontFamily": "{{buttons.default.value.fontFamily}}",
                    "fontSize": "{{font.sizes.xs}}",
                    "fontColor": {
                        "solid": {
                            "color": "{{buttons.default.value.fontColor}}"
                        }
                    },
                    "bold": false
                }
            ]
        }
    }
}
```
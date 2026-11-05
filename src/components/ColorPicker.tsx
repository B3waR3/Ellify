import { useState } from 'react'
import { NOTEBOOK_COLOR_ROWS, isValidHex, normalizeHex } from '../lib/colors'

type Props = {
  value: string
  onChange: (color: string) => void
}

export default function ColorPicker({ value, onChange }: Props) {
  const [hexInput, setHexInput] = useState(value)

  const applyHex = (raw: string) => {
    setHexInput(raw)
    const n = normalizeHex(raw)
    if (isValidHex(n)) onChange(n)
  }

  return (
    <div className="color-picker">
      <div className="color-grid">
        {NOTEBOOK_COLOR_ROWS.map((row, ri) => (
          <div key={ri} className="color-row">
            {row.map((c) => (
              <button
                key={c}
                type="button"
                className={`color-swatch ${value.toUpperCase() === c.toUpperCase() ? 'active' : ''}`}
                style={{ background: c }}
                onClick={() => {
                  onChange(c)
                  setHexInput(c)
                }}
                aria-label={c}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="hex-row">
        <label className="hex-label" htmlFor="hex-color">
          HEX
        </label>
        <input
          id="hex-color"
          className="hex-input"
          dir="ltr"
          value={hexInput}
          onChange={(e) => applyHex(e.target.value)}
          placeholder="#8757A7"
          maxLength={7}
        />
        <input
          type="color"
          className="hex-native"
          value={isValidHex(normalizeHex(value)) ? normalizeHex(value) : '#8757A7'}
          onChange={(e) => {
            const c = e.target.value.toUpperCase()
            onChange(c)
            setHexInput(c)
          }}
          aria-label="פלטת צבעים"
          title="פלטה"
        />
        <span className="color-preview" style={{ background: value }} />
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import {
  FaBold,
  FaItalic,
  FaUnderline,
  FaStrikethrough,
  FaListUl,
  FaListOl,
  FaAlignLeft,
  FaAlignCenter,
  FaAlignRight,
  FaAlignJustify
} from 'react-icons/fa6'
import { useLang } from '../i18n'

const SIZES = { small: '2', normal: '3', large: '5', xlarge: '7' }

// Editor de texto enriquecido tipo Word. Guarda el contenido como HTML.
export default function RichText({ value, onChange, placeholder }) {
  const { t } = useLang()
  const areaRef = useRef(null)
  const savedRange = useRef(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    if (areaRef.current && areaRef.current.innerHTML !== (value || '')) {
      areaRef.current.innerHTML = value || ''
    }
  }, [value])

  const saveRange = () => {
    const sel = window.getSelection()
    if (
      sel &&
      sel.rangeCount &&
      areaRef.current &&
      areaRef.current.contains(sel.anchorNode)
    ) {
      savedRange.current = sel.getRangeAt(0).cloneRange()
    } else {
      savedRange.current = null
    }
  }

  const restoreRange = () => {
    if (!savedRange.current) return
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(savedRange.current)
  }

  const sync = () => onChange?.(areaRef.current?.innerHTML || '')

  const exec = (cmd, arg) => {
    restoreRange()
    areaRef.current?.focus()
    document.execCommand(cmd, false, arg)
    sync()
    setTick((k) => k + 1)
  }

  const isActive = (cmd) => {
    try {
      return document.queryCommandState(cmd)
    } catch {
      return false
    }
  }

  const ToolBtn = ({ cmd, Icon, label }) => (
    <button
      type="button"
      className={`richtext-btn ${cmd && isActive(cmd) ? 'is-active' : ''}`}
      title={label}
      aria-label={label}
      onMouseDown={(e) => {
        e.preventDefault()
        saveRange()
      }}
      onClick={() => exec(cmd)}
    >
      <Icon />
    </button>
  )

  return (
    <div className="richtext">
      <div className="richtext-toolbar">
        <ToolBtn cmd="bold" Icon={FaBold} label={t('news.bold')} />
        <ToolBtn cmd="italic" Icon={FaItalic} label={t('news.italic')} />
        <ToolBtn cmd="underline" Icon={FaUnderline} label={t('news.underline')} />
        <ToolBtn cmd="strikeThrough" Icon={FaStrikethrough} label={t('news.strike')} />
        <span className="richtext-sep" />
        <ToolBtn cmd="insertUnorderedList" Icon={FaListUl} label={t('news.bulletList')} />
        <ToolBtn cmd="insertOrderedList" Icon={FaListOl} label={t('news.numberedList')} />
        <span className="richtext-sep" />
        <ToolBtn cmd="justifyLeft" Icon={FaAlignLeft} label={t('news.alignLeft')} />
        <ToolBtn cmd="justifyCenter" Icon={FaAlignCenter} label={t('news.alignCenter')} />
        <ToolBtn cmd="justifyRight" Icon={FaAlignRight} label={t('news.alignRight')} />
        <ToolBtn cmd="justifyFull" Icon={FaAlignJustify} label={t('news.alignJustify')} />
        <span className="richtext-sep" />
        <select
          className="richtext-size"
          title={t('news.size')}
          defaultValue="normal"
          onMouseDown={saveRange}
          onChange={(e) => exec('fontSize', SIZES[e.target.value])}
        >
          <option value="small">{t('news.sizeSmall')}</option>
          <option value="normal">{t('news.sizeNormal')}</option>
          <option value="large">{t('news.sizeLarge')}</option>
          <option value="xlarge">{t('news.sizeXLarge')}</option>
        </select>
      </div>
      <div
        ref={areaRef}
        className="richtext-area"
        data-placeholder={placeholder}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
      />
    </div>
  )
}
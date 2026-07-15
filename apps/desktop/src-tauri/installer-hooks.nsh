; NSIS installer hooks (tauri.conf.json > bundle.windows.nsis.installerHooks).
;
; Registers the Explorer context-menu entry "Resolver conflito com MergeScope"
; for all file types, under HKCU to match installMode "currentUser". Windows
; static context-menu entries cannot inspect file contents, so the entry is
; always shown; MergeScope itself checks for conflict markers on launch and
; falls back to the settings-only mode when the file has none.

!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr HKCU "Software\Classes\*\shell\MergeScope" "" "Resolver conflito com MergeScope"
  WriteRegStr HKCU "Software\Classes\*\shell\MergeScope" "Icon" "$INSTDIR\${MAINBINARYNAME}.exe"
  WriteRegStr HKCU "Software\Classes\*\shell\MergeScope\command" "" '"$INSTDIR\${MAINBINARYNAME}.exe" --file "%1"'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey HKCU "Software\Classes\*\shell\MergeScope"
!macroend

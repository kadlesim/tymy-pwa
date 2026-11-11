// Team files. The Tymy REST API does not expose the file storage (the legacy app
// renders that page on the server), so this screen explains the situation and links
// to the legacy file browser instead of pretending to list something.

import { ICONS } from '../../lib/icons'
import { tr } from '../../lib/i18n'

const legacyFilesUrl = import.meta.env.DEV ? 'https://dev.tymy.cz/file' : '/file'

export default function FilesPage() {
  return (
    <div class="files-page max-w-2xl mx-auto">
      <h1 class="text-xl font-semibold text-text mb-4">{tr('Soubory')}</h1>

      <div class="bg-elevated rounded-xl border border-border p-6 text-center">
        <span class="icon icon-lg text-muted mb-3" innerHTML={ICONS['files']} aria-hidden="true" />
        <h2 class="text-lg font-medium text-text mb-1">
          {tr('Soubory jsou dostupné v původní aplikaci')}
        </h2>
        <p class="text-sm text-muted mb-4 max-w-md mx-auto">
          {tr('REST API zatím úložiště souborů nevystavuje – seznam souborů a složek generuje serverová část původní aplikace. Pro nahrávání a stahování souborů použijte webovou aplikaci.')}
        </p>
        <a
          class="btn btn-secondary"
          href={legacyFilesUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="icon-sm" innerHTML={ICONS['files']} />
          {tr('Otevřít soubory')}
        </a>
        <p class="text-xs text-muted mt-4">
          {tr('Jakmile API přinese seznam souborů, tahle stránka se napojí na něj.')}
        </p>
      </div>
    </div>
  )
}

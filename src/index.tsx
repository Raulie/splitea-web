/* @refresh reload */
import { render } from 'solid-js/web'
import './index.css'
import App from './App.tsx'
import { applyDocumentLanguage } from './lib/i18n'

// Runs before the first render so `:lang()` font selection is already
// in place for the initial paint, rather than restyling a frame later.
applyDocumentLanguage()

const root = document.getElementById('root')

render(() => <App />, root!)

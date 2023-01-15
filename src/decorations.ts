import * as vscode from 'vscode'
import * as constants from './constants'

export const useDecoration = (editor: vscode.TextEditor) => {
    const setColorToSelection = (color: string, selection: vscode.Selection) => {
        const decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: color,
            isWholeLine: true,
        })
        editor.setDecorations(decorationType, [selection])
        return decorationType
    }

    const animateLines = (selection: vscode.Selection) => {
        let alpha = 0.2
        let direction = 1
        let lastDecorationType: vscode.TextEditorDecorationType | undefined
        let usedSelection = selection
        const interval = setInterval(() => {
            const easeInOutCubic = (t: number): number => {
                t /= 0.5
                if ((t) < 1) {
                    return 0.5 * t * t * t
                }
                return 0.5 * ((t -= 2) * t * t + 2)
            }
            const decoration = setColorToSelection(`rgba(${constants.LineBackgroundColor}, ${easeInOutCubic(alpha)})`, usedSelection)
            if (lastDecorationType) {
                lastDecorationType.dispose()
            }
            lastDecorationType = decoration
            alpha += 0.004 * direction
            if (alpha >= 0.5) {
                direction = -1
            }
            if (alpha <= 0.2) {
                direction = 1
            }
        }, 10)

        const stop = () => {
            clearInterval(interval)
            if (lastDecorationType) {
                lastDecorationType.dispose()
            }
        }

        const updateSelection = (newSelection: vscode.Selection) => {
            usedSelection = newSelection
        }

        return { stop, updateSelection }
    }

    const setLineToLoading = (context: vscode.ExtensionContext, selection: vscode.Selection, message: string) => {
        const gutterIcon = context.asAbsolutePath('./src/loading.svg')
        const loadingIcon = vscode.window.createTextEditorDecorationType({
            gutterIconPath: gutterIcon,
            gutterIconSize: 'contain',
            isWholeLine: true,
            after: {
                contentText: message,
                fontStyle: 'italic',
                margin: '0 0 0 32px',
            },
            light: {
                after: {
                    color: '#123b63',
                },
            },
            dark: {
                after: {
                    color: '#c0c0c0',
                },
            },
        })
        // Apply to the first line of the selection
        const firstLine = new vscode.Range(selection.start.line, 0, selection.start.line, 0)
        editor.setDecorations(loadingIcon, [firstLine])

        const stop = () => {
            loadingIcon.dispose()
        }

        return stop
    }

    const setLineToError = (selection: vscode.Selection, message: string) => {
        const errorDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 0, 0, 0.1)',
            isWholeLine: true,
            after: {
                contentText: message,
                color: 'rgba(255, 0, 0, 0.8)',
                fontStyle: 'italic',
                margin: '0 0 0 32px',
            },
        })
        const firstLine = new vscode.Range(selection.start.line, 0, selection.start.line, 0)
        // Apply to the first line of the selection
        editor.setDecorations(errorDecorationType, [firstLine])
        setTimeout(() => {
            if (errorDecorationType) {
                errorDecorationType.dispose()
            }
        }, 2000)
    }

    return {
        setLineToLoading,
        setLineToError,
        setColorToSelection,
        animateLines,
    }
}

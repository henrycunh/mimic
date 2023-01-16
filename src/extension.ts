import * as vscode from 'vscode'
import { AxiosError } from 'axios'
import { getCurrentFileLanguage } from './language'
import { createOpenAIClient } from './openai'
import { showAPIAuthError } from './interactions'
import { useDecoration } from './decorations'

const getApiKey = (): string | undefined => vscode.workspace.getConfiguration('mimic').get('apiKey')

const checkForAPIKey = () => {
    const apiKey = getApiKey()
    if (!apiKey) {
        // Show error message with a button that opens the settings
        showAPIAuthError('No OpenAI API key found. Please enter your OpenAI API key in the settings.')
    }
    return apiKey
}

const getSelection = (editor: vscode.TextEditor) => ({
    selection: editor.selection,
    selectedText: editor.document.getText(editor.selection),
})

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('mimic.convertTextToCode', async () => {
        const apiKey = getApiKey()
        if (!apiKey || !checkForAPIKey()) {
            return
        }

        // Get the active text editor
        const editor = vscode.window.activeTextEditor
        if (!editor) {
            // Show an error message if there is no active text editor
            vscode.window.showErrorMessage('No active text editor')
            return
        }

        // Get the selected text
        const { selection: originalSelection, selectedText } = getSelection(editor)
        let selection = originalSelection
        const editorFullText = editor.document.getText()

        // Show an error message if there is no selected text
        if (!selectedText) {
            vscode.window.showErrorMessage('No selected text')
            return
        }

        const language = getCurrentFileLanguage()

        // Create a new client
        const { getCodeCompletion } = createOpenAIClient(apiKey)

        // Animate lines while the code is being generated
        const { animateLines, setLineToLoading, setLineToError } = useDecoration(editor)
        const {
            stop: stopLinesAnimation,
            updateSelection: updateLinesAnimationSelection,
        } = animateLines(selection)

        // Add loading gutter icon
        const stopLineLoadingState = setLineToLoading(
            context,
            selection,
            `Converting text to ${language}...`,
        )

        try {
            let changes = 0
            const code = await getCodeCompletion(
                editorFullText,
                selectedText,
                language as string,
                ({ response: code }) => {
                    // Original cursor position at the start of the selection - 1
                    const originalCursorPosition = editor.document.positionAt(
                        editor.document.offsetAt(selection.start),
                    )
                    // Cursor position at the end of the generated code
                    // this includes line breaks
                    const cursorPosition = editor.document.positionAt(
                        editor.document.offsetAt(originalSelection.start)
                        + code.length,
                    )

                    if (changes++ % 4 === 0) {
                        // Replace the selected text with the generated code
                        editor.edit((editBuilder) => {
                            editBuilder.replace(selection, code)
                        })
                    }
                    // Set the selection to the generated code
                    selection = new vscode.Selection(originalCursorPosition, cursorPosition)
                    // Update the lines animation
                    updateLinesAnimationSelection(selection)
                },
            )
            console.log(code)
            // Insert the code
            editor.edit((editBuilder) => {
                editBuilder.replace(selection, code)
            })
        }
        catch (error: any) {
            if (error instanceof AxiosError) {
                if (error.response?.status === 401) {
                    setLineToError(selection, 'Invalid API key.')
                    // Show an error message if the API key is invalid
                    showAPIAuthError('Invalid API key. Please enter a valid API key in the settings.')
                    return
                }
                if (error.message === 'API_TIMEOUT') {
                    setLineToError(selection, 'API timed out. Please try again later.')
                    // Show an error message if the API timed out
                    vscode.window.showErrorMessage('API timed out. Please try again later.')
                    return
                }
                const errorDetails = error.response?.data ? JSON.stringify(error.response.data) : error.message
                vscode.window.showErrorMessage(`Error while converting text:\n${errorDetails}`)
            }
            if (error.message === 'CODE_NOT_REPLACED') {
                setLineToError(selection, 'Code could not replaced. Please try again.')
            }
            return
        }
        finally {
            stopLinesAnimation()
            stopLineLoadingState()
        }
    })
    context.subscriptions.push(disposable)
}

// This method is called when your extension is deactivated
export function deactivate() {}

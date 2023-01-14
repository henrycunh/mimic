import * as vscode from 'vscode'

export const showAPIAuthError = (error: string) => {
    vscode.window.showErrorMessage(
        error,
        'Open Settings',
        'Input API Key',
    ).then((selection) => {
        if (selection === 'Open Settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'mimic.apiKey')
        }
        if (selection === 'Input API Key') {
            vscode.window.showInputBox({
                placeHolder: 'Enter your API key',
                validateInput: (value) => {
                    if (!value) {
                        return 'Please enter a valid API key'
                    }
                    return null
                },
            }).then((value) => {
                if (value) {
                    vscode.workspace.getConfiguration('mimic').update('apiKey', value, true)
                }
            })
        }
    })
}
